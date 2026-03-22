import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { createHmac, timingSafeEqual } from 'https://deno.land/std@0.168.0/node/crypto.ts'
import { enforceRateLimit, getClientIp } from '../_shared/rateLimit.ts'
import { getPlanCredits } from '../_shared/planConfig.ts'

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const STRIPE_SECRET_KEY = getRequiredEnv('STRIPE_SECRET_KEY')
const SUPABASE_URL = getRequiredEnv('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const STRIPE_WEBHOOK_SECRET = getRequiredEnv('STRIPE_WEBHOOK_SECRET')
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300

// Helper function to make Stripe API calls using fetch
async function stripeRequest(endpoint: string, method: string, params?: Record<string, string>) {
  const url = `https://api.stripe.com/v1${endpoint}`
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  let body = ''
  if (params) {
    body = new URLSearchParams(params).toString()
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method !== 'GET' ? body : undefined,
  })

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Stripe API error')
  }

  return data
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    const byte = Number.parseInt(hex.slice(i, i + 2), 16)
    if (Number.isNaN(byte)) return null
    bytes[i / 2] = byte
  }
  return bytes
}

function timingSafeHexCompare(aHex: string, bHex: string): boolean {
  const a = hexToBytes(aHex)
  const b = hexToBytes(bHex)
  if (!a || !b || a.length !== b.length) {
    return false
  }
  return timingSafeEqual(a, b)
}

// Verify Stripe webhook signature (timing-safe + timestamp tolerance)
function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const parts = signature.split(',').map((p) => p.trim())
    const timestampRaw = parts.find((p) => p.startsWith('t='))?.split('=')[1]
    const signatures = parts
      .filter((p) => p.startsWith('v1='))
      .map((p) => p.split('=')[1])
      .filter((v): v is string => !!v)
    
    if (!timestampRaw || signatures.length === 0) {
      return false
    }

    const timestamp = Number.parseInt(timestampRaw, 10)
    if (!Number.isFinite(timestamp)) {
      return false
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    if (Math.abs(nowSeconds - timestamp) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
      return false
    }

    const signedPayload = `${timestamp}.${payload}`
    const expectedSig = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')

    return signatures.some((sig) => timingSafeHexCompare(sig, expectedSig))
  } catch {
    return false
  }
}

type StripeWebhookEvent = {
  id: string
  type: string
  created?: number
  data: {
    object: Record<string, any>
    previous_attributes?: Record<string, any>
  }
}

async function registerWebhookEvent(
  supabase: ReturnType<typeof createClient>,
  event: StripeWebhookEvent,
): Promise<'new' | 'duplicate'> {
  const { error } = await supabase.from('stripe_webhook_events').insert({
    event_id: event.id,
    event_type: event.type,
    stripe_created_at: event.created ? new Date(event.created * 1000).toISOString() : null,
    status: 'processing',
    attempts: 1,
  })

  if (!error) {
    return 'new'
  }

  // 23505 = unique_violation, event already recorded (idempotency)
  if ((error as any).code === '23505') {
    const { data: existing } = await supabase
      .from('stripe_webhook_events')
      .select('status, attempts')
      .eq('event_id', event.id)
      .maybeSingle()

    if (existing?.status === 'processed' || existing?.status === 'processing') {
      return 'duplicate'
    }

    // Retry failed events
    await supabase
      .from('stripe_webhook_events')
      .update({
        status: 'processing',
        last_error: null,
        attempts: (existing?.attempts ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', event.id)

    return 'new'
  }

  throw error
}

async function markWebhookEventProcessed(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
): Promise<void> {
  await supabase
    .from('stripe_webhook_events')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
}

async function markWebhookEventFailed(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from('stripe_webhook_events')
    .update({
      status: 'failed',
      last_error: errorMessage.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
}

serve(async (req) => {
  const rateLimit = await enforceRateLimit({
    identifier: getClientIp(req),
    action: 'stripe-webhook',
    limit: 180,
    windowSeconds: 60,
  })

  if (!rateLimit.allowed) {
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: {
        'Content-Type': 'text/plain',
        'Retry-After': String(rateLimit.retryAfter),
      },
    })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  const body = await req.text()

  // Verify signature
  if (!verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET)) {
    console.error('Webhook signature verification failed')
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  let event: StripeWebhookEvent
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON payload', { status: 400 })
  }

  if (!event?.id || !event?.type) {
    return new Response('Invalid Stripe event payload', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const idempotencyResult = await registerWebhookEvent(supabase, event)
  if (idempotencyResult === 'duplicate') {
    console.log(`Duplicate webhook event ignored: ${event.id}`)
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  console.log(`Processing webhook event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.supabase_user_id
        const planId = session.metadata?.plan_id

        if (!userId || !planId) {
          console.error('Missing metadata in checkout session')
          break
        }

        // Get subscription details from Stripe
        const subscriptionId = session.subscription as string
        const subscription = await stripeRequest(`/subscriptions/${subscriptionId}`, 'GET')

        // Upsert subscription in database
        const { error: upsertError } = await supabase.from('subscriptions').upsert({
          user_id: userId,
          plan: planId,
          status: 'active',
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: subscription.items.data[0]?.price.id,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        }, { onConflict: 'user_id' })

        if (upsertError) {
          console.error('Error upserting subscription:', upsertError)
        }

        // Add credits for the plan
        const credits = getPlanCredits(planId)
        if (credits > 0) {
          const { error: creditsError } = await supabase.rpc('add_credits', {
            user_id: userId,
            amount: credits,
          })

          if (creditsError) {
            console.error('Error adding credits:', creditsError)
          }
        }

        // Send notification
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'subscription',
          title: 'Subscription Activated! 🎉',
          message: `Your ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan is now active. You received ${credits} credits!`,
        })

        console.log(`Subscription created for user ${userId}, plan ${planId}, credits: ${credits}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const userId = subscription.metadata?.supabase_user_id
        const previousAttributes = event.data.previous_attributes || {}

        let targetUserId = userId

        if (!userId) {
          // Try to find by stripe_subscription_id
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subscription.id)
            .maybeSingle()

          if (!sub) {
            console.error('User not found for subscription update')
            break
          }
          targetUserId = sub.user_id

          await supabase.from('subscriptions').update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          }).eq('stripe_subscription_id', subscription.id)
        } else {
          await supabase.from('subscriptions').update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          }).eq('user_id', userId)
        }

        // Notify user if cancellation was scheduled or reactivated
        if (targetUserId && previousAttributes.cancel_at_period_end !== undefined) {
          if (subscription.cancel_at_period_end && !previousAttributes.cancel_at_period_end) {
            // User scheduled cancellation
            const endDate = new Date(subscription.current_period_end * 1000)
            await supabase.from('notifications').insert({
              user_id: targetUserId,
              type: 'subscription',
              title: 'Subscription Cancellation Scheduled',
              message: `Your subscription will be canceled on ${endDate.toLocaleDateString()}. You can reactivate anytime before this date.`,
            })
          } else if (!subscription.cancel_at_period_end && previousAttributes.cancel_at_period_end) {
            // User reactivated subscription
            await supabase.from('notifications').insert({
              user_id: targetUserId,
              type: 'subscription',
              title: 'Subscription Reactivated! 🎉',
              message: 'Your subscription has been reactivated and will continue to renew automatically.',
            })
          }
        }

        console.log(`Subscription updated: ${subscription.id}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle()

        if (sub) {
          await supabase.from('subscriptions').update({
            status: 'canceled',
            cancel_at_period_end: false,
          }).eq('stripe_subscription_id', subscription.id)

          await supabase.from('notifications').insert({
            user_id: sub.user_id,
            type: 'subscription',
            title: 'Subscription Canceled',
            message: 'Your subscription has been canceled. Thank you for using Lumivids!',
          })
        }

        console.log(`Subscription deleted: ${subscription.id}`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object

        // Only process subscription renewals, not initial payments
        if (invoice.billing_reason === 'subscription_cycle') {
          const subscriptionId = invoice.subscription as string
          const subscription = await stripeRequest(`/subscriptions/${subscriptionId}`, 'GET')
          const planId = subscription.metadata?.plan_id

          const { data: sub } = await supabase
            .from('subscriptions')
            .select('user_id, plan')
            .eq('stripe_subscription_id', subscriptionId)
            .maybeSingle()

          if (sub) {
            const plan = planId || sub.plan
            const credits = getPlanCredits(plan)

            if (credits > 0) {
              await supabase.rpc('add_credits', {
                user_id: sub.user_id,
                amount: credits,
              })

              await supabase.from('notifications').insert({
                user_id: sub.user_id,
                type: 'subscription',
                title: 'Credits Added! 💰',
                message: `Your subscription renewed! ${credits} credits have been added to your account.`,
              })
            }
          }
        }

        console.log(`Invoice paid: ${invoice.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subscriptionId = invoice.subscription as string

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle()

        if (sub) {
          await supabase.from('subscriptions').update({
            status: 'past_due',
          }).eq('user_id', sub.user_id)

          await supabase.from('notifications').insert({
            user_id: sub.user_id,
            type: 'subscription',
            title: 'Payment Failed ⚠️',
            message: 'Your subscription payment failed. Please update your payment method.',
          })
        }

        console.log(`Invoice payment failed: ${invoice.id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    await markWebhookEventProcessed(supabase, event.id)
  } catch (err) {
    console.error('Error processing webhook:', err)
    await markWebhookEventFailed(supabase, event.id, err instanceof Error ? err.message : 'Unknown error')
    return new Response(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown'}`, { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})

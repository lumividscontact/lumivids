import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''

async function stripeRequest(endpoint: string, method: string, params?: Record<string, string>) {
  const url = `https://api.stripe.com/v1${endpoint}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
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

async function cancelStripeSubscriptions(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, stripe_customer_id, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (!subscription) {
    return
  }

  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured. Cannot safely delete account with active subscription.')
  }

  const idsToCancel = new Set<string>()

  if (subscription.stripe_subscription_id) {
    idsToCancel.add(subscription.stripe_subscription_id)
  }

  // Fallback: if we only have customer id, list subscriptions and cancel non-canceled ones
  if (!subscription.stripe_subscription_id && subscription.stripe_customer_id) {
    const listed = await stripeRequest(
      `/subscriptions?customer=${encodeURIComponent(subscription.stripe_customer_id)}&status=all&limit=100`,
      'GET',
    )

    const activeSubscriptions = Array.isArray(listed?.data)
      ? listed.data.filter((s: any) => s?.id && s.status !== 'canceled' && s.status !== 'incomplete_expired')
      : []

    activeSubscriptions.forEach((s: any) => idsToCancel.add(String(s.id)))
  }

  for (const stripeSubscriptionId of idsToCancel) {
    try {
      await stripeRequest(`/subscriptions/${stripeSubscriptionId}`, 'DELETE')
      console.log(`[Delete Account] Canceled Stripe subscription ${stripeSubscriptionId} for user ${userId}`)
    } catch (err) {
      // If already canceled/not found, continue safely
      const message = err instanceof Error ? err.message : 'Unknown Stripe cancel error'
      if (message.toLowerCase().includes('no such subscription')) {
        console.warn(`[Delete Account] Stripe subscription already removed: ${stripeSubscriptionId}`)
        continue
      }
      throw err
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-supabase-auth')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : authHeader
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rateLimit = await enforceRateLimit({
      identifier: user.id,
      action: 'delete-account',
      limit: 5,
      windowSeconds: 60,
    })

    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfter),
        },
      })
    }

    // Cancel Stripe subscription(s) before deleting user to avoid continued billing
    await cancelStripeSubscriptions(supabase, user.id)

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Delete account error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

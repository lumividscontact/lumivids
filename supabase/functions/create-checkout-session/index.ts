import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { getPlanCredits } from '../_shared/planConfig.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Price IDs for each plan (configure in Stripe Dashboard)
const PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  creator: {
    monthly: Deno.env.get('STRIPE_PRICE_CREATOR_MONTHLY') || '',
    annual: Deno.env.get('STRIPE_PRICE_CREATOR_ANNUAL') || '',
  },
  studio: {
    monthly: Deno.env.get('STRIPE_PRICE_STUDIO_MONTHLY') || '',
    annual: Deno.env.get('STRIPE_PRICE_STUDIO_ANNUAL') || '',
  },
  director: {
    monthly: Deno.env.get('STRIPE_PRICE_DIRECTOR_MONTHLY') || '',
    annual: Deno.env.get('STRIPE_PRICE_DIRECTOR_ANNUAL') || '',
  },
}

const PRICE_ENV_KEYS: Record<string, { monthly: string; annual: string }> = {
  creator: {
    monthly: 'STRIPE_PRICE_CREATOR_MONTHLY',
    annual: 'STRIPE_PRICE_CREATOR_ANNUAL',
  },
  studio: {
    monthly: 'STRIPE_PRICE_STUDIO_MONTHLY',
    annual: 'STRIPE_PRICE_STUDIO_ANNUAL',
  },
  director: {
    monthly: 'STRIPE_PRICE_DIRECTOR_MONTHLY',
    annual: 'STRIPE_PRICE_DIRECTOR_ANNUAL',
  },
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    const xSupabaseAuth = req.headers.get('x-supabase-auth')
    const finalAuthHeader = authHeader || xSupabaseAuth
    
    console.log('[Checkout] Auth headers received:', { 
      hasAuth: !!authHeader, 
      hasXSupabase: !!xSupabaseAuth 
    })
    
    if (!finalAuthHeader) {
      console.error('[Checkout] No auth header')
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract token
    const token = finalAuthHeader.startsWith('Bearer ') 
      ? finalAuthHeader.replace('Bearer ', '') 
      : finalAuthHeader

    // Use service role to validate the token
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Checkout] Auth error:', authError?.message || 'No user')
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rateLimit = await enforceRateLimit({
      identifier: user.id,
      action: 'create-checkout-session',
      limit: 10,
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

    console.log('[Checkout] User authenticated:', user.id)

    const { planId, billingPeriod = 'monthly', successUrl, cancelUrl } = await req.json()

    if (!planId || !PRICE_IDS[planId]) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (billingPeriod !== 'monthly' && billingPeriod !== 'annual') {
      return new Response(JSON.stringify({ error: 'Invalid billing period' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const priceId = PRICE_IDS[planId][billingPeriod]
    if (!priceId) {
      const missingSecret = PRICE_ENV_KEYS[planId]?.[billingPeriod]
      console.error('[Checkout] Missing Stripe price secret:', { planId, billingPeriod, missingSecret })
      return new Response(JSON.stringify({
        error: 'Price not configured for this plan and billing period',
        planId,
        billingPeriod,
        missingSecret,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user already has a Stripe customer
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let customerId = subscription?.stripe_customer_id

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripeRequest('/customers', 'POST', {
        email: user.email || '',
        'metadata[supabase_user_id]': user.id,
      })
      customerId = customer.id
    }

    const planCredits = getPlanCredits(planId)

    // Create checkout session
    const session = await stripeRequest('/checkout/sessions', 'POST', {
      customer: customerId,
      'payment_method_types[0]': 'card',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      mode: 'subscription',
      success_url: successUrl || `${Deno.env.get('APP_URL')}/pricing?success=true`,
      cancel_url: cancelUrl || `${Deno.env.get('APP_URL')}/pricing?canceled=true`,
      'subscription_data[metadata][supabase_user_id]': user.id,
      'subscription_data[metadata][plan_id]': planId,
      'subscription_data[metadata][plan_credits]': String(planCredits),
      'metadata[supabase_user_id]': user.id,
      'metadata[plan_id]': planId,
      'metadata[plan_credits]': String(planCredits),
    })

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('Checkout error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})


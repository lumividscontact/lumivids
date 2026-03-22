import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function stripeRequest(endpoint: string, method: string, params?: Record<string, string>) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  const body = params ? new URLSearchParams(params).toString() : undefined
  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers,
    body: method !== 'GET' ? body : undefined,
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.error?.message || 'Stripe API error')
  }

  return json
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-supabase-auth')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { paymentIntentId, chargeId, amount, reason = 'requested_by_customer' } = await req.json()

    let targetCharge = chargeId as string | undefined

    if (!targetCharge && paymentIntentId) {
      const paymentIntent = await stripeRequest(`/payment_intents/${paymentIntentId}`, 'GET')
      targetCharge = paymentIntent.latest_charge
    }

    if (!targetCharge) {
      return new Response(JSON.stringify({ error: 'Provide paymentIntentId or chargeId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const refundParams: Record<string, string> = {
      charge: targetCharge,
      reason,
    }

    if (amount && Number.isFinite(Number(amount)) && Number(amount) > 0) {
      refundParams.amount = String(amount)
    }

    const refund = await stripeRequest('/refunds', 'POST', refundParams)

    return new Response(JSON.stringify({ refundId: refund.id, status: refund.status }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

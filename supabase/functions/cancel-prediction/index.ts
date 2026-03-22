import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getReplicate } from '../_shared/replicate.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { getUserFromAuth, refundCredits, claimRefundableCredits } from '../_shared/credits.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function userOwnsPrediction(userId: string, predictionId: string): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Small retry window to handle race condition between frontend insert and quick cancel
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await supabase
      .from('generations')
      .select('id')
      .eq('user_id', userId)
      .eq('replicate_prediction_id', predictionId)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[Cancel Prediction] Ownership check error:', error)
      return false
    }

    if (data?.id) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return false
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authResult = await getUserFromAuth(req)
    if (authResult.error || !authResult.userId) {
      return new Response(JSON.stringify({ error: authResult.error || 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rateLimit = await enforceRateLimit({
      identifier: authResult.userId,
      action: 'cancel-prediction',
      limit: 30,
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

    const { id } = await req.json()

    if (!id) {
      return new Response(JSON.stringify({ error: 'Prediction ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const hasAccess = await userOwnsPrediction(authResult.userId, id)
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Prediction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const replicate = getReplicate()
    const prediction = await replicate.predictions.cancel(id)

    // Refund credits for canceled generation (atomic claim to avoid race conditions)
    try {
      const claimResult = await claimRefundableCredits(authResult.userId, id, 'canceled')
      if (claimResult.success && claimResult.amount > 0) {
        console.log(`[Cancel Prediction] Refunding ${claimResult.amount} credits to user ${authResult.userId}`)
        await refundCredits(authResult.userId, claimResult.amount, `Canceled generation: ${id}`)
      }
    } catch (refundErr) {
      console.error('[Cancel Prediction] Refund error:', refundErr)
      // Don't fail the cancel response even if refund fails
    }

    return new Response(JSON.stringify(prediction), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('Cancel prediction error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

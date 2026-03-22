import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req: Request) => {
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
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

    if (!token || token !== SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let staleAfterMinutes = 45
    let batchLimit = 100
    let rateLimitRetentionHours = 168
    let rateLimitCleanupBatch = 100000

    try {
      const body = await req.json()
      if (typeof body?.staleAfterMinutes === 'number' && Number.isFinite(body.staleAfterMinutes)) {
        staleAfterMinutes = Math.trunc(body.staleAfterMinutes)
      }
      if (typeof body?.batchLimit === 'number' && Number.isFinite(body.batchLimit)) {
        batchLimit = Math.trunc(body.batchLimit)
      }
      if (typeof body?.rateLimitRetentionHours === 'number' && Number.isFinite(body.rateLimitRetentionHours)) {
        rateLimitRetentionHours = Math.trunc(body.rateLimitRetentionHours)
      }
      if (typeof body?.rateLimitCleanupBatch === 'number' && Number.isFinite(body.rateLimitCleanupBatch)) {
        rateLimitCleanupBatch = Math.trunc(body.rateLimitCleanupBatch)
      }
    } catch {
      // Keep defaults when body is empty/invalid
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data, error } = await supabaseAdmin.rpc('cleanup_stale_generations', {
      p_stale_after_minutes: staleAfterMinutes,
      p_batch_limit: batchLimit,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rateLimitCleanupData, error: rateLimitCleanupError } = await supabaseAdmin.rpc('cleanup_edge_rate_limits', {
      p_older_than_hours: rateLimitRetentionHours,
      p_batch_limit: rateLimitCleanupBatch,
    })

    if (rateLimitCleanupError) {
      return new Response(JSON.stringify({ error: rateLimitCleanupError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const row = Array.isArray(data) ? data[0] : null

    return new Response(JSON.stringify({
      processed: Number(row?.processed_count ?? 0),
      refundedCredits: Number(row?.refunded_total ?? 0),
      staleAfterMinutes,
      batchLimit,
      edgeRateLimitsDeleted: Number(rateLimitCleanupData ?? 0),
      rateLimitRetentionHours,
      rateLimitCleanupBatch,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

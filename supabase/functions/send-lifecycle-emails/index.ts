/**
 * send-lifecycle-emails
 *
 * Cron-triggered edge function (call via Supabase pg_cron or external scheduler
 * every hour). Uses service-role bearer token for auth.
 *
 * Jobs:
 *  1. low_credits  — freemium users with credits ≤ 3, never emailed yet
 *  2. reengagement — users whose last succeeded generation was ≥ 7 days ago,
 *                    never emailed yet
 *
 * Both jobs send a Resend broadcast event that maps to an email template
 * in the Resend dashboard. The payload carries the user's first name,
 * last video thumbnail URL, and a direct link to /pricing.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY            = Deno.env.get('RESEND_API_KEY') || ''
const APP_URL                   = Deno.env.get('APP_URL') || 'https://lumivids.com'

// Resend event names — configure matching email templates in the Resend dashboard
const EVENT_LOW_CREDITS   = Deno.env.get('RESEND_LOW_CREDITS_EVENT')   || 'low_credits_upgrade'
const EVENT_REENGAGEMENT  = Deno.env.get('RESEND_REENGAGEMENT_EVENT')  || 'reengagement_7day'

// Max users to process per job per run (safety cap)
const BATCH_LIMIT = 50

// ─────────────────────────────────────────────
// Resend events helper
// ─────────────────────────────────────────────
async function sendResendEvent(params: {
  event: string
  email: string
  payload: Record<string, unknown>
}): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured')
  }

  const response = await fetch('https://api.resend.com/events/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event: params.event,
      email: params.email,
      payload: params.payload,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string; error?: string }
    throw new Error(body.message || body.error || `Resend error ${response.status}`)
  }
}

function firstName(displayName: string | null, email: string): string {
  const name = displayName || email.split('@')[0] || 'creator'
  return name.trim().split(/\s+/)[0]
}

// ─────────────────────────────────────────────
// Job 1 — Low credits (freemium, credits ≤ 3)
// ─────────────────────────────────────────────
async function runLowCreditsJob(supabase: ReturnType<typeof createClient>): Promise<{
  sent: number
  skipped: number
  errors: string[]
}> {
  const result = { sent: 0, skipped: 0, errors: [] as string[] }

  // Freemium users (no active subscription) with credits ≤ 3 and email not sent yet
  const { data: candidates, error } = await supabase
    .from('user_credits')
    .select(`
      user_id,
      credits,
      profiles!inner (
        email,
        display_name,
        low_credits_email_sent_at
      ),
      subscriptions (
        status,
        current_period_end
      )
    `)
    .lte('credits', 3)
    .gt('credits', -1)
    .is('profiles.low_credits_email_sent_at', null)
    .limit(BATCH_LIMIT)

  if (error) {
    result.errors.push(`low_credits query: ${error.message}`)
    return result
  }

  if (!candidates || candidates.length === 0) return result

  for (const row of candidates) {
    try {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles as {
        email: string | null
        display_name: string | null
        low_credits_email_sent_at: string | null
      } | null

      if (!profile?.email) { result.skipped++; continue }

      // Skip if user has an active paid subscription
      const subs = Array.isArray(row.subscriptions) ? row.subscriptions : (row.subscriptions ? [row.subscriptions] : []) as Array<{
        status: string
        current_period_end: string | null
      }>
      const hasActive = subs.some(
        (s) => s.status === 'active' && (!s.current_period_end || new Date(s.current_period_end) > new Date()),
      )
      if (hasActive) { result.skipped++; continue }

      // Get their last succeeded generation thumbnail
      const { data: lastGen } = await supabase
        .from('generations')
        .select('thumbnail_url, output_url, type, prompt')
        .eq('user_id', row.user_id)
        .eq('status', 'succeeded')
        .is('hidden_at', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const thumbnailUrl = lastGen?.thumbnail_url || lastGen?.output_url || null
      const generationType = lastGen?.type || 'video'
      const prompt = lastGen?.prompt || ''

      await sendResendEvent({
        event: EVENT_LOW_CREDITS,
        email: profile.email,
        payload: {
          first_name:      firstName(profile.display_name, profile.email),
          credits_left:    row.credits,
          thumbnail_url:   thumbnailUrl,
          generation_type: generationType,
          prompt:          prompt.slice(0, 120),
          pricing_url:     `${APP_URL}/pricing`,
          app_url:         APP_URL,
        },
      })

      // Mark as sent
      await supabase
        .from('profiles')
        .update({ low_credits_email_sent_at: new Date().toISOString() })
        .eq('user_id', row.user_id)
        .is('low_credits_email_sent_at', null)

      result.sent++
    } catch (err) {
      result.errors.push(`user ${row.user_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}

// ─────────────────────────────────────────────
// Job 2 — Re-engagement (inactive ≥ 7 days)
// ─────────────────────────────────────────────
async function runReengagementJob(supabase: ReturnType<typeof createClient>): Promise<{
  sent: number
  skipped: number
  errors: string[]
}> {
  const result = { sent: 0, skipped: 0, errors: [] as string[] }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Users whose last succeeded generation is older than 7 days and have not been
  // re-engaged yet. We use a subquery via Supabase's raw RPC to keep it readable.
  const { data: candidates, error } = await supabase.rpc('get_reengagement_candidates', {
    p_inactive_before: sevenDaysAgo,
    p_limit: BATCH_LIMIT,
  })

  if (error) {
    result.errors.push(`reengagement query: ${error.message}`)
    return result
  }

  if (!candidates || candidates.length === 0) return result

  for (const row of candidates as Array<{
    user_id: string
    email: string
    display_name: string | null
    last_generation_at: string
    thumbnail_url: string | null
    output_url: string | null
    generation_type: string | null
    prompt: string | null
  }>) {
    try {
      if (!row.email) { result.skipped++; continue }

      const thumbnailUrl = row.thumbnail_url || row.output_url || null

      await sendResendEvent({
        event: EVENT_REENGAGEMENT,
        email: row.email,
        payload: {
          first_name:           firstName(row.display_name, row.email),
          last_generation_at:   row.last_generation_at,
          thumbnail_url:        thumbnailUrl,
          generation_type:      row.generation_type || 'video',
          prompt:               (row.prompt || '').slice(0, 120),
          create_url:           `${APP_URL}/text-to-video`,
          app_url:              APP_URL,
        },
      })

      // Mark as sent
      await supabase
        .from('profiles')
        .update({ reengagement_email_sent_at: new Date().toISOString() })
        .eq('user_id', row.user_id)
        .is('reengagement_email_sent_at', null)

      result.sent++
    } catch (err) {
      result.errors.push(`user ${row.user_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────
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

  // Auth: service-role token only (for cron)
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (!token || token !== SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let jobs: string[] = ['low_credits', 'reengagement']
  try {
    const body = await req.json().catch(() => ({})) as { jobs?: string[] }
    if (Array.isArray(body.jobs) && body.jobs.length > 0) {
      jobs = body.jobs
    }
  } catch { /* use defaults */ }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const report: Record<string, unknown> = {}

  if (jobs.includes('low_credits')) {
    report.low_credits = await runLowCreditsJob(supabase)
  }

  if (jobs.includes('reengagement')) {
    report.reengagement = await runReengagementJob(supabase)
  }

  return new Response(JSON.stringify({ success: true, report }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

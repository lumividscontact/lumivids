import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const APP_URL = Deno.env.get('APP_URL') || 'https://lumivids.com'
const RESEND_WELCOME_EVENT = Deno.env.get('RESEND_WELCOME_EVENT') || 'welcome_email'

async function sendResendEvent(params: {
  event: string
  email: string
  payload?: Record<string, unknown>
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
      payload: params.payload ?? {},
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string; error?: string }
    throw new Error(payload.message || payload.error || 'Failed to send event via Resend')
  }
}

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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: authData, error: authError } = await supabase.auth.getUser(token)

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rateLimit = await enforceRateLimit({
      identifier: authData.user.id,
      action: 'send-welcome-email',
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, email, welcome_email_pending, welcome_email_sent_at')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (profile.welcome_email_sent_at) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'already-sent' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!profile.welcome_email_pending) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'not-pending' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const recipientEmail = profile.email || authData.user.email || ''
    if (!recipientEmail) {
      return new Response(JSON.stringify({ success: false, skipped: true, reason: 'missing-email' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const firstName = (profile.display_name || authData.user.user_metadata?.display_name || authData.user.user_metadata?.name || recipientEmail.split('@')[0] || 'creator')
      .trim()
      .split(/\s+/)[0]

    await sendResendEvent({
      event: RESEND_WELCOME_EVENT,
      email: recipientEmail,
      payload: {
        first_name: firstName,
        app_url: APP_URL,
        credits_bonus: 10,
      },
    })

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        welcome_email_pending: false,
        welcome_email_sent_at: new Date().toISOString(),
        welcome_email_event_name: RESEND_WELCOME_EVENT,
        welcome_email_last_status: 'triggered',
        welcome_email_last_error: null,
      })
      .eq('user_id', authData.user.id)
      .is('welcome_email_sent_at', null)

    if (updateError) {
      throw updateError
    }

    return new Response(JSON.stringify({ success: true, sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-welcome-email] Error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

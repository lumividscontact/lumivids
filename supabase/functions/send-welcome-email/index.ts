import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || ''
const APP_URL = Deno.env.get('APP_URL') || 'https://lumivids.com'

async function sendResendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured')
  }

  if (!RESEND_FROM_EMAIL) {
    throw new Error('RESEND_FROM_EMAIL not configured')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string; error?: string }
    throw new Error(payload.message || payload.error || 'Failed to send email via Resend')
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

    const subject = 'Welcome to Lumivids'
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
        <h1 style="margin:0 0 16px;font-size:28px;">Welcome to Lumivids, ${firstName}!</h1>
        <p style="margin:0 0 16px;">Your account is ready and you already have 10 bonus credits waiting for you.</p>
        <p style="margin:0 0 16px;">Start creating AI videos and images in minutes, explore the gallery for inspiration, and test your first workflow now.</p>
        <p style="margin:24px 0;">
          <a href="${APP_URL}/home" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;">Open Lumivids</a>
        </p>
        <p style="margin:0;color:#4b5563;">If you need help, just reply to this email.</p>
      </div>
    `
    const text = `Welcome to Lumivids, ${firstName}!\n\nYour account is ready and you already have 10 bonus credits waiting for you.\n\nStart here: ${APP_URL}/home\n`

    await sendResendEmail({
      to: recipientEmail,
      subject,
      html,
      text,
    })

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        welcome_email_pending: false,
        welcome_email_sent_at: new Date().toISOString(),
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

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

type ResendWebhookPayload = {
  type?: string
  created_at?: string
  data?: {
    email_id?: string
    to?: string[]
    subject?: string
    failed?: { reason?: string }
    bounce?: {
      message?: string
      subType?: string
      type?: string
      diagnosticCode?: string[]
    }
    tags?: Record<string, string>
  }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') || ''

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary)
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

async function verifySvixSignature(params: {
  payloadText: string
  svixId: string
  svixTimestamp: string
  svixSignature: string
  secret: string
}): Promise<boolean> {
  const timestamp = Number.parseInt(params.svixTimestamp, 10)
  if (!Number.isFinite(timestamp)) {
    return false
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - timestamp) > 300) {
    return false
  }

  const secretBase64 = params.secret.startsWith('whsec_')
    ? params.secret.slice(6)
    : params.secret

  let secretRaw: string
  try {
    secretRaw = atob(secretBase64)
  } catch {
    return false
  }

  const secretBytes = Uint8Array.from(secretRaw, (char) => char.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signedPayload = `${params.svixId}.${params.svixTimestamp}.${params.payloadText}`
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload)),
  )
  const expectedSignature = bytesToBase64(signatureBytes)

  const candidates = params.svixSignature
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1,'))
    .map((part) => part.slice(3))
    .filter((part) => part.length > 0)

  return candidates.some((candidate) => timingSafeEqualString(candidate, expectedSignature))
}

function getFirstRecipient(payload: ResendWebhookPayload): string | null {
  const to = payload.data?.to
  if (!to || to.length === 0) {
    return null
  }
  return to[0]?.trim().toLowerCase() || null
}

function getFailureReason(payload: ResendWebhookPayload): string | null {
  if (payload.type === 'email.failed') {
    return payload.data?.failed?.reason || 'unknown-failure'
  }

  if (payload.type === 'email.bounced') {
    const bounce = payload.data?.bounce
    const pieces = [bounce?.type, bounce?.subType, bounce?.message]
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => value.trim())

    return pieces.length > 0 ? pieces.join(' | ') : 'bounced'
  }

  return null
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

  if (!RESEND_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'RESEND_WEBHOOK_SECRET not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const payloadText = await req.text()
  const svixId = req.headers.get('svix-id') || ''
  const svixTimestamp = req.headers.get('svix-timestamp') || ''
  const svixSignature = req.headers.get('svix-signature') || ''

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response(JSON.stringify({ error: 'Missing Svix signature headers' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const isValidSignature = await verifySvixSignature({
    payloadText,
    svixId,
    svixTimestamp,
    svixSignature,
    secret: RESEND_WEBHOOK_SECRET,
  })

  if (!isValidSignature) {
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let payload: ResendWebhookPayload
  try {
    payload = JSON.parse(payloadText) as ResendWebhookPayload
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const eventType = payload.type || 'unknown'
  const trackableTypes = new Set(['email.sent', 'email.failed', 'email.bounced'])
  if (!trackableTypes.has(eventType)) {
    return new Response(JSON.stringify({ success: true, ignored: true, type: eventType }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const recipientEmail = getFirstRecipient(payload)
  if (!recipientEmail) {
    return new Response(JSON.stringify({ success: true, ignored: true, reason: 'missing-recipient' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .ilike('email', recipientEmail)
    .maybeSingle()

  if (profile?.user_id) {
    const failureReason = getFailureReason(payload)
    await supabase
      .from('profiles')
      .update({
        welcome_email_event_id: svixId,
        welcome_email_provider_email_id: payload.data?.email_id ?? null,
        welcome_email_last_status: eventType,
        welcome_email_last_error: failureReason,
        welcome_email_last_webhook_at: payload.created_at || new Date().toISOString(),
      })
      .eq('user_id', profile.user_id)

    if (eventType === 'email.failed' || eventType === 'email.bounced') {
      const { data: admins } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('role', 'admin')

      const adminRows = (admins || []).map((admin) => ({
        user_id: admin.user_id,
        type: 'system',
        title: `Welcome email ${eventType === 'email.failed' ? 'failed' : 'bounced'}`,
        message: `Failed to deliver welcome email to ${recipientEmail}. Reason: ${failureReason || 'not provided'}`,
        data: {
          source: 'resend-webhook',
          resend_event_type: eventType,
          resend_event_id: svixId,
          resend_email_id: payload.data?.email_id ?? null,
          recipient_email: recipientEmail,
          subject: payload.data?.subject ?? null,
          reason: failureReason,
        },
      }))

      if (adminRows.length > 0) {
        await supabase.from('notifications').insert(adminRows)
      }
    }
  }

  return new Response(JSON.stringify({ success: true, type: eventType }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
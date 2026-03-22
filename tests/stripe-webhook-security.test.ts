import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('stripe webhook hardening regression checks', () => {
  const webhookPath = join(process.cwd(), 'supabase', 'functions', 'stripe-webhook', 'index.ts')
  const schemaPath = join(process.cwd(), 'supabase', 'schema.sql')
  const webhookSource = readFileSync(webhookPath, 'utf8')
  const schema = readFileSync(schemaPath, 'utf8')

  it('uses timing-safe signature verification with timestamp tolerance', () => {
    expect(webhookSource).toContain('timingSafeEqual')
    expect(webhookSource).toContain('verifyStripeSignature(')
    expect(webhookSource).toContain('STRIPE_WEBHOOK_TOLERANCE_SECONDS')
    expect(webhookSource).toContain('createHmac(')
  })

  it('requires Stripe environment variables without insecure empty fallback', () => {
    expect(webhookSource).toContain("const STRIPE_SECRET_KEY = getRequiredEnv('STRIPE_SECRET_KEY')")
    expect(webhookSource).toContain("const STRIPE_WEBHOOK_SECRET = getRequiredEnv('STRIPE_WEBHOOK_SECRET')")
    expect(webhookSource).not.toContain("Deno.env.get('STRIPE_SECRET_KEY') || ''")
    expect(webhookSource).not.toContain("Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''")
  })

  it('persists webhook idempotency events in schema', () => {
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (')
    expect(schema).toContain('event_id TEXT PRIMARY KEY')
    expect(schema).toContain("status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed'))")
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production guardrails', () => {
  const storageSetup = readFileSync(join(process.cwd(), 'supabase', 'SETUP_STORAGE.sql'), 'utf8')
  const schema = readFileSync(join(process.cwd(), 'supabase', 'schema.sql'), 'utf8')
  const pricingPage = readFileSync(join(process.cwd(), 'src', 'pages', 'PricingPage.tsx'), 'utf8')
  const checkPredictionSource = readFileSync(join(process.cwd(), 'supabase', 'functions', 'check-prediction', 'index.ts'), 'utf8')

  it('enforces server-side storage file limits and mime types', () => {
    expect(storageSetup).toContain('file_size_limit')
    expect(storageSetup).toContain('allowed_mime_types')
    expect(storageSetup).toContain('104857600')
    expect(storageSetup).toContain('10485760')
  })

  it('uses i18n for per-month pricing label', () => {
    expect(pricingPage).toContain('{t.pricing.perMonth}')
    expect(pricingPage).not.toContain('>/mês<')
  })

  it('contains cleanup_stale_generations rpc with service_role-only execution', () => {
    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.cleanup_stale_generations(')
    expect(schema).toContain("IF COALESCE(auth.role(), '') <> 'service_role' THEN")
    expect(schema).toContain('GRANT EXECUTE ON FUNCTION public.cleanup_stale_generations(INTEGER, INTEGER) TO service_role;')
  })

  it('contains index optimized for stale generation cleanup scan', () => {
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_generations_stale_cleanup')
    expect(schema).toContain("WHERE status IN ('starting', 'processing');")
  })

  it('contains edge rate limit cleanup rpc and service_role grant', () => {
    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.cleanup_edge_rate_limits(')
    expect(schema).toContain('GRANT EXECUTE ON FUNCTION public.cleanup_edge_rate_limits(INTEGER, INTEGER) TO service_role;')
  })

  it('restricts admin rpc execute grants to service_role', () => {
    expect(schema).toContain('GRANT EXECUTE ON FUNCTION public.admin_adjust_user_credits(UUID, INTEGER, TEXT) TO service_role;')
    expect(schema).toContain('REVOKE ALL ON FUNCTION public.admin_adjust_user_credits(UUID, INTEGER, TEXT) FROM authenticated;')
  })

  it('uploads prediction output without arrayBuffer full-memory buffering', () => {
    expect(checkPredictionSource).not.toContain('arrayBuffer()')
    expect(checkPredictionSource).toContain('uploadVideoStreamToStorage(')
  })
})

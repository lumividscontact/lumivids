import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production guardrails', () => {
  const storageGuide = readFileSync(join(process.cwd(), 'supabase', 'STORAGE_SETUP_GUIDE.md'), 'utf8')
  const schema = readFileSync(join(process.cwd(), 'supabase', 'schema.sql'), 'utf8')
  const pricingPage = readFileSync(join(process.cwd(), 'src', 'pages', 'PricingPage.tsx'), 'utf8')
  const imageUploadSource = readFileSync(join(process.cwd(), 'src', 'components', 'ImageUpload.tsx'), 'utf8')
  const checkPredictionSource = readFileSync(join(process.cwd(), 'supabase', 'functions', 'check-prediction', 'index.ts'), 'utf8')

  it('documents storage limits and enforces upload guardrails in code', () => {
    expect(storageGuide).toContain('File size limit')
    expect(storageGuide).toContain('100 MB')
    expect(storageGuide).toContain('Allowed MIME types')
    expect(storageGuide).toContain('video/*')
    expect(checkPredictionSource).toContain('const VIDEO_UPLOAD_MAX_BYTES = 100 * 1024 * 1024')
    expect(imageUploadSource).toContain("maxSizeMB = 10")
    expect(imageUploadSource).toContain("acceptedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']")
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

  it('contains generations audit trail for inserts updates and deletes', () => {
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS public.generations_audit (')
    expect(schema).toContain("event_type TEXT NOT NULL CHECK (event_type IN ('insert', 'update', 'delete'))")
    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.audit_generations_changes()')
    expect(schema).toContain('CREATE TRIGGER audit_generations_changes')
    expect(schema).toContain('AFTER INSERT OR UPDATE OR DELETE ON public.generations')
  })

  it('uses soft-hide for generations instead of user delete policy', () => {
    expect(schema).toContain('ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;')
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_generations_user_hidden_created_at')
    expect(schema).not.toContain('CREATE POLICY "Users can delete their own generations"')
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

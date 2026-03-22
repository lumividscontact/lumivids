import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('schema.sql refund RPC coverage', () => {
  const schemaPath = join(process.cwd(), 'supabase', 'schema.sql')
  const schema = readFileSync(schemaPath, 'utf8')

  it('defines claim_generation_refund_credits in main schema', () => {
    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.claim_generation_refund_credits(')
    expect(schema).toContain('RETURNS INTEGER AS $$')
    expect(schema).toContain('FOR UPDATE')
    expect(schema).toContain('credits_used = 0')
  })

  it('locks down and grants claim_generation_refund_credits execute permission correctly', () => {
    expect(schema).toContain('REVOKE ALL ON FUNCTION public.claim_generation_refund_credits(UUID, TEXT, TEXT) FROM PUBLIC;')
    expect(schema).toContain('GRANT EXECUTE ON FUNCTION public.claim_generation_refund_credits(UUID, TEXT, TEXT) TO service_role;')
  })
})

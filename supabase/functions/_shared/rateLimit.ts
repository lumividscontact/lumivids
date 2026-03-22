import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const configuredFallbackMode = Deno.env.get('RATE_LIMIT_FALLBACK_MODE')
const isProductionEnvironment = Deno.env.get('APP_ENV') === 'production' || Deno.env.get('ENV') === 'production'
const rateLimitFallbackMode = (configuredFallbackMode ?? (isProductionEnvironment ? 'fail-closed' : 'memory')).toLowerCase()

type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfter: number
}

const fallbackCounters = new Map<string, number>()

function getWindowStart(windowSeconds: number): number {
  const now = Math.floor(Date.now() / 1000)
  return Math.floor(now / windowSeconds) * windowSeconds
}

function fallbackRateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const windowStart = getWindowStart(windowSeconds)
  const key = `${action}:${identifier}:${windowStart}`

  const current = fallbackCounters.get(key) ?? 0
  const next = current + 1
  fallbackCounters.set(key, next)

  const now = Math.floor(Date.now() / 1000)
  const retryAfter = windowSeconds - (now % windowSeconds)

  return {
    allowed: next <= limit,
    remaining: Math.max(limit - next, 0),
    retryAfter,
  }
}

function denyOnUnavailable(windowSeconds: number): RateLimitResult {
  return {
    allowed: false,
    remaining: 0,
    retryAfter: Math.max(windowSeconds, 1),
  }
}

export async function enforceRateLimit(params: {
  identifier: string
  action: string
  limit: number
  windowSeconds?: number
}): Promise<RateLimitResult> {
  const { identifier, action, limit, windowSeconds = 60 } = params

  if (!identifier) {
    return { allowed: false, remaining: 0, retryAfter: windowSeconds }
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_action: action,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      if (rateLimitFallbackMode === 'memory') {
        console.warn('[RateLimit] RPC unavailable, using in-memory fallback limiter:', error.message)
        return fallbackRateLimit(identifier, action, limit, windowSeconds)
      }

      console.warn('[RateLimit] RPC unavailable, denying requests (fail-closed mode):', error.message)
      return denyOnUnavailable(windowSeconds)
    }

    const row = Array.isArray(data) ? data[0] : data
    return {
      allowed: !!row?.allowed,
      remaining: Number(row?.remaining ?? 0),
      retryAfter: Number(row?.retry_after ?? windowSeconds),
    }
  } catch (error) {
    if (rateLimitFallbackMode === 'memory') {
      console.warn('[RateLimit] Unexpected limiter error, using in-memory fallback limiter:', error)
      return fallbackRateLimit(identifier, action, limit, windowSeconds)
    }

    console.warn('[RateLimit] Unexpected limiter error, denying requests (fail-closed mode):', error)
    return denyOnUnavailable(windowSeconds)
  }
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

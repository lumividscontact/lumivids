const appEnv = (Deno.env.get('APP_ENV') || Deno.env.get('ENV') || '').toLowerCase()
const isProduction = appEnv === 'production'

const configuredOrigins = (Deno.env.get('CORS_ALLOWED_ORIGINS') || Deno.env.get('CORS_ALLOWED_ORIGIN') || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const resolvedOrigin = (() => {
  if (configuredOrigins.includes('*')) return '*'
  if (configuredOrigins.length > 0) return configuredOrigins[0]
  if (!isProduction) return '*'
  return 'https://lumivids.com'
})()

export const corsHeaders = {
  'Access-Control-Allow-Origin': resolvedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

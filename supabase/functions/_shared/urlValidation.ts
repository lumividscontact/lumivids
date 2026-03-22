const DEFAULT_ALLOWED_SUFFIXES = [
  '.supabase.co',
  '.supabase.in',
  '.replicate.delivery',
]

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split('.').map((p) => Number.parseInt(p, 10))
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false
  }

  const [a, b] = parts

  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true // Benchmarking

  return false
}

function isPrivateIPv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  )
}

function isIpAddress(hostname: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return true
  if (hostname.includes(':')) return true
  return false
}

function getDefaultAllowedHosts(): Set<string> {
  const hosts = new Set<string>()

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (supabaseUrl) {
    try {
      hosts.add(new URL(supabaseUrl).hostname.toLowerCase())
    } catch {
      // ignore malformed env
    }
  }

  hosts.add('replicate.delivery')

  const envHosts = Deno.env.get('ALLOWED_IMAGE_HOSTS')
  if (envHosts) {
    envHosts
      .split(',')
      .map((h: string) => h.trim().toLowerCase())
      .filter(Boolean)
      .forEach((h: string) => hosts.add(h))
  }

  return hosts
}

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  const allowedHosts = getDefaultAllowedHosts()

  if (allowedHosts.has(host)) {
    return true
  }

  return DEFAULT_ALLOWED_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

export function validateImageUrl(imageUrl: string): { valid: true } | { valid: false; error: string } {
  let parsed: URL

  try {
    parsed = new URL(imageUrl)
  } catch {
    return { valid: false, error: 'Invalid image URL' }
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS image URLs are allowed' }
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'Image URL must not contain credentials' }
  }

  if (parsed.port && parsed.port !== '443') {
    return { valid: false, error: 'Custom ports are not allowed for image URLs' }
  }

  const hostname = parsed.hostname.toLowerCase()

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { valid: false, error: 'Localhost image URLs are not allowed' }
  }

  if (
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home')
  ) {
    return { valid: false, error: 'Private network domains are not allowed' }
  }

  if (isIpAddress(hostname)) {
    if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
      return { valid: false, error: 'Private or local IP image URLs are not allowed' }
    }
  }

  if (!isAllowedHost(hostname)) {
    return { valid: false, error: 'Image host is not allowed' }
  }

  return { valid: true }
}

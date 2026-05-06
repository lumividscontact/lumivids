export type RuntimeLanguage = 'pt' | 'en' | 'es' | 'id'

const STORAGE_KEY = 'lumivids_language'

const PORTUGUESE_LOCALES = ['pt', 'pt-BR', 'pt-PT', 'pt-AO', 'pt-MZ', 'pt-CV', 'pt-GW', 'pt-ST', 'pt-TL']
const SPANISH_LOCALES = [
  'es', 'es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-CL', 'es-PE', 'es-VE', 'es-EC',
  'es-GT', 'es-CU', 'es-BO', 'es-DO', 'es-HN', 'es-PY', 'es-SV', 'es-NI',
  'es-CR', 'es-PA', 'es-UY', 'es-PR', 'es-GQ',
]
const INDONESIAN_LOCALES = ['id', 'id-ID']

function isRuntimeLanguage(value: string | null): value is RuntimeLanguage {
  return value === 'pt' || value === 'en' || value === 'es' || value === 'id'
}

function normalizePathname(pathname: string): string {
  if (!pathname) return '/'
  if (pathname === '/') return '/'
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

function isLanguagePathPrefix(pathname: string, language: RuntimeLanguage): boolean {
  return pathname === `/${language}` || pathname.startsWith(`/${language}/`)
}

function getPathLanguage(pathname: string): RuntimeLanguage | null {
  const normalizedPathname = normalizePathname(pathname).toLowerCase()

  if (isLanguagePathPrefix(normalizedPathname, 'pt')) {
    return 'pt'
  }

  if (isLanguagePathPrefix(normalizedPathname, 'es')) {
    return 'es'
  }

  if (isLanguagePathPrefix(normalizedPathname, 'id')) {
    return 'id'
  }

  if (isLanguagePathPrefix(normalizedPathname, 'en')) {
    return 'en'
  }

  return null
}

export function getPathPrefixLanguage(pathname: string): Exclude<RuntimeLanguage, 'en'> | null {
  const pathLanguage = getPathLanguage(pathname)
  return pathLanguage === 'pt' || pathLanguage === 'es' || pathLanguage === 'id' ? pathLanguage : null
}

export function stripLanguagePrefix(pathname: string): string {
  const normalizedPathname = normalizePathname(pathname)
  const prefixLanguage = getPathLanguage(normalizedPathname)

  if (!prefixLanguage) {
    return normalizedPathname
  }

  const prefix = `/${prefixLanguage}`
  const stripped = normalizedPathname.slice(prefix.length)
  return stripped || '/'
}

export function getLanguageBasePath(language: RuntimeLanguage): string {
  if (language === 'en') {
    return ''
  }

  return `/${language}`
}

export function buildPathForLanguage(pathname: string, language: RuntimeLanguage): string {
  const pathWithoutPrefix = stripLanguagePrefix(pathname)
  const basePath = getLanguageBasePath(language)

  if (pathWithoutPrefix === '/') {
    return basePath || '/'
  }

  return `${basePath}${pathWithoutPrefix}`
}

function detectLanguageFromLocales(locales: readonly string[]): RuntimeLanguage {
  for (const locale of locales) {
    const normalizedLocale = locale.toLowerCase()

    if (PORTUGUESE_LOCALES.some((candidate) => normalizedLocale.startsWith(candidate.toLowerCase()))) {
      return 'pt'
    }

    if (SPANISH_LOCALES.some((candidate) => normalizedLocale.startsWith(candidate.toLowerCase()))) {
      return 'es'
    }

    if (INDONESIAN_LOCALES.some((candidate) => normalizedLocale.startsWith(candidate.toLowerCase()))) {
      return 'id'
    }
  }

  return 'en'
}

export function getStoredRuntimeLanguage(): RuntimeLanguage | null {
  if (typeof window === 'undefined') return null

  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isRuntimeLanguage(stored) ? stored : null
}

export function detectRuntimeLanguage(): RuntimeLanguage {
  if (typeof window === 'undefined') return 'en'

  const browserLocales = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || 'en']

  return detectLanguageFromLocales(browserLocales)
}

export function getRuntimeLanguage(): RuntimeLanguage {
  if (typeof window === 'undefined') {
    return 'en'
  }

  return getPathLanguage(window.location.pathname) ?? getQueryParamLanguage() ?? getStoredRuntimeLanguage() ?? detectRuntimeLanguage()
}

export function getQueryParamLanguage(): RuntimeLanguage | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const lang = params.get('lang')
  if (isRuntimeLanguage(lang)) {
    setStoredRuntimeLanguage(lang)
    return lang
  }
  return null
}

export function setStoredRuntimeLanguage(language: RuntimeLanguage): void {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(STORAGE_KEY, language)
}

export function getRuntimeMessage(messages: Record<RuntimeLanguage, string>): string {
  const lang = getRuntimeLanguage()
  return messages[lang] ?? messages.en
}

const INTL_LOCALE_MAP: Record<RuntimeLanguage, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  id: 'id-ID',
}

export function getIntlLocale(language: RuntimeLanguage): string {
  return INTL_LOCALE_MAP[language]
}

export function formatDate(date: Date | string | number, language: RuntimeLanguage, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(INTL_LOCALE_MAP[language], options).format(new Date(date))
}

export function formatNumber(value: number, language: RuntimeLanguage, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL_LOCALE_MAP[language], options).format(value)
}

export function formatCurrency(amount: number, language: RuntimeLanguage, currency = 'BRL'): string {
  return new Intl.NumberFormat(INTL_LOCALE_MAP[language], { style: 'currency', currency }).format(amount)
}

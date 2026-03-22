export type RuntimeLanguage = 'pt' | 'en' | 'es'

const STORAGE_KEY = 'lumivids_language'

const PORTUGUESE_LOCALES = ['pt', 'pt-BR', 'pt-PT', 'pt-AO', 'pt-MZ', 'pt-CV', 'pt-GW', 'pt-ST', 'pt-TL']
const SPANISH_LOCALES = [
  'es', 'es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-CL', 'es-PE', 'es-VE', 'es-EC',
  'es-GT', 'es-CU', 'es-BO', 'es-DO', 'es-HN', 'es-PY', 'es-SV', 'es-NI',
  'es-CR', 'es-PA', 'es-UY', 'es-PR', 'es-GQ',
]

function isRuntimeLanguage(value: string | null): value is RuntimeLanguage {
  return value === 'pt' || value === 'en' || value === 'es'
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
  return getQueryParamLanguage() ?? getStoredRuntimeLanguage() ?? detectRuntimeLanguage()
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

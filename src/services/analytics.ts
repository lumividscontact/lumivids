type AnalyticsParams = Record<string, string | number | boolean | null | undefined>

const GOOGLE_ADS_CONVERSION_ID = 'AW-17551376525'
const GOOGLE_ADS_SIGNUP_CONVERSION_LABEL = 'o1nMCPLo2KkcEI2Bk7FB'
const SIGN_UP_DEDUP_PREFIX = 'lumivids_signup_conversion:'
const BING_AD_CONSENT_KEY = 'lumivids_bing_ad_storage_consent'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    uetq?: Array<unknown>
  }
}

function canTrackWithGtag(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function'
}

function getGoogleAdsSignUpLabel(): string | null {
  const label = import.meta.env.VITE_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL

  if (typeof label === 'string') {
    const normalized = label.trim()
    if (normalized) {
      return normalized
    }
  }

  return GOOGLE_ADS_SIGNUP_CONVERSION_LABEL
}

function hasTrackedSignUpForUser(userId: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(`${SIGN_UP_DEDUP_PREFIX}${userId}`) === '1'
  } catch {
    return false
  }
}

function markSignUpTrackedForUser(userId: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(`${SIGN_UP_DEDUP_PREFIX}${userId}`, '1')
  } catch {
    // Ignore storage errors.
  }
}

function canTrackWithUet(): boolean {
  return typeof window !== 'undefined' && Array.isArray(window.uetq)
}

function getStoredBingAdConsent(): 'granted' | 'denied' | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const value = window.localStorage.getItem(BING_AD_CONSENT_KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

function hasGrantedBingAdConsent(): boolean {
  return getStoredBingAdConsent() === 'granted'
}

function normalizeEmail(value?: string | null): string {
  if (!value) {
    return ''
  }

  return value.trim().toLowerCase()
}

function normalizePhone(value?: string | null): string {
  if (!value) {
    return ''
  }

  return value.trim().replace(/[^\d+]/g, '')
}

export function updateBingAdConsent(granted: boolean): void {
  if (!canTrackWithUet()) {
    return
  }

  const adStorage = granted ? 'granted' : 'denied'

  window.uetq?.push('consent', 'update', {
    ad_storage: adStorage,
  })

  try {
    window.localStorage.setItem(BING_AD_CONSENT_KEY, adStorage)
  } catch {
    // Ignore storage errors.
  }
}

export function syncStoredBingAdConsent(): void {
  const storedConsent = getStoredBingAdConsent()
  if (storedConsent === null) {
    return
  }

  updateBingAdConsent(storedConsent === 'granted')
}

export function setBingEnhancedConversionIdentifiers(email?: string | null, phone?: string | null): void {
  if (!canTrackWithUet() || !hasGrantedBingAdConsent()) {
    return
  }

  const normalizedEmail = normalizeEmail(email)
  const normalizedPhone = normalizePhone(phone)

  if (!normalizedEmail && !normalizedPhone) {
    return
  }

  window.uetq?.push('set', {
    pid: {
      em: normalizedEmail,
      ph: normalizedPhone,
    },
  })
}

export function trackEvent(eventName: string, params?: AnalyticsParams): void {
  if (!canTrackWithGtag()) {
    return
  }

  if (params && Object.keys(params).length > 0) {
    window.gtag('event', eventName, params)
    return
  }

  window.gtag('event', eventName)
}

export function trackSignUp(method: 'email' | 'google', userId: string): void {
  if (!userId || hasTrackedSignUpForUser(userId)) {
    return
  }

  trackEvent('sign_up', { method })

  const googleAdsLabel = getGoogleAdsSignUpLabel()
  if (canTrackWithGtag() && googleAdsLabel) {
    window.gtag('event', 'conversion', {
      send_to: `${GOOGLE_ADS_CONVERSION_ID}/${googleAdsLabel}`,
      method,
    })
  }

  markSignUpTrackedForUser(userId)
}

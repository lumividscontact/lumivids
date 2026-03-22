type AnalyticsParams = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function trackEvent(eventName: string, params?: AnalyticsParams): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return
  }

  if (params && Object.keys(params).length > 0) {
    window.gtag('event', eventName, params)
    return
  }

  window.gtag('event', eventName)
}

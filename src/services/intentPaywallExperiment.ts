export type IntentPaywallVariant = 'control_manual' | 'treatment_auto'

const VARIANT_KEY_PREFIX = 'lumivids_intent_paywall_variant'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getIntentPaywallVariant(userId?: string | null): IntentPaywallVariant {
  if (!isBrowser()) {
    return 'control_manual'
  }

  try {
    const identity = userId && userId.trim().length > 0 ? userId.trim() : 'anonymous'
    const storageKey = `${VARIANT_KEY_PREFIX}:${identity}`
    const stored = window.localStorage.getItem(storageKey)
    if (stored === 'control_manual' || stored === 'treatment_auto') {
      return stored
    }

    const assigned: IntentPaywallVariant = Math.random() < 0.5 ? 'control_manual' : 'treatment_auto'
    window.localStorage.setItem(storageKey, assigned)
    return assigned
  } catch {
    return 'control_manual'
  }
}

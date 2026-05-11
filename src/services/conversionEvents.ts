import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/services/analytics'

type ConversionEventName = 'intent_paywall_view' | 'intent_paywall_checkout_click'

type ConversionEventParams = {
  source?: string
  reason?: string
  experiment_variant?: string
  plan_id?: string
  billing_period?: string
  required_credits?: number
  current_credits?: number
  credits_deficit?: number
  value?: number
  currency?: string
  [key: string]: string | number | boolean | null | undefined
}

export async function trackConversionEvent(eventName: ConversionEventName, params: ConversionEventParams): Promise<void> {
  trackEvent(eventName, params)

  const payload = {
    event_name: eventName,
    source: typeof params.source === 'string' ? params.source : null,
    reason: typeof params.reason === 'string' ? params.reason : null,
    experiment_variant: typeof params.experiment_variant === 'string' ? params.experiment_variant : null,
    plan_id: typeof params.plan_id === 'string' ? params.plan_id : null,
    billing_period: typeof params.billing_period === 'string' ? params.billing_period : null,
    required_credits: typeof params.required_credits === 'number' ? Math.trunc(params.required_credits) : null,
    current_credits: typeof params.current_credits === 'number' ? Math.trunc(params.current_credits) : null,
    credits_deficit: typeof params.credits_deficit === 'number' ? Math.trunc(params.credits_deficit) : null,
    value: typeof params.value === 'number' ? params.value : null,
    currency: typeof params.currency === 'string' ? params.currency : null,
    metadata: params,
  }

  try {
    const { error } = await supabase
      .from('conversion_events')
      .insert(payload)

    if (error) {
      console.warn('[ConversionEvents] failed to insert event', eventName, error.message)
    }
  } catch (error) {
    console.warn('[ConversionEvents] unexpected insert error', eventName, error)
  }
}

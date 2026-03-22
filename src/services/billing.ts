import { supabase } from '@/lib/supabase'
import { getRuntimeMessage } from '@/i18n/runtime'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export interface CheckoutResponse {
  url: string
  sessionId: string
}

export interface PortalResponse {
  url: string
}

const SESSION_EXPIRED_FOR_CHECKOUT = {
  pt: 'Sua sessão expirou. Faça login novamente para assinar um plano.',
  en: 'Your session has expired. Please sign in again to subscribe to a plan.',
  es: 'Tu sesión expiró. Inicia sesión nuevamente para suscribirte a un plan.',
} as const

const SESSION_EXPIRED_FOR_PORTAL = {
  pt: 'Sua sessão expirou. Faça login novamente para acessar o portal de cobrança.',
  en: 'Your session has expired. Please sign in again to access the billing portal.',
  es: 'Tu sesión expiró. Inicia sesión nuevamente para acceder al portal de facturación.',
} as const

/**
 * Create a Stripe checkout session for a plan
 */
export async function createCheckoutSession(
  planId: string,
  billingPeriod: 'monthly' | 'annual' = 'monthly'
): Promise<CheckoutResponse> {
  let { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession()
    session = data.session
  }
  
  if (!session?.access_token) {
    await supabase.auth.signOut()
    throw new Error(getRuntimeMessage(SESSION_EXPIRED_FOR_CHECKOUT))
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'x-supabase-auth': session.access_token,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      planId,
      billingPeriod,
      successUrl: `${window.location.origin}/pricing?success=true`,
      cancelUrl: `${window.location.origin}/pricing?canceled=true`,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create checkout session')
  }

  return response.json()
}

/**
 * Create a Stripe billing portal session
 */
export async function createPortalSession(): Promise<PortalResponse> {
  let { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession()
    session = data.session
  }
  
  if (!session?.access_token) {
    await supabase.auth.signOut()
    throw new Error(getRuntimeMessage(SESSION_EXPIRED_FOR_PORTAL))
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-portal-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'x-supabase-auth': session.access_token,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      returnUrl: `${window.location.origin}/my-account`,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('[Billing] Portal session error:', response.status, error)
    throw new Error(error.error || 'Failed to create portal session')
  }

  return response.json()
}

/**
 * Redirect to Stripe checkout
 */
export async function redirectToCheckout(
  planId: string,
  billingPeriod: 'monthly' | 'annual' = 'monthly'
): Promise<void> {
  const { url } = await createCheckoutSession(planId, billingPeriod)
  window.location.href = url
}

/**
 * Redirect to Stripe billing portal
 */
export async function redirectToPortal(): Promise<void> {
  const { url } = await createPortalSession()
  window.location.href = url
}

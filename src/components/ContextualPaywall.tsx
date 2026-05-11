import { useMemo, useState } from 'react'
import { Check, Loader2, Sparkles, X, Zap } from 'lucide-react'
import { useCredits, type Plan } from '@/contexts/CreditsContext'
import { useLanguage } from '@/i18n'
import { redirectToCheckout } from '@/services/billing'
import { trackConversionEvent } from '@/services/conversionEvents'
import { trackEvent } from '@/services/analytics'
import type { IntentPaywallVariant } from '@/services/intentPaywallExperiment'

type PaidPlan = Plan & { id: Exclude<Plan['id'], null> }

function isPaidPlan(plan: Plan): plan is PaidPlan {
  return plan.id !== null
}

interface ContextualPaywallProps {
  isOpen: boolean
  onClose: () => void
  requiredCredits: number
  currentCredits: number
  source: string
  openReason: string
  experimentVariant: IntentPaywallVariant
  isAuthenticated: boolean
  onRequireAuth: () => void
}

export default function ContextualPaywall({
  isOpen,
  onClose,
  requiredCredits,
  currentCredits,
  source,
  openReason,
  experimentVariant,
  isAuthenticated,
  onRequireAuth,
}: ContextualPaywallProps) {
  const { t } = useLanguage()
  const { plans } = useCredits()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null)
  const paidPlans = plans.filter(isPaidPlan)

  const deficit = Math.max(requiredCredits - currentCredits, 0)

  const recommendedPlan = useMemo(() => {
    if (paidPlans.length === 0) return null

    const targetCredits = Math.max(requiredCredits * 20, 200)
    const suitablePlan = paidPlans.find((planItem) => planItem.credits >= targetCredits)

    return suitablePlan || paidPlans.find((planItem) => planItem.popular) || paidPlans[0]
  }, [paidPlans, requiredCredits])

  const estimatedGenerations = recommendedPlan
    ? Math.max(1, Math.floor(recommendedPlan.credits / Math.max(requiredCredits, 1)))
    : null

  const handleCheckout = async (planId: string) => {
    if (!isAuthenticated) {
      onRequireAuth()
      onClose()
      return
    }

    setLoadingPlanId(planId)
    const targetPlan = paidPlans.find((planItem) => planItem.id === planId)
    const targetPrice = billingPeriod === 'annual' && typeof targetPlan?.annualMonthlyPrice === 'number'
      ? targetPlan.annualMonthlyPrice
      : targetPlan?.price

    await Promise.race([
      trackConversionEvent('intent_paywall_checkout_click', {
        source,
        reason: openReason,
        experiment_variant: experimentVariant,
        plan_id: planId,
        billing_period: billingPeriod,
        required_credits: requiredCredits,
        current_credits: currentCredits,
        credits_deficit: deficit,
        value: typeof targetPrice === 'number' ? targetPrice : undefined,
        currency: 'USD',
      }),
      new Promise((resolve) => setTimeout(resolve, 300)),
    ])

    trackEvent('begin_checkout', {
      source,
      plan_id: planId,
      billing_period: billingPeriod,
      value: typeof targetPrice === 'number' ? targetPrice : undefined,
      currency: 'USD',
    })

    try {
      await redirectToCheckout(planId, billingPeriod)
    } catch (error) {
      console.error('[ContextualPaywall] checkout error:', error)
      setLoadingPlanId(null)
    }
  }

  if (!isOpen || !recommendedPlan) {
    return null
  }

  const displayPrice = billingPeriod === 'annual' && typeof recommendedPlan.annualMonthlyPrice === 'number'
    ? recommendedPlan.annualMonthlyPrice
    : recommendedPlan.price

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label={t.common.close}
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-primary-500/40 bg-dark-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-dark-300 hover:text-white"
          aria-label={t.common.close}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-500/40 bg-primary-500/15 px-3 py-1 text-xs font-semibold text-primary-300">
          <Sparkles className="h-4 w-4" />
          {t.freemium.contextualPaywall.badge}
        </div>

        <h3 className="text-2xl font-bold text-white">{t.freemium.contextualPaywall.title}</h3>
        <p className="mt-2 text-sm text-dark-300">
          {t.freemium.contextualPaywall.subtitle
            .replace('{required}', String(requiredCredits))
            .replace('{current}', String(currentCredits))}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-dark-700 bg-dark-800/70 p-3">
            <p className="text-xs text-dark-400">{t.freemium.contextualPaywall.requiredLabel}</p>
            <p className="mt-1 flex items-center gap-1 text-lg font-semibold text-white">
              <Zap className="h-4 w-4 text-primary-400" />
              {requiredCredits}
            </p>
          </div>
          <div className="rounded-xl border border-dark-700 bg-dark-800/70 p-3">
            <p className="text-xs text-dark-400">{t.freemium.contextualPaywall.missingLabel}</p>
            <p className="mt-1 text-lg font-semibold text-orange-300">{deficit}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-primary-500/40 bg-primary-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-primary-300">{t.freemium.contextualPaywall.recommended}</p>
              <p className="text-lg font-bold text-white">{recommendedPlan.name}</p>
            </div>
            {recommendedPlan.popular && (
              <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-300">
                {t.pricing.mostPopular}
              </span>
            )}
          </div>

          <div className="mt-3 text-sm text-dark-200">
            {t.freemium.contextualPaywall.creditsPerMonth.replace('{credits}', String(recommendedPlan.credits))}
          </div>

          {estimatedGenerations !== null && (
            <div className="mt-2 text-xs text-dark-300">
              {t.freemium.contextualPaywall.generationEstimate.replace('{count}', String(estimatedGenerations))}
            </div>
          )}

          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dark-700 bg-dark-900/70 p-1">
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                billingPeriod === 'monthly' ? 'bg-primary-500 text-white' : 'text-dark-300'
              }`}
            >
              {t.pricing.billingMonthly}
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('annual')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                billingPeriod === 'annual' ? 'bg-primary-500 text-white' : 'text-dark-300'
              }`}
            >
              {t.pricing.billingAnnual}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleCheckout(recommendedPlan.id)}
            disabled={loadingPlanId === recommendedPlan.id}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 px-4 py-3 text-sm font-semibold text-white hover:from-primary-600 hover:to-accent-600 disabled:cursor-wait disabled:opacity-60"
          >
            {loadingPlanId === recommendedPlan.id ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.pricing.processing}
              </span>
            ) : (
              t.freemium.contextualPaywall.cta
                .replace('{plan}', recommendedPlan.name)
                .replace('{price}', displayPrice.toFixed(1))
            )}
          </button>
        </div>

        <ul className="mt-4 space-y-2 text-xs text-dark-300">
          {(t.pricing.planFeatures?.[recommendedPlan.id as keyof typeof t.pricing.planFeatures] ?? recommendedPlan.features)
            .slice(0, 3)
            .map((feature, index) => (
              <li key={`${recommendedPlan.id}-${index}`} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-400" />
                <span>{feature}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  )
}

import { Check, Sparkles, Zap, Crown, Building2, Settings, Loader2, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useCredits } from '@/contexts/CreditsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/i18n'
import { redirectToCheckout, redirectToPortal } from '@/services/billing'
import { useSearchParams } from 'react-router-dom'
import { LoadingSpinner } from '@/components/Loading'
import { useSEO, SEO_PAGES } from '@/hooks'
import { trackEvent } from '@/services/analytics'

const planIcons: Record<string, typeof Zap> = {
  creator: Zap,
  studio: Crown,
  director: Building2,
}

export default function PricingPage() {
  const { plans, plan: currentPlan, credits } = useCredits()
  const { user, isLoading: authLoading } = useAuth()
  const { t } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')
  const [loadingPortal, setLoadingPortal] = useState(false)
  
  // SEO meta tags
  useSEO(SEO_PAGES.pricing)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const isInitialLoading = authLoading || plans.length === 0

  const handleManageSubscription = async () => {
    setLoadingPortal(true)
    try {
      await redirectToPortal()
    } catch (error) {
      console.error('Portal error:', error)
    } finally {
      setLoadingPortal(false)
    }
  }

  // Usuários sem plano não têm plano pago
  const hasPaidPlan = currentPlan !== null
  const hasCurrentPlan = currentPlan !== null

  // Check for success/canceled from Stripe redirect
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setMessage({ type: 'success', text: t.pricing.subscriptionSuccess })
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('success')
      setSearchParams(nextParams, { replace: true })
    } else if (searchParams.get('canceled') === 'true') {
      setMessage({ type: 'error', text: t.pricing.paymentCanceled })
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('canceled')
      setSearchParams(nextParams, { replace: true })
    }
  }, [searchParams, setSearchParams, t.pricing.subscriptionSuccess, t.pricing.paymentCanceled])

  const handleSubscribe = async (planId: string) => {
    if (!planId) return
    setLoadingPlan(planId)
    setMessage(null)
    try {
      const selectedPlan = plans.find((plan) => plan.id === planId)
      const planValue = billingPeriod === 'annual' && typeof selectedPlan?.annualMonthlyPrice === 'number'
        ? selectedPlan.annualMonthlyPrice
        : selectedPlan?.price

      trackEvent('begin_checkout', {
        plan_id: planId,
        billing_period: billingPeriod,
        value: typeof planValue === 'number' ? planValue : undefined,
        currency: 'USD',
      })

      await redirectToCheckout(planId, billingPeriod)
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : t.pricing.paymentError })
    } finally {
      setLoadingPlan(null)
    }
  }

  const handleDismissMessage = () => {
    setMessage(null)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('success')
    nextParams.delete('canceled')
    setSearchParams(nextParams, { replace: true })
  }

  const faqItems = [
    t.pricing.faq.whatAreCredits,
    t.pricing.faq.doCreditsAccumulate,
    t.pricing.faq.canUpgrade,
    t.pricing.faq.canCancel,
  ]

  return (
    <div className="min-h-screen p-4 sm:p-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          <span className="gradient-text">{t.pricing.title}</span>
        </h1>
        <p className="text-dark-400 text-lg max-w-2xl mx-auto">
          {t.pricing.subtitle}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dark-800/50 border border-dark-700">
          <Sparkles className="w-5 h-5 text-primary-400" />
          <span className="text-white">
            {t.pricing.youHave} <span className="font-bold text-primary-400">{credits}</span> {t.common.credits}
          </span>
        </div>

        {/* Manage Subscription Button */}
        {hasPaidPlan && (
          <div className="mt-4">
            <button
              onClick={handleManageSubscription}
              disabled={loadingPortal}
              className="btn-secondary flex items-center gap-2 mx-auto"
            >
              {loadingPortal ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.settings.payment.manageSubscriptionLoading}
                </>
              ) : (
                <>
                  <Settings className="w-5 h-5" />
                  {t.settings.payment.manageSubscription}
                </>
              )}
            </button>
          </div>
        )}
        <div className="mt-6 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 bg-dark-800/50 border border-dark-700 rounded-2xl p-1.5">
            <button
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                billingPeriod === 'monthly' ? 'bg-primary-500 text-white' : 'text-dark-300'
              }`}
              onClick={() => setBillingPeriod('monthly')}
            >
              {t.pricing.billingMonthly}
            </button>
            <button
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                billingPeriod === 'annual' ? 'bg-primary-500 text-white' : 'text-dark-300'
              }`}
              onClick={() => setBillingPeriod('annual')}
            >
              {t.pricing.billingAnnual}
              <span className="ml-2 px-2 py-0.5 text-xs rounded-md bg-green-500/20 text-green-400">{t.pricing.saveAnnual} 🎉</span>
            </button>
          </div>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`relative mt-6 max-w-md mx-auto p-4 pr-12 rounded-xl border ${
            message.type === 'success' 
              ? 'bg-green-500/10 border-green-500 text-green-400' 
              : 'bg-red-500/10 border-red-500 text-red-400'
          }`}>
            {message.text}
            <button
              onClick={handleDismissMessage}
              className="absolute top-3 right-3 text-current/80 hover:text-current transition-colors"
              aria-label="Close message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
      </div>

      {/* Pricing Cards */}
      {isInitialLoading ? (
        <div className="max-w-7xl mx-auto">
          <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 flex items-center justify-center gap-3 text-dark-300">
            <LoadingSpinner size="sm" />
            <span>{t.common.loading}</span>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {plans.map((planItem) => {
          const Icon = planIcons[planItem.id]
          const isCurrentPlan = hasCurrentPlan && planItem.id === currentPlan
          const isPopular = planItem.popular
          const hasAnnualMonthlyPrice = typeof planItem.annualMonthlyPrice === 'number'
          const displayedPrice = billingPeriod === 'annual' && hasAnnualMonthlyPrice
            ? planItem.annualMonthlyPrice
            : planItem.price
          const showStruckMonthlyPrice = billingPeriod === 'annual' && hasAnnualMonthlyPrice && planItem.price > displayedPrice
          const discountPercent = showStruckMonthlyPrice
            ? Math.round(((planItem.price - displayedPrice) / planItem.price) * 100)
            : 0
          const showPrice = planItem.price > 0
          const costPerCreditValue = showPrice && planItem.credits > 0
            ? displayedPrice / planItem.credits
            : null
          const isLoading = loadingPlan === planItem.id

          return (
            <div
              key={planItem.id}
              className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 ${
                isPopular
                    ? 'bg-gradient-to-r from-primary-500/25 to-primary-600/35 border border-primary-500/60'
                  : 'bg-dark-800/50 border border-dark-700 hover:border-dark-600'
              }`}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div className="absolute -left-9 top-5 -rotate-45 bg-red-500 text-white text-xs font-bold px-10 py-1 shadow-md">
                  <span>
                    {t.pricing.mostPopular}
                  </span>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentPlan && (
                <div className="absolute -top-4 right-4">
                  <span className="px-3 py-1 rounded-full bg-green-500 text-white text-xs font-semibold">
                    {t.pricing.currentPlan}
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div
                      className={`w-12 h-12 rounded-xl mb-3 flex items-center justify-center ${
                        isPopular ? 'bg-primary-500' : 'bg-dark-700'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isPopular ? 'text-white' : 'text-primary-400'}`} />
                    </div>
                    <h3 className="text-3xl font-bold text-white leading-none">{planItem.name}</h3>
                    {planItem.tagline && (
                      <p className="text-dark-300 text-sm mt-2">{planItem.tagline}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {billingPeriod === 'annual' && discountPercent > 0 && (
                      <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 text-sm font-semibold mb-1">
                        {discountPercent}% OFF 🎉
                      </div>
                    )}
                    <div className="text-5xl font-bold text-white leading-none">
                      ${showPrice ? displayedPrice.toFixed(1) : '0'}
                    </div>
                    <div className="text-xl text-dark-300 font-semibold">{t.pricing.perMonth}</div>
                    {showPrice && showStruckMonthlyPrice && (
                      <div className="text-lg text-dark-500 line-through">
                        ${planItem.price.toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
                {showPrice && billingPeriod === 'annual' && (
                  <p className="text-sm text-dark-300 mt-3">{t.pricing.billedAnnually}</p>
                )}
                <div className="mt-4 inline-flex items-center gap-2 text-primary-400 font-semibold text-3xl">
                  <Sparkles className="w-5 h-5" />
                  <span>{planItem.credits}</span>
                </div>
                {costPerCreditValue !== null && (
                  <div className="mt-3">
                    <p className="text-xs text-dark-400">{t.pricing.costPerCreditLabel}</p>
                    <p className="text-sm text-white font-semibold">${costPerCreditValue.toFixed(4)}</p>
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {(t.pricing.planFeatures?.[planItem.id as keyof typeof t.pricing.planFeatures] ?? planItem.features).map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-dark-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleSubscribe(planItem.id as string)}
                disabled={isCurrentPlan || isLoading || loadingPlan !== null}
                className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  isCurrentPlan
                    ? 'bg-dark-700 text-dark-400 cursor-not-allowed'
                    : isLoading
                    ? 'bg-primary-500/50 text-white cursor-wait'
                    : isPopular
                    ? 'bg-primary-500 hover:bg-primary-600 text-white'
                    : 'bg-dark-700 hover:bg-dark-600 text-white'
                }`}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {t.pricing.processing}
                  </>
                ) : isCurrentPlan ? (
                  t.pricing.currentPlan
                ) : (
                  t.pricing.subscribe
                )}
              </button>
            </div>
          )
        })}
      </div>
      )}

      {/* FAQ */}
      <div className="mt-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">
          <span className="gradient-text">{t.pricing.faq.title}</span>
        </h2>

        <div className="space-y-4">
          {faqItems.map((item) => (
            <details key={item.question} className="group bg-dark-800/50 rounded-xl border border-dark-700">
              <summary className="flex justify-between items-center cursor-pointer p-4 text-white font-medium">
                {item.question}
                <span className="transform group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="px-4 pb-4 text-dark-400">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}

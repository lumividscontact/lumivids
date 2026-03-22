import { Check, Sparkles, Zap, Crown, Building2, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import BrandLogo from '@/components/BrandLogo'
import { useLanguage } from '@/i18n'
import { useSEO, SEO_PAGES } from '@/hooks'
import { PLANS } from '@/contexts/CreditsContext'

const planIcons: Record<string, typeof Zap> = {
  creator: Zap,
  studio: Crown,
  director: Building2,
}

// Use centralized plans from CreditsContext
const publicPlans = PLANS

export default function PublicPricingPage() {
  const { t } = useLanguage()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')
  const pricingSeo = t.pricing.seo
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://lumivids.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: pricingSeo.title,
        item: 'https://lumivids.com/plans',
      },
    ],
  }
  
  // SEO meta tags
  useSEO({
    title: pricingSeo.title,
    description: pricingSeo.description,
    keywords: pricingSeo.keywords,
    canonical: SEO_PAGES.publicPricing.canonical,
    image: SEO_PAGES.publicPricing.image,
    hreflang: {
      'pt-BR': '/plans?lang=pt',
      en: '/plans?lang=en',
      es: '/plans?lang=es',
      'x-default': '/plans',
    },
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Lumivids Plans',
        description: pricingSeo.description,
        brand: {
          '@type': 'Brand',
          name: 'Lumivids',
        },
        offers: publicPlans.map((planItem) => ({
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: planItem.price,
          name: planItem.name,
          description: t.pricing.creditsPerMonth.replace('{credits}', String(planItem.credits)),
          availability: 'https://schema.org/InStock',
          url: typeof window !== 'undefined' ? `${window.location.origin}/plans` : 'https://lumivids.com/plans',
        })),
      },
      breadcrumbSchema,
    ],
  })

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark-950/80 backdrop-blur-lg border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <BrandLogo />
            </Link>
            
            <div className="flex items-center gap-4">
              <Link to="/" className="text-dark-300 hover:text-white transition-colors flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t.common.back}
              </Link>
              <Link to="/auth?force=1" className="text-dark-300 hover:text-white transition-colors">
                {t.auth.login}
              </Link>
              <Link to="/auth" className="btn-primary">
                {t.home.getStarted}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="pt-24 pb-16 px-4">
        {/* Page Header */}
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">{t.pricing.title}</span>
          </h1>
          <p className="text-dark-400 text-lg">
            {t.pricing.subtitle}
          </p>
          
          <div className="mt-8 flex items-center justify-center">
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
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
          {publicPlans.map((planItem) => {
            const Icon = planIcons[planItem.id] ?? Sparkles
            const isPopular = planItem.popular
            const hasAnnualMonthlyPrice = typeof planItem.annualMonthlyPrice === 'number'
            const effectivePrice = billingPeriod === 'annual' && hasAnnualMonthlyPrice ? planItem.annualMonthlyPrice : planItem.price
            const showStruckMonthlyPrice = billingPeriod === 'annual' && hasAnnualMonthlyPrice && planItem.price > effectivePrice
            const discountPercent = showStruckMonthlyPrice
              ? Math.round(((planItem.price - effectivePrice) / planItem.price) * 100)
              : 0
            const showPrice = planItem.price > 0
            const costPerCreditValue = showPrice && planItem.credits > 0
              ? effectivePrice / planItem.credits
              : null

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
                        <p className="text-dark-300 text-sm mt-2">
                          {t.pricing.planTaglines?.[planItem.id as keyof typeof t.pricing.planTaglines] ?? planItem.tagline}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {billingPeriod === 'annual' && discountPercent > 0 && (
                        <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 text-sm font-semibold mb-1">
                          {discountPercent}% OFF 🎉
                        </div>
                      )}
                      <div className="text-5xl font-bold text-white leading-none">
                        ${showPrice ? effectivePrice.toFixed(1) : '0'}
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
                <Link
                  to="/auth"
                  className={`block w-full py-3 rounded-xl font-semibold text-center transition-all duration-200 ${
                    isPopular
                      ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/25'
                      : 'bg-dark-700 hover:bg-dark-600 text-white'
                  }`}
                >
                  {t.pricing.startFree}
                </Link>
              </div>
            )
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <div className="inline-block bg-gradient-to-r from-primary-500/20 to-accent-500/20 border border-primary-500/50 rounded-2xl p-8 max-w-2xl">
            <h3 className="text-2xl font-bold text-white mb-4">
              {t.pricing.publicCtaTitle}
            </h3>
            <p className="text-dark-400 mb-6">
              {t.pricing.publicCtaSubtitle}
            </p>
            <Link to="/auth" className="btn-primary inline-flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {t.home.getStarted}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

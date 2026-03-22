import { 
  Sparkles, 
  Video, 
  ImagePlus, 
  ArrowRight, 
  Play,
  Menu,
  X,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense, useMemo } from 'react'
import BrandLogo from '@/components/BrandLogo'
import { useLanguage } from '@/i18n'
import LanguageSelector from '@/components/LanguageSelector'
import { useAuth } from '@/contexts/AuthContext'
import { useSEO, getSeoPages } from '@/hooks'
import { PLANS } from '@/contexts/CreditsContext'
import {
  RESOLUTIONS,
  TEXT_TO_VIDEO_MODELS,
  IMAGE_TO_VIDEO_MODELS,
  TEXT_TO_IMAGE_MODELS,
  IMAGE_TO_IMAGE_MODELS,
} from '@/config/models'
const LandingDeferredSections = lazy(() => import('./LandingPage/LandingDeferredSections'))

const SITE_URL = 'https://lumivids.com'
const SOCIAL_LINKS = [
  'https://x.com/lumivids',
  'https://instagram.com/lumivids',
  'https://youtube.com/@lumivids',
]
const DEMO_VIDEOS = [
  {
    src: 'https://lumivids.com/videos/city.mp4',
    title: 'AI City Demo',
    description: 'Demo reel showing AI-generated city footage created with Lumivids.',
  },
  {
    src: 'https://lumivids.com/videos/lp/space.mp4',
    title: 'AI Space Demo',
    description: 'Demo reel showing AI-generated space footage created with Lumivids.',
  },
  {
    src: 'https://lumivids.com/videos/lp/pets.mp4',
    title: 'AI Pets Demo',
    description: 'Demo reel showing AI-generated pet footage created with Lumivids.',
  },
  {
    src: 'https://lumivids.com/videos/lp/paisagem.mp4',
    title: 'AI Landscape Demo',
    description: 'Demo reel showing AI-generated landscape footage created with Lumivids.',
  },
]

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [isProcessingAuth, setIsProcessingAuth] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { t } = useLanguage()
  const { isAuthenticated, isLoading } = useAuth()
  const landingSeo = t.landing.seo
  const faqStructuredData = useMemo(
    () => [
      'whatAreCredits',
      'doCreditsAccumulate',
      'canUpgrade',
      'canCancel',
    ].map((key) => {
      const item = t.pricing.faq[key as keyof typeof t.pricing.faq] as { question: string; answer: string }

      return {
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      }
    }),
    [t.pricing.faq],
  )

  const landingStructuredData = useMemo(() => {
    const paidPlans = PLANS.filter((plan) => plan.price > 0)
    const lowPrice = Math.min(...paidPlans.map((plan) => plan.annualMonthlyPrice ?? plan.price))
    const highPrice = Math.max(...paidPlans.map((plan) => plan.price))

    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Lumivids',
        url: SITE_URL,
        description: landingSeo.description,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/plans`,
          'query-input': 'required name=plan',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Lumivids',
        url: SITE_URL,
        logo: `${SITE_URL}/logo.svg`,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: 'contact@lumivids.com',
          availableLanguage: ['pt-BR', 'en', 'es'],
        },
        sameAs: SOCIAL_LINKS,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Lumivids',
        url: SITE_URL,
        applicationCategory: 'MultimediaApplication',
        applicationSubCategory: 'AI Video Generator',
        operatingSystem: 'Web',
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'USD',
          lowPrice,
          highPrice,
          offerCount: paidPlans.length,
          url: `${SITE_URL}/plans`,
        },
        featureList: [
          'Text to video generation',
          'Image to video generation',
          'Text to image generation',
          'Image to image generation',
          'Multiple AI model access',
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqStructuredData,
      },
      ...DEMO_VIDEOS.map((video) => ({
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: video.title,
        description: video.description,
        contentUrl: video.src,
        embedUrl: video.src,
        publisher: {
          '@type': 'Organization',
          name: 'Lumivids',
          logo: {
            '@type': 'ImageObject',
            url: `${SITE_URL}/logo.svg`,
          },
        },
      })),
    ]
  }, [faqStructuredData, landingSeo.description])
  
  // SEO meta tags
  useSEO({
    title: landingSeo.title,
    description: landingSeo.description,
    keywords: landingSeo.keywords,
    canonical: getSeoPages(t).landing.canonical,
    image: getSeoPages(t).landing.image,
    hreflang: {
      'pt-BR': '/?lang=pt',
      en: '/?lang=en',
      es: '/?lang=es',
      'x-default': '/',
    },
    structuredData: landingStructuredData,
  })

  // Check if we're coming back from OAuth callback
  useEffect(() => {
    const url = new URL(window.location.href)
    const hasAuthCode = url.searchParams.has('code') || url.hash.includes('access_token')
    
    if (hasAuthCode) {
      // Wait for Supabase to process the OAuth callback
      const timer = setTimeout(() => {
        setIsProcessingAuth(false)
      }, 2000)
      return () => clearTimeout(timer)
    } else {
      setIsProcessingAuth(false)
    }
  }, [])

  const stats = useMemo(() => {
    const models = [
      ...TEXT_TO_VIDEO_MODELS,
      ...IMAGE_TO_VIDEO_MODELS,
      ...TEXT_TO_IMAGE_MODELS,
      ...IMAGE_TO_IMAGE_MODELS,
    ]

    const maxDurationSeconds = models.reduce((maxDuration, model) => {
      const modelMaxDuration = model.maxDuration ?? model.defaultDuration ?? model.minDuration ?? 0
      return Math.max(maxDuration, modelMaxDuration)
    }, 0)

    const maxResolution = models
      .flatMap((model) => model.supportedResolutions)
      .reduce((bestResolution, candidateResolution) => {
        const bestPixels = RESOLUTIONS[bestResolution].width * RESOLUTIONS[bestResolution].height
        const candidatePixels = RESOLUTIONS[candidateResolution].width * RESOLUTIONS[candidateResolution].height
        return candidatePixels > bestPixels ? candidateResolution : bestResolution
      }, '480p' as const)

    return {
      modelCount: models.length,
      maxResolution: maxResolution.toUpperCase(),
      maxDuration: `${maxDurationSeconds}s`,
    }
  }, [])

  // Show loading while processing auth or checking session
  if (isLoading || isProcessingAuth) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <span className="text-dark-300 text-sm">{t.common.loading}</span>
      </div>
    )
  }

  // Redirect authenticated users to home
  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  const testimonials = t.landing?.testimonials?.items || []

  const faqs = [
    { key: 'whatAreCredits' },
    { key: 'doCreditsAccumulate' },
    { key: 'canUpgrade' },
    { key: 'canCancel' },
  ]

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark-950/80 backdrop-blur-lg border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <BrandLogo />
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-dark-300 hover:text-white transition-colors">
                {t.landing.nav.features}
              </a>
              <a href="#models" className="text-dark-300 hover:text-white transition-colors">
                {t.landing.nav.models}
              </a>
              <a href="#testimonials" className="text-dark-300 hover:text-white transition-colors">
                {t.landing.nav.testimonials}
              </a>
              <Link to="/plans" className="text-dark-300 hover:text-white transition-colors">
                {t.nav.pricing}
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <LanguageSelector />

              <div className="hidden md:flex items-center gap-4">
                <Link to="/auth?force=1" className="text-dark-300 hover:text-white transition-colors">
                  {t.auth.login}
                </Link>
                <Link to="/text-to-video" className="btn-primary flex items-center gap-2">
                  {t.home.getStarted}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg bg-dark-800 text-dark-200 hover:text-white hover:bg-dark-700 transition-colors"
                aria-label={isMobileMenuOpen
                  ? t.landing.nav.closeMenu
                  : t.landing.nav.openMenu
                }
                aria-expanded={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="md:hidden pb-4 border-t border-dark-800/80">
              <nav className="pt-4 flex flex-col gap-1">
                <a
                  href="#features"
                  className="px-2 py-2 text-dark-300 hover:text-white transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t.landing.nav.features}
                </a>
                <a
                  href="#models"
                  className="px-2 py-2 text-dark-300 hover:text-white transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t.landing.nav.models}
                </a>
                <a
                  href="#testimonials"
                  className="px-2 py-2 text-dark-300 hover:text-white transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t.landing.nav.testimonials}
                </a>
                <Link
                  to="/plans"
                  className="px-2 py-2 text-dark-300 hover:text-white transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t.nav.pricing}
                </Link>
              </nav>

              <div className="mt-4 pt-4 border-t border-dark-800/80 flex flex-col gap-2">
                <Link
                  to="/auth?force=1"
                  className="w-full text-center py-2.5 rounded-xl bg-dark-800 text-dark-200 hover:text-white hover:bg-dark-700 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t.auth.login}
                </Link>
                <Link
                  to="/text-to-video"
                  className="w-full btn-primary flex items-center justify-center gap-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t.home.getStarted}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-accent-500/10" />
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent-500/20 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/30 mb-8">
              <Sparkles className="w-4 h-4 text-primary-400" />
              <span className="text-primary-400 text-sm font-medium">
                {t.landing.hero.badge}
              </span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              {t.home.title.split(' ').slice(0, 3).join(' ')}{' '}
              <span className="gradient-text">{t.home.title.split(' ').slice(3).join(' ')}</span>
            </h1>
            
            <p className="text-xl text-dark-300 mb-10 max-w-2xl mx-auto">
              {t.home.subtitle}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link to="/text-to-video" className="btn-primary text-lg px-8 py-4 flex items-center gap-2 group">
                <Video className="w-5 h-5" />
                {t.nav.textToVideo}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/image-to-video" className="btn-secondary text-lg px-8 py-4 flex items-center gap-2 group border-2 border-dark-600 hover:border-primary-500">
                <ImagePlus className="w-5 h-5" />
                {t.nav.imageToVideo}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Video Gallery Preview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16 max-w-4xl mx-auto">
              {DEMO_VIDEOS.map((item, i) => (
                <div 
                  key={i} 
                  className="relative aspect-video rounded-xl overflow-hidden border border-dark-700 group cursor-pointer hover:border-primary-500 transition-all hover:scale-105"
                  onMouseEnter={(e) => {
                    const video = e.currentTarget.querySelector('video')
                    video?.play()
                  }}
                  onMouseLeave={(e) => {
                    const video = e.currentTarget.querySelector('video')
                    if (video) {
                      video.pause()
                      video.currentTime = 0
                    }
                  }}
                >
                  <video
                    src={item.src}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    preload="none"
                    aria-label={item.title}
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2 w-6 h-6 rounded-full bg-dark-900/80 flex items-center justify-center">
                    <Play className="w-3 h-3 text-white fill-white" />
                  </div>
                </div>
              ))}
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">{stats.modelCount}+</div>
                <div className="text-sm text-dark-400">{t.home.stats.modelsAvailable}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">{stats.maxResolution}</div>
                <div className="text-sm text-dark-400">{t.landing.hero.maxResolutionLabel}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">{stats.maxDuration}</div>
                <div className="text-sm text-dark-400">{t.landing.hero.maxDurationLabel}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white">100%</div>
                <div className="text-sm text-dark-400">{t.landing.hero.safeLabel}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="py-12 text-center text-dark-400 text-sm">
            {t.common.loading}
          </div>
        }
      >
        <LandingDeferredSections
          t={t}
          testimonials={testimonials}
          faqs={faqs}
          openFaq={openFaq}
          onToggleFaq={setOpenFaq}
        />
      </Suspense>
    </div>
  )
}

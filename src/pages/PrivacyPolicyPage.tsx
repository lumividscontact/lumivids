import { Link } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import { useLanguage } from '@/i18n'
import { useSEO, getSeoPages } from '@/hooks'

const SITE_URL = 'https://lumivids.com'

export default function PrivacyPolicyPage() {
  const { t } = useLanguage()
  const privacySeo = t.legal.privacy.seo
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: privacySeo.title,
        item: `${SITE_URL}/privacy`,
      },
    ],
  }

  useSEO({
    title: privacySeo.title,
    description: privacySeo.description,
    keywords: privacySeo.keywords,
    canonical: getSeoPages(t).privacy.canonical,
    image: getSeoPages(t).privacy.image,
    hreflang: {
      'pt-BR': '/privacy?lang=pt',
      en: '/privacy?lang=en',
      es: '/privacy?lang=es',
      'x-default': '/privacy',
    },
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: privacySeo.title,
        description: privacySeo.description,
        url: `${SITE_URL}/privacy`,
      },
      breadcrumbSchema,
    ],
  })

  const sections = [
    t.legal.privacy.collection,
    t.legal.privacy.usage,
    t.legal.privacy.aiUsage,
    t.legal.privacy.sharing,
    t.legal.privacy.security,
    t.legal.privacy.retention,
    t.legal.privacy.rights,
    t.legal.privacy.children,
    t.legal.privacy.thirdPartyLinks,
    t.legal.privacy.changes,
    t.legal.privacy.contact,
  ]

  return (
    <div className="min-h-screen gradient-bg">
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark-950/80 backdrop-blur-lg border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <BrandLogo />
            </Link>

            <Link to="/" className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t.common.back}
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-primary-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">{t.auth.privacy}</h1>
            <p className="text-dark-400 text-sm">
              {t.legal.privacy.lastUpdated}: {t.legal.privacy.revisionDate}
            </p>
          </div>

          <div className="card mb-6">
            <p className="text-dark-300 leading-relaxed whitespace-pre-line">{t.legal.privacy.intro}</p>
          </div>

          <div className="space-y-6">
            {sections.map((section, index) => (
              <div className="card" key={section.title}>
                <h2 className="text-2xl font-bold text-white mb-3">{index + 1}. {section.title}</h2>
                <p className="text-dark-300 leading-relaxed whitespace-pre-line">{section.content}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-8 px-4 border-t border-dark-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo
              iconClassName="w-8 h-8 object-contain shrink-0"
              textClassName="text-xl font-bold gradient-text"
            />
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/terms" className="text-dark-400 hover:text-white transition-colors">
              {t.auth.terms}
            </Link>
            <Link to="/privacy" className="text-primary-400">
              {t.auth.privacy}
            </Link>
          </div>
          <p className="text-dark-400 text-sm">© {new Date().getFullYear()} Lumivids</p>
        </div>
      </footer>
    </div>
  )
}

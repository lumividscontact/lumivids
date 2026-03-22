import { Link } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import { useLanguage } from '@/i18n'
import { useSEO, SEO_PAGES } from '@/hooks'

const SITE_URL = 'https://lumivids.com'

export default function TermsOfServicePage() {
  const { t } = useLanguage()
  const termsSeo = t.legal.terms.seo
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
        name: termsSeo.title,
        item: `${SITE_URL}/terms`,
      },
    ],
  }

  useSEO({
    title: termsSeo.title,
    description: termsSeo.description,
    keywords: termsSeo.keywords,
    canonical: SEO_PAGES.terms.canonical,
    image: SEO_PAGES.terms.image,
    hreflang: {
      'pt-BR': '/terms?lang=pt',
      en: '/terms?lang=en',
      es: '/terms?lang=es',
      'x-default': '/terms',
    },
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: termsSeo.title,
        description: termsSeo.description,
        url: `${SITE_URL}/terms`,
      },
      breadcrumbSchema,
    ],
  })

  const sections = [
    t.legal.terms.about,
    t.legal.terms.account,
    t.legal.terms.platformUse,
    t.legal.terms.credits,
    t.legal.terms.userContent,
    t.legal.terms.aiContent,
    t.legal.terms.license,
    t.legal.terms.ip,
    t.legal.terms.thirdPartyServices,
    t.legal.terms.availability,
    t.legal.terms.liability,
    t.legal.terms.accountTermination,
    t.legal.terms.changes,
    t.legal.terms.governingLaw,
    t.legal.terms.contact,
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
            
            <Link to="/" className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t.common.back}
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 h-8 text-primary-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {t.auth.terms}
            </h1>
            <p className="text-dark-400 text-sm">
              {t.legal.terms.lastUpdated}: {t.legal.terms.revisionDate}
            </p>
          </div>

          <div className="card mb-8">
            <p className="text-dark-300 leading-relaxed whitespace-pre-line">{t.legal.terms.intro}</p>
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

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-dark-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo
              iconClassName="w-8 h-8 object-contain shrink-0"
              textClassName="text-xl font-bold gradient-text"
            />
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/terms" className="text-primary-400">
              {t.auth.terms}
            </Link>
            <Link to="/privacy" className="text-dark-400 hover:text-white transition-colors">
              {t.auth.privacy}
            </Link>
          </div>
          <p className="text-dark-400 text-sm">
            © {new Date().getFullYear()} Lumivids
          </p>
        </div>
      </footer>
    </div>
  )
}

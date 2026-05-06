import { useEffect } from 'react'
import { getLanguageBasePath, getPathPrefixLanguage, stripLanguagePrefix } from '@/i18n/runtime'

type StructuredData = Record<string, unknown> | Record<string, unknown>[]

interface SEOConfig {
  title?: string
  description?: string
  keywords?: readonly string[]
  image?: string
  url?: string
  type?: 'website' | 'article' | 'product'
  noindex?: boolean
  canonical?: string
  hreflang?: Partial<Record<'pt-BR' | 'en' | 'es' | 'id' | 'x-default', string>>
  structuredData?: StructuredData
}

const DEFAULT_CONFIG: SEOConfig = {
  title: 'Lumivids - AI Video & Image Generator',
  description: 'Lumivids is a free AI studio for text to video, image to video, text to image, and image to image creation. Generate with Kling, Sora, MiniMax, Veo, and Flux in one workflow.',
  keywords: [
    'AI video generator',
    'text to video',
    'image to video',
    'AI image generator',
    'artificial intelligence',
    'video generator',
    'Lumivids',
    'MiniMax',
    'Kling',
    'Luma Dream Machine',
    'Sora',
    'Google Veo',
  ],
  image: '/og/landing.png',
  type: 'website',
}

const SITE_NAME = 'Lumivids'
const BASE_URL = typeof window !== 'undefined' ? window.location.origin.replace(/^https?:\/\/(www\.)?/, 'https://') : 'https://lumivids.com'
const SUPPORTED_HREFLANGS: Array<'pt-BR' | 'en' | 'es' | 'id'> = ['pt-BR', 'en', 'es', 'id']
const JSON_LD_ELEMENT_ID = 'lumivids-seo-jsonld'
const OG_LOCALE_BY_HTML_LANG: Record<string, string> = {
  'pt-BR': 'pt_BR',
  en: 'en_US',
  es: 'es_ES',
  id: 'id_ID',
}
const OG_ALTERNATE_ELEMENT_SELECTOR = 'meta[property="og:locale:alternate"][data-seo="true"]'

function normalizeCanonicalPath(pathname: string): string {
  const stripped = stripLanguagePrefix(pathname)
  return stripped === '/' ? '/' : stripped
}

function getLocalizedPath(pathname: string, language: 'pt' | 'en' | 'es' | 'id'): string {
  const normalized = normalizeCanonicalPath(pathname)
  const basePath = getLanguageBasePath(language)

  if (normalized === '/') {
    return basePath || '/'
  }

  return `${basePath}${normalized}`
}

const getImageMimeType = (imageUrl: string): string => {
  const normalized = imageUrl.toLowerCase()
  if (normalized.endsWith('.png')) return 'image/png'
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg'
  if (normalized.endsWith('.webp')) return 'image/webp'
  if (normalized.endsWith('.gif')) return 'image/gif'
  if (normalized.endsWith('.svg')) return 'image/svg+xml'
  return 'image/png'
}

/**
 * Hook for managing dynamic SEO meta tags
 * Updates document head with provided SEO configuration
 */
export function useSEO(config: SEOConfig = {}) {
  const {
    title,
    description,
    keywords,
    image,
    url,
    type,
    noindex,
    canonical,
    hreflang,
    structuredData,
  } = config
  const keywordsKey = keywords?.join(',')
  const hreflangKey = JSON.stringify(hreflang)
  const structuredDataKey = JSON.stringify(structuredData)

  useEffect(() => {
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      title,
      description,
      keywords,
      image,
      url,
      type,
      noindex,
      canonical,
      hreflang,
      structuredData,
    }
    const mergedTitle = mergedConfig.title
    const mergedDescription = mergedConfig.description
    const mergedKeywords = mergedConfig.keywords
    const mergedImage = mergedConfig.image
    const mergedUrl = mergedConfig.url
    const mergedType = mergedConfig.type
    const mergedNoindex = mergedConfig.noindex
    const mergedCanonical = mergedConfig.canonical

    // Helper to set or create meta tag
    const setMetaTag = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`
      let element = document.querySelector(selector) as HTMLMetaElement
      
      if (!element) {
        element = document.createElement('meta')
        if (isProperty) {
          element.setAttribute('property', name)
        } else {
          element.setAttribute('name', name)
        }
        document.head.appendChild(element)
      }
      element.setAttribute('content', content)
    }

    // Helper to set or create link tag
    const setLinkTag = (rel: string, href: string, hreflang?: string) => {
      const selector = hreflang
        ? `link[rel="${rel}"][hreflang="${hreflang}"]`
        : `link[rel="${rel}"]`
      let element = document.querySelector(selector) as HTMLLinkElement
      
      if (!element) {
        element = document.createElement('link')
        element.setAttribute('rel', rel)
        if (hreflang) {
          element.setAttribute('hreflang', hreflang)
        }
        document.head.appendChild(element)
      }
      element.setAttribute('href', href)
    }

    const removeSeoAlternates = () => {
      const alternateLinks = document.querySelectorAll('link[rel="alternate"][data-seo="true"]')
      alternateLinks.forEach((link) => link.remove())
    }

    const setOgLocaleAlternates = (currentLocale: string) => {
      const existingAlternates = document.querySelectorAll(OG_ALTERNATE_ELEMENT_SELECTOR)
      existingAlternates.forEach((element) => element.remove())

      Object.values(OG_LOCALE_BY_HTML_LANG)
        .filter((locale) => locale !== currentLocale)
        .forEach((locale) => {
          const element = document.createElement('meta')
          element.setAttribute('property', 'og:locale:alternate')
          element.setAttribute('content', locale)
          element.setAttribute('data-seo', 'true')
          document.head.appendChild(element)
        })
    }

    const setJsonLd = (data?: StructuredData) => {
      const existing = document.getElementById(JSON_LD_ELEMENT_ID)
      if (!data) {
        if (existing) {
          existing.remove()
        }
        return
      }

      const script = existing ?? document.createElement('script')
      script.id = JSON_LD_ELEMENT_ID
      script.setAttribute('type', 'application/ld+json')
      script.textContent = JSON.stringify(data)

      if (!existing) {
        document.head.appendChild(script)
      }
    }

    // Title
    const fullTitle = mergedTitle === DEFAULT_CONFIG.title 
      ? mergedTitle 
      : `${mergedTitle} | ${SITE_NAME}`
    document.title = fullTitle || SITE_NAME

    // Basic meta tags
    if (mergedDescription) {
      setMetaTag('description', mergedDescription)
    }
    
    if (mergedKeywords && mergedKeywords.length > 0) {
      setMetaTag('keywords', mergedKeywords.join(', '))
    }

    // Robots
    if (mergedNoindex) {
      setMetaTag('robots', 'noindex, nofollow')
    } else {
      setMetaTag('robots', 'index, follow')
    }

    // Canonical URL
    const currentPathname = typeof window !== 'undefined' ? window.location.pathname : '/'
    const currentLanguage = getPathPrefixLanguage(currentPathname) ?? 'en'
    const isAbsoluteCanonical = Boolean(mergedCanonical && mergedCanonical.startsWith('http'))
    const canonicalPath = mergedCanonical && !isAbsoluteCanonical
      ? getLocalizedPath(mergedCanonical, currentLanguage)
      : currentPathname
    const pagePath = mergedUrl || (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '')
    const pageUrl = pagePath.startsWith('http') ? pagePath : `${BASE_URL}${pagePath}`
    if (canonicalPath || pageUrl) {
      const canonicalUrl = mergedCanonical
        ? (isAbsoluteCanonical ? mergedCanonical : `${BASE_URL}${canonicalPath}`)
        : pageUrl
      setLinkTag('canonical', canonicalUrl)

      // Hreflang alternates — skip for noindex pages (they must not be in hreflang clusters)
      removeSeoAlternates()
      if (!mergedNoindex) {
        const currentLang = getPathPrefixLanguage(window.location.pathname) ?? 'en'

        const hreflangConfig = hreflang || {
          'pt-BR': `${BASE_URL}${getLocalizedPath(window.location.pathname, 'pt')}`,
          en: `${BASE_URL}${getLocalizedPath(window.location.pathname, 'en')}`,
          es: `${BASE_URL}${getLocalizedPath(window.location.pathname, 'es')}`,
          id: `${BASE_URL}${getLocalizedPath(window.location.pathname, 'id')}`,
          'x-default': `${BASE_URL}${getLocalizedPath(window.location.pathname, 'en')}`,
        }

        // Ensure self-referencing hreflang for the current language
        if (currentLang === 'pt') {
          hreflangConfig['pt-BR'] = `${BASE_URL}${getLocalizedPath(window.location.pathname, 'pt')}`
        } else if (currentLang === 'es') {
          hreflangConfig['es'] = `${BASE_URL}${getLocalizedPath(window.location.pathname, 'es')}`
        } else if (currentLang === 'id') {
          hreflangConfig['id'] = `${BASE_URL}${getLocalizedPath(window.location.pathname, 'id')}`
        } else {
          hreflangConfig['en'] = `${BASE_URL}${getLocalizedPath(window.location.pathname, 'en')}`
        }

        for (const locale of SUPPORTED_HREFLANGS) {
          const href = hreflangConfig[locale]
          if (href) {
            const fullHref = href.startsWith('http') ? href : `${BASE_URL}${href}`
            setLinkTag('alternate', fullHref, locale)
            const element = document.querySelector(`link[rel="alternate"][hreflang="${locale}"]`)
            if (element) element.setAttribute('data-seo', 'true')
          }
        }

        if (hreflangConfig['x-default']) {
          const defaultHref = hreflangConfig['x-default']!
          const fullDefaultHref = defaultHref.startsWith('http') ? defaultHref : `${BASE_URL}${defaultHref}`
          setLinkTag('alternate', fullDefaultHref, 'x-default')
          const element = document.querySelector('link[rel="alternate"][hreflang="x-default"]')
          if (element) element.setAttribute('data-seo', 'true')
        }
      }
    }

    // Open Graph
    setMetaTag('og:title', fullTitle || SITE_NAME, true)
    if (mergedDescription) {
      setMetaTag('og:description', mergedDescription, true)
    }
    setMetaTag('og:type', mergedType || 'website', true)
    setMetaTag('og:site_name', SITE_NAME, true)
    const htmlLang = document.documentElement.lang || 'en'
    const currentOgLocale = OG_LOCALE_BY_HTML_LANG[htmlLang] || OG_LOCALE_BY_HTML_LANG.en
    setMetaTag('og:locale', currentOgLocale, true)
    setOgLocaleAlternates(currentOgLocale)
    if (pageUrl) {
      setMetaTag('og:url', pageUrl, true)
    }
    if (mergedImage) {
      const imageUrl = mergedImage.startsWith('http') ? mergedImage : `${BASE_URL}${mergedImage}`
      setMetaTag('og:image', imageUrl, true)
      setMetaTag('og:image:width', '1200', true)
      setMetaTag('og:image:height', '630', true)
      setMetaTag('og:image:type', getImageMimeType(imageUrl), true)
    }

    // Twitter Card
    setMetaTag('twitter:card', 'summary_large_image')
    setMetaTag('twitter:title', fullTitle || SITE_NAME)
    if (mergedDescription) {
      setMetaTag('twitter:description', mergedDescription)
    }
    if (mergedImage) {
      const imageUrl = mergedImage.startsWith('http') ? mergedImage : `${BASE_URL}${mergedImage}`
      setMetaTag('twitter:image', imageUrl)
    }

    // JSON-LD structured data
    setJsonLd(structuredData)

    // Cleanup function - reset to defaults when component unmounts
    return () => {
      document.title = DEFAULT_CONFIG.title || SITE_NAME
      removeSeoAlternates()
      const existingAlternates = document.querySelectorAll(OG_ALTERNATE_ELEMENT_SELECTOR)
      existingAlternates.forEach((element) => element.remove())
      setJsonLd(undefined)
    }
  }, [canonical, description, hreflang, hreflangKey, image, keywords, keywordsKey, noindex, structuredData, structuredDataKey, title, type, url])
}

/**
 * Build SEO configurations for each page from the active translations.
 * Static props (canonical, image, noindex) stay fixed; text comes from i18n.
 */
export function getSeoPages(t: {
  home: { seo: { title: string; description: string } };
  landing: { seo: { title: string; description: string; keywords: string[] } };
  textToVideo: { seo: { title: string; description: string; keywords: string[] } };
  imageToVideo: { seo: { title: string; description: string; keywords: string[] } };
  textToImage: { seo: { title: string; description: string; keywords: string[] } };
  imageToImage: { seo: { title: string; description: string; keywords: string[] } };
  myVideos: { seo: { title: string; description: string } };
  myFavorites: { seo: { title: string; description: string } };
  pricing: { seo: { title: string; description: string; keywords: string[] } };
  myAccount: { seo: { title: string; description: string } };
  auth: { seo: { title: string; description: string } };
  legal: {
    privacy: { seo: { title: string; description: string; keywords: string[] } };
    terms: { seo: { title: string; description: string; keywords: string[] } };
  };
}) {
  return {
    home: {
      title: t.home.seo.title,
      description: t.home.seo.description,
    },
    landing: {
      title: t.landing.seo.title,
      description: t.landing.seo.description,
      keywords: t.landing.seo.keywords,
      canonical: '/',
      image: '/og/landing.png',
    },
    textToVideo: {
      title: t.textToVideo.seo.title,
      description: t.textToVideo.seo.description,
      keywords: t.textToVideo.seo.keywords,
      image: '/og/text-to-video.png',
      canonical: '/text-to-video',
    },
    imageToVideo: {
      title: t.imageToVideo.seo.title,
      description: t.imageToVideo.seo.description,
      keywords: t.imageToVideo.seo.keywords,
      image: '/og/image-to-video.png',
      canonical: '/image-to-video',
    },
    textToImage: {
      title: t.textToImage.seo.title,
      description: t.textToImage.seo.description,
      keywords: t.textToImage.seo.keywords,
      image: '/og/text-to-image.png',
      canonical: '/text-to-image',
    },
    imageToImage: {
      title: t.imageToImage.seo.title,
      description: t.imageToImage.seo.description,
      keywords: t.imageToImage.seo.keywords,
      image: '/og/image-to-image.png',
      canonical: '/image-to-image',
    },
    myVideos: {
      title: t.myVideos.seo.title,
      description: t.myVideos.seo.description,
    },
    favorites: {
      title: t.myFavorites.seo.title,
      description: t.myFavorites.seo.description,
    },
    pricing: {
      title: t.pricing.seo.title,
      description: t.pricing.seo.description,
      keywords: t.pricing.seo.keywords,
    },
    publicPricing: {
      title: t.pricing.seo.title,
      description: t.pricing.seo.description,
      keywords: t.pricing.seo.keywords,
      canonical: '/plans',
      image: '/og/plans.png',
    },
    account: {
      title: t.myAccount.seo.title,
      description: t.myAccount.seo.description,
      noindex: true,
    },
    privacy: {
      title: t.legal.privacy.seo.title,
      description: t.legal.privacy.seo.description,
      canonical: '/privacy',
      image: '/og/privacy.png',
    },
    terms: {
      title: t.legal.terms.seo.title,
      description: t.legal.terms.seo.description,
      canonical: '/terms',
      image: '/og/terms.png',
    },
    auth: {
      title: t.auth.seo.title,
      description: t.auth.seo.description,
      noindex: true,
      canonical: '/auth',
    },
  } as const
}

export type SeoPages = ReturnType<typeof getSeoPages>
export type SEOPageKey = keyof SeoPages

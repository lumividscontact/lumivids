import { useEffect } from 'react'

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
  hreflang?: Partial<Record<'pt-BR' | 'en' | 'es' | 'x-default', string>>
  structuredData?: StructuredData
}

const DEFAULT_CONFIG: SEOConfig = {
  title: 'Lumivids - AI Video & Image Generator',
  description: 'Create stunning videos and images with artificial intelligence. Turn text into video, animate images, and more with next-generation AI models.',
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
  image: '/og/landing.svg',
  type: 'website',
}

const SITE_NAME = 'Lumivids'
const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://lumivids.com'
const SUPPORTED_HREFLANGS: Array<'pt-BR' | 'en' | 'es'> = ['pt-BR', 'en', 'es']
const JSON_LD_ELEMENT_ID = 'lumivids-seo-jsonld'
const OG_LOCALE_BY_HTML_LANG: Record<string, string> = {
  'pt-BR': 'pt_BR',
  en: 'en_US',
  es: 'es_ES',
}
const OG_ALTERNATE_ELEMENT_SELECTOR = 'meta[property="og:locale:alternate"][data-seo="true"]'

/**
 * Hook for managing dynamic SEO meta tags
 * Updates document head with provided SEO configuration
 */
export function useSEO(config: SEOConfig = {}) {
  useEffect(() => {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config }
    const {
      title,
      description,
      keywords,
      image,
      url,
      type,
      noindex,
      canonical,
    } = mergedConfig

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
    const fullTitle = title === DEFAULT_CONFIG.title 
      ? title 
      : `${title} | ${SITE_NAME}`
    document.title = fullTitle || SITE_NAME

    // Basic meta tags
    if (description) {
      setMetaTag('description', description)
    }
    
    if (keywords && keywords.length > 0) {
      setMetaTag('keywords', keywords.join(', '))
    }

    // Robots
    if (noindex) {
      setMetaTag('robots', 'noindex, nofollow')
    } else {
      setMetaTag('robots', 'index, follow')
    }

    // Canonical URL
    const pagePath = url || (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '')
    const pageUrl = pagePath.startsWith('http') ? pagePath : `${BASE_URL}${pagePath}`
    if (canonical || pageUrl) {
      const canonicalUrl = canonical ? (canonical.startsWith('http') ? canonical : `${BASE_URL}${canonical}`) : pageUrl
      setLinkTag('canonical', canonicalUrl)

      // Hreflang alternates
      removeSeoAlternates()
      const hreflangConfig = config.hreflang || {
        'pt-BR': `${BASE_URL}${window.location.pathname}?lang=pt`,
        en: `${BASE_URL}${window.location.pathname}?lang=en`,
        es: `${BASE_URL}${window.location.pathname}?lang=es`,
        'x-default': `${BASE_URL}${window.location.pathname}`,
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

    // Open Graph
    setMetaTag('og:title', fullTitle || SITE_NAME, true)
    if (description) {
      setMetaTag('og:description', description, true)
    }
    setMetaTag('og:type', type || 'website', true)
    setMetaTag('og:site_name', SITE_NAME, true)
    const htmlLang = document.documentElement.lang || 'en'
    const currentOgLocale = OG_LOCALE_BY_HTML_LANG[htmlLang] || OG_LOCALE_BY_HTML_LANG.en
    setMetaTag('og:locale', currentOgLocale, true)
    setOgLocaleAlternates(currentOgLocale)
    if (pageUrl) {
      setMetaTag('og:url', pageUrl, true)
    }
    if (image) {
      const imageUrl = image.startsWith('http') ? image : `${BASE_URL}${image}`
      setMetaTag('og:image', imageUrl, true)
      setMetaTag('og:image:width', '1200', true)
      setMetaTag('og:image:height', '630', true)
    }

    // Twitter Card
    setMetaTag('twitter:card', 'summary_large_image')
    setMetaTag('twitter:title', fullTitle || SITE_NAME)
    if (description) {
      setMetaTag('twitter:description', description)
    }
    if (image) {
      const imageUrl = image.startsWith('http') ? image : `${BASE_URL}${image}`
      setMetaTag('twitter:image', imageUrl)
    }

    // JSON-LD structured data
    setJsonLd(config.structuredData)

    // Cleanup function - reset to defaults when component unmounts
    return () => {
      document.title = DEFAULT_CONFIG.title || SITE_NAME
      removeSeoAlternates()
      const existingAlternates = document.querySelectorAll(OG_ALTERNATE_ELEMENT_SELECTOR)
      existingAlternates.forEach((element) => element.remove())
      setJsonLd(undefined)
    }
  }, [config.title, config.description, config.keywords?.join(','), config.image, config.url, config.type, config.noindex, config.canonical, JSON.stringify(config.hreflang), JSON.stringify(config.structuredData)])
}

/**
 * SEO configurations for each page
 */
export const SEO_PAGES = {
  home: {
    title: 'Dashboard',
    description: 'Seu painel de criação de vídeos e imagens com IA. Acesse seus projetos, veja suas gerações recentes e comece a criar.',
  },
  landing: {
    title: 'Lumivids - AI Video & Image Generator',
    description: 'Create stunning videos and images with artificial intelligence. Turn text into video, animate images, and more with next-generation AI models.',
    keywords: ['AI video generator', 'text to video', 'image to video', 'AI image generator', 'inteligência artificial', 'gerador de vídeo'],
    canonical: '/',
    image: '/og/landing.svg',
  },
  textToVideo: {
    title: 'Text to Video - Criar Vídeo com IA',
    description: 'Transforme suas ideias em vídeos impressionantes. Escreva um prompt e deixe a IA criar vídeos de alta qualidade com MiniMax, Kling, Sora e mais.',
    keywords: ['text to video', 'AI video', 'gerador de vídeo', 'criar vídeo com IA', 'prompt to video'],
    image: '/og/text-to-video.svg',
  },
  imageToVideo: {
    title: 'Image to Video - Animar Imagem com IA',
    description: 'Dê vida às suas imagens! Use IA para transformar fotos estáticas em vídeos animados impressionantes.',
    keywords: ['image to video', 'animar imagem', 'foto para vídeo', 'AI animation', 'animate image'],
    image: '/og/image-to-video.svg',
  },
  textToImage: {
    title: 'Text to Image - Criar Imagem com IA',
    description: 'Gere imagens únicas a partir de descrições de texto. Use Flux, Stable Diffusion, DALL-E e outros modelos de IA.',
    keywords: ['text to image', 'AI image', 'gerador de imagem', 'criar imagem com IA', 'prompt to image'],
    image: '/og/text-to-image.svg',
  },
  imageToImage: {
    title: 'Image to Image - Transformar Imagem com IA',
    description: 'Transforme e aprimore suas imagens com IA. Edite estilos, melhore qualidade e crie variações.',
    keywords: ['image to image', 'editar imagem com IA', 'transformar imagem', 'AI image editing'],
    image: '/og/image-to-image.svg',
  },
  myVideos: {
    title: 'Minhas Criações',
    description: 'Veja todos os seus vídeos e imagens gerados. Baixe, compartilhe e gerencie suas criações.',
  },
  favorites: {
    title: 'Favoritos',
    description: 'Seus vídeos e imagens favoritos em um só lugar. Acesse rapidamente suas melhores criações.',
  },
  pricing: {
    title: 'Planos e Preços',
    description: 'Escolha o plano ideal para você. Créditos mensais para gerar vídeos e imagens com os melhores modelos de IA.',
    keywords: ['preços lumivids', 'planos IA', 'créditos vídeo IA', 'assinatura'],
  },
  publicPricing: {
    title: 'Lumivids Pricing Plans',
    description: 'Compare Lumivids plans and pricing for AI video and image generation.',
    keywords: ['lumivids pricing', 'AI plans', 'AI video credits', 'lumivids subscription'],
    canonical: '/plans',
    image: '/og/plans.svg',
  },
  account: {
    title: 'Minha Conta',
    description: 'Gerencie sua conta, veja seus créditos e configure suas preferências.',
    noindex: true,
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'Learn how Lumivids collects, uses, and protects your personal data.',
    canonical: '/privacy',
    image: '/og/privacy.svg',
  },
  terms: {
    title: 'Terms of Service',
    description: 'Read the terms and conditions for using the Lumivids platform.',
    canonical: '/terms',
    image: '/og/terms.svg',
  },
  auth: {
    title: 'Login',
    description: 'Entre na sua conta Lumivids ou crie uma nova para começar a gerar vídeos e imagens com IA.',
    noindex: true,
    canonical: '/auth',
  },
} as const

export type SEOPageKey = keyof typeof SEO_PAGES

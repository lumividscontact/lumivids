import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sitemapPath = path.resolve(__dirname, '../public/sitemap.xml')
const today = new Date().toISOString().slice(0, 10)
const BASE_URL = 'https://lumivids.com'
const BLOG_SITEMAP_INDEX_URL = `${BASE_URL}/blog/sitemap_index.xml`

type UrlEntry = {
  loc: string
  lastmod: string
  changefreq: 'daily' | 'weekly' | 'monthly'
  priority: string
  alternates?: {
    pt?: string
    en?: string
    es?: string
    id?: string
    xDefault?: string
  }
}

const BASE_ENTRIES: UrlEntry[] = [
  {
    loc: `${BASE_URL}/`,
    lastmod: today,
    changefreq: 'daily',
    priority: '1.0',
    alternates: {
      pt: `${BASE_URL}/pt`,
      en: `${BASE_URL}/`,
      es: `${BASE_URL}/es`,
      id: `${BASE_URL}/id`,
      xDefault: `${BASE_URL}/`,
    },
  },
  {
    loc: `${BASE_URL}/plans`,
    lastmod: today,
    changefreq: 'weekly',
    priority: '0.9',
    alternates: {
      pt: `${BASE_URL}/pt/plans`,
      en: `${BASE_URL}/plans`,
      es: `${BASE_URL}/es/plans`,
      id: `${BASE_URL}/id/plans`,
      xDefault: `${BASE_URL}/plans`,
    },
  },
  {
    loc: `${BASE_URL}/text-to-video`,
    lastmod: today,
    changefreq: 'daily',
    priority: '0.9',
    alternates: {
      pt: `${BASE_URL}/pt/text-to-video`,
      en: `${BASE_URL}/text-to-video`,
      es: `${BASE_URL}/es/text-to-video`,
      id: `${BASE_URL}/id/text-to-video`,
      xDefault: `${BASE_URL}/text-to-video`,
    },
  },
  {
    loc: `${BASE_URL}/image-to-video`,
    lastmod: today,
    changefreq: 'daily',
    priority: '0.9',
    alternates: {
      pt: `${BASE_URL}/pt/image-to-video`,
      en: `${BASE_URL}/image-to-video`,
      es: `${BASE_URL}/es/image-to-video`,
      id: `${BASE_URL}/id/image-to-video`,
      xDefault: `${BASE_URL}/image-to-video`,
    },
  },
  {
    loc: `${BASE_URL}/text-to-image`,
    lastmod: today,
    changefreq: 'daily',
    priority: '0.9',
    alternates: {
      pt: `${BASE_URL}/pt/text-to-image`,
      en: `${BASE_URL}/text-to-image`,
      es: `${BASE_URL}/es/text-to-image`,
      id: `${BASE_URL}/id/text-to-image`,
      xDefault: `${BASE_URL}/text-to-image`,
    },
  },
  {
    loc: `${BASE_URL}/image-to-image`,
    lastmod: today,
    changefreq: 'daily',
    priority: '0.9',
    alternates: {
      pt: `${BASE_URL}/pt/image-to-image`,
      en: `${BASE_URL}/image-to-image`,
      es: `${BASE_URL}/es/image-to-image`,
      id: `${BASE_URL}/id/image-to-image`,
      xDefault: `${BASE_URL}/image-to-image`,
    },
  },
  {
    loc: `${BASE_URL}/privacy`,
    lastmod: today,
    changefreq: 'monthly',
    priority: '0.5',
    alternates: {
      pt: `${BASE_URL}/pt/privacy`,
      en: `${BASE_URL}/privacy`,
      es: `${BASE_URL}/es/privacy`,
      id: `${BASE_URL}/id/privacy`,
      xDefault: `${BASE_URL}/privacy`,
    },
  },
  {
    loc: `${BASE_URL}/terms`,
    lastmod: today,
    changefreq: 'monthly',
    priority: '0.5',
    alternates: {
      pt: `${BASE_URL}/pt/terms`,
      en: `${BASE_URL}/terms`,
      es: `${BASE_URL}/es/terms`,
      id: `${BASE_URL}/id/terms`,
      xDefault: `${BASE_URL}/terms`,
    },
  },
]

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

const extractLocValues = (xml: string): string[] => {
  const matches = xml.match(/<loc>([^<]+)<\/loc>/g) || []
  return matches
    .map((match) => match.replace('<loc>', '').replace('</loc>', '').trim())
    .filter(Boolean)
}

const extractBlogEntries = (xml: string): Array<{ loc: string; lastmod: string }> => {
  const blockRegex = /<url>([\s\S]*?)<\/url>/g
  const entries: Array<{ loc: string; lastmod: string }> = []

  for (const blockMatch of xml.matchAll(blockRegex)) {
    const block = blockMatch[1]
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/)
    if (!locMatch) continue

    const loc = locMatch[1].trim()
    if (!loc.startsWith(`${BASE_URL}/blog/`)) continue

    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/)
    const rawLastmod = lastmodMatch?.[1]?.trim() || today
    const normalizedLastmod = rawLastmod.slice(0, 10)
    entries.push({ loc, lastmod: normalizedLastmod })
  }

  return entries
}

async function fetchBlogEntries(): Promise<UrlEntry[]> {
  const fallbackRootEntry: UrlEntry = {
    loc: `${BASE_URL}/blog/`,
    lastmod: today,
    changefreq: 'daily',
    priority: '0.8',
  }

  try {
    const indexRes = await fetch(BLOG_SITEMAP_INDEX_URL)
    if (!indexRes.ok) {
      return [fallbackRootEntry]
    }

    const indexXml = await indexRes.text()
    const sitemapUrls = extractLocValues(indexXml).filter((loc) => loc.includes('/blog/') && loc.endsWith('.xml'))

    const blogMap = new Map<string, string>()
    blogMap.set(`${BASE_URL}/blog/`, today)

    for (const sitemapUrl of sitemapUrls) {
      try {
        const sitemapRes = await fetch(sitemapUrl)
        if (!sitemapRes.ok) continue

        const sitemapXml = await sitemapRes.text()
        const entries = extractBlogEntries(sitemapXml)

        for (const entry of entries) {
          const previous = blogMap.get(entry.loc)
          if (!previous || entry.lastmod > previous) {
            blogMap.set(entry.loc, entry.lastmod)
          }
        }
      } catch {
        // Ignore individual blog sitemap failures and keep remaining entries.
      }
    }

    return Array.from(blogMap.entries())
      .map(([loc, lastmod]) => ({
        loc,
        lastmod,
        changefreq: loc === `${BASE_URL}/blog/` ? 'daily' : 'weekly',
        priority: loc === `${BASE_URL}/blog/` ? '0.8' : '0.7',
      }))
      .sort((a, b) => a.loc.localeCompare(b.loc))
  } catch {
    return [fallbackRootEntry]
  }
}

const renderUrl = (entry: UrlEntry): string => {
  const alternateLines = entry.alternates
    ? [
        entry.alternates.pt
          ? `    <xhtml:link rel="alternate" hreflang="pt-BR" href="${escapeXml(entry.alternates.pt)}" />`
          : '',
        entry.alternates.en
          ? `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(entry.alternates.en)}" />`
          : '',
        entry.alternates.es
          ? `    <xhtml:link rel="alternate" hreflang="es" href="${escapeXml(entry.alternates.es)}" />`
          : '',
        entry.alternates.id
          ? `    <xhtml:link rel="alternate" hreflang="id" href="${escapeXml(entry.alternates.id)}" />`
          : '',
        entry.alternates.xDefault
          ? `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(entry.alternates.xDefault)}" />`
          : '',
      ].filter(Boolean)
    : []

  const lines = [
    '  <url>',
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    ...alternateLines,
    '  </url>',
  ]

  return lines.join('\n')
}

async function updateSitemap(): Promise<void> {
  const blogEntries = await fetchBlogEntries()
  const merged = [...BASE_ENTRIES, ...blogEntries]

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...merged.map(renderUrl),
    '</urlset>',
    '',
  ].join('\n')

  writeFileSync(sitemapPath, xml, 'utf8')
}

await updateSitemap()
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sitemapPath = path.resolve(__dirname, '../public/sitemap.xml')
const today = new Date().toISOString().slice(0, 10)

const sitemap = readFileSync(sitemapPath, 'utf8')
const updated = sitemap.replace(/<lastmod>[^<]+<\/lastmod>/g, `<lastmod>${today}</lastmod>`)

if (updated !== sitemap) {
  writeFileSync(sitemapPath, updated, 'utf8')
}
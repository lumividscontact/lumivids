import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as XLSX from 'xlsx'

const XLSXLib = ((XLSX as unknown as { default?: typeof XLSX }).default || XLSX) as typeof XLSX

type Row = Record<string, unknown>

type CliOptions = {
  filePath: string
  dryRun: boolean
  limit: number | null
  startAt: number
}

type PublishResult = {
  index: number
  title: string
  slug: string
  action: 'created' | 'updated' | 'skipped' | 'failed'
  postId?: number
  url?: string
  reason?: string
}

type WpPost = {
  id: number
  slug: string
  link: string
}

type WpMedia = {
  id: number
}

const DEFAULT_WP_BASE_URL = 'https://lumivids.com/blog'
const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations'

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback
  const v = value.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'y'
}

function parseArgs(argv: string[]): CliOptions {
  let filePath = process.env.BLOG_XLSX_PATH?.trim() || 'textos.xlsx'
  let dryRun = toBool(process.env.BLOG_DRY_RUN, false)
  let limit: number | null = null
  let startAt = 1
  const positionals: string[] = []

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (!arg.startsWith('-')) {
      positionals.push(arg)
      continue
    }

    if (arg.startsWith('--file=')) {
      filePath = arg.slice('--file='.length)
      continue
    }

    if (arg.startsWith('--limit=')) {
      const parsed = Number.parseInt(arg.slice('--limit='.length), 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed
      }
      continue
    }

    if (arg.startsWith('--start-at=')) {
      const parsed = Number.parseInt(arg.slice('--start-at='.length), 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        startAt = parsed
      }
      continue
    }

    if (arg === '--file' && argv[i + 1]) {
      filePath = argv[i + 1]
      i += 1
      continue
    }

    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    if (arg === '--publish') {
      dryRun = false
      continue
    }

    if (arg === '--limit' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed
      }
      i += 1
      continue
    }

    if (arg === '--start-at' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        startAt = parsed
      }
      i += 1
      continue
    }
  }

  if (positionals.length > 0) {
    filePath = positionals[0]
  }

  if (positionals.length > 1) {
    const parsed = Number.parseInt(positionals[1], 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = parsed
    }
  }

  return {
    filePath,
    dryRun,
    limit,
    startAt,
  }
}

function normalizeSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function normalizeHeader(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function pickString(row: Row, candidates: string[]): string {
  const direct = new Map<string, unknown>()
  const normalized = new Map<string, unknown>()

  for (const [key, value] of Object.entries(row)) {
    direct.set(key, value)
    normalized.set(normalizeHeader(key), value)
  }

  for (const key of candidates) {
    const value = direct.get(key) ?? normalized.get(normalizeHeader(key))
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }
  return ''
}

function parseCsvNumbers(value: string): number[] {
  if (!value) return []
  return value
    .split(',')
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
}

function readSpreadsheet(filePath: string): Row[] {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(abs)) {
    throw new Error(`Planilha nao encontrada: ${abs}`)
  }

  const wb = XLSXLib.readFile(abs)
  const firstSheet = wb.SheetNames[0]
  if (!firstSheet) {
    throw new Error('A planilha nao possui abas.')
  }

  const ws = wb.Sheets[firstSheet]
  const rows = XLSXLib.utils.sheet_to_json<Row>(ws, {
    raw: false,
    defval: '',
  })

  if (!rows.length) {
    throw new Error('A planilha nao possui linhas para processar.')
  }

  return rows
}

function buildArticlePrompt(row: Row): string {
  const topic = pickString(row, ['keyword', 'keyword_principal', 'tema', 'topico', 'assunto', 'title', 'titulo', 'titulo_sugerido'])
  const audience = pickString(row, ['publico', 'audiencia', 'persona']) || 'criadores de video com IA'
  const language = pickString(row, ['idioma', 'language']) || 'pt-BR'
  const cta = pickString(row, ['cta', 'chamada']) || 'Teste o LumiVids para criar videos com IA em minutos.'
  const templateHint = pickString(row, ['template', 'tipo_template']) || 'guia passo a passo'

  const extraBrief = pickString(row, ['brief', 'descricao', 'resumo'])

  return [
    `Gere um artigo de blog em ${language} sobre: ${topic}.`,
    `Publico-alvo: ${audience}.`,
    `Formato preferido: ${templateHint}.`,
    'Requisitos obrigatorios:',
    '- Estrutura em Markdown com H1 unico e H2/H3 claros.',
    '- Conteudo pratico, objetivo e SEO-friendly sem keyword stuffing.',
    '- Incluir FAQ com 3 perguntas reais.',
    '- Incluir conclusao com CTA final.',
    `CTA: ${cta}`,
    extraBrief ? `Contexto adicional: ${extraBrief}` : '',
    'Retorne apenas o artigo completo em Markdown, sem explicacoes extras.',
  ]
    .filter(Boolean)
    .join('\n')
}

function generateArticleWithoutLlm(row: Row): string {
  const title = pickString(row, ['title', 'titulo', 'titulo_sugerido']) || 'Guia pratico'
  const keyword = pickString(row, ['keyword', 'keyword_principal', 'tema', 'topico']) || title
  const intent = pickString(row, ['intencao', 'intencao_de_busca']) || 'informacional'
  const cta = pickString(row, ['cta', 'chamada']) || 'Teste o LumiVids gratuitamente.'

  return [
    `# ${title}`,
    '',
    `## O que e ${keyword}`,
    `${keyword} e uma abordagem para criar resultados com IA de forma rapida e consistente, especialmente para usuarios que querem produtividade sem fluxo tecnico complexo.`,
    '',
    `## Quando usar (${intent})`,
    '- Quando voce precisa de um resultado rapido e funcional.',
    '- Quando quer reduzir tempo de tentativa e erro.',
    '- Quando precisa padronizar o processo para escalar.',
    '',
    `## Passo a passo para aplicar ${keyword}`,
    '1. Defina o objetivo final e o formato esperado.',
    '2. Estruture um prompt claro com contexto, estilo e restricoes.',
    '3. Gere uma versao inicial e ajuste com base no resultado.',
    '4. Salve a melhor configuracao para reutilizacao.',
    '',
    '## Erros comuns',
    '- Prompt vago: descreva contexto e resultado esperado.',
    '- Falta de validacao: compare saidas antes de publicar.',
    '- Nao iterar: pequenos ajustes melhoram muito a qualidade.',
    '',
    '## FAQ',
    `### ${keyword} funciona para iniciantes?`,
    'Sim. Com um processo simples de testes, mesmo iniciantes conseguem bons resultados.',
    '',
    `### Quanto tempo leva para dominar ${keyword}?`,
    'Com pratica diaria e prompts estruturados, os ganhos aparecem rapidamente.',
    '',
    '### Preciso de ferramentas pagas?',
    'Nao necessariamente. Voce pode iniciar com opcoes gratuitas e evoluir conforme a necessidade.',
    '',
    '## Conclusao',
    `${keyword} pode acelerar sua producao com qualidade quando aplicado com metodo.`,
    '',
    `CTA: ${cta}`,
  ].join('\n')
}

async function generateArticleWithLlm(row: Row): Promise<string> {
  const apiKey = process.env.BLOG_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return generateArticleWithoutLlm(row)
  }

  const endpoint = process.env.BLOG_OPENAI_URL || DEFAULT_OPENAI_URL
  const model = process.env.BLOG_OPENAI_MODEL || 'gpt-4.1-mini'

  const prompt = buildArticlePrompt(row)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content:
            'Voce e um redator SEO especializado em conteudo para SaaS de IA. Escreva em portugues claro e confiavel.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao gerar artigo via IA (${response.status}): ${body}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = json.choices?.[0]?.message?.content?.trim() || ''
  if (!content) {
    throw new Error('Resposta da IA sem conteudo.')
  }

  return content
}

function basicAuthHeader(username: string, appPassword: string): string {
  return `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`
}

async function findPostBySlug(baseUrl: string, authHeader: string, slug: string): Promise<WpPost | null> {
  const url = `${baseUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=id,slug,link`
  const response = await fetch(url, {
    headers: {
      Authorization: authHeader,
    },
  })

  if (!response.ok) {
    const txt = await response.text()
    throw new Error(`Falha ao buscar slug existente (${response.status}): ${txt}`)
  }

  const posts = (await response.json()) as WpPost[]
  return posts[0] || null
}

async function upsertWpPost(params: {
  baseUrl: string
  authHeader: string
  title: string
  slug: string
  content: string
  excerpt: string
  status: 'draft' | 'publish'
  categories: number[]
  tags: number[]
  featuredMediaId?: number
}): Promise<{ action: 'created' | 'updated'; post: WpPost }> {
  const existing = await findPostBySlug(params.baseUrl, params.authHeader, params.slug)
  const endpoint = existing
    ? `${params.baseUrl}/wp-json/wp/v2/posts/${existing.id}`
    : `${params.baseUrl}/wp-json/wp/v2/posts`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: params.authHeader,
    },
    body: JSON.stringify({
      title: params.title,
      slug: params.slug,
      content: params.content,
      excerpt: params.excerpt || undefined,
      status: params.status,
      categories: params.categories.length ? params.categories : undefined,
      tags: params.tags.length ? params.tags : undefined,
      featured_media: params.featuredMediaId || undefined,
    }),
  })

  if (!response.ok) {
    const txt = await response.text()
    throw new Error(`Falha no upsert do post (${response.status}): ${txt}`)
  }

  const post = (await response.json()) as WpPost
  return { action: existing ? 'updated' : 'created', post }
}

function safeFilename(input: string): string {
  const slug = normalizeSlug(input || 'imagem-destaque')
  return (slug || 'imagem-destaque').slice(0, 80)
}

function buildFeaturedImagePrompt(row: Row, title: string): string {
  const keyword = pickString(row, ['keyword', 'keyword_principal', 'tema', 'topico']) || title
  const audience = pickString(row, ['publico', 'audiencia', 'persona']) || 'criadores de conteudo'
  const style = pickString(row, ['image_style', 'estilo_imagem', 'estilo']) || 'fotorealista, moderno e clean'

  return [
    `Crie uma imagem horizontal de capa de artigo sobre: ${keyword}.`,
    `Titulo do artigo: ${title}.`,
    `Publico-alvo: ${audience}.`,
    `Estilo visual: ${style}.`,
    'Sem texto na imagem, sem logos, sem marcas d\'agua.',
    'Composicao impactante, iluminacao profissional e foco central claro.',
  ].join(' ')
}

async function generateImageWithLlm(row: Row, title: string): Promise<Uint8Array> {
  const apiKey = process.env.BLOG_IMAGE_OPENAI_API_KEY || process.env.BLOG_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Sem chave para geracao de imagem (BLOG_IMAGE_OPENAI_API_KEY/BLOG_OPENAI_API_KEY/OPENAI_API_KEY).')
  }

  const endpoint = process.env.BLOG_IMAGE_OPENAI_URL || DEFAULT_OPENAI_IMAGE_URL
  const model = process.env.BLOG_IMAGE_OPENAI_MODEL || 'gpt-image-1'
  const size = process.env.BLOG_IMAGE_SIZE || '1536x1024'
  const prompt = buildFeaturedImagePrompt(row, title)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality: 'high',
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao gerar imagem via IA (${response.status}): ${body}`)
  }

  const json = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>
  }

  const item = json.data?.[0]
  if (!item) {
    throw new Error('Resposta de imagem sem dados.')
  }

  if (item.b64_json) {
    const buffer = Buffer.from(item.b64_json, 'base64')
    return new Uint8Array(buffer)
  }

  if (item.url) {
    const imageResponse = await fetch(item.url)
    if (!imageResponse.ok) {
      const body = await imageResponse.text()
      throw new Error(`Falha ao baixar imagem gerada (${imageResponse.status}): ${body}`)
    }
    const ab = await imageResponse.arrayBuffer()
    return new Uint8Array(ab)
  }

  throw new Error('Imagem gerada sem b64_json ou url.')
}

async function fetchImageFromUrl(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Falha ao baixar imagem da planilha (${response.status}): ${body}`)
  }
  const ab = await response.arrayBuffer()
  return new Uint8Array(ab)
}

async function uploadWpMedia(params: {
  baseUrl: string
  authHeader: string
  fileName: string
  mimeType: string
  data: Uint8Array
  title: string
  altText: string
}): Promise<number> {
  const endpoint = `${params.baseUrl}/wp-json/wp/v2/media`
  const uploadResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: params.authHeader,
      'Content-Type': params.mimeType,
      'Content-Disposition': `attachment; filename="${params.fileName}"`,
    },
    body: params.data,
  })

  if (!uploadResponse.ok) {
    const body = await uploadResponse.text()
    throw new Error(`Falha ao enviar imagem para WordPress (${uploadResponse.status}): ${body}`)
  }

  const uploaded = (await uploadResponse.json()) as WpMedia
  if (!uploaded.id) {
    throw new Error('Upload de imagem sem media ID.')
  }

  const metaEndpoint = `${params.baseUrl}/wp-json/wp/v2/media/${uploaded.id}`
  const metaResponse = await fetch(metaEndpoint, {
    method: 'POST',
    headers: {
      Authorization: params.authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: params.title,
      alt_text: params.altText,
    }),
  })

  if (!metaResponse.ok) {
    const body = await metaResponse.text()
    throw new Error(`Falha ao atualizar metadados da imagem (${metaResponse.status}): ${body}`)
  }

  return uploaded.id
}

async function getFeaturedMediaId(params: {
  row: Row
  title: string
  slug: string
  baseUrl: string
  authHeader: string
}): Promise<number | undefined> {
  const existingUrl = pickString(params.row, ['image_url', 'imagem_url', 'featured_image_url', 'thumbnail_url'])
  const imageData = existingUrl
    ? await fetchImageFromUrl(existingUrl)
    : await generateImageWithLlm(params.row, params.title)

  const fileName = `${safeFilename(params.slug || params.title)}.png`
  return uploadWpMedia({
    baseUrl: params.baseUrl,
    authHeader: params.authHeader,
    fileName,
    mimeType: 'image/png',
    data: imageData,
    title: params.title,
    altText: params.title,
  })
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const wpBaseUrl = (process.env.WORDPRESS_BASE_URL || DEFAULT_WP_BASE_URL).replace(/\/$/, '')
  const wpUser = process.env.WORDPRESS_USERNAME?.trim() || ''
  const wpAppPassword = process.env.WORDPRESS_APP_PASSWORD?.trim() || ''

  if (!options.dryRun && (!wpUser || !wpAppPassword)) {
    throw new Error('Para publicar, configure WORDPRESS_USERNAME e WORDPRESS_APP_PASSWORD.')
  }

  const rows = readSpreadsheet(options.filePath)
  const sliced = rows.slice(Math.max(0, options.startAt - 1))
  const selected = options.limit ? sliced.slice(0, options.limit) : sliced
  const authHeader = basicAuthHeader(wpUser, wpAppPassword)

  console.log(`[blog] Linhas na planilha: ${rows.length}`)
  console.log(`[blog] Processando: ${selected.length} (a partir da linha ${options.startAt})`)
  console.log(`[blog] Modo: ${options.dryRun ? 'dry-run' : 'publicacao real'}`)
  console.log(`[blog] Base URL: ${wpBaseUrl}`)

  const results: PublishResult[] = []

  for (let i = 0; i < selected.length; i += 1) {
    const row = selected[i]
    const line = options.startAt + i

    const title = pickString(row, ['title', 'titulo', 'titulo_sugerido'])
    const rawSlug = pickString(row, ['slug']) || title
    const slug = normalizeSlug(rawSlug)
    const excerpt = pickString(row, ['excerpt', 'resumo'])
    const explicitStatus = pickString(row, ['status']).toLowerCase()
    const status: 'draft' | 'publish' = explicitStatus === 'draft' ? 'draft' : 'publish'

    const categories = parseCsvNumbers(pickString(row, ['categories', 'category_ids', 'categorias']))
    const tags = parseCsvNumbers(pickString(row, ['tags', 'tag_ids']))

    if (!title) {
      results.push({
        index: line,
        title: '',
        slug,
        action: 'skipped',
        reason: 'Sem titulo na linha.',
      })
      continue
    }

    if (!slug) {
      results.push({
        index: line,
        title,
        slug: '',
        action: 'skipped',
        reason: 'Slug invalido.',
      })
      continue
    }

    try {
      let content = pickString(row, ['content', 'conteudo', 'texto', 'article'])
      if (!content) {
        console.log(`[blog][linha ${line}] Gerando conteudo com IA para: ${title}`)
        content = await generateArticleWithLlm(row)
      }

      if (options.dryRun) {
        results.push({
          index: line,
          title,
          slug,
          action: 'skipped',
          reason: 'Dry-run: post nao publicado.',
        })
        console.log(`[blog][linha ${line}] Dry-run OK: ${title}`)
        continue
      }

      let featuredMediaId: number | undefined
      try {
        featuredMediaId = await getFeaturedMediaId({
          row,
          title,
          slug,
          baseUrl: wpBaseUrl,
          authHeader,
        })
      } catch (imageError) {
        const imageReason = imageError instanceof Error ? imageError.message : 'Erro desconhecido ao processar imagem'
        console.warn(`[blog][linha ${line}] Aviso imagem: ${imageReason}`)
      }

      const saved = await upsertWpPost({
        baseUrl: wpBaseUrl,
        authHeader,
        title,
        slug,
        content,
        excerpt,
        status,
        categories,
        tags,
        featuredMediaId,
      })

      results.push({
        index: line,
        title,
        slug,
        action: saved.action,
        postId: saved.post.id,
        url: saved.post.link,
      })

      console.log(`[blog][linha ${line}] ${saved.action.toUpperCase()}: ${title} -> ${saved.post.link}`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Erro desconhecido'
      results.push({
        index: line,
        title,
        slug,
        action: 'failed',
        reason,
      })
      console.error(`[blog][linha ${line}] FAILED: ${title} -> ${reason}`)
    }
  }

  const summary = {
    total: results.length,
    created: results.filter((r) => r.action === 'created').length,
    updated: results.filter((r) => r.action === 'updated').length,
    skipped: results.filter((r) => r.action === 'skipped').length,
    failed: results.filter((r) => r.action === 'failed').length,
    results,
  }

  const reportPath = path.resolve(
    process.cwd(),
    'scripts',
    `blog-publish-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  console.log('[blog] Resumo:', summary)
  console.log(`[blog] Relatorio salvo em: ${reportPath}`)

  if (summary.failed > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Erro desconhecido'
  console.error('[blog] Erro fatal:', message)
  process.exitCode = 1
})

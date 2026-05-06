/**
 * generate-articles-local.ts
 *
 * Lê a planilha XLSX e gera todos os artigos como arquivos .md
 * na pasta articles/ (ou --output=<pasta>).
 *
 * Uso:
 *   npm run blog:generate
 *   npm run blog:generate -- --file textos.xlsx --output artigos
 *   npm run blog:generate -- --limit 5
 *   npm run blog:generate -- --start-at 10
 *
 * Com IA (OpenAI ou compatível):
 *   $env:BLOG_OPENAI_API_KEY='sk-...'
 *   npm run blog:generate
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as XLSX from 'xlsx'

const XLSXLib = ((XLSX as unknown as { default?: typeof XLSX }).default || XLSX) as typeof XLSX

type Row = Record<string, unknown>

/* ─── CLI ─────────────────────────────────────────────────────────────────── */

type CliOptions = {
  filePath: string
  outputDir: string
  limit: number | null
  startAt: number
  skipExisting: boolean
}

function parseArgs(argv: string[]): CliOptions {
  let filePath = process.env.BLOG_XLSX_PATH?.trim() || 'textos.xlsx'
  let outputDir = process.env.BLOG_OUTPUT_DIR?.trim() || 'articles'
  let limit: number | null = null
  let startAt = 1
  let skipExisting = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--file=')) { filePath = arg.slice('--file='.length); continue }
    if (arg === '--file' && argv[i + 1]) { filePath = argv[++i]; continue }
    if (arg.startsWith('--output=')) { outputDir = arg.slice('--output='.length); continue }
    if (arg === '--output' && argv[i + 1]) { outputDir = argv[++i]; continue }
    if (arg.startsWith('--limit=')) { limit = parseInt(arg.slice('--limit='.length), 10) || null; continue }
    if (arg === '--limit' && argv[i + 1]) { limit = parseInt(argv[++i], 10) || null; continue }
    if (arg.startsWith('--start-at=')) { startAt = parseInt(arg.slice('--start-at='.length), 10) || 1; continue }
    if (arg === '--start-at' && argv[i + 1]) { startAt = parseInt(argv[++i], 10) || 1; continue }
    if (arg === '--skip-existing') { skipExisting = true; continue }
    if (!arg.startsWith('-')) { filePath = arg; continue }
  }

  return { filePath, outputDir, limit, startAt, skipExisting }
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function normalizeSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
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
  const direct = new Map<string, unknown>(Object.entries(row))
  const normalized = new Map<string, unknown>(
    Object.entries(row).map(([k, v]) => [normalizeHeader(k), v])
  )
  for (const key of candidates) {
    const v = direct.get(key) ?? normalized.get(normalizeHeader(key))
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

function readSpreadsheet(filePath: string): Row[] {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(abs)) throw new Error(`Planilha não encontrada: ${abs}`)
  const wb = XLSXLib.readFile(abs)
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Planilha sem abas.')
  const rows = XLSXLib.utils.sheet_to_json<Row>(ws, { raw: false, defval: '' })
  if (!rows.length) throw new Error('Planilha vazia.')
  return rows
}

/* ─── Geração de conteúdo ─────────────────────────────────────────────────── */

function buildPrompt(row: Row): string {
  const title    = pickString(row, ['titulo_sugerido', 'titulo', 'title'])
  const keyword  = pickString(row, ['keyword_principal', 'keyword', 'tema'])
  const intent   = pickString(row, ['intencao', 'intencao_de_busca']) || 'informacional'
  const cta      = pickString(row, ['cta', 'chamada']) || 'Teste o LumiVids gratuitamente em lumivids.com.'

  return `Escreva um artigo de blog completo em português (pt-BR) para o site LumiVids, uma plataforma de geração de vídeos com IA.

Título: ${title}
Keyword principal: ${keyword}
Intenção de busca: ${intent}

Requisitos obrigatórios:
- Estrutura em Markdown com H1 único (o título) e seções H2/H3 claras.
- Mínimo de 800 palavras, linguagem acessível e prática.
- SEO-friendly: usar a keyword naturalmente, sem keyword stuffing.
- Incluir seção "FAQ" com 3 perguntas e respostas reais que o público pesquisaria.
- Incluir conclusão com chamada para ação (CTA): "${cta}"
- Não adicionar comentários, explicações ou qualquer texto fora do artigo.

Retorne apenas o artigo completo em Markdown.`
}

async function generateWithLlm(row: Row): Promise<string> {
  const apiKey  = process.env.BLOG_OPENAI_API_KEY?.trim()
  const apiUrl  = (process.env.BLOG_OPENAI_URL?.trim() || 'https://api.openai.com/v1/chat/completions')
  const model   = process.env.BLOG_OPENAI_MODEL?.trim() || 'gpt-4o-mini'

  if (!apiKey) throw new Error('BLOG_OPENAI_API_KEY não configurada')

  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Você é um redator especialista em SEO e marketing de conteúdo para SaaS de IA.' },
        { role: 'user', content: buildPrompt(row) },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`OpenAI ${resp.status}: ${txt.slice(0, 200)}`)
  }

  const json = await resp.json() as { choices: Array<{ message: { content: string } }> }
  const content = json.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('Resposta vazia da API')
  return content
}

function generateStub(row: Row): string {
  const title   = pickString(row, ['titulo_sugerido', 'titulo', 'title']) || 'Guia prático'
  const keyword = pickString(row, ['keyword_principal', 'keyword', 'tema']) || title
  const intent  = pickString(row, ['intencao', 'intencao_de_busca']) || 'informacional'
  const cta     = pickString(row, ['cta', 'chamada']) || 'Teste o LumiVids gratuitamente.'

  return `# ${title}

> **Nota:** Este é um rascunho gerado automaticamente. Revise antes de publicar.

## O que é ${keyword}

${keyword} é uma das abordagens mais eficientes para criadores de conteúdo que querem produzir vídeos de alta qualidade usando inteligência artificial — sem precisar de equipamentos caros ou experiência em edição.

## Por que ${keyword} importa (intenção: ${intent})

- **Economia de tempo**: O que levava horas agora leva minutos.
- **Acessibilidade**: Qualquer pessoa pode criar vídeos profissionais.
- **Escalabilidade**: Produza dezenas de vídeos por semana com consistência.

## Como fazer ${keyword} passo a passo

### 1. Defina seu objetivo
Antes de começar, saiba que tipo de vídeo você quer criar: tutorial, apresentação, short para redes sociais etc.

### 2. Escolha a ferramenta certa
Plataformas como o **LumiVids** oferecem múltiplos modelos de IA especializados para diferentes estilos e formatos de vídeo.

### 3. Configure e gere
Insira o prompt ou a imagem de referência, ajuste as configurações de duração e resolução, e deixe a IA trabalhar.

### 4. Revise e exporte
Assista ao resultado, faça ajustes se necessário, e exporte no formato ideal para sua plataforma.

## Dicas avançadas

- Use imagens de alta resolução como entrada para melhores resultados.
- Experimente diferentes modelos para encontrar o estilo ideal para sua marca.
- Aproveite a geração em lote para criar variações rapidamente.

## FAQ

**O que é necessário para começar com ${keyword}?**
Basta uma conta em uma plataforma de IA como o LumiVids, uma ideia e alguns minutos. Não é necessário nenhum software adicional ou conhecimento técnico.

**${keyword} é seguro para uso comercial?**
Sim, desde que você utilize plataformas que ofereçam licença comercial nos vídeos gerados. O LumiVids inclui isso em todos os planos pagos.

**Quanto custa criar vídeos com IA?**
O custo varia conforme a plataforma e o volume. O LumiVids oferece planos acessíveis com créditos mensais que cobrem desde criadores individuais até equipes.

## Conclusão

${keyword} está transformando a forma como criadores e empresas produzem conteúdo em vídeo. Com as ferramentas certas, qualquer pessoa pode criar vídeos impressionantes em minutos.

${cta}
`
}

async function getContent(row: Row): Promise<{ content: string; source: 'llm' | 'stub' | 'spreadsheet' }> {
  const existing = pickString(row, ['content', 'conteudo', 'texto', 'article'])
  if (existing) return { content: existing, source: 'spreadsheet' }

  try {
    const content = await generateWithLlm(row)
    return { content, source: 'llm' }
  } catch {
    return { content: generateStub(row), source: 'stub' }
  }
}

/* ─── Frontmatter ─────────────────────────────────────────────────────────── */

function buildMarkdown(row: Row, content: string, source: string): string {
  const title   = pickString(row, ['titulo_sugerido', 'titulo', 'title']) || ''
  const slug    = normalizeSlug(pickString(row, ['slug']) || title)
  const keyword = pickString(row, ['keyword_principal', 'keyword', 'tema']) || ''
  const intent  = pickString(row, ['intencao', 'intencao_de_busca']) || ''
  const cta     = pickString(row, ['cta', 'chamada']) || ''
  const date    = new Date().toISOString().slice(0, 10)

  const fm = [
    '---',
    `title: "${title.replace(/"/g, "'")}"`,
    `slug: "${slug}"`,
    keyword ? `keyword: "${keyword}"` : null,
    intent ? `intent: "${intent}"` : null,
    cta ? `cta: "${cta.replace(/"/g, "'")}"` : null,
    `date: "${date}"`,
    `source: "${source}"`,
    'status: draft',
    '---',
    '',
  ].filter(v => v !== null).join('\n')

  // Se o conteúdo já começa com H1, não duplicar
  const body = content.startsWith('# ') ? content : `# ${title}\n\n${content}`

  return fm + body
}

/* ─── Main ────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  const hasLlm = !!process.env.BLOG_OPENAI_API_KEY?.trim()

  const absOutput = path.isAbsolute(opts.outputDir)
    ? opts.outputDir
    : path.resolve(process.cwd(), opts.outputDir)

  if (!fs.existsSync(absOutput)) fs.mkdirSync(absOutput, { recursive: true })

  const rows   = readSpreadsheet(opts.filePath)
  const sliced = rows.slice(Math.max(0, opts.startAt - 1))
  const batch  = opts.limit ? sliced.slice(0, opts.limit) : sliced

  console.log(`\n📄 Planilha: ${opts.filePath} (${rows.length} linhas)`)
  console.log(`📁 Saída:    ${absOutput}`)
  console.log(`🤖 Modo IA:  ${hasLlm ? 'OpenAI ativo' : 'sem chave API — usando rascunho automático'}`)
  console.log(`📝 Artigos:  ${batch.length} (a partir da linha ${opts.startAt})\n`)

  let created = 0, skipped = 0, failed = 0

  for (let i = 0; i < batch.length; i++) {
    const row  = batch[i]
    const line = opts.startAt + i

    const title   = pickString(row, ['titulo_sugerido', 'titulo', 'title'])
    const rawSlug = pickString(row, ['slug']) || title
    const slug    = normalizeSlug(rawSlug)

    if (!title || !slug) {
      console.log(`  [linha ${line}] ⚠️  Pulando — sem título ou slug`)
      skipped++
      continue
    }

    const outFile = path.join(absOutput, `${slug}.md`)

    if (opts.skipExisting && fs.existsSync(outFile)) {
      console.log(`  [linha ${line}] ⏭️  Já existe: ${slug}.md`)
      skipped++
      continue
    }

    process.stdout.write(`  [linha ${String(line).padStart(2)}/${String(rows.length).padEnd(2)}] ${title.slice(0, 60).padEnd(62)}`)

    try {
      const { content, source } = await getContent(row)
      const md = buildMarkdown(row, content, source)
      fs.writeFileSync(outFile, md, 'utf8')
      const icon = source === 'llm' ? '🤖' : source === 'spreadsheet' ? '📋' : '📝'
      console.log(`${icon} ${source}`)
      created++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`❌ ERRO: ${msg.slice(0, 80)}`)
      failed++
    }
  }

  console.log(`\n✅ Gerados: ${created}  ⏭️  Pulados: ${skipped}  ❌ Erros: ${failed}`)
  console.log(`📁 Arquivos salvos em: ${absOutput}\n`)
}

main().catch(err => {
  console.error('Erro fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})

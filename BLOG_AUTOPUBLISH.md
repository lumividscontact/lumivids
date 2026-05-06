# Publicacao automatica de artigos no blog

Este projeto agora possui um script para:

1. Ler uma planilha .xlsx com pautas/artigos.
2. Gerar o conteudo com IA quando a coluna de conteudo estiver vazia.
3. Publicar (ou atualizar por slug) no WordPress em https://lumivids.com/blog.

## Comando

```bash
npm run blog:publish -- --file textos.xlsx --publish
```

## Modos de execucao

- Publicacao real: `--publish`
- Simulacao sem publicar: `--dry-run`
- Limitar quantidade: `--limit 5`
- Comecar da linha N: `--start-at 3`

Exemplo:

```bash
npm run blog:publish -- --file textos.xlsx --publish --limit 10
```

## Variaveis de ambiente

- `WORDPRESS_BASE_URL` (padrao: `https://lumivids.com/blog`)
- `WORDPRESS_USERNAME`
- `WORDPRESS_APP_PASSWORD`
- `BLOG_XLSX_PATH` (padrao: `textos.xlsx`)
- `BLOG_DRY_RUN` (`true` ou `false`)

Somente para geracao com IA quando a planilha nao tiver conteudo:

- `BLOG_OPENAI_API_KEY` (ou `OPENAI_API_KEY`)
- `BLOG_OPENAI_MODEL` (padrao: `gpt-4.1-mini`)
- `BLOG_OPENAI_URL` (padrao: OpenAI Chat Completions)

## Colunas aceitas na planilha

Minimo recomendado:

- `title` ou `titulo`
- `slug` (opcional, sera derivado do titulo se vazio)
- `content`/`conteudo`/`texto` (opcional se IA estiver configurada)

Opcionais:

- `excerpt` ou `resumo`
- `status` (`publish` ou `draft`)
- `categories` (IDs separados por virgula, ex: `3,8`)
- `tags` (IDs separados por virgula)
- `keyword`, `tema`, `brief`, `publico`, `idioma`, `cta`, `template` (usados para prompt de IA)

## Comportamento de upsert

O script busca por `slug` no WordPress:

- Se existir: atualiza o post existente.
- Se nao existir: cria novo post.

## Relatorio

Ao final de cada execucao, um arquivo de relatorio e salvo em:

- `scripts/blog-publish-report-AAAA-MM-DDTHH-MM-SS-sssZ.json`

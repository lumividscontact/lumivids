# 🚀 Deploy Edge Functions - Lumivids

## Pré-requisitos

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2. Fazer Login

```bash
supabase login
```

## Funções Disponíveis

| Função | Descrição |
|--------|-----------|
| `text-to-video` | Gera vídeos a partir de texto usando vários modelos |
| `text-to-image` | Gera imagens a partir de texto (Flux, SD 3.5, Ideogram) |
| `image-to-video` | Anima imagens usando modelos de vídeo |
| `image-to-image` | Transforma imagens (estilos, upscale) |
| `check-prediction` | Verifica status de uma predição no Replicate |
| `cancel-prediction` | Cancela uma predição em andamento |
| `cleanup-stale-generations` | Finaliza gerações travadas e reembolsa créditos automaticamente |
| `admin-rpc` | Proxy server-side para RPCs administrativas com validação de admin |

## Deploy

### 1. Linkar ao projeto

```bash
cd c:\Users\ferra\lumivids
supabase link --project-ref ixaxkwfmxmsftnirtkqi
```

### 2. Configurar Secret do Replicate

```bash
supabase secrets set REPLICATE_API_TOKEN=sua_api_key_aqui
```

### 3. Deploy de todas as funções

```bash
supabase functions deploy text-to-video
supabase functions deploy text-to-image
supabase functions deploy image-to-video
supabase functions deploy image-to-image
supabase functions deploy check-prediction
supabase functions deploy cancel-prediction
supabase functions deploy cleanup-stale-generations
supabase functions deploy admin-rpc
```

### 4. Ou deploy em lote (PowerShell):

```powershell
$functions = @("text-to-video", "text-to-image", "image-to-video", "image-to-image", "check-prediction", "cancel-prediction", "cleanup-stale-generations", "admin-rpc")
foreach ($fn in $functions) {
    Write-Host "Deploying $fn..."
    supabase functions deploy $fn
}
```

## URLs das Funções

Após o deploy:

```
https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/text-to-video
https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/text-to-image
https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/image-to-video
https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/image-to-image
https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/check-prediction
https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/cancel-prediction
https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/cleanup-stale-generations
https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/admin-rpc
```

## Agendar cleanup automático (Scheduler)

Para evitar gerações travadas eternamente (`starting`/`processing`), agende a função `cleanup-stale-generations` para rodar periodicamente.

### Exemplo recomendado

- Frequência: a cada 5 minutos
- Método: `POST`
- URL: `https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/cleanup-stale-generations`
- Header: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
- Body JSON:

```json
{
    "staleAfterMinutes": 45,
    "batchLimit": 100,
    "rateLimitRetentionHours": 168,
    "rateLimitCleanupBatch": 100000
}
```

## Verificar Secrets

```bash
supabase secrets list
```

### Secrets recomendados para produção/staging

- `CORS_ALLOWED_ORIGINS`: lista de origens separadas por vírgula (ex.: `https://lumivids.com,https://staging.lumivids.com,http://localhost:5173`)
- `CORS_ALLOWED_ORIGIN`: origem única (legado/alternativo quando não usar lista)
- `RATE_LIMIT_FALLBACK_MODE`: `fail-closed` (recomendado em produção) ou `memory` (útil em dev/local)

## Logs das Funções

```bash
supabase functions logs text-to-video --tail
```

## Modelos Suportados

### Text to Video
- `seedance-1-lite`, `seedance-1.5-pro` (ByteDance)
- `minimax`, `hailuo-2.3` (MiniMax)
- `kling`, `kling-v2.5-turbo-pro` (Kuaishou)
- `luma-dream` (Luma AI)
- `haiper` (Haiper)
- `hunyuan` (Tencent)
- `mochi` (Genmo)
- `wan-2.6` (Wan Video)
- `google-veo-3.1-fast` (Google)
- `openai-sora-2`, `openai-sora-2-pro` (OpenAI)

### Text to Image
- `flux-pro`, `flux-schnell`, `flux-dev` (Black Forest Labs)
- `stable-3.5` (Stability AI)
- `nano-banana-pro` (Google)
- `ideogram` (Ideogram AI)

### Image to Video
- `luma-img`, `kling-img`, `minimax-img`
- `hailuo-2.3-img`, `hailuo-2.3-fast-img`
- `google-veo-3.1-fast-img`
- `openai-sora-2-img`, `openai-sora-2-pro-img`
- `kling-v2.5-turbo-pro-img`
- `stable-video-img`, `haiper-img`

### Image to Image
- `img2img-flux`, `img2img-sdxl`
- `upscale` (Real-ESRGAN)

## ✅ Checklist

- [ ] Supabase CLI instalado
- [ ] Login feito (`supabase login`)
- [ ] Projeto linkado
- [ ] `REPLICATE_API_TOKEN` configurado
- [ ] Edge Functions deployadas

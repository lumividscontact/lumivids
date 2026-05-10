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
| `send-welcome-email` | Envia e-mail de boas-vindas para novos usuários via Resend |
| `send-lifecycle-emails` | Emails comportamentais: créditos baixos (≤3) e reengajamento (inativo 7 dias) |
| `resend-webhook` | Recebe webhooks do Resend para auditoria e alertas de falha/bounce |

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
supabase functions deploy send-welcome-email
supabase functions deploy send-lifecycle-emails
supabase functions deploy resend-webhook
```

### 4. Ou deploy em lote (PowerShell):

```powershell
$functions = @("text-to-video", "text-to-image", "image-to-video", "image-to-image", "check-prediction", "cancel-prediction", "cleanup-stale-generations", "admin-rpc", "send-welcome-email", "send-lifecycle-emails", "resend-webhook")
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
https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/send-welcome-email
https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/send-lifecycle-emails
https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/resend-webhook
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

## Agendar emails de ciclo de vida (send-lifecycle-emails)

A função `send-lifecycle-emails` detecta automaticamente dois comportamentos e dispara emails via Resend:

| Job | Gatilho | Evento Resend |
|-----|---------|---------------|
| `low_credits` | Freemium com ≤ 3 créditos restantes, email nunca enviado | `low_credits_upgrade` |
| `reengagement` | Último vídeo gerado há ≥ 7 dias, email nunca enviado | `reengagement_7day` |

### Agendar (a cada 1 hora)

- Frequência: a cada hora (ex.: `0 * * * *`)
- Método: `POST`
- URL: `https://ixaxkwfmxmsftnirtkqi.supabase.co/functions/v1/send-lifecycle-emails`
- Header: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
- Body JSON (opcional — roda ambos os jobs por padrão):

```json
{ "jobs": ["low_credits", "reengagement"] }
```

### Secrets necessários

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set RESEND_LOW_CREDITS_EVENT=low_credits_upgrade
supabase secrets set RESEND_REENGAGEMENT_EVENT=reengagement_7day
supabase secrets set APP_URL=https://lumivids.com
```

### Templates Resend

Crie dois **broadcast events** no dashboard do Resend com os nomes acima. Variáveis disponíveis no payload:

**`low_credits_upgrade`**
- `{{first_name}}` — primeiro nome
- `{{credits_left}}` — créditos restantes (0–3)
- `{{thumbnail_url}}` — URL do último vídeo gerado (pode ser null)
- `{{prompt}}` — prompt usado (truncado em 120 chars)
- `{{pricing_url}}` — link direto para `/pricing`

**`reengagement_7day`**
- `{{first_name}}` — primeiro nome
- `{{last_generation_at}}` — data da última geração (ISO 8601)
- `{{thumbnail_url}}` — URL do último vídeo gerado (pode ser null)
- `{{prompt}}` — prompt usado (truncado em 120 chars)
- `{{create_url}}` — link direto para `/text-to-video`

## Verificar Secrets

```bash
supabase secrets list
```

### Secrets recomendados para produção/staging

- `CORS_ALLOWED_ORIGINS`: lista de origens separadas por vírgula (ex.: `https://lumivids.com,https://staging.lumivids.com,http://localhost:5173`)
- `CORS_ALLOWED_ORIGIN`: origem única (legado/alternativo quando não usar lista)
- `RATE_LIMIT_FALLBACK_MODE`: `fail-closed` (recomendado em produção) ou `memory` (útil em dev/local)
- `RESEND_API_KEY`: chave da API do Resend
- `RESEND_WELCOME_EVENT`: nome do evento customizado que dispara a automação (ex.: `cadastro_lumivids`)
- `RESEND_WEBHOOK_SECRET`: secret de assinatura do webhook do Resend (Svix)
- `APP_URL`: URL pública da aplicação usada no CTA do e-mail (ex.: `https://lumivids.com`)

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

# Setup de Storage para Vídeos Locais

## Problema
Os vídeos estavam sendo carregados diretamente do Replicate, causando erros CORS e URLs expiradas.

## Solução
Configurar Supabase Storage para baixar e armazenar os vídeos localmente.

---

## Passo 1: Criar Bucket de Storage no Supabase

1. Acesse o **Supabase Dashboard** → Seu projeto
2. Vá em **Storage** (menu lateral)
3. Clique em **"New bucket"**
4. Configurações:
   - **Name**: `videos`
   - **Public bucket**: ✅ **ATIVADO** (importante!)
   - **File size limit**: 100 MB (ou mais se necessário)
   - **Allowed MIME types**: `video/*` (ou deixe vazio para aceitar tudo)
5. Clique em **"Create bucket"**

---

## Passo 2: Configurar Políticas de Segurança (RLS)

1. No Supabase Dashboard, vá em **SQL Editor**
2. Clique em **"New query"**
3. Cole o conteúdo do arquivo `supabase/SETUP_STORAGE.sql`
4. Clique em **"Run"**

Ou execute manualmente:

```sql
-- Tornar o bucket público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'videos';

-- Permitir que edge functions façam upload
CREATE POLICY "Service role can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'videos' AND
  auth.jwt()->>'role' = 'service_role'
);
```

---

## Passo 3: Fazer Deploy da Edge Function Atualizada

No terminal do projeto:

```bash
# Login no Supabase (se ainda não estiver logado)
npx supabase login

# Fazer deploy da função check-prediction atualizada
npx supabase functions deploy check-prediction
```

---

## Passo 4: Verificar Configuração

1. Acesse **Storage** → **videos** no Supabase Dashboard
2. Você deve ver a pasta `generations/` aparecer quando os vídeos forem gerados
3. Clique em um vídeo → Deve mostrar a URL pública

---

## Como Funciona Agora

### Fluxo Antigo (❌ Não Funcionava)
1. Usuário gera vídeo
2. Replicate processa
3. URL do Replicate é salva no banco
4. Frontend tenta carregar vídeo do Replicate
5. **ERRO**: CORS bloqueado, URL expira

### Fluxo Novo (✅ Funciona)
1. Usuário gera vídeo
2. Replicate processa
3. **Edge function baixa o vídeo do Replicate**
4. **Vídeo é salvo no Supabase Storage**
5. **URL local é salva no banco**
6. Frontend carrega vídeo do próprio servidor
7. **✅ Sem CORS, URLs permanentes**

---

## Testando

1. Gere um novo vídeo no app
2. Aguarde o processamento
3. Clique para visualizar
4. O vídeo agora deve reproduzir normalmente
5. Verifique no console: A URL deve começar com seu domínio Supabase, não `replicate.delivery`

---

## Vídeos Antigos

Os vídeos gerados antes desta atualização ainda têm URLs do Replicate. Opções:

### Opção A: Migrar URLs antigas (Recomendado)
Execute este script no SQL Editor:

```sql
-- Atualizar vídeos antigos para forçar re-download na próxima verificação
UPDATE generations
SET status = 'processing'
WHERE output_url LIKE '%replicate.delivery%'
  AND status = 'succeeded';
```

Depois, o polling automático vai re-baixar os vídeos.

### Opção B: Deletar e regerar
Simplesmente delete os vídeos antigos e gere novos.

---

## Monitoramento

Para ver logs da edge function:

```bash
npx supabase functions logs check-prediction --tail
```

Procure por:
- `[Check Prediction] Downloading video from:`
- `[Check Prediction] Uploading to storage:`
- `[Check Prediction] Upload successful:`

---

## Troubleshooting

### Erro: "Bucket not found"
- Verifique se criou o bucket `videos` no Storage
- Nome deve ser exatamente `videos` (minúsculo)

### Erro: "Permission denied"
- Execute o script SQL de políticas (SETUP_STORAGE.sql)
- Verifique se o bucket está marcado como público

### Vídeo não faz download
- Verifique os logs da edge function
- Pode ser que a URL do Replicate tenha expirado muito rápido
- Tente gerar um vídeo novo

### URLs ainda são do Replicate
- Certifique-se de fazer deploy da edge function atualizada
- Gere um novo vídeo para testar
- Vídeos antigos precisam ser migrados (ver acima)

---

## Custos

- **Armazenamento**: ~10-50 MB por vídeo
- **Bandwidth**: Apenas quando usuários assistem
- **Supabase Free Tier**: 1 GB storage + 2 GB bandwidth/mês
- Para produção: Considere plano pago ou CDN

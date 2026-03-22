# Deploy Manual da Edge Function check-prediction

Como o deploy via CLI está com problemas de autenticação, faça o deploy manual via Dashboard:

## Passo 1: Acesse Edge Functions no Dashboard

1. Vá para: https://supabase.com/dashboard/project/ykrbhgusozwbvrlftdzu/functions
2. Clique na função **check-prediction** (ou crie se não existir)

## Passo 2: Copie o Código Atualizado

Copie TODO o conteúdo do arquivo:
**`supabase/functions/check-prediction/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getReplicate } from '../_shared/replicate.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get ID from query params (GET request) or body (POST request)
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return new Response(JSON.stringify({ error: 'Prediction ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[Check Prediction] Checking prediction:', id)

    const replicate = getReplicate()
    const prediction = await replicate.predictions.get(id)

    console.log('[Check Prediction] Status:', prediction.status)

    // If prediction succeeded, download and store the video
    if (prediction.status === 'succeeded' && prediction.output) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      // Get the output URL (handle both array and string formats)
      let outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
      
      if (typeof outputUrl === 'string' && outputUrl) {
        try {
          console.log('[Check Prediction] Downloading video from:', outputUrl)
          
          // Download the video from Replicate
          const videoResponse = await fetch(outputUrl)
          if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`)
          }

          const videoBlob = await videoResponse.blob()
          const videoBuffer = await videoBlob.arrayBuffer()
          
          // Generate filename
          const extension = outputUrl.includes('.mp4') ? 'mp4' : 'webm'
          const filename = `${id}.${extension}`
          const filepath = `generations/${filename}`

          console.log('[Check Prediction] Uploading to storage:', filepath)

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('videos')
            .upload(filepath, videoBuffer, {
              contentType: `video/${extension}`,
              upsert: true,
            })

          if (uploadError) {
            console.error('[Check Prediction] Upload error:', uploadError)
          } else {
            console.log('[Check Prediction] Upload successful:', uploadData)
            
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('videos')
              .getPublicUrl(filepath)

            // Update prediction output with local URL
            prediction.local_output_url = publicUrl
          }
        } catch (downloadError) {
          console.error('[Check Prediction] Download/Upload error:', downloadError)
          // Continue with original Replicate URL if download fails
        }
      }
    }

    return new Response(JSON.stringify(prediction), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('[Check Prediction] Error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

## Passo 3: Cole no Editor

1. No Dashboard, vá em **Edge Functions** → **check-prediction**
2. Cole o código acima no editor
3. Clique em **Save** ou **Deploy**

## Passo 4: Verifique as Variáveis de Ambiente

Certifique-se que estas variáveis estão configuradas:
- `REPLICATE_API_TOKEN`
- `SUPABASE_URL` (geralmente já está)
- `SUPABASE_SERVICE_ROLE_KEY` (geralmente já está)

## Passo 5: Teste

1. Gere um novo vídeo no app
2. Aguarde o processamento
3. Verifique os logs da função:
   - Dashboard → Edge Functions → check-prediction → Logs
4. Procure por: `[Check Prediction] Uploading to storage:`

## ✅ Pronto!

Agora os vídeos serão baixados e armazenados localmente.

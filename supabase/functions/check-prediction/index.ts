import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getReplicate } from '../_shared/replicate.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { getUserFromAuth, refundCredits, claimRefundableCredits } from '../_shared/credits.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VIDEO_UPLOAD_MAX_BYTES = 100 * 1024 * 1024

type PredictionLike = {
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  error?: string
  local_output_url?: string
  output_url?: string
  output?: unknown
}

type GenerationState = {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  credits_used: number
}

function encodeStoragePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

async function uploadVideoStreamToStorage(
  objectPath: string,
  response: Response,
  contentType: string,
): Promise<void> {
  if (!response.body) {
    throw new Error('Video response body is empty')
  }

  const uploadUrl = `${supabaseUrl}/storage/v1/object/videos/${encodeStoragePath(objectPath)}`
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'x-upsert': 'true',
      'content-type': contentType,
    },
    body: response.body,
  })

  if (!uploadResponse.ok) {
    const details = await uploadResponse.text().catch(() => uploadResponse.statusText)
    throw new Error(`Storage upload failed (${uploadResponse.status}): ${details}`)
  }
}

async function resolveOutputUrl(value: unknown): Promise<string | null> {
  if (!value) return null

  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = await resolveOutputUrl(item)
      if (resolved) return resolved
    }
    return null
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>

    if (typeof obj.url === 'function') {
      try {
        const maybeUrl = await (obj.url as () => Promise<string> | string)()
        if (typeof maybeUrl === 'string' && maybeUrl.length > 0) {
          return maybeUrl
        }
      } catch {
        // ignore and continue fallback extraction
      }
    }

    const candidates = [obj.url, obj.href, obj.video, obj.output, obj.result, obj.local_output_url, obj.output_url]
    for (const candidate of candidates) {
      const resolved = await resolveOutputUrl(candidate)
      if (resolved) return resolved
    }
  }

  return null
}

async function waitForPredictionOwnership(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  predictionId: string,
): Promise<boolean> {
  // Small retry window to handle race condition between frontend insert and polling start
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await supabase
      .from('generations')
      .select('id')
      .eq('user_id', userId)
      .eq('replicate_prediction_id', predictionId)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[Check Prediction] Ownership check error:', error)
      return false
    }

    if (data?.id) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return false
}

async function getGenerationState(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  predictionId: string,
): Promise<GenerationState | null> {
  const { data, error } = await supabase
    .from('generations')
    .select('id, status, credits_used')
    .eq('user_id', userId)
    .eq('replicate_prediction_id', predictionId)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[Check Prediction] Failed to load generation state:', error)
    return null
  }

  return data as GenerationState | null
}

async function persistPredictionState(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  predictionId: string,
  prediction: PredictionLike,
): Promise<void> {
  const resolvedOutputUrl = prediction.local_output_url
    || prediction.output_url
    || (await resolveOutputUrl(prediction.output))

  const updateData: Record<string, unknown> = {
    status: prediction.status,
    updated_at: new Date().toISOString(),
  }

  if (prediction.status === 'succeeded') {
    updateData.error_message = null
    if (resolvedOutputUrl) {
      updateData.output_url = resolvedOutputUrl
      updateData.thumbnail_url = resolvedOutputUrl
    }
  } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
    updateData.error_message = prediction.error || null
  }

  if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
    updateData.completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('generations')
    .update(updateData)
    .eq('user_id', userId)
    .eq('replicate_prediction_id', predictionId)

  if (error) {
    console.error('[Check Prediction] Failed to persist prediction state:', error)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authResult = await getUserFromAuth(req)
    if (authResult.error || !authResult.userId) {
      return new Response(JSON.stringify({ error: authResult.error || 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rateLimit = await enforceRateLimit({
      identifier: authResult.userId,
      action: 'check-prediction',
      limit: 120,
      windowSeconds: 60,
    })

    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfter),
        },
      })
    }

    // Get ID from query params (GET request) or body (POST request)
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return new Response(JSON.stringify({ error: 'Prediction ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const hasAccess = await waitForPredictionOwnership(supabase, authResult.userId, id)

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Prediction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const generationState = await getGenerationState(supabase, authResult.userId, id)

    console.log('[Check Prediction] Checking prediction:', id)

    const replicate = getReplicate()
    const prediction = await replicate.predictions.get(id)

    console.log('[Check Prediction] Status:', prediction.status)

    // If prediction succeeded, download and store the video
    if (prediction.status === 'succeeded' && prediction.output) {
      const outputUrl = await resolveOutputUrl(prediction.output)

      if (outputUrl) {
        prediction.output = [outputUrl]
      }
      
      if (typeof outputUrl === 'string' && outputUrl) {
        try {
          console.log('[Check Prediction] Downloading video from:', outputUrl)
          
          // Download the video from Replicate
          const videoResponse = await fetch(outputUrl)
          if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`)
          }

          const contentLength = Number(videoResponse.headers.get('content-length') ?? '0')
          if (Number.isFinite(contentLength) && contentLength > VIDEO_UPLOAD_MAX_BYTES) {
            throw new Error(`Video too large for upload (${contentLength} bytes)`)
          }

          const contentType = videoResponse.headers.get('content-type') || 'video/mp4'
          
          // Generate filename
          const extension = outputUrl.includes('.mp4') ? 'mp4' : 'webm'
          const filename = `${id}.${extension}`
          const filepath = `generations/${authResult.userId}/${filename}`

          console.log('[Check Prediction] Uploading to storage:', filepath)

          await uploadVideoStreamToStorage(filepath, videoResponse, contentType)

          console.log('[Check Prediction] Upload successful:', filepath)

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('videos')
            .getPublicUrl(filepath)

          // Update prediction output with local URL
          prediction.local_output_url = publicUrl
        } catch (downloadError) {
          console.error('[Check Prediction] Download/Upload error:', downloadError)
          // Continue with original Replicate URL if download fails
        }
      }
    }

    const refundedTerminalStatus = generationState?.credits_used === 0
      && (generationState.status === 'failed' || generationState.status === 'canceled')

    if (prediction.status === 'succeeded' && refundedTerminalStatus) {
      console.warn('[Check Prediction] Ignoring late success for refunded generation:', id)

      const blockedPrediction: PredictionLike = {
        status: generationState.status,
        error: 'Generation completed after refund and was discarded to avoid free delivery.',
      }

      await persistPredictionState(supabase, authResult.userId, id, blockedPrediction)

      return new Response(JSON.stringify(blockedPrediction), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    await persistPredictionState(supabase, authResult.userId, id, prediction as PredictionLike)

    // Refund credits if prediction failed or was canceled
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      try {
        const claimResult = await claimRefundableCredits(authResult.userId, id, prediction.status)

        if (claimResult.success && claimResult.amount > 0) {
          console.log(`[Check Prediction] Refunding ${claimResult.amount} credits to user ${authResult.userId} (status: ${prediction.status})`)
          await refundCredits(authResult.userId, claimResult.amount, `Generation ${prediction.status}: ${id}`)
        }
      } catch (refundErr) {
        console.error('[Check Prediction] Refund error:', refundErr)
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

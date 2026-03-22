import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getReplicate, MODELS, resolutionMap } from '../_shared/replicate.ts'
import { getUserFromAuth, deductCredits, calculateCreditCost, refundCredits, ensureModelEnabled } from '../_shared/credits.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { persistGenerationStart } from '../_shared/generations.ts'
import { validatePrompt } from '../_shared/promptValidation.ts'

const SUPPORTED_ASPECT_RATIOS_BY_MODEL: Record<string, string[]> = {
  'seedance-1-lite': ['16:9', '9:16', '1:1'],
  'seedance-1.5-pro': ['16:9', '9:16', '1:1'],
  'kling-v2.5-turbo-pro': ['16:9', '9:16', '1:1'],
  'hailuo-2.3': ['16:9', '9:16', '1:1'],
  'wan-2.6': ['16:9', '9:16', '1:1'],
  'google-veo-3.1-fast': ['16:9', '9:16', '1:1'],
  'openai-sora-2': ['16:9', '9:16'],
  'openai-sora-2-pro': ['16:9', '9:16'],
}

const normalizeWanDimension = (value: number): number => {
  const snapped = Math.round(value / 32) * 32
  return Math.max(256, snapped)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Track for potential refund
  let userId: string | null = null
  let creditsDeducted = 0

  try {
    // Authenticate user
    const authResult = await getUserFromAuth(req)
    if (authResult.error || !authResult.userId) {
      return new Response(JSON.stringify({ error: authResult.error || 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    userId = authResult.userId

    const rateLimit = await enforceRateLimit({
      identifier: userId,
      action: 'text-to-video',
      limit: 30,
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

    const { 
      prompt: rawPrompt, 
      negativePrompt,
      model = 'minimax', 
      aspectRatio = '16:9',
      duration = '5',
      resolution = '720p',
      seed,
      withAudio = false
    } = await req.json()

    const promptResult = validatePrompt(rawPrompt)
    if (!promptResult.valid) {
      return new Response(JSON.stringify({ error: promptResult.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const prompt = promptResult.prompt

    if (!MODELS[model]) {
      return new Response(JSON.stringify({ error: 'Invalid model' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    try {
      await ensureModelEnabled(model)
    } catch {
      return new Response(JSON.stringify({ error: 'Model disabled by admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsedDuration = Number.parseInt(duration, 10)
    const requestedDuration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 5
    const requestedResolution = resolution || '720p'
    const supportedAspectRatios = SUPPORTED_ASPECT_RATIOS_BY_MODEL[model] || ['16:9']
    const effectiveAspectRatio = supportedAspectRatios.includes(aspectRatio)
      ? aspectRatio
      : supportedAspectRatios[0]

    const modelId = MODELS[model]

    // Normalize effective generation settings BEFORE charging
    let billingDuration = requestedDuration
    let billingResolution = requestedResolution

    if (modelId.includes('hailuo')) {
      billingDuration = requestedDuration <= 6 ? 6 : 10
      billingResolution = requestedResolution === '1080p' && billingDuration === 6 ? '1080p' : '768p'
    } else if (modelId.includes('wan')) {
      billingDuration = requestedDuration <= 5 ? 5 : requestedDuration <= 10 ? 10 : 15
      billingResolution = requestedResolution === '1080p' ? '1080p' : '720p'
    } else if (modelId.includes('google') && modelId.includes('veo')) {
      billingDuration = requestedDuration <= 6 ? 6 : 8
      billingResolution = requestedResolution === '1080p' ? '1080p' : '720p'
    } else if (modelId.includes('openai') && modelId.includes('sora')) {
      billingDuration = requestedDuration
      if (billingDuration < 8) billingDuration = 8
      else if (billingDuration > 12) billingDuration = 12
      else if (billingDuration === 9 || billingDuration === 11) billingDuration = 10
    }

    // Calculate credit cost with normalized values
    const cost = await calculateCreditCost('text-to-video', {
      model,
      duration: billingDuration,
      resolution: billingResolution,
      withAudio,
    })

    // Deduct credits BEFORE starting generation
    const deductResult = await deductCredits(userId, cost, `Text to Video: ${model}`)
    if (!deductResult.success) {
      return new Response(JSON.stringify({ 
        error: deductResult.error || 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        required: cost,
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    creditsDeducted = cost

    console.log(`[Text2Video] User ${userId} charged ${cost} credits`)

    const replicate = getReplicate()
    
    let input: Record<string, any> = { prompt }

    const dims = resolutionMap[billingResolution]?.[effectiveAspectRatio] || resolutionMap['720p']['16:9']

    // Model-specific configurations
    if (modelId.includes('seedance')) {
      input = {
        prompt,
        negative_prompt: negativePrompt || '',
        duration: requestedDuration,
        width: dims[0],
        height: dims[1],
        aspect_ratio: effectiveAspectRatio,
        seed: seed || Math.floor(Math.random() * 1000000),
      }
      if (model === 'seedance-1.5-pro' && withAudio) {
        input.audio = true
      }
    } else if (modelId.includes('hailuo')) {
      input = {
        prompt,
        duration: billingDuration,
        aspect_ratio: effectiveAspectRatio,
        resolution: billingResolution,
      }
    } else if (modelId.includes('minimax')) {
      input = {
        prompt,
        prompt_optimizer: true,
        width: dims[0],
        height: dims[1],
        aspect_ratio: effectiveAspectRatio,
      }
    } else if (modelId.includes('luma')) {
      input = {
        prompt,
        aspect_ratio: effectiveAspectRatio,
      }
    } else if (modelId.includes('kling')) {
      input = {
        prompt,
        negative_prompt: negativePrompt || '',
        duration: requestedDuration,
        aspect_ratio: effectiveAspectRatio,
        seed: seed || Math.floor(Math.random() * 1000000),
      }
    } else if (modelId.includes('hunyuan')) {
      input = {
        prompt,
        video_length: duration === '5' ? 129 : 65,
        width: effectiveAspectRatio === '16:9' ? 1280 : effectiveAspectRatio === '9:16' ? 720 : 1024,
        height: effectiveAspectRatio === '16:9' ? 720 : effectiveAspectRatio === '9:16' ? 1280 : 1024,
      }
    } else if (modelId.includes('haiper')) {
      input = {
        prompt,
        duration: requestedDuration,
        aspect_ratio: effectiveAspectRatio,
      }
    } else if (modelId.includes('genmo') || modelId.includes('mochi')) {
      input = {
        prompt,
        prompt_optimizer: true,
        width: dims[0],
        height: dims[1],
        aspect_ratio: effectiveAspectRatio,
      }
    } else if (modelId.includes('wan')) {
      const wanWidth = normalizeWanDimension(dims[0])
      const wanHeight = normalizeWanDimension(dims[1])

      input = {
        prompt,
        negative_prompt: negativePrompt || '',
        num_frames: billingDuration * 24,
        width: wanWidth,
        height: wanHeight,
        aspect_ratio: effectiveAspectRatio,
        seed: seed || Math.floor(Math.random() * 1000000),
      }
    } else if (modelId.includes('google') && modelId.includes('veo')) {
      input = {
        prompt,
        duration: billingDuration,
        aspect_ratio: effectiveAspectRatio,
        resolution: billingResolution,
        generate_audio: withAudio || false,
      }
    } else if (modelId.includes('openai') && modelId.includes('sora')) {
      // Sora aceita apenas "portrait" ou "landscape"
      const soraAspect = effectiveAspectRatio === '9:16' ? 'portrait' : 'landscape'

      console.log(`[Sora] Requested duration: ${duration}, Using seconds: ${billingDuration}`)

      // openai/sora-2 espera o campo "seconds"
      input = {
        prompt,
        seconds: billingDuration,
        aspect_ratio: soraAspect,
      }
      if (modelId.includes('sora-2-pro')) {
        input.quality = billingResolution === '1080p' ? 'high' : 'standard'
      }

      console.log('[Sora] Final input:', JSON.stringify(input))
    }

    console.log(`[Text2Video] Model: ${modelId}, Prompt: ${prompt.substring(0, 50)}...`)

    const prediction = await replicate.predictions.create({
      model: modelId,
      input,
    })

    await persistGenerationStart({
      userId,
      type: 'text-to-video',
      predictionId: prediction.id,
      modelId,
      modelName: model,
      creditsUsed: creditsDeducted,
      status: prediction.status,
      prompt,
      negativePrompt,
      settings: {
        model,
        aspectRatio: effectiveAspectRatio,
        duration: billingDuration,
        resolution: billingResolution,
        withAudio,
        seed: seed || null,
      },
    })

    return new Response(JSON.stringify({
      id: prediction.id,
      status: prediction.status,
      creditsUsed: creditsDeducted,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('Text to Video Error:', err)
    
    // Refund credits if generation failed before starting
    if (userId && creditsDeducted > 0) {
      console.log(`[Text2Video] Refunding ${creditsDeducted} credits to user ${userId}`)
      await refundCredits(userId, creditsDeducted, 'Text to Video failed')
    }
    
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

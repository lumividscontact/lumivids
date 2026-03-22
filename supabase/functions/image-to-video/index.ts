import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getReplicate, MODELS, resolutionMap } from '../_shared/replicate.ts'
import { getUserFromAuth, deductCredits, calculateCreditCost, refundCredits, checkCredits, ensureModelEnabled } from '../_shared/credits.ts'
import { validateImageUrl } from '../_shared/urlValidation.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { persistGenerationStart } from '../_shared/generations.ts'
import { MAX_PROMPT_LENGTH } from '../_shared/promptValidation.ts'

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
      action: 'image-to-video',
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
      imageUrl, 
      prompt,
      model = 'luma-img',
      aspectRatio = '16:9',
      duration = '5',
      resolution = '720p',
      motionStrength = 50
    } = await req.json()

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'Image URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (prompt && typeof prompt === 'string' && prompt.length > MAX_PROMPT_LENGTH) {
      return new Response(JSON.stringify({ error: `Prompt too long. Maximum is ${MAX_PROMPT_LENGTH} characters.` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const imageValidation = validateImageUrl(imageUrl)
    if (!imageValidation.valid) {
      return new Response(JSON.stringify({ error: imageValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
    const modelId = MODELS[model]

    let billingDuration = requestedDuration
    let billingResolution = requestedResolution

    if (modelId.includes('hailuo')) {
      billingDuration = requestedDuration <= 6 ? 6 : 10
      billingResolution = requestedResolution === '1080p' && billingDuration === 6 ? '1080p' : '768p'
    } else if (modelId.includes('google') && modelId.includes('veo')) {
      billingDuration = requestedDuration <= 6 ? 6 : 8
      billingResolution = requestedResolution === '1080p' ? '1080p' : '720p'
    } else if (modelId.includes('openai') && modelId.includes('sora')) {
      billingDuration = requestedDuration
      if (billingDuration < 8) billingDuration = 8
      else if (billingDuration > 12) billingDuration = 12
      else if (billingDuration === 9 || billingDuration === 11) billingDuration = 10
    }

    // Calculate credit cost
    const cost = await calculateCreditCost('image-to-video', {
      model,
      duration: billingDuration,
      resolution: billingResolution,
    })

    // Deduct credits BEFORE starting generation
    const deductResult = await deductCredits(userId, cost, `Image to Video: ${model}`)
    if (!deductResult.success) {
      const balanceCheck = await checkCredits(userId, cost)
      return new Response(JSON.stringify({ 
        error: deductResult.error || 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        required: cost,
        current: balanceCheck.currentBalance,
        billing: {
          model,
          duration: billingDuration,
          resolution: billingResolution,
        },
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    creditsDeducted = cost

    console.log(`[Image2Video] User ${userId} charged ${cost} credits`)

    const replicate = getReplicate()
    
    let input: Record<string, any> = {}
    const dims = resolutionMap[billingResolution]?.[aspectRatio] || resolutionMap['720p']['16:9']

    if (modelId.includes('luma')) {
      input = {
        prompt: prompt || 'animate this image with natural motion',
        start_image_url: imageUrl,
        aspect_ratio: aspectRatio,
      }
    } else if (modelId.includes('stable-video')) {
      input = {
        input_image: imageUrl,
        motion_bucket_id: Math.floor(motionStrength * 2.55),
      }
    } else if (modelId.includes('hailuo')) {
      input = {
        prompt: prompt || 'animate this image with natural motion',
        first_frame_image: imageUrl,
        duration: billingDuration,
        resolution: billingResolution,
      }
    } else if (modelId.includes('minimax')) {
      input = {
        prompt: prompt || 'animate this image',
        first_frame_image: imageUrl,
        width: dims[0],
        height: dims[1],
        aspect_ratio: aspectRatio,
      }
    } else if (modelId.includes('kling')) {
      const isKlingV2 = modelId.includes('kling-v2.')
      const isKlingV21 = model === 'kling-v2.1' || modelId.includes('kling-v2.1')
      input = {
        prompt: prompt || 'animate this image with natural motion',
        ...(isKlingV2 ? { start_image: imageUrl } : { image: imageUrl }),
        duration: requestedDuration,
        ...(!isKlingV21 ? { aspect_ratio: aspectRatio } : {}),
      }
    } else if (modelId.includes('haiper')) {
      input = {
        prompt: prompt || 'animate this image',
        image_url: imageUrl,
        aspect_ratio: aspectRatio,
      }
    } else if (modelId.includes('google') && modelId.includes('veo')) {
      input = {
        prompt: prompt || 'animate this image with natural motion',
        image: imageUrl,
        duration: billingDuration,
        aspect_ratio: aspectRatio,
        resolution: billingResolution,
        generate_audio: false,
      }
    } else if (modelId.includes('openai') && modelId.includes('sora')) {
      const soraAspect = aspectRatio === '1:1' ? '16:9' : aspectRatio
      input = {
        prompt: prompt || 'animate this image with natural motion',
        image: imageUrl,
        seconds: billingDuration,
        aspect_ratio: soraAspect,
      }
      if (modelId.includes('sora-2-pro')) {
        input.quality = billingResolution === '1080p' ? 'high' : 'standard'
      }
    }

    console.log(`[Image2Video] Model: ${modelId}`)

    const prediction = await replicate.predictions.create({
      model: modelId,
      input,
    })

    await persistGenerationStart({
      userId,
      type: 'image-to-video',
      predictionId: prediction.id,
      modelId,
      modelName: model,
      creditsUsed: creditsDeducted,
      status: prediction.status,
      prompt,
      inputImageUrl: imageUrl,
      settings: {
        model,
        aspectRatio,
        duration: billingDuration,
        resolution: billingResolution,
        motionStrength,
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
    console.error('Image to Video Error:', err)
    
    // Refund credits if generation failed before starting
    if (userId && creditsDeducted > 0) {
      console.log(`[Image2Video] Refunding ${creditsDeducted} credits to user ${userId}`)
      await refundCredits(userId, creditsDeducted, 'Image to Video failed')
    }
    
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

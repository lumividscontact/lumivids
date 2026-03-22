import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getReplicate, MODELS } from '../_shared/replicate.ts'
import { getUserFromAuth, deductCredits, calculateCreditCost, refundCredits, ensureModelEnabled } from '../_shared/credits.ts'
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
      return new Response(JSON.stringify({ error: 'AUTH_REQUIRED', code: 'AUTH_REQUIRED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    userId = authResult.userId

    const rateLimit = await enforceRateLimit({
      identifier: userId,
      action: 'image-to-image',
      limit: 40,
      windowSeconds: 60,
    })

    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'RATE_LIMIT_EXCEEDED', code: 'RATE_LIMIT_EXCEEDED' }), {
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
      negativePrompt,
      model,
      transformType = 'style-transfer',
      style,
      strength = 0.7,
      aspectRatio,
      resolution
    } = await req.json()

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'IMAGE_URL_REQUIRED', code: 'IMAGE_URL_REQUIRED' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (prompt && typeof prompt === 'string' && prompt.length > MAX_PROMPT_LENGTH) {
      return new Response(JSON.stringify({ error: `Prompt too long. Maximum is ${MAX_PROMPT_LENGTH} characters.`, code: 'PROMPT_TOO_LONG' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isUpscaleRequest =
      transformType === 'upscale' ||
      model === 'upscale' ||
      model === 'clarity-upscaler' ||
      model === 'esrgan'

    if (isUpscaleRequest && !MODELS['upscale']) {
      return new Response(JSON.stringify({ error: 'UPSCALE_MODEL_NOT_CONFIGURED', code: 'UPSCALE_MODEL_NOT_CONFIGURED' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const imageValidation = validateImageUrl(imageUrl)
    if (!imageValidation.valid) {
      return new Response(JSON.stringify({ error: 'INVALID_IMAGE_URL', code: 'INVALID_IMAGE_URL', details: imageValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Calculate credit cost
    const modelForCost = model || 'img2img-flux'
    try {
      await ensureModelEnabled(isUpscaleRequest ? 'upscale' : modelForCost)
    } catch {
      return new Response(JSON.stringify({ error: 'MODEL_DISABLED', code: 'MODEL_DISABLED' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cost = await calculateCreditCost('image-to-image', {
      model: isUpscaleRequest ? 'upscale' : modelForCost,
      resolution,
    })

    // Deduct credits BEFORE starting generation
    const deductResult = await deductCredits(userId, cost, `Image to Image: ${modelForCost}`)
    if (!deductResult.success) {
      return new Response(JSON.stringify({ 
        error: 'INSUFFICIENT_CREDITS',
        code: 'INSUFFICIENT_CREDITS',
        required: cost,
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    creditsDeducted = cost

    console.log(`[Image2Image] User ${userId} charged ${cost} credits`)

    const replicate = getReplicate()
    let modelId: string
    let input: Record<string, any> = {}

    if (isUpscaleRequest) {
      modelId = MODELS['upscale']
      input = {
        image: imageUrl,
        scale: 4,
        face_enhance: true,
      }
    } else {
      modelId = (model && MODELS[model]) ? MODELS[model] : MODELS['img2img-flux']
      
      const stylePrompts: Record<string, string> = {
        'anime': 'anime style, vibrant colors, clean lines',
        'enhance': 'high quality, highly detailed, sharp focus, refined textures',
        'photographic': 'photorealistic, natural lighting, realistic textures, true-to-life details',
        'digital-art': 'digital art style, concept art, painterly rendering, detailed composition',
        'cinematic': 'cinematic lighting, dramatic composition, film still aesthetic, color grading',
        'oil-painting': 'oil painting style, brush strokes, classical art',
        'watercolor': 'watercolor painting style, soft colors, flowing',
        'pencil-sketch': 'pencil sketch, black and white, detailed lines',
        'pop-art': 'pop art style, bold colors, comic book',
        'cyberpunk': 'cyberpunk style, neon lights, futuristic',
        'vintage': 'vintage photograph, sepia tones, retro',
        'minimalist': 'minimalist style, simple, clean',
      }
      
      const stylePrompt = style ? stylePrompts[style] || '' : ''
      const fullPrompt = prompt ? `${prompt}, ${stylePrompt}` : stylePrompt || 'transform this image'
      const requestedAspectRatio = aspectRatio && aspectRatio !== 'auto' ? String(aspectRatio) : 'match_input_image'

      if (modelId.includes('nano-banana-pro')) {
        const nanoResolution = resolution ? String(resolution).toUpperCase() : '2K'
        input = {
          prompt: fullPrompt,
          image_input: [imageUrl],
          aspect_ratio: requestedAspectRatio,
          resolution: nanoResolution,
        }
      } else if (modelId.includes('seedream-4.5')) {
        const seedreamSize = resolution ? String(resolution).toUpperCase() : '2K'
        input = {
          prompt: fullPrompt,
          image_input: [imageUrl],
          aspect_ratio: requestedAspectRatio,
          size: seedreamSize,
        }
      } else if (modelId.includes('sdxl') || modelId.includes('stable-diffusion-3.5')) {
        input = {
          prompt: fullPrompt,
          negative_prompt: negativePrompt || '',
          image: imageUrl,
          strength,
        }
      } else if (modelId.includes('flux')) {
        // FLUX 1.1 Pro uses image_prompt for Redux-style image conditioning
        input = {
          prompt: fullPrompt,
          image_prompt: imageUrl,
          prompt_strength: strength,
          output_format: 'webp',
        }
      } else {
        // Generic fallback for other models
        input = {
          prompt: fullPrompt,
          image: imageUrl,
          prompt_strength: strength,
          output_format: 'webp',
        }
      }
    }

    console.log(`[Image2Image] Type: ${transformType}, Model: ${modelId}`)

    const prediction = await replicate.predictions.create({
      model: modelId,
      input,
    })

    await persistGenerationStart({
      userId,
      type: 'image-to-image',
      predictionId: prediction.id,
      modelId,
      modelName: isUpscaleRequest ? 'upscale' : modelForCost,
      creditsUsed: creditsDeducted,
      status: prediction.status,
      prompt,
      negativePrompt,
      inputImageUrl: imageUrl,
      settings: {
        model: isUpscaleRequest ? 'upscale' : modelForCost,
        transformType,
        style: style || null,
        aspectRatio: aspectRatio || null,
        strength,
        resolution: resolution || null,
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
    console.error('Image to Image Error:', err)
    
    // Refund credits if generation failed before starting
    if (userId && creditsDeducted > 0) {
      console.log(`[Image2Image] Refunding ${creditsDeducted} credits to user ${userId}`)
      await refundCredits(userId, creditsDeducted, 'Image to Image failed')
    }
    
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

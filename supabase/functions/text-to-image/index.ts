import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getReplicate, MODELS } from '../_shared/replicate.ts'
import { getUserFromAuth, deductCredits, calculateCreditCost, refundCredits, ensureModelEnabled } from '../_shared/credits.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'
import { persistGenerationStart, persistGenerationStarts } from '../_shared/generations.ts'
import { validatePrompt, clampNumOutputs } from '../_shared/promptValidation.ts'

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
      action: 'text-to-image',
      limit: 60,
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

    const body = await req.json()
    const { 
      prompt: rawPrompt, 
      negativePrompt,
      model = 'flux-pro',
      aspectRatio = '1:1',
      resolution,
    } = body
    const numOutputs = clampNumOutputs(body.numOutputs || body.numImages || 1)

    const promptResult = validatePrompt(rawPrompt)
    if (!promptResult.valid) {
      return new Response(JSON.stringify({ error: promptResult.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const prompt = promptResult.prompt

    try {
      await ensureModelEnabled(model)
    } catch {
      return new Response(JSON.stringify({ error: 'Model disabled by admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Calculate credit cost
    const cost = await calculateCreditCost('text-to-image', {
      model,
      resolution,
      numOutputs,
    })

    // Deduct credits BEFORE starting generation
    const deductResult = await deductCredits(userId, cost, `Text to Image: ${model}`)
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

    console.log(`[Text2Image] User ${userId} charged ${cost} credits`)

    const replicate = getReplicate()
    const modelId = MODELS[model] || MODELS['flux-pro']
    
    const dimensions: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '4:3': { width: 1152, height: 896 },
      '3:2': { width: 1216, height: 832 },
    }
    
    const { width, height } = dimensions[aspectRatio] || dimensions['1:1']
    
    let input: Record<string, any> = {}

    if (modelId.includes('flux')) {
      input = {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: 'webp',
        output_quality: 90,
        num_outputs: numOutputs,
      }
    } else if (modelId.includes('nano-banana-pro')) {
      const nanoAspectRatio = aspectRatio === 'auto' ? 'match_input_image' : aspectRatio
      const nanoResolution = resolution ? String(resolution).toUpperCase() : '2K'
      input = {
        prompt,
        aspect_ratio: nanoAspectRatio,
        resolution: nanoResolution,
        num_outputs: numOutputs,
      }
    } else if (modelId.includes('sdxl') || modelId.includes('stable-diffusion-3.5')) {
      input = {
        prompt,
        negative_prompt: negativePrompt || '',
        width,
        height,
        num_outputs: numOutputs,
      }
    } else if (modelId.includes('imagen-4-fast')) {
      input = {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: 'jpg',
        number_of_images: numOutputs,
      }
    } else if (modelId.includes('imagen-4-ultra')) {
      input = {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: 'jpg',
        number_of_images: numOutputs,
      }
    } else if (modelId.includes('seedream-4.5')) {
      const seedreamAspectRatio = aspectRatio === 'auto' ? 'match_input_image' : aspectRatio
      const seedreamSize = resolution ? String(resolution).toUpperCase() : '2K'
      input = {
        prompt,
        aspect_ratio: seedreamAspectRatio,
        size: seedreamSize,
        num_outputs: numOutputs,
      }
    } else if (modelId.includes('ideogram')) {
      input = {
        prompt,
        aspect_ratio: aspectRatio,
        style_type: 'Auto',
        num_images: numOutputs,
      }
    }

    console.log(`[Text2Image] Model: ${modelId}, Prompt: ${prompt.substring(0, 50)}...`)

    // Some models don't support num_outputs natively (ideogram, imagen, seedream).
    // For those, we create predictions sequentially with a delay to avoid rate limits.
    const singleOutputModel = modelId.includes('ideogram') || modelId.includes('imagen-4') || modelId.includes('seedream')

    if (singleOutputModel && numOutputs > 1) {
      const predictions = []
      for (let i = 0; i < numOutputs; i++) {
        if (i > 0) {
          // Wait 12s between requests to respect rate limits
          await new Promise(r => setTimeout(r, 12_000))
        }
        const p = await replicate.predictions.create({ model: modelId, input })
        predictions.push(p)
        console.log(`[Text2Image] Created prediction ${i + 1}/${numOutputs}: ${p.id}`)
      }

      const baseCreditsPerPrediction = Math.floor(creditsDeducted / numOutputs)
      const remainderCredits = creditsDeducted % numOutputs

      await persistGenerationStarts(
        predictions.map((p, index) => ({
          userId,
          type: 'text-to-image' as const,
          predictionId: p.id,
          modelId,
          modelName: model,
          creditsUsed: baseCreditsPerPrediction + (index < remainderCredits ? 1 : 0),
          status: p.status,
          prompt,
          negativePrompt,
          settings: {
            model,
            aspectRatio,
            resolution: resolution || null,
            numOutputs,
          },
        }))
      )

      // Return the first prediction ID + extra IDs so the client can poll all of them
      return new Response(JSON.stringify({
        id: predictions[0].id,
        status: predictions[0].status,
        creditsUsed: creditsDeducted,
        parallelIds: predictions.map(p => p.id),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const prediction = await replicate.predictions.create({
      model: modelId,
      input,
    })

    await persistGenerationStart({
      userId,
      type: 'text-to-image',
      predictionId: prediction.id,
      modelId,
      modelName: model,
      creditsUsed: creditsDeducted,
      status: prediction.status,
      prompt,
      negativePrompt,
      settings: {
        model,
        aspectRatio,
        resolution: resolution || null,
        numOutputs,
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
    console.error('Text to Image Error:', err)
    
    // Refund credits if generation failed before starting
    if (userId && creditsDeducted > 0) {
      console.log(`[Text2Image] Refunding ${creditsDeducted} credits to user ${userId}`)
      await refundCredits(userId, creditsDeducted, 'Text to Image failed')
    }
    
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

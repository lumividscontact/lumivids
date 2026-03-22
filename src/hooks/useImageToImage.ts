import { useMemo } from 'react'
import { replicateAPI, ImageToImageInput } from '@/services/replicate'
import { updateUsageStats } from '@/services/usageStats'
import { useCredits } from '@/contexts/CreditsContext'
import { useLanguage } from '@/i18n'
import { useGeneration } from './useGeneration'

export function useImageToImage() {
  const { t } = useLanguage()
  const { credits, getCost } = useCredits()

  const generation = useGeneration<ImageToImageInput, string>({
    generationType: 'image-to-image',
    calculateCost: (input) => getCost('image-to-image', input.model, input.resolution),
    createPrediction: async (input) => replicateAPI.createImageToImage(input),
    waitForCompletion: async ({ predictionId, onProgress }) => {
      const result = await replicateAPI.waitForPrediction(predictionId, (prediction) => {
        onProgress({
          status: prediction.status,
          progress: prediction.status === 'processing' ? 50 : 10,
        })
      })

      if (result.status !== 'succeeded') {
        throw new Error(result.error || t.errors.generationFailed)
      }

      return Array.isArray(result.output) ? result.output[0] : (result.output as string)
    },
    buildInitialGeneration: ({ input, predictionId, cost }) => ({
      predictionId,
      type: 'image-to-image',
      status: 'starting',
      output: null,
      error: null,
      progress: 10,
      creditsUsed: cost,
      modelName: input.model,
      prompt: input.prompt,
      thumbnail: input.imageUrl,
    }),
    buildSuccessGenerationUpdate: ({ output }) => ({
      thumbnail: output,
    }),
    mapGenerationOutput: (output) => {
      if (!output) return null
      return Array.isArray(output) ? (output[0] ?? null) : output
    },
    formatInsufficientCreditsError: ({ cost, credits }) =>
      `${t.errors.insufficientCredits} ${t.pricing.youNeed} ${cost} ${t.ui.creditsLabel.toLowerCase()}, ${t.pricing.youHave} ${credits} ${t.ui.creditsLabel.toLowerCase()}.`,
    formatFailureError: ({ errorMessage, cost }) => {
      const isInsufficientCredits = errorMessage.includes('Insufficient credits') || errorMessage.includes('INSUFFICIENT_CREDITS')
      if (isInsufficientCredits) {
        return `${t.errors.insufficientCredits} ${t.pricing.youNeed} ${cost} ${t.ui.creditsLabel.toLowerCase()}.`
      }

      if (errorMessage.includes('AUTH_REQUIRED')) return t.errors.unauthorized
      if (errorMessage.includes('RATE_LIMIT_EXCEEDED')) return t.errors.rateLimitExceeded
      if (errorMessage.includes('IMAGE_URL_REQUIRED')) return t.errors.imageRequired
      if (errorMessage.includes('UPSCALE_MODEL_NOT_CONFIGURED')) return t.errors.generationFailed
      if (errorMessage.includes('INVALID_IMAGE_URL')) return t.errors.invalidFile
      if (errorMessage.includes('INTERNAL_ERROR')) return t.errors.generic

      return errorMessage
    },
    onCompleted: async ({ cost }) => {
      await updateUsageStats('image-to-image', cost, 0)
    },
  })

  const hookResult = useMemo(() => ({
    ...generation,
    getCost: (model: string) => getCost('image-to-image', model),
  }), [generation, getCost])

  return {
    ...hookResult,
    credits,
  }
}

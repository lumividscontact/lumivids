import { useMemo } from 'react'
import { replicateAPI, resolvePredictionOutputUrls, TextToVideoInput } from '@/services/replicate'
import { updateUsageStats } from '@/services/usageStats'
import { useCredits } from '@/contexts/CreditsContext'
import { getModelById, calculateCredits, Resolution } from '@/config/models'
import { useLanguage } from '@/i18n'
import { useGeneration } from './useGeneration'
import { createEstimatedPollingProgress } from './estimatedProgress'

export function useTextToVideo() {
  const { t } = useLanguage()
  const { getCost } = useCredits()

  const generationConfig = useMemo(() => ({
    generationType: 'text-to-video',
    calculateCost: (input) => {
      const model = getModelById(input.model)
      const duration = parseInt(input.duration) || 5
      const resolution = (input.resolution || '720p') as Resolution
      const withAudio = input.withAudio || false
      return model ? calculateCredits(model, duration, resolution, withAudio) : getCost('text-to-video', input.model, input.resolution)
    },
    createPrediction: async (input) => replicateAPI.createTextToVideo(input),
    waitForCompletion: async ({ predictionId, onProgress }) => {
      const getEstimatedProgress = createEstimatedPollingProgress()

      const result = await replicateAPI.waitForPrediction(predictionId, (prediction) => {
        onProgress({
          status: prediction.status,
          progress: getEstimatedProgress(prediction.status),
        })
      })

      if (result.status !== 'succeeded') {
        throw new Error(result.error || 'Generation failed')
      }

      console.log('[TextToVideo] Prediction output:', typeof result.output, JSON.stringify(result.output)?.slice(0, 200))
      const outputUrls = resolvePredictionOutputUrls(result)
      console.log('[TextToVideo] Resolved URLs:', outputUrls)
      if (outputUrls.length === 0) {
        console.warn('[TextToVideo] No URLs resolved from prediction:', JSON.stringify(result)?.slice(0, 500))
      }
      return outputUrls.length > 0 ? outputUrls : null
    },
    buildInitialGeneration: ({ input, predictionId, cost }) => {
      const model = getModelById(input.model)
      const duration = parseInt(input.duration) || 5
      return {
        predictionId,
        type: 'text-to-video',
        status: 'starting',
        output: null,
        error: null,
        progress: 10,
        creditsUsed: cost,
        modelName: model?.name || input.model,
        prompt: input.prompt,
        durationSec: duration,
        aspectRatio: input.aspectRatio,
      }
    },
    buildSuccessGenerationUpdate: ({ input, output }) => ({
      thumbnail: output?.[0] || undefined,
      durationSec: parseInt(input.duration) || 5,
      aspectRatio: input.aspectRatio,
    }),
    mapGenerationOutput: (output) => {
      if (!output) return null
      return Array.isArray(output) ? output : [output]
    },
    formatInsufficientCreditsError: ({ cost, credits }) =>
      `${t.errors.insufficientCredits} ${t.pricing.youNeed} ${cost} ${t.ui.creditsLabel.toLowerCase()}, ${t.pricing.youHave} ${credits} ${t.ui.creditsLabel.toLowerCase()}.`,
    formatFailureError: ({ errorMessage, cost }) => {
      const isInsufficientCredits = errorMessage.includes('Insufficient credits') || errorMessage.includes('INSUFFICIENT_CREDITS')
      return isInsufficientCredits
        ? `${t.errors.insufficientCredits} ${t.pricing.youNeed} ${cost} ${t.ui.creditsLabel.toLowerCase()}.`
        : errorMessage
    },
    onCompleted: async ({ input, cost }) => {
      await updateUsageStats('text-to-video', cost, parseInt(input.duration) || 5)
    },
  }), [getCost, t])

  const generation = useGeneration<TextToVideoInput, string[] | null>(generationConfig)

  return {
    ...generation,
  }
}

import { useMemo } from 'react'
import { replicateAPI, resolvePredictionOutputUrls, TextToImageInput } from '@/services/replicate'
import { updateUsageStats } from '@/services/usageStats'
import { useCredits } from '@/contexts/CreditsContext'
import { useLanguage } from '@/i18n'
import { useGeneration } from './useGeneration'
import { createEstimatedPollingProgress } from './estimatedProgress'

export function useTextToImage() {
  const { credits, getCost } = useCredits()
  const { t } = useLanguage()

  const generationConfig = useMemo(() => ({
    generationType: 'text-to-image',
    calculateCost: (input) =>
      getCost('text-to-image', input.model, {
        resolution: input.resolution,
        numOutputs: input.numOutputs || 1,
      }),
    createPrediction: async (input) => replicateAPI.createTextToImage(input),
    waitForCompletion: async ({ predictionId, parallelIds, onProgress }) => {
      if (parallelIds && parallelIds.length > 1) {
        const getEstimatedProgress = createEstimatedPollingProgress()

        const results = await replicateAPI.waitForMultiplePredictions(parallelIds, (completed, total) => {
          const progress = Math.round(10 + (completed / total) * 80)
          onProgress({ status: 'processing', progress })
        })

        const output: string[] = []
        for (const result of results) {
          if (result.status === 'succeeded' && result.output) {
            const urls = resolvePredictionOutputUrls(result)
            output.push(...urls)
          }
        }

        if (output.length === 0) {
          throw new Error(results.find((result) => result.error)?.error || 'All generations failed')
        }

        return output
      }

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

      const outputUrls = resolvePredictionOutputUrls(result)
      return outputUrls.length > 0 ? outputUrls : (Array.isArray(result.output) ? result.output as string[] : [result.output as string])
    },
    buildInitialGeneration: ({ input, predictionId, cost }) => ({
      predictionId,
      type: 'text-to-image',
      status: 'starting',
      output: null,
      error: null,
      progress: 10,
      creditsUsed: cost,
      modelName: input.model,
      prompt: input.prompt,
      thumbnail: undefined,
      aspectRatio: input.aspectRatio,
    }),
    buildSuccessGenerationUpdate: ({ input, output }) => ({
      thumbnail: output[0],
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
    onCompleted: async ({ cost }) => {
      await updateUsageStats('text-to-image', cost, 0)
    },
  }), [getCost, t])

  const generation = useGeneration<TextToImageInput, string[]>(generationConfig)

  return {
    ...generation,
    credits,
  }
}

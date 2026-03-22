import type { PredictionResult } from '@/services/replicate'

interface EstimatedProgressOptions {
  startingProgress?: number
  processingStartProgress?: number
  processingStep?: number
  processingMaxProgress?: number
}

export function createEstimatedPollingProgress(options: EstimatedProgressOptions = {}) {
  const {
    startingProgress = 10,
    processingStartProgress = 20,
    processingStep = 8,
    processingMaxProgress = 90,
  } = options

  let processingTicks = 0

  return (status: PredictionResult['status']) => {
    if (status === 'processing') {
      processingTicks += 1
      return Math.min(processingMaxProgress, processingStartProgress + processingTicks * processingStep)
    }

    if (status === 'starting') {
      return startingProgress
    }

    return startingProgress
  }
}
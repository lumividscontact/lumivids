/**
 * CREDIT COSTS - Single Source of Truth
 * 
 * This file defines all credit costs for the platform.
 * It is used by both frontend and backend to ensure consistency.
 * 
 * IMPORTANT: When adding or modifying models, update this file ONLY.
 * Both frontend (src/config/models.ts) and backend (supabase/functions/_shared/credits.ts)
 * import from this file.
 */

export type OperationType = 'text-to-video' | 'image-to-video' | 'text-to-image' | 'image-to-image'
export type Resolution = '480p' | '576p' | '720p' | '768p' | '1080p' | '1k' | '2k' | '4k'

export interface PerSecondCost {
  perSecond: Record<Resolution, number>
  perSecondWithAudio?: Record<Resolution, number>
}

export type ModelCost = number | PerSecondCost

export interface CreditCostsConfig {
  'text-to-video': Record<string, ModelCost>
  'image-to-video': Record<string, ModelCost>
  'text-to-image': Record<string, ModelCost>
  'image-to-image': Record<string, ModelCost>
}

/**
 * Credit costs per model/operation
 * 
 * Format:
 * - number: Fixed cost per generation
 * - { perSecond: { resolution: cost } }: Cost per second per resolution
 * - { perSecondWithAudio: { resolution: cost } }: Cost per second with audio
 */
export const CREDIT_COSTS: CreditCostsConfig = {
  'text-to-video': {
    // SeeDance models - per second pricing
    'seedance-1-lite': {
      perSecond: { '480p': 1, '576p': 1, '720p': 2, '768p': 2, '1080p': 4, '1k': 2, '2k': 4, '4k': 8 },
    },
    'seedance-1.5-pro': {
      perSecond: { '480p': 2, '576p': 2, '720p': 2, '768p': 2, '1080p': 2, '1k': 2, '2k': 2, '4k': 2 },
      perSecondWithAudio: { '480p': 3, '576p': 3, '720p': 3, '768p': 3, '1080p': 3, '1k': 3, '2k': 3, '4k': 3 },
    },
    
    // Kling models
    'kling-v2.5-turbo-pro': {
      perSecond: { '480p': 4, '576p': 4, '720p': 4, '768p': 4, '1080p': 4, '1k': 4, '2k': 4, '4k': 4 },
    },
    
    // Hailuo
    'hailuo-2.3': {
      perSecond: { '480p': 4, '576p': 4, '720p': 4, '768p': 4, '1080p': 7, '1k': 4, '2k': 7, '4k': 7 },
    },
    
    // Wan
    'wan-2.6': {
      perSecond: { '480p': 10, '576p': 10, '720p': 10, '768p': 10, '1080p': 15, '1k': 10, '2k': 15, '4k': 15 },
    },
    
    // Google Veo
    'google-veo-3.1-fast': {
      perSecond: { '480p': 6, '576p': 6, '720p': 6, '768p': 6, '1080p': 6, '1k': 6, '2k': 6, '4k': 6 },
      perSecondWithAudio: { '480p': 9, '576p': 9, '720p': 9, '768p': 9, '1080p': 9, '1k': 9, '2k': 9, '4k': 9 },
    },
    
    // OpenAI Sora
    'openai-sora-2': {
      perSecond: { '480p': 6, '576p': 6, '720p': 6, '768p': 6, '1080p': 6, '1k': 6, '2k': 6, '4k': 6 },
    },
    'openai-sora-2-pro': {
      perSecond: { '480p': 18, '576p': 18, '720p': 18, '768p': 18, '1080p': 30, '1k': 18, '2k': 30, '4k': 30 },
    },
    
    // Legacy models (fixed pricing)
    minimax: 10,
    'luma-dream': 15,
    kling: 12,
    haiper: 8,
    cogvideo: 10,
    genmo: 8,
  },
  
  'image-to-video': {
    // Google Veo
    'google-veo-3.1-fast-img': {
      perSecond: { '480p': 6, '576p': 6, '720p': 6, '768p': 6, '1080p': 6, '1k': 6, '2k': 6, '4k': 6 },
      perSecondWithAudio: { '480p': 9, '576p': 9, '720p': 9, '768p': 9, '1080p': 9, '1k': 9, '2k': 9, '4k': 9 },
    },
    
    // OpenAI Sora
    'openai-sora-2-img': {
      perSecond: { '480p': 6, '576p': 6, '720p': 6, '768p': 6, '1080p': 6, '1k': 6, '2k': 6, '4k': 6 },
    },
    'openai-sora-2-pro-img': {
      perSecond: { '480p': 18, '576p': 18, '720p': 18, '768p': 18, '1080p': 30, '1k': 18, '2k': 30, '4k': 30 },
    },
    
    // Kling
    'kling-v2.5-turbo-pro-img': {
      perSecond: { '480p': 4, '576p': 4, '720p': 4, '768p': 4, '1080p': 4, '1k': 4, '2k': 4, '4k': 4 },
    },
    'kling-v2.1': {
      perSecond: { '480p': 5, '576p': 5, '720p': 5, '768p': 5, '1080p': 9, '1k': 5, '2k': 9, '4k': 9 },
    },
    
    // Hailuo
    'hailuo-2.3-img': {
      perSecond: { '480p': 4, '576p': 4, '720p': 4, '768p': 4, '1080p': 7, '1k': 4, '2k': 7, '4k': 7 },
    },
    'hailuo-2.3-fast-img': {
      perSecond: { '480p': 3, '576p': 3, '720p': 3, '768p': 3, '1080p': 5, '1k': 3, '2k': 5, '4k': 5 },
    },
    
    // Minimax
    'minimax-img': {
      perSecond: { '480p': 2, '576p': 2, '720p': 2, '768p': 2, '1080p': 3, '1k': 2, '2k': 3, '4k': 3 },
    },
    
    // Luma
    'luma-photon-img': {
      perSecond: { '480p': 5, '576p': 5, '720p': 5, '768p': 5, '1080p': 5, '1k': 5, '2k': 5, '4k': 5 },
    },
    
    // Legacy models (fixed pricing)
    minimax: 12,
    'luma-dream': 18,
    'luma-img': 18,
    kling: 15,
    'kling-img': 15,
    haiper: 10,
    'haiper-img': 10,
    'stable-video': 8,
    'stable-video-img': 8,
  },
  
  'text-to-image': {
    // Flux
    'flux-pro': 3,
    'flux-schnell': 1,
    
    // Stable Diffusion
    'stable-3.5': 5,
    
    // Google Imagen
    'imagen-4-fast': 2,
    'imagen-4-ultra': 4,
    
    // Others
    'nano-banana-pro': 15, // Base price, adjust by resolution (1k=12, 2k=15, 4k=24)
    ideogram: 6,
    'seedream-4.5': 3,
  },
  
  'image-to-image': {
    // Flux
    'flux-pro': 3,
    'flux-img2img': 3,
    'img2img-flux': 3,
    
    // Others
    'nano-banana-pro': 15, // Base price, adjust by resolution (1k=12, 2k=15, 4k=24)
    'seedream-4.5': 3,
    upscale: 2,
  },
} as const

/**
 * Calculate credit cost for a generation
 */
export function calculateCreditCost(
  operationType: OperationType,
  model: string,
  duration: number = 5,
  resolution: Resolution = '720p',
  withAudio: boolean = false,
  numOutputs: number = 1
): number {
  // Special handling for nano-banana-pro with resolution-based pricing
  if (model === 'nano-banana-pro') {
    const res = resolution.toLowerCase()
    if (res === '4k') return 24 * numOutputs
    if (res === '1k') return 12 * numOutputs
    return 15 * numOutputs // 2k default
  }

  const costs = CREDIT_COSTS[operationType]
  const modelCost = costs[model]

  if (!modelCost) {
    // Fallback costs by operation type
    const fallbacks: Record<OperationType, number> = {
      'text-to-video': 10,
      'image-to-video': 12,
      'text-to-image': 5,
      'image-to-image': 5,
    }
    return fallbacks[operationType] * numOutputs
  }

  // If model has per-second costs
  if (typeof modelCost === 'object' && 'perSecond' in modelCost) {
    // Use audio pricing if available and enabled
    if (withAudio && modelCost.perSecondWithAudio) {
      const perSecondCosts = modelCost.perSecondWithAudio
      const resolutionCost = perSecondCosts[resolution] || perSecondCosts['720p'] || 2
      return resolutionCost * duration * numOutputs
    }
    
    const perSecondCosts = modelCost.perSecond
    const resolutionCost = perSecondCosts[resolution] || perSecondCosts['720p'] || 2
    return resolutionCost * duration * numOutputs
  }

  // Fixed cost per generation
  return (modelCost as number) * numOutputs
}

/**
 * Get all model IDs for an operation type
 */
export function getModelIds(operationType: OperationType): string[] {
  return Object.keys(CREDIT_COSTS[operationType])
}

/**
 * Check if a model exists for an operation type
 */
export function isValidModel(operationType: OperationType, model: string): boolean {
  return model in CREDIT_COSTS[operationType]
}

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
export type Resolution = '480p' | '576p' | '720p' | '768p' | '1080p' | '1k' | '2k' | '3k' | '4k'

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

const NANO_BANANA_IMAGE_COSTS = {
  'nano-banana-pro': {
    '1k': 12,
    '2k': 15,
    '4k': 24,
  },
  'nano-banana-2': {
    '1k': 7,
    '2k': 10,
    '4k': 15,
  },
} as const

const FLUX_2_PRO_TEXT_IMAGE_COSTS = {
  '1k': 2,
  '2k': 3,
  '4k': 5,
} as const

const FLUX_2_PRO_IMAGE_EDIT_COSTS = {
  '1k': 3,
  '2k': 5,
  '4k': 8,
} as const

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
      perSecond: { '480p': 1, '576p': 1, '720p': 2, '768p': 2, '1080p': 5, '1k': 5, '2k': 5, '4k': 5 },
      perSecondWithAudio: { '480p': 2, '576p': 2, '720p': 4, '768p': 4, '1080p': 10, '1k': 10, '2k': 10, '4k': 10 },
    },
    'seedance-2.0': {
      perSecond: { '480p': 7, '576p': 7, '720p': 15, '768p': 15, '1080p': 15, '1k': 15, '2k': 15, '4k': 15 },
      perSecondWithAudio: { '480p': 7, '576p': 7, '720p': 15, '768p': 15, '1080p': 15, '1k': 15, '2k': 15, '4k': 15 },
    },
    'grok-imagine-video': {
      perSecond: { '480p': 4, '576p': 4, '720p': 4, '768p': 4, '1080p': 4, '1k': 4, '2k': 4, '4k': 4 },
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

    // Runway
    'runway-gen-4.5': {
      perSecond: { '480p': 8, '576p': 8, '720p': 8, '768p': 8, '1080p': 8, '1k': 8, '2k': 8, '4k': 8 },
    },
    
    // OpenAI Sora
    'openai-sora-2': {
      perSecond: { '480p': 6, '576p': 6, '720p': 6, '768p': 6, '1080p': 6, '1k': 6, '2k': 6, '4k': 6 },
    },
    'openai-sora-2-pro': {
      perSecond: { '480p': 18, '576p': 18, '720p': 18, '768p': 18, '1080p': 30, '1k': 18, '2k': 30, '4k': 30 },
    },

    // Pruna AI P-Video
    'p-video-standard': {
      perSecond: { '720p': 4, '1080p': 8 },
      perSecondWithAudio: { '720p': 4, '1080p': 8 },
    },
    'p-video-draft': {
      perSecond: { '720p': 1, '1080p': 2 },
      perSecondWithAudio: { '720p': 1, '1080p': 2 },
    },

    // Kling v3 Omni
    'kling-v3-omni': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'p-video-720p-standard': {
      perSecond: { '720p': 4, '1080p': 8 },
      perSecondWithAudio: { '720p': 4, '1080p': 8 },
    },
    'p-video-720p-draft': {
      perSecond: { '720p': 1, '1080p': 2 },
      perSecondWithAudio: { '720p': 1, '1080p': 2 },
    },
    'p-video-1080p-standard': {
      perSecond: { '720p': 4, '1080p': 8 },
      perSecondWithAudio: { '720p': 4, '1080p': 8 },
    },
    'p-video-1080p-draft': {
      perSecond: { '720p': 1, '1080p': 2 },
      perSecondWithAudio: { '720p': 1, '1080p': 2 },
    },
    'kling-v3-omni-standard': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'kling-v3-omni-standard-audio': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'kling-v3-omni-pro': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'kling-v3-omni-pro-audio': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'kling-v3-omni-4k': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'kling-v3-omni-4k-audio': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
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
    'grok-imagine-video-img': {
      perSecond: { '480p': 4, '576p': 4, '720p': 4, '768p': 4, '1080p': 4, '1k': 4, '2k': 4, '4k': 4 },
    },
    'seedance-2.0-img': {
      perSecond: { '480p': 7, '576p': 7, '720p': 15, '768p': 15, '1080p': 15, '1k': 15, '2k': 15, '4k': 15 },
    },

    // Google Veo
    'google-veo-3.1-fast-img': {
      perSecond: { '480p': 6, '576p': 6, '720p': 6, '768p': 6, '1080p': 6, '1k': 6, '2k': 6, '4k': 6 },
      perSecondWithAudio: { '480p': 9, '576p': 9, '720p': 9, '768p': 9, '1080p': 9, '1k': 9, '2k': 9, '4k': 9 },
    },

    // Runway
    'runway-gen-4.5-img': {
      perSecond: { '480p': 8, '576p': 8, '720p': 8, '768p': 8, '1080p': 8, '1k': 8, '2k': 8, '4k': 8 },
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

    // Pruna AI P-Video
    'p-video-standard-img': {
      perSecond: { '720p': 4, '1080p': 8 },
      perSecondWithAudio: { '720p': 4, '1080p': 8 },
    },
    'p-video-draft-img': {
      perSecond: { '720p': 1, '1080p': 2 },
      perSecondWithAudio: { '720p': 1, '1080p': 2 },
    },

    // Kling v3 Omni
    'kling-v3-omni-img': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'p-video-720p-standard-img': {
      perSecond: { '720p': 4, '1080p': 8 },
      perSecondWithAudio: { '720p': 4, '1080p': 8 },
    },
    'p-video-720p-draft-img': {
      perSecond: { '720p': 1, '1080p': 2 },
      perSecondWithAudio: { '720p': 1, '1080p': 2 },
    },
    'p-video-1080p-standard-img': {
      perSecond: { '720p': 4, '1080p': 8 },
      perSecondWithAudio: { '720p': 4, '1080p': 8 },
    },
    'p-video-1080p-draft-img': {
      perSecond: { '720p': 1, '1080p': 2 },
      perSecondWithAudio: { '720p': 1, '1080p': 2 },
    },
    'kling-v3-omni-standard-img': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'kling-v3-omni-standard-audio-img': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'kling-v3-omni-pro-img': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'kling-v3-omni-pro-audio-img': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'kling-v3-omni-4k-img': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
    },
    'kling-v3-omni-4k-audio-img': {
      perSecond: { '720p': 34, '1080p': 45, '4k': 84 },
      perSecondWithAudio: { '720p': 45, '1080p': 56, '4k': 84 },
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
    'flux-2-pro': 3,
    'flux-pro': 3, // legacy alias
    'flux-schnell': 1,

    // OpenAI GPT Image 2
    'gpt-image-2': 8,
    'gpt-image-2-auto': 8,
    'gpt-image-2-low': 1,
    'gpt-image-2-medium': 3,
    'gpt-image-2-high': 8,
    
    // Stable Diffusion
    'stable-3.5': 5,
    
    // Google Imagen
    'imagen-4-fast': 2,
    'imagen-4-ultra': 4,
    
    // Others
    'nano-banana-pro': 15, // Base price, adjust by resolution (1k=12, 2k=15, 4k=24)
    'nano-banana-2': 7, // Base price, adjust by resolution (1k=7, 2k=10, 4k=15)
    ideogram: 6,
    'seedream-4.5': 3,
    'seedream-5-lite': 4,
  },
  
  'image-to-image': {
    // Flux
    'flux-2-pro-img2img': 5,
    'flux-pro': 5, // legacy alias
    'flux-img2img': 5, // legacy alias
    'img2img-flux': 5, // legacy alias
    
    // Others
    'nano-banana-pro': 15, // Base price, adjust by resolution (1k=12, 2k=15, 4k=24)
    'nano-banana-2': 7, // Base price, adjust by resolution (1k=7, 2k=10, 4k=15)
    'seedream-4.5': 3,
    'seedream-5-lite': 4,
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
  const normalizeImageResolutionTier = (res: Resolution): keyof typeof FLUX_2_PRO_TEXT_IMAGE_COSTS => {
    const normalized = res.toLowerCase()
    if (normalized === '4k') return '4k'
    if (normalized === '1k' || normalized === '720p') return '1k'
    return '2k'
  }

  // Special handling for Nano Banana image models with resolution-based pricing
  if (model in NANO_BANANA_IMAGE_COSTS) {
    const res = resolution.toLowerCase()
    const pricing = NANO_BANANA_IMAGE_COSTS[model as keyof typeof NANO_BANANA_IMAGE_COSTS]
    if (res === '4k') return pricing['4k'] * numOutputs
    if (res === '1k') return pricing['1k'] * numOutputs
    return pricing['2k'] * numOutputs
  }

  // Flux 2 Pro resolution-based pricing tuned for sustainable margins
  if (operationType === 'text-to-image' && (model === 'flux-2-pro' || model === 'flux-pro')) {
    const tier = normalizeImageResolutionTier(resolution)
    return FLUX_2_PRO_TEXT_IMAGE_COSTS[tier] * numOutputs
  }

  if (
    operationType === 'image-to-image' &&
    (model === 'flux-2-pro-img2img' || model === 'flux-img2img' || model === 'img2img-flux' || model === 'flux-pro')
  ) {
    const tier = normalizeImageResolutionTier(resolution)
    return FLUX_2_PRO_IMAGE_EDIT_COSTS[tier] * numOutputs
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

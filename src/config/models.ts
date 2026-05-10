// AI Models Configuration
// This file contains all AI model configurations for the platform

export type ModelCategory = 'text-to-video' | 'image-to-video' | 'text-to-image' | 'image-to-image'
export type Resolution = '480p' | '576p' | '720p' | '768p' | '1080p' | '1k' | '2k' | '3k' | '4k'
export type AspectRatio = 'auto' | '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '2:3' | '3:2' | '21:9' | '9:21'

export interface CreditCost {
  perSecond?: number // Credits per second of video
  fixed?: number // Fixed credits per generation
}

export interface ResolutionConfig {
  width: number
  height: number
  creditMultiplier: number // Multiplier for credits based on resolution
}

export interface ModelConfig {
  id: string
  name: string
  description: string
  category: ModelCategory
  replicateId: string
  
  // Generation settings
  minDuration?: number // seconds
  maxDuration?: number // seconds
  defaultDuration?: number // seconds
  durationOptions?: number[] // explicit duration options for models with non-linear presets
  supportedAspectRatios: AspectRatio[]
  supportedResolutions: Resolution[]
  defaultResolution: Resolution
  
  // Credit costs
  credits: {
    base: number // Base credits
    perSecond?: Partial<Record<Resolution, number>> // Credits per second per resolution
    perSecondWithAudio?: Partial<Record<Resolution, number>> // Credits per second with audio
  }
  
  // Capabilities
  supportsNegativePrompt?: boolean
  supportsPromptOptimizer?: boolean
  supportsLoopVideo?: boolean
  supportsSeed?: boolean
  supportsAudio?: boolean // Whether model supports audio generation
  
  // UI
  badge?: string // e.g., "NEW", "POPULAR", "FAST"
  hideResolutionSelector?: boolean
  hideAspectRatioSelector?: boolean
  tier: 'creator' | 'studio' | 'director' // Minimum plan required
}

// Resolution configurations
export const RESOLUTIONS: Record<Resolution, ResolutionConfig> = {
  '480p': { width: 854, height: 480, creditMultiplier: 1 },
  '576p': { width: 1024, height: 576, creditMultiplier: 1.5 },
  '720p': { width: 1280, height: 720, creditMultiplier: 2 },
  '768p': { width: 1366, height: 768, creditMultiplier: 2 },
  '1080p': { width: 1920, height: 1080, creditMultiplier: 4 },
  '1k': { width: 1024, height: 1024, creditMultiplier: 3 },
  '2k': { width: 2048, height: 2048, creditMultiplier: 6 },
  '3k': { width: 3072, height: 3072, creditMultiplier: 7 },
  '4k': { width: 3840, height: 2160, creditMultiplier: 8 },
}

export async function loadResolutionDimensions() {
  const module = await import('./resolutionDimensions.ts')
  return module.RESOLUTION_DIMENSIONS
}

// ============================================
// TEXT TO VIDEO MODELS
// ============================================
export const TEXT_TO_VIDEO_MODELS: ModelConfig[] = [
  {
    id: 'seedance-1-lite',
    name: 'SeeDance Lite',
    description: 'Fast and affordable video generation with great quality',
    category: 'text-to-video',
    replicateId: 'bytedance/seedance-1-lite',
    minDuration: 5,
    maxDuration: 10,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['480p', '720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 1,
        '576p': 1,
        '720p': 2,
        '768p': 2,
        '1080p': 4,
        '4k': 8, // not supported but for type safety
      },
    },
    supportsNegativePrompt: true,
    supportsPromptOptimizer: true,
    supportsSeed: true,
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'seedance-1.5-pro',
    name: 'SeeDance 1.5 Pro',
    description: 'High quality video with optional audio generation',
    category: 'text-to-video',
    replicateId: 'bytedance/seedance-1.5-pro',
    minDuration: 5,
    maxDuration: 12,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', '9:21'],
    supportedResolutions: ['480p', '720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 1,
        '576p': 1,
        '720p': 2,
        '768p': 2,
        '1080p': 5,
        '4k': 5,
      },
      perSecondWithAudio: {
        '480p': 2,
        '576p': 2,
        '720p': 4,
        '768p': 4,
        '1080p': 10,
        '4k': 10,
      },
    },
    supportsNegativePrompt: true,
    supportsPromptOptimizer: true,
    supportsSeed: true,
    supportsAudio: true,
    badge: 'POPULAR',
    tier: 'creator',
  },
  {
    id: 'seedance-2.0',
    name: 'SeeDance 2.0',
    description: 'Next-generation ByteDance video model with native audio and support for wider aspect ratios',
    category: 'text-to-video',
    replicateId: 'bytedance/seedance-2.0',
    minDuration: 5,
    maxDuration: 15,
    defaultDuration: 5,
    durationOptions: [5, 10, 15],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    supportedResolutions: ['480p', '720p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 7,
        '576p': 7,
        '720p': 15,
        '768p': 15,
        '1080p': 15,
        '4k': 15,
      },
      perSecondWithAudio: {
        '480p': 7,
        '576p': 7,
        '720p': 15,
        '768p': 15,
        '1080p': 15,
        '4k': 15,
      },
    },
    supportsPromptOptimizer: true,
    supportsAudio: true,
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'grok-imagine-video',
    name: 'Grok Imagine Video',
    description: 'xAI video model for cinematic text-to-video with native synchronized audio',
    category: 'text-to-video',
    replicateId: 'xai/grok-imagine-video',
    minDuration: 1,
    maxDuration: 15,
    defaultDuration: 5,
    durationOptions: [1, 2, 4, 5, 8, 10, 12, 15],
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3'],
    supportedResolutions: ['480p', '720p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 4,
        '576p': 4,
        '720p': 4,
        '768p': 4,
        '1080p': 4,
        '4k': 4,
      },
    },
    supportsPromptOptimizer: true,
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'kling-v2.5-turbo-pro',
    name: 'Kling v2.5 Turbo Pro',
    description: 'High quality fast video generation by Kuaishou',
    category: 'text-to-video',
    replicateId: 'kwaivgi/kling-v2.5-turbo-pro',
    minDuration: 5,
    maxDuration: 10,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['720p'],
    defaultResolution: '720p',
    hideResolutionSelector: true,
    credits: {
      base: 0,
      perSecond: {
        '480p': 4,
        '576p': 4,
        '720p': 4,
        '768p': 4,
        '1080p': 4,
        '4k': 4,
      },
    },
    supportsNegativePrompt: true,
    supportsPromptOptimizer: true,
    badge: 'POPULAR',
    tier: 'creator',
  },
  {
    id: 'hailuo-2.3',
    name: 'Hailuo 2.3',
    description: 'High quality video with flexible duration and resolution',
    category: 'text-to-video',
    replicateId: 'minimax/hailuo-2.3',
    minDuration: 6,
    maxDuration: 10,
    defaultDuration: 6,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['768p', '1080p'],
    defaultResolution: '768p',
    credits: {
      base: 24,
      // Fixed pricing: 768p 6s=24cr, 768p 10s=48cr, 1080p 6s=42cr (1080p only 6s)
      perSecond: {
        '480p': 4, // 24/6 = 4cr/s (768p 6s)
        '576p': 4,
        '720p': 4,
        '768p': 4, // 768p 6s: 24cr, 768p 10s: 48cr (4.8 rounded to 4)
        '1080p': 7, // 1080p 6s: 42cr = 7cr/s
        '4k': 7,
      },
    },
    supportsNegativePrompt: true,
    supportsPromptOptimizer: true,
    badge: 'POPULAR',
    tier: 'creator',
  },
  {
    id: 'wan-2.6',
    name: 'Wan 2.6',
    description: 'Text-to-video with 5/10/15s presets and 720p/1080p output',
    category: 'text-to-video',
    replicateId: 'wan-video/wan-2.6-t2v',
    minDuration: 5,
    maxDuration: 15,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 10,
        '576p': 10,
        '720p': 10,
        '768p': 10,
        '1080p': 15,
        '4k': 15,
      },
    },
    supportsNegativePrompt: true,
    supportsPromptOptimizer: true,
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'google-veo-3.1-fast',
    name: 'Google Veo 3.1 Fast',
    description: 'Fast high-quality video generation with optional audio',
    category: 'text-to-video',
    replicateId: 'google/veo-3.1-fast',
    minDuration: 6,
    maxDuration: 8,
    defaultDuration: 6,
    supportedAspectRatios: ['16:9', '9:16'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 6,
        '576p': 6,
        '720p': 6,
        '768p': 6,
        '1080p': 6,
        '4k': 6,
      },
      perSecondWithAudio: {
        '480p': 9,
        '576p': 9,
        '720p': 9,
        '768p': 9,
        '1080p': 9,
        '4k': 9,
      },
    },
    supportsNegativePrompt: true,
    supportsPromptOptimizer: true,
    supportsAudio: true,
    badge: 'POPULAR',
    tier: 'creator',
  },
  {
    id: 'runway-gen-4.5',
    name: 'Runway Gen-4.5',
    description: 'High-fidelity Runway video generation with strong prompt adherence and cinematic motion',
    category: 'text-to-video',
    replicateId: 'runwayml/gen-4.5',
    minDuration: 5,
    maxDuration: 10,
    defaultDuration: 5,
    durationOptions: [5, 10],
    supportedAspectRatios: ['16:9'],
    supportedResolutions: ['720p'],
    defaultResolution: '720p',
    hideResolutionSelector: true,
    credits: {
      base: 0,
      perSecond: {
        '480p': 8,
        '576p': 8,
        '720p': 8,
        '768p': 8,
        '1080p': 8,
        '4k': 8,
      },
    },
    supportsPromptOptimizer: true,
    supportsSeed: true,
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'openai-sora-2',
    name: 'OpenAI Sora 2',
    description: 'High quality video generation by OpenAI',
    category: 'text-to-video',
    replicateId: 'openai/sora-2',
    minDuration: 4,
    maxDuration: 12,
    defaultDuration: 4,
    durationOptions: [4, 8, 12],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedResolutions: ['720p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 6,
        '576p': 6,
        '720p': 6,
        '768p': 6,
        '1080p': 6,
        '4k': 6,
      },
    },
    supportsNegativePrompt: true,
    supportsPromptOptimizer: true,
    badge: 'NEW',
    tier: 'studio',
  },
  {
    id: 'openai-sora-2-pro',
    name: 'OpenAI Sora 2 Pro',
    description: 'Premium quality video generation by OpenAI',
    category: 'text-to-video',
    replicateId: 'openai/sora-2-pro',
    minDuration: 4,
    maxDuration: 12,
    defaultDuration: 4,
    durationOptions: [4, 8, 12],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 18,
        '576p': 18,
        '720p': 18,  // Standard
        '768p': 18,
        '1080p': 30, // High (1024p)
        '4k': 30,
      },
    },
    supportsNegativePrompt: true,
    supportsPromptOptimizer: true,
    badge: 'POPULAR',
    tier: 'director',
  },
  {
    id: 'p-video-standard',
    name: 'P-Video Standard',
    description: 'Fast video generation by Pruna AI with 720p/1080p output',
    category: 'text-to-video',
    replicateId: 'prunaai/p-video',
    minDuration: 1,
    maxDuration: 20,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '720p': 4,
        '1080p': 8,
      },
      perSecondWithAudio: {
        '720p': 4,
        '1080p': 8,
      },
    },
    supportsPromptOptimizer: true,
    supportsSeed: true,
    supportsAudio: true,
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'p-video-draft',
    name: 'P-Video Draft',
    description: 'Fast video generation by Pruna AI with draft mode and 720p/1080p output',
    category: 'text-to-video',
    replicateId: 'prunaai/p-video',
    minDuration: 1,
    maxDuration: 20,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '720p': 1,
        '1080p': 2,
      },
      perSecondWithAudio: {
        '720p': 1,
        '1080p': 2,
      },
    },
    supportsPromptOptimizer: true,
    supportsSeed: true,
    supportsAudio: true,
    badge: 'FAST',
    tier: 'creator',
  },
  {
    id: 'kling-v3-omni',
    name: 'Kling 3.0 Omni',
    description: 'Unified multimodal video generation with 720p, 1080p and 4K output',
    category: 'text-to-video',
    replicateId: 'kwaivgi/kling-v3-omni-video',
    minDuration: 3,
    maxDuration: 15,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '720p': 34,
        '1080p': 45,
        '4k': 84,
      },
      perSecondWithAudio: {
        '720p': 45,
        '1080p': 56,
        '4k': 84,
      },
    },
    supportsPromptOptimizer: true,
    supportsAudio: true,
    badge: 'NEW',
    tier: 'director',
  },
]

// ============================================
// IMAGE TO VIDEO MODELS
// ============================================
export const IMAGE_TO_VIDEO_MODELS: ModelConfig[] = [
  {
    id: 'grok-imagine-video-img',
    name: 'Grok Imagine Video',
    description: 'xAI image-to-video model with cinematic motion and native synchronized audio',
    category: 'image-to-video',
    replicateId: 'xai/grok-imagine-video',
    minDuration: 1,
    maxDuration: 15,
    defaultDuration: 5,
    durationOptions: [1, 2, 4, 5, 8, 10, 12, 15],
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3'],
    supportedResolutions: ['480p', '720p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 4,
        '576p': 4,
        '720p': 4,
        '768p': 4,
        '1080p': 4,
        '4k': 4,
      },
    },
    supportsPromptOptimizer: true,
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'seedance-2.0-img',
    name: 'SeeDance 2.0',
    description: 'Premium image-to-video model with cinematic motion, strong prompt adherence, and wide aspect ratio support',
    category: 'image-to-video',
    replicateId: 'bytedance/seedance-2.0',
    minDuration: 5,
    maxDuration: 15,
    defaultDuration: 5,
    durationOptions: [5, 10, 15],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    supportedResolutions: ['480p', '720p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 7,
        '576p': 7,
        '720p': 15,
        '768p': 15,
        '1080p': 15,
        '4k': 15,
      },
    },
    supportsPromptOptimizer: true,
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'google-veo-3.1-fast-img',
    name: 'Google Veo 3.1 Fast',
    description: 'Fast high-quality image animation with optional audio',
    category: 'image-to-video',
    replicateId: 'google/veo-3.1-fast',
    minDuration: 6,
    maxDuration: 8,
    defaultDuration: 6,
    supportedAspectRatios: ['16:9', '9:16'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 6,
        '576p': 6,
        '720p': 6,
        '768p': 6,
        '1080p': 6,
        '4k': 6,
      },
      perSecondWithAudio: {
        '480p': 9,
        '576p': 9,
        '720p': 9,
        '768p': 9,
        '1080p': 9,
        '4k': 9,
      },
    },
    supportsPromptOptimizer: true,
    supportsAudio: true,
    badge: 'POPULAR',
    tier: 'creator',
  },
  {
    id: 'runway-gen-4.5-img',
    name: 'Runway Gen-4.5',
    description: 'Runway image-to-video generation with strong motion quality and prompt adherence',
    category: 'image-to-video',
    replicateId: 'runwayml/gen-4.5',
    minDuration: 5,
    maxDuration: 10,
    defaultDuration: 5,
    durationOptions: [5, 10],
    supportedAspectRatios: ['16:9'],
    supportedResolutions: ['720p'],
    defaultResolution: '720p',
    hideResolutionSelector: true,
    credits: {
      base: 0,
      perSecond: {
        '480p': 8,
        '576p': 8,
        '720p': 8,
        '768p': 8,
        '1080p': 8,
        '4k': 8,
      },
    },
    supportsPromptOptimizer: true,
    supportsSeed: true,
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'openai-sora-2-img',
    name: 'OpenAI Sora 2',
    description: 'High quality image animation by OpenAI',
    category: 'image-to-video',
    replicateId: 'openai/sora-2',
    minDuration: 4,
    maxDuration: 12,
    defaultDuration: 4,
    durationOptions: [4, 8, 12],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedResolutions: ['720p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 6,
        '576p': 6,
        '720p': 6,
        '768p': 6,
        '1080p': 6,
        '4k': 6,
      },
    },
    supportsPromptOptimizer: true,
    badge: 'NEW',
    tier: 'studio',
  },
  {
    id: 'openai-sora-2-pro-img',
    name: 'OpenAI Sora 2 Pro',
    description: 'Premium quality image animation by OpenAI',
    category: 'image-to-video',
    replicateId: 'openai/sora-2-pro',
    minDuration: 4,
    maxDuration: 12,
    defaultDuration: 4,
    durationOptions: [4, 8, 12],
    supportedAspectRatios: ['16:9', '9:16'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 18,
        '576p': 18,
        '720p': 18,  // Standard
        '768p': 18,
        '1080p': 30, // High (1024p)
        '4k': 30,
      },
    },
    supportsPromptOptimizer: true,
    badge: 'POPULAR',
    tier: 'director',
  },
  {
    id: 'kling-v2.5-turbo-pro-img',
    name: 'Kling v2.5 Turbo Pro',
    description: 'High quality fast image animation by Kuaishou',
    category: 'image-to-video',
    replicateId: 'kwaivgi/kling-v2.5-turbo-pro',
    minDuration: 5,
    maxDuration: 10,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['720p'],
    defaultResolution: '720p',
    hideResolutionSelector: true,
    credits: {
      base: 0,
      perSecond: {
        '480p': 4,
        '576p': 4,
        '720p': 4,
        '768p': 4,
        '1080p': 4,
        '4k': 4,
      },
    },
    supportsPromptOptimizer: true,
    badge: 'POPULAR',
    tier: 'creator',
  },
  {
    id: 'kling-v2.1',
    name: 'Kling v2.1',
    description: 'High quality cinematic image animation by Kuaishou',
    category: 'image-to-video',
    replicateId: 'kwaivgi/kling-v2.1',
    minDuration: 5,
    maxDuration: 10,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '480p': 5,
        '576p': 5,
        '720p': 5,
        '768p': 5,
        '1080p': 9,
        '4k': 9,
      },
    },
    supportsNegativePrompt: true,
    supportsPromptOptimizer: true,
    supportsSeed: true,
    hideAspectRatioSelector: true,
    badge: 'NEW',
    tier: 'studio',
  },
  {
    id: 'hailuo-2.3-img',
    name: 'Hailuo 2.3',
    description: 'High quality image-to-video with flexible options',
    category: 'image-to-video',
    replicateId: 'minimax/hailuo-2.3',
    minDuration: 6,
    maxDuration: 10,
    defaultDuration: 6,
    durationOptions: [6, 10],
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['768p', '1080p'],
    defaultResolution: '768p',
    credits: {
      base: 24,
      perSecond: {
        '480p': 4,
        '576p': 4,
        '720p': 4,
        '768p': 4, // 768p 6s: 24cr, 768p 10s: 48cr
        '1080p': 7, // 1080p 6s: 42cr (only 6s supported)
        '4k': 7,
      },
    },
    supportsPromptOptimizer: true,
    hideAspectRatioSelector: true,
    badge: 'POPULAR',
    tier: 'creator',
  },
  {
    id: 'hailuo-2.3-fast-img',
    name: 'Hailuo 2.3 Fast',
    description: 'Fast image-to-video generation with great quality',
    category: 'image-to-video',
    replicateId: 'minimax/hailuo-2.3-fast',
    minDuration: 6,
    maxDuration: 10,
    defaultDuration: 6,
    durationOptions: [6, 10],
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['768p', '1080p'],
    defaultResolution: '768p',
    credits: {
      base: 16,
      perSecond: {
        '480p': 3,
        '576p': 3,
        '720p': 3,
        '768p': 3, // 768p 6s: 16cr, 768p 10s: 28cr
        '1080p': 5, // 1080p 6s: 28cr (only 6s supported)
        '4k': 5,
      },
    },
    supportsPromptOptimizer: true,
    hideAspectRatioSelector: true,
    badge: 'FAST',
    tier: 'creator',
  },
  {
    id: 'p-video-standard-img',
    name: 'P-Video Standard',
    description: 'Fast image-to-video by Pruna AI with 720p/1080p output',
    category: 'image-to-video',
    replicateId: 'prunaai/p-video',
    minDuration: 1,
    maxDuration: 20,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '720p': 4,
        '1080p': 8,
      },
      perSecondWithAudio: {
        '720p': 4,
        '1080p': 8,
      },
    },
    supportsPromptOptimizer: true,
    supportsSeed: true,
    supportsAudio: true,
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'p-video-draft-img',
    name: 'P-Video Draft',
    description: 'Fast image-to-video by Pruna AI with draft mode and 720p/1080p output',
    category: 'image-to-video',
    replicateId: 'prunaai/p-video',
    minDuration: 1,
    maxDuration: 20,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '720p': 1,
        '1080p': 2,
      },
      perSecondWithAudio: {
        '720p': 1,
        '1080p': 2,
      },
    },
    supportsPromptOptimizer: true,
    supportsSeed: true,
    supportsAudio: true,
    badge: 'FAST',
    tier: 'creator',
  },
  {
    id: 'kling-v3-omni-img',
    name: 'Kling 3.0 Omni',
    description: 'Unified multimodal image-to-video generation with 720p, 1080p and 4K output',
    category: 'image-to-video',
    replicateId: 'kwaivgi/kling-v3-omni-video',
    minDuration: 3,
    maxDuration: 15,
    defaultDuration: 5,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    credits: {
      base: 0,
      perSecond: {
        '720p': 34,
        '1080p': 45,
        '4k': 84,
      },
      perSecondWithAudio: {
        '720p': 45,
        '1080p': 56,
        '4k': 84,
      },
    },
    supportsPromptOptimizer: true,
    supportsAudio: true,
    badge: 'NEW',
    tier: 'director',
  },
]

// ============================================
// TEXT TO IMAGE MODELS
// ============================================
export const TEXT_TO_IMAGE_MODELS: ModelConfig[] = [
  {
    id: 'flux-2-pro',
    name: 'FLUX 2 Pro',
    description: 'High-quality image generation and editing with strong prompt adherence',
    category: 'text-to-image',
    replicateId: 'black-forest-labs/flux-2-pro',
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3'],
    supportedResolutions: ['1k', '2k', '4k'],
    defaultResolution: '2k',
    credits: {
      base: 3,
    },
    badge: 'POPULAR',
    tier: 'creator',
  },
  {
    id: 'flux-schnell',
    name: 'FLUX.1 Schnell',
    description: 'Fast image generation',
    category: 'text-to-image',
    replicateId: 'black-forest-labs/flux-schnell',
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    credits: {
      base: 1,
    },
    badge: 'FAST',
    tier: 'creator',
  },
  {
    id: 'stable-3.5',
    name: 'Stable Diffusion 3.5 Large',
    description: 'High quality SD 3.5 image generation',
    category: 'text-to-image',
    replicateId: 'stability-ai/stable-diffusion-3.5-large',
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3'],
    supportedResolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    credits: {
      base: 5,
    },
    supportsNegativePrompt: true,
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    description: 'Fast, high quality image generation',
    category: 'text-to-image',
    replicateId: 'google/nano-banana-pro',
    supportedAspectRatios: ['auto', '16:9', '9:16', '1:1', '2:3', '3:2', '4:3', '3:4', '21:9'],
    supportedResolutions: ['1k', '2k', '4k'],
    defaultResolution: '2k',
    credits: {
      base: 15,
    },
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    description: 'Fast image generation with conversational editing, multi-image fusion, and character consistency',
    category: 'text-to-image',
    replicateId: 'google/nano-banana-2',
    supportedAspectRatios: ['auto', '16:9', '9:16', '1:1', '2:3', '3:2', '4:3', '3:4', '21:9'],
    supportedResolutions: ['1k', '2k', '4k'],
    defaultResolution: '1k',
    credits: {
      base: 7,
    },
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'ideogram',
    name: 'Ideogram V2',
    description: 'Excellent text rendering in images',
    category: 'text-to-image',
    replicateId: 'ideogram-ai/ideogram-v2',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['1080p'],
    defaultResolution: '1080p',
    credits: {
      base: 6,
    },
    tier: 'creator',
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    description: 'OpenAI image generation with selectable quality (auto, low, medium, high)',
    category: 'text-to-image',
    replicateId: 'openai/gpt-image-2',
    supportedAspectRatios: ['1:1', '3:2', '2:3'],
    supportedResolutions: ['1k'],
    defaultResolution: '1k',
    credits: {
      base: 8,
    },
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'imagen-4-fast',
    name: 'Imagen 4 Fast',
    description: 'Fast image generation with great quality',
    category: 'text-to-image',
    replicateId: 'google/imagen-4-fast',
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportedResolutions: ['2k'],
    defaultResolution: '2k',
    credits: {
      base: 2,
    },
    badge: 'FAST',
    tier: 'creator',
  },
  {
    id: 'imagen-4-ultra',
    name: 'Imagen 4 Ultra',
    description: 'Ultra quality image generation for the best results',
    category: 'text-to-image',
    replicateId: 'google/imagen-4-ultra',
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    supportedResolutions: ['2k'],
    defaultResolution: '2k',
    credits: {
      base: 4,
    },
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'seedream-4.5',
    name: 'Seedream 4.5',
    description: 'High quality image generation with strong instruction following',
    category: 'text-to-image',
    replicateId: 'bytedance/seedream-4.5',
    supportedAspectRatios: ['auto', '16:9', '9:16', '1:1', '2:3', '3:2', '4:3', '3:4', '21:9'],
    supportedResolutions: ['2k', '4k'],
    defaultResolution: '2k',
    credits: {
      base: 3,
    },
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'seedream-5-lite',
    name: 'Seedream 5 Lite',
    description: 'Image generation with built-in reasoning, strong text rendering, and example-based editing',
    category: 'text-to-image',
    replicateId: 'bytedance/seedream-5-lite',
    supportedAspectRatios: ['auto', '16:9', '9:16', '1:1', '2:3', '3:2', '4:3', '3:4', '21:9'],
    supportedResolutions: ['2k', '3k'],
    defaultResolution: '2k',
    credits: {
      base: 4,
    },
    badge: 'NEW',
    tier: 'creator',
  },
]

// ============================================
// IMAGE TO IMAGE MODELS
// ============================================
export const IMAGE_TO_IMAGE_MODELS: ModelConfig[] = [
  {
    id: 'flux-2-pro-img2img',
    name: 'FLUX 2 Pro',
    description: 'Transform images with AI',
    category: 'image-to-image',
    replicateId: 'black-forest-labs/flux-2-pro',
    supportedAspectRatios: ['auto', '16:9', '9:16', '1:1', '2:3', '3:2', '4:3', '3:4'],
    supportedResolutions: ['1k', '2k', '4k'],
    defaultResolution: '2k',
    credits: {
      base: 5,
    },
    tier: 'creator',
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    description: 'High quality image transformation',
    category: 'image-to-image',
    replicateId: 'google/nano-banana-pro',
    supportedAspectRatios: ['auto', '16:9', '9:16', '1:1', '2:3', '3:2', '4:3', '3:4', '21:9'],
    supportedResolutions: ['1k', '2k', '4k'],
    defaultResolution: '2k',
    credits: {
      base: 15,
    },
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    description: 'Fast image transformation with conversational editing, multi-image fusion, and character consistency',
    category: 'image-to-image',
    replicateId: 'google/nano-banana-2',
    supportedAspectRatios: ['auto', '16:9', '9:16', '1:1', '2:3', '3:2', '4:3', '3:4', '21:9'],
    supportedResolutions: ['1k', '2k', '4k'],
    defaultResolution: '1k',
    credits: {
      base: 7,
    },
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'seedream-4.5',
    name: 'Seedream 4.5',
    description: 'High quality image transformation with strong instruction following',
    category: 'image-to-image',
    replicateId: 'bytedance/seedream-4.5',
    supportedAspectRatios: ['auto', '16:9', '9:16', '1:1', '2:3', '3:2', '4:3', '3:4', '21:9'],
    supportedResolutions: ['2k', '4k'],
    defaultResolution: '2k',
    credits: {
      base: 3,
    },
    badge: 'NEW',
    tier: 'creator',
  },
  {
    id: 'seedream-5-lite',
    name: 'Seedream 5 Lite',
    description: 'Image transformation with built-in reasoning, strong text rendering, and example-based editing',
    category: 'image-to-image',
    replicateId: 'bytedance/seedream-5-lite',
    supportedAspectRatios: ['auto', '16:9', '9:16', '1:1', '2:3', '3:2', '4:3', '3:4', '21:9'],
    supportedResolutions: ['2k', '3k'],
    defaultResolution: '2k',
    credits: {
      base: 4,
    },
    badge: 'NEW',
    tier: 'creator',
  },
]

const ALL_MODELS: ModelConfig[] = [
  ...TEXT_TO_VIDEO_MODELS,
  ...IMAGE_TO_VIDEO_MODELS,
  ...TEXT_TO_IMAGE_MODELS,
  ...IMAGE_TO_IMAGE_MODELS,
]

const MODELS_BY_ID = new Map<string, ModelConfig>(ALL_MODELS.map((model) => [model.id, model]))

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getModelById(id: string): ModelConfig | undefined {
  return MODELS_BY_ID.get(id)
}

export function getModelsByCategory(category: ModelCategory): ModelConfig[] {
  switch (category) {
    case 'text-to-video':
      return TEXT_TO_VIDEO_MODELS
    case 'image-to-video':
      return IMAGE_TO_VIDEO_MODELS
    case 'text-to-image':
      return TEXT_TO_IMAGE_MODELS
    case 'image-to-image':
      return IMAGE_TO_IMAGE_MODELS
    default:
      return []
  }
}

export function calculateCredits(
  model: ModelConfig,
  duration?: number,
  resolution?: Resolution,
  withAudio?: boolean
): number {
  let effectiveDuration = duration
  let effectiveResolution = resolution

  // Keep frontend pricing aligned with edge-function billing normalization.
  if (model.category === 'text-to-video' || model.category === 'image-to-video') {
    const modelRef = model.replicateId.toLowerCase()
    const rawDuration = typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? duration : undefined
    const rawResolution = resolution ?? model.defaultResolution

    if (rawDuration && rawResolution) {
      if (modelRef.includes('hailuo')) {
        const normalizedDuration = rawDuration <= 6 ? 6 : 10
        effectiveDuration = normalizedDuration
        effectiveResolution = rawResolution === '1080p' && normalizedDuration === 6 ? '1080p' : '768p'
      } else if (modelRef.includes('wan')) {
        effectiveDuration = rawDuration <= 5 ? 5 : rawDuration <= 10 ? 10 : 15
        effectiveResolution = rawResolution === '1080p' ? '1080p' : '720p'
      } else if (modelRef.includes('google') && modelRef.includes('veo')) {
        effectiveDuration = rawDuration <= 6 ? 6 : 8
        effectiveResolution = rawResolution === '1080p' ? '1080p' : '720p'
      } else if (modelRef.includes('openai') && modelRef.includes('sora')) {
        let normalizedDuration = rawDuration
        if (normalizedDuration < 8) normalizedDuration = 8
        else if (normalizedDuration > 12) normalizedDuration = 12
        else if (normalizedDuration === 9 || normalizedDuration === 11) normalizedDuration = 10
        effectiveDuration = normalizedDuration
      }
    }
  }

  // If model has per-second pricing
  if (effectiveDuration && effectiveResolution) {
    // Use audio pricing if available and enabled
    if (withAudio && model.credits.perSecondWithAudio) {
      const costPerSecond = model.credits.perSecondWithAudio[effectiveResolution] || 1
      return costPerSecond * effectiveDuration
    }
    // Use regular per-second pricing
    if (model.credits.perSecond) {
      const costPerSecond = model.credits.perSecond[effectiveResolution] || 1
      return costPerSecond * effectiveDuration
    }
  }
  
  // Otherwise use base credits
  return model.credits.base
}

export function getDurationOptions(model: ModelConfig): number[] {
  if (model.durationOptions && model.durationOptions.length > 0) {
    return [...new Set(model.durationOptions)].sort((a, b) => a - b)
  }

  if (!model.minDuration || !model.maxDuration) return [5]
  
  const options: number[] = []
  for (let d = model.minDuration; d <= model.maxDuration; d++) {
    if (d === model.minDuration || d === model.maxDuration || d % 5 === 0) {
      options.push(d)
    }
  }
  
  // Ensure we have at least min and max
  if (!options.includes(model.minDuration)) options.unshift(model.minDuration)
  if (!options.includes(model.maxDuration)) options.push(model.maxDuration)
  
  return [...new Set(options)].sort((a, b) => a - b)
}

export function getResolutionLabel(resolution: Resolution): string {
  const labels: Record<Resolution, string> = {
    '480p': '480p (SD)',
    '576p': '576p (SD+)',
    '720p': '720p (HD)',
    '768p': '768p (HD)',
    '1080p': '1080p (Full HD)',
    '1k': '1K',
    '2k': '2K',
    '3k': '3K',
    '4k': '4K (Ultra HD)',
  }
  return labels[resolution] || resolution
}

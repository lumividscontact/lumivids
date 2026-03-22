// Use Supabase Edge Functions in production, localhost in development
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { 
  POLLING_INITIAL_INTERVAL_MS, 
  POLLING_MAX_INTERVAL_MS, 
  POLLING_BACKOFF_MULTIPLIER, 
  POLLING_TIMEOUT_MS 
} from '@/config/constants'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const API_BASE_URL = SUPABASE_URL 
  ? `${SUPABASE_URL}/functions/v1` 
  : import.meta.env.VITE_API_URL || 'http://localhost:3001'

const USE_EDGE_FUNCTIONS = !!SUPABASE_URL

export interface PredictionResult {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output?: string | string[]
  error?: string
  local_output_url?: string
  output_url?: string
  metrics?: {
    predict_time?: number
  }
}

export interface TextToVideoInput {
  prompt: string
  negativePrompt?: string
  model: string
  aspectRatio: string
  duration: string
  resolution?: string
  seed?: number
  withAudio?: boolean
}

export interface ImageToVideoInput {
  imageUrl: string
  prompt?: string
  model: string
  motionType: string
  motionStrength: number
  aspectRatio?: string
  duration?: string
  resolution?: string
}

export interface TextToImageInput {
  prompt: string
  negativePrompt?: string
  model: string
  aspectRatio: string
  resolution?: string
  numOutputs?: number
}

export interface ImageToImageInput {
  imageUrl: string
  prompt?: string
  negativePrompt?: string
  model: string
  aspectRatio?: string
  resolution?: string
  transformType?: string
  style?: string
  strength: number
}

const extractUrls = (value: unknown, collected: string[] = [], visited = new WeakSet<object>()): string[] => {
  if (!value) return collected

  if (typeof value === 'string') {
    collected.push(value)
    return collected
  }

  if (value instanceof URL) {
    collected.push(value.toString())
    return collected
  }

  if (Array.isArray(value)) {
    value.forEach((item) => extractUrls(item, collected, visited))
    return collected
  }

  if (typeof value === 'object') {
    if (visited.has(value)) {
      return collected
    }
    visited.add(value)

    const obj = value as Record<string, unknown>
    const candidates = [
      obj.video,
      obj.videos,
      obj.url,
      obj.urls,
      obj.output,
      obj.result,
      obj.href,
      obj.local_output_url,
      obj.output_url,
    ]
    candidates.forEach((item) => extractUrls(item, collected, visited))

    Object.values(obj).forEach((item) => extractUrls(item, collected, visited))
  }

  return collected
}

export const normalizeOutputUrls = (output: unknown): string[] => {
  const urls = extractUrls(output)
  return urls.filter((url) => typeof url === 'string' && url.length > 0)
}

export const resolvePredictionOutputUrls = (prediction: PredictionResult): string[] => {
  const outputUrls = normalizeOutputUrls(prediction.output)
  if (outputUrls.length > 0) {
    return outputUrls
  }

  const fallbackUrls = [prediction.local_output_url, prediction.output_url]
    .filter((url): url is string => typeof url === 'string' && url.length > 0)

  return fallbackUrls
}

class ReplicateAPI {
  private baseUrl: string

  constructor() {
    this.baseUrl = API_BASE_URL
  }

  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    // Add Supabase auth headers when using Edge Functions
    if (USE_EDGE_FUNCTIONS && SUPABASE_ANON_KEY) {
      headers['apikey'] = SUPABASE_ANON_KEY
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`
      
      // Get user token from Supabase auth session (not localStorage)
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            headers['x-supabase-auth'] = session.access_token
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
        } catch (e) {
          console.warn('Failed to get auth session:', e)
        }
      }
    }

    return headers
  }

  // Text to Video
  async createTextToVideo(input: TextToVideoInput): Promise<{ id: string; status: string }> {
    const endpoint = USE_EDGE_FUNCTIONS ? '/text-to-video' : '/api/text-to-video'
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.code || error.error || 'Failed to create prediction')
    }

    return response.json()
  }

  // Image to Video
  async createImageToVideo(input: ImageToVideoInput): Promise<{ id: string; status: string }> {
    const endpoint = USE_EDGE_FUNCTIONS ? '/image-to-video' : '/api/image-to-video'
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const error = await response.json()
      if (response.status === 402 && error?.code === 'INSUFFICIENT_CREDITS') {
        const required = typeof error?.required === 'number' ? error.required : null
        const current = typeof error?.current === 'number' ? error.current : null

        if (required !== null && current !== null) {
          throw new Error(`Insufficient credits. You need ${required} credits, you have ${current}.`)
        }

        if (required !== null) {
          throw new Error(`Insufficient credits. You need ${required} credits.`)
        }
      }

      throw new Error(error.error || 'Failed to create prediction')
    }

    return response.json()
  }

  // Text to Image - returns additional parallelIds for models that don't support multi-output
  async createTextToImage(input: TextToImageInput): Promise<{ id: string; status: string; parallelIds?: string[] }> {
    const endpoint = USE_EDGE_FUNCTIONS ? '/text-to-image' : '/api/text-to-image'
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create prediction')
    }

    return response.json()
  }

  // Image to Image
  async createImageToImage(input: ImageToImageInput): Promise<{ id: string; status: string }> {
    const endpoint = USE_EDGE_FUNCTIONS ? '/image-to-image' : '/api/image-to-image'
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create prediction')
    }

    return response.json()
  }

  // Get prediction status
  async getPrediction(id: string): Promise<PredictionResult> {
    const endpoint = USE_EDGE_FUNCTIONS ? `/check-prediction?id=${id}` : `/api/predictions/${id}`
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: await this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get prediction')
    }

    return response.json()
  }

  // Cancel prediction
  async cancelPrediction(id: string): Promise<void> {
    const endpoint = USE_EDGE_FUNCTIONS ? '/cancel-prediction' : `/api/predictions/${id}/cancel`
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ id }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to cancel prediction')
    }
  }

  // Poll prediction until complete with exponential backoff
  async waitForPrediction(
    id: string,
    onProgress?: (prediction: PredictionResult) => void,
    options: {
      initialInterval?: number
      maxInterval?: number
      backoffMultiplier?: number
      timeout?: number
    } = {}
  ): Promise<PredictionResult> {
    const {
      initialInterval = POLLING_INITIAL_INTERVAL_MS,
      maxInterval = POLLING_MAX_INTERVAL_MS,
      backoffMultiplier = POLLING_BACKOFF_MULTIPLIER,
      timeout = POLLING_TIMEOUT_MS,
    } = options

    const startTime = Date.now()
    let currentInterval = initialInterval
    let pollCount = 0

    while (true) {
      pollCount++
      const elapsed = Date.now() - startTime

      // Check timeout
      if (elapsed > timeout) {
        throw new Error(`Generation timed out after ${Math.round(timeout / 1000)} seconds`)
      }

      const prediction = await this.getPrediction(id)
      
      if (onProgress) {
        onProgress(prediction)
      }

      // Check for terminal states
      if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
        return prediction
      }

      // Wait with current interval
      await new Promise(resolve => setTimeout(resolve, currentInterval))

      // Increase interval for next poll (exponential backoff)
      // But keep fast polling for the first few checks (responsiveness)
      if (pollCount > 3) {
        currentInterval = Math.min(currentInterval * backoffMultiplier, maxInterval)
      }
    }
  }

  // Poll multiple predictions in parallel (for models that don't support num_outputs)
  async waitForMultiplePredictions(
    ids: string[],
    onProgress?: (completed: number, total: number) => void,
    options: {
      initialInterval?: number
      maxInterval?: number
      backoffMultiplier?: number
      timeout?: number
    } = {}
  ): Promise<PredictionResult[]> {
    const results = await Promise.all(
      ids.map(async (id, idx) => {
        const result = await this.waitForPrediction(id, () => {
          if (onProgress) onProgress(idx, ids.length)
        }, options)
        return result
      })
    )
    return results
  }

  // Health check
  async healthCheck(): Promise<{ status: string; hasToken: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/health`)
    return response.json()
  }
}

export const replicateAPI = new ReplicateAPI()

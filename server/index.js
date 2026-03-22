import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Replicate from 'replicate'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// ============================================
// PRODUCTION GUARD: This server is for LOCAL
// DEVELOPMENT ONLY. In production, all API
// calls go through Supabase Edge Functions.
// ============================================
if (process.env.NODE_ENV === 'production') {
  console.error('\n❌ ERROR: server/index.js must NOT run in production.')
  console.error('Production traffic should go through Supabase Edge Functions.')
  console.error('Set NODE_ENV to "development" to use this local dev server.\n')
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null


// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueId = crypto.randomBytes(16).toString('hex')
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uniqueId}${ext}`)
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Formato de arquivo não suportado. Use: JPEG, PNG, WEBP ou GIF'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  }
})

// Middleware
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',')
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman) in dev
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir))

// ============================================
// AUTH ACCOUNT METHOD CHECK
// ============================================
app.get('/api/auth/account-method', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase()

    if (!email) {
      return res.status(400).json({ error: 'email is required' })
    }

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!isValidEmail) {
      return res.status(400).json({ error: 'invalid email format' })
    }

    if (!supabaseAdmin) {
      return res.json({ method: 'unknown' })
    }

    let foundUser = null
    let page = 1
    const perPage = 200
    const maxPages = 25

    while (!foundUser && page <= maxPages) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (error) {
        console.error('[AuthMethod] listUsers error:', error)
        return res.json({ method: 'unknown' })
      }

      const users = data?.users || []
      if (users.length === 0) {
        break
      }

      foundUser = users.find((user) => String(user.email || '').toLowerCase() === email) || null
      page += 1
    }

    if (!foundUser) {
      // Return 'email' for unknown accounts to prevent user enumeration.
      // The client will show the email/password form regardless.
      return res.json({ method: 'email' })
    }

    const providers = new Set()
    for (const identity of foundUser.identities || []) {
      if (identity?.provider) {
        providers.add(String(identity.provider).toLowerCase())
      }
    }

    const appProvider = String(foundUser.app_metadata?.provider || '').toLowerCase()
    if (appProvider) {
      providers.add(appProvider)
    }

    const hasGoogle = providers.has('google')
    const hasEmail = providers.has('email') || providers.has('email_password') || providers.has('supabase')

    if (hasGoogle && hasEmail) {
      return res.json({ method: 'both' })
    }
    if (hasGoogle) {
      return res.json({ method: 'google' })
    }
    if (hasEmail) {
      return res.json({ method: 'email' })
    }

    // Default to 'email' to avoid leaking account existence
    return res.json({ method: 'email' })
  } catch (error) {
    console.error('[AuthMethod] endpoint error:', error)
    return res.status(500).json({ error: 'internal_error', method: 'unknown' })
  }
})


// Model mappings - Replicate model identifiers
const MODELS = {
  // Text to Video
  'seedance-1-lite': 'bytedance/seedance-1-lite',
  'seedance-1.5-pro': 'bytedance/seedance-1.5-pro',
  'minimax': 'minimax/video-01',
  'kling': 'kwaivgi/kling-v1.6-pro',
  'luma-dream': 'luma/ray',
  'haiper': 'haiper-ai/haiper-video-2',
  'hunyuan': 'tencent/hunyuan-video',
  'cogvideo': 'tencent/hunyuan-video',
  'runway-gen3': 'luma/ray', // fallback
  'pika-labs': 'luma/ray', // fallback
  'stable-video': 'stability-ai/stable-video-diffusion',
  'genmo': 'genmo/mochi-1-preview',
  'mochi': 'genmo/mochi-1-preview',
  'hailuo-2.3': 'minimax/hailuo-2.3',
  'wan-2.6': 'wan-video/wan-2.6-t2v',
  'google-veo-3.1-fast': 'google/veo-3.1-fast',
  'openai-sora-2': 'openai/sora-2',
  'openai-sora-2-pro': 'openai/sora-2-pro',
  'kling-v2.5-turbo-pro': 'kwaivgi/kling-v2.5-turbo-pro',
  'morph': 'luma/ray', // fallback
  'pixverse': 'luma/ray', // fallback

  // Text to Image
  'flux-pro': 'black-forest-labs/flux-1.1-pro',
  'flux-schnell': 'black-forest-labs/flux-schnell',
  'flux-dev': 'black-forest-labs/flux-dev',
  'stable-3.5': 'stability-ai/stable-diffusion-3.5-large',
  'nano-banana-pro': 'google/nano-banana-pro',
  'ideogram': 'ideogram-ai/ideogram-v2',
  'imagen-4-fast': 'google/imagen-4-fast',
  'imagen-4-ultra': 'google/imagen-4-ultra',
  'seedream-4.5': 'bytedance/seedream-4.5',
  'dall-e-3': 'black-forest-labs/flux-1.1-pro', // fallback to flux
  'midjourney': 'black-forest-labs/flux-1.1-pro', // fallback to flux

  // Image to Video
  'kling-v2.1': 'kwaivgi/kling-v2.1',
  'hailuo-2.3-img': 'minimax/hailuo-2.3',
  'hailuo-2.3-fast-img': 'minimax/hailuo-2.3-fast',
  'google-veo-3.1-fast-img': 'google/veo-3.1-fast',
  'openai-sora-2-img': 'openai/sora-2',
  'openai-sora-2-pro-img': 'openai/sora-2-pro',
  'kling-v2.5-turbo-pro-img': 'kwaivgi/kling-v2.5-turbo-pro',
  'stable-video-img': 'stability-ai/stable-video-diffusion',
  'kling-img': 'kwaivgi/kling-v1.6-pro',
  'luma-img': 'luma/ray',
  'minimax-img': 'minimax/video-01',
  'haiper-img': 'haiper-ai/haiper-video-2',

  // Image to Image
  'img2img-flux': 'black-forest-labs/flux-1.1-pro',
  'seedream-4.5': 'bytedance/seedream-4.5',
}

// Store running predictions for polling
const predictions = new Map()

async function resolveOutputUrl(value) {
  if (!value) return null

  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = await resolveOutputUrl(item)
      if (resolved) return resolved
    }
    return null
  }

  if (typeof value === 'object') {
    if (typeof value.url === 'function') {
      try {
        const maybeUrl = await value.url()
        if (typeof maybeUrl === 'string' && maybeUrl.length > 0) {
          return maybeUrl
        }
      } catch {
        // ignore and continue fallback extraction
      }
    }

    const candidates = [value.url, value.href, value.video, value.output, value.result, value.local_output_url, value.output_url]
    for (const candidate of candidates) {
      const resolved = await resolveOutputUrl(candidate)
      if (resolved) return resolved
    }
  }

  return null
}

// ============================================
// TEXT TO VIDEO
// ============================================
app.post('/api/text-to-video', async (req, res) => {
  try {
    const { 
      prompt, 
      negativePrompt,
      model = 'minimax', 
      aspectRatio = '16:9',
      duration = '5',
      resolution = '720p',
      seed,
      withAudio = false
    } = req.body

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    const modelId = MODELS[model] || MODELS['minimax']
    
    let input = { prompt }

    // Resolution mappings
    const resolutionMap = {
      '480p': { '16:9': [854, 480], '9:16': [480, 854], '1:1': [480, 480], '4:3': [640, 480], '3:4': [480, 640] },
      '576p': { '16:9': [1024, 576], '9:16': [576, 1024], '1:1': [576, 576], '4:3': [768, 576], '3:4': [576, 768] },
      '720p': { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [720, 720], '4:3': [960, 720], '3:4': [720, 960] },
      '768p': { '16:9': [1366, 768], '9:16': [768, 1366], '1:1': [768, 768], '4:3': [1024, 768], '3:4': [768, 1024] },
      '1080p': { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:3': [1440, 1080], '3:4': [1080, 1440] },
      '4k': { '16:9': [3840, 2160], '9:16': [2160, 3840], '1:1': [2160, 2160], '4:3': [2880, 2160], '3:4': [2160, 2880] },
    }

    // Model-specific configurations
    if (modelId.includes('seedance')) {
      // SeeDance configuration (Lite and Pro)
      const dims = resolutionMap[resolution]?.[aspectRatio] || resolutionMap['720p']['16:9']
      input = {
        prompt,
        negative_prompt: negativePrompt || '',
        duration: parseInt(duration),
        width: dims[0],
        height: dims[1],
        aspect_ratio: aspectRatio,
        seed: seed || Math.floor(Math.random() * 1000000),
      }
      // Add audio for SeeDance 1.5 Pro
      if (model === 'seedance-1.5-pro' && withAudio) {
        input.audio = true
      }
    } else if (modelId.includes('minimax')) {
      const dims = resolutionMap[resolution]?.[aspectRatio] || resolutionMap['720p']['16:9']
      input = {
        prompt,
        prompt_optimizer: true,
        width: dims[0],
        height: dims[1],
        aspect_ratio: aspectRatio,
      }
    } else if (modelId.includes('luma')) {
      input = {
        prompt,
        aspect_ratio: aspectRatio,
      }
    } else if (modelId.includes('kling')) {
      // Kling v2.1 configuration
      input = {
        prompt,
        negative_prompt: negativePrompt || '',
        duration: parseInt(duration),
        aspect_ratio: aspectRatio,
        seed: seed || Math.floor(Math.random() * 1000000),
      }
    } else if (modelId.includes('hunyuan')) {
      input = {
        prompt,
        video_length: duration === '5' ? 129 : 65,
        width: aspectRatio === '16:9' ? 1280 : aspectRatio === '9:16' ? 720 : 1024,
        height: aspectRatio === '16:9' ? 720 : aspectRatio === '9:16' ? 1280 : 1024,
      }
    } else if (modelId.includes('haiper')) {
      input = {
        prompt,
        duration: parseInt(duration),
        aspect_ratio: aspectRatio,
      }
    } else if (modelId.includes('genmo') || modelId.includes('mochi')) {
      const dims = resolutionMap[resolution]?.[aspectRatio] || resolutionMap['720p']['16:9']
      input = {
        prompt,
        prompt_optimizer: true,
        width: dims[0],
        height: dims[1],
        aspect_ratio: aspectRatio,
      }
    } else if (modelId.includes('hailuo')) {
      // Hailuo 2.3 configuration
      // Durations: 6s or 10s
      // Resolutions: 768p (720p), 1080p (1080p only for 6s)
      const hailuoDuration = parseInt(duration) <= 6 ? 6 : 10
      input = {
        prompt,
        duration: hailuoDuration,
        aspect_ratio: aspectRatio,
        resolution: resolution === '1080p' && hailuoDuration === 6 ? '1080p' : '768p',
      }
    } else if (modelId.includes('wan')) {
      // Wan 2.6 configuration
      const wanDurationRaw = parseInt(duration)
      const wanDuration = wanDurationRaw <= 5 ? 5 : wanDurationRaw <= 10 ? 10 : 15
      const wanResolution = resolution === '1080p' ? '1080p' : '720p'
      const resolutionMap = {
        '720p': { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [720, 720] },
        '1080p': { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] },
      }
      const dims = resolutionMap[wanResolution]?.[aspectRatio] || resolutionMap['720p']['16:9']
      input = {
        prompt,
        negative_prompt: negativePrompt || '',
        num_frames: wanDuration * 24,
        width: dims[0],
        height: dims[1],
        aspect_ratio: aspectRatio,
        seed: seed || Math.floor(Math.random() * 1000000),
      }
    } else if (modelId.includes('google') && modelId.includes('veo')) {
      // Google Veo 3.1 Fast configuration
      // Durations: 6s or 8s, Resolutions: 720p, 1080p, Aspect ratios: 16:9, 9:16, 1:1
      const veoDuration = parseInt(duration) <= 6 ? 6 : 8
      input = {
        prompt,
        duration: veoDuration,
        aspect_ratio: aspectRatio,
        resolution: resolution === '1080p' ? '1080p' : '720p',
        generate_audio: withAudio || false,
      }
    } else if (modelId.includes('openai') && modelId.includes('sora')) {
      // OpenAI Sora 2 / Sora 2 Pro configuration
      // Durations: 8s or 12s, Aspect ratios: 16:9, 9:16
      // Sora 2: 720p fixed | Sora 2 Pro: 720p (standard) or 1024p (high)
      const soraDuration = parseInt(duration) <= 8 ? 8 : 12
      const soraAspect = aspectRatio === '1:1' ? '16:9' : aspectRatio // fallback 1:1 to 16:9
      input = {
        prompt,
        duration: soraDuration,
        aspect_ratio: soraAspect,
      }
      // Sora 2 Pro supports resolution quality
      if (modelId.includes('sora-2-pro')) {
        input.quality = resolution === '1080p' ? 'high' : 'standard'
      }
    }

    console.log(`[Text2Video] Model: ${modelId}, Resolution: ${resolution}, Duration: ${duration}s, Prompt: ${prompt.substring(0, 50)}...`)

    const prediction = await replicate.predictions.create({
      model: modelId,
      input,
    })

    predictions.set(prediction.id, prediction)

    res.json({
      id: prediction.id,
      status: prediction.status,
    })
  } catch (error) {
    console.error('Text to Video Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// IMAGE TO VIDEO
// ============================================
app.post('/api/image-to-video', async (req, res) => {
  try {
    const { 
      imageUrl, 
      prompt,
      model = 'luma-img',
      motionType = 'auto',
      motionStrength = 50,
      aspectRatio = '16:9',
      duration = '5',
      resolution = '720p'
    } = req.body

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' })
    }

    const modelId = MODELS[model] || MODELS['luma-img']
    
    let input = {}

    const resolutionMap = {
      '480p': { '16:9': [854, 480], '9:16': [480, 854], '1:1': [480, 480], '4:3': [640, 480], '3:4': [480, 640] },
      '576p': { '16:9': [1024, 576], '9:16': [576, 1024], '1:1': [576, 576], '4:3': [768, 576], '3:4': [576, 768] },
      '720p': { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [720, 720], '4:3': [960, 720], '3:4': [720, 960] },
      '768p': { '16:9': [1366, 768], '9:16': [768, 1366], '1:1': [768, 768], '4:3': [1024, 768], '3:4': [768, 1024] },
      '1080p': { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:3': [1440, 1080], '3:4': [1080, 1440] },
      '4k': { '16:9': [3840, 2160], '9:16': [2160, 3840], '1:1': [2160, 2160], '4:3': [2880, 2160], '3:4': [2160, 2880] },
    }

    if (modelId.includes('luma')) {
      input = {
        prompt: prompt || 'animate this image with natural motion',
        start_image_url: imageUrl,
        aspect_ratio: aspectRatio,
      }
    } else if (modelId.includes('stable-video')) {
      input = {
        input_image: imageUrl,
        motion_bucket_id: Math.floor(motionStrength * 2.55), // 0-255
      }
    } else if (modelId.includes('minimax')) {
      const dims = resolutionMap[resolution]?.[aspectRatio] || resolutionMap['720p']['16:9']
      input = {
        prompt: prompt || 'animate this image',
        first_frame_image: imageUrl,
        width: dims[0],
        height: dims[1],
        aspect_ratio: aspectRatio,
      }
    } else if (modelId.includes('kling')) {
      // Kling v2.1 configuration
      input = {
        prompt: prompt || 'animate this image with natural motion',
        image: imageUrl,
        duration: parseInt(duration) || 5,
        aspect_ratio: aspectRatio,
      }
    } else if (modelId.includes('haiper')) {
      input = {
        prompt: prompt || 'animate this image',
        image_url: imageUrl,
        aspect_ratio: aspectRatio,
      }
    } else if (modelId.includes('hailuo')) {
      // Hailuo 2.3 image-to-video configuration
      const hailuoDuration = parseInt(duration) <= 6 ? 6 : 10
      input = {
        prompt: prompt || 'animate this image with natural motion',
        first_frame_image: imageUrl,
        duration: hailuoDuration,
        aspect_ratio: aspectRatio,
        resolution: resolution === '1080p' && hailuoDuration === 6 ? '1080p' : '768p',
      }
    } else if (modelId.includes('google') && modelId.includes('veo')) {
      // Google Veo 3.1 Fast image-to-video configuration
      const veoDuration = parseInt(duration) <= 6 ? 6 : 8
      input = {
        prompt: prompt || 'animate this image with natural motion',
        image: imageUrl,
        duration: veoDuration,
        aspect_ratio: aspectRatio,
        resolution: resolution === '1080p' ? '1080p' : '720p',
        generate_audio: false,
      }
    } else if (modelId.includes('openai') && modelId.includes('sora')) {
      // OpenAI Sora 2 / Sora 2 Pro image-to-video configuration
      const soraDuration = parseInt(duration) <= 8 ? 8 : 12
      const soraAspect = aspectRatio === '1:1' ? '16:9' : aspectRatio
      input = {
        prompt: prompt || 'animate this image with natural motion',
        image: imageUrl,
        duration: soraDuration,
        aspect_ratio: soraAspect,
      }
      // Sora 2 Pro supports resolution quality
      if (modelId.includes('sora-2-pro')) {
        input.quality = 'standard' // default to standard for image-to-video
      }
    }

    console.log(`[Image2Video] Model: ${modelId}`)

    const prediction = await replicate.predictions.create({
      model: modelId,
      input,
    })

    predictions.set(prediction.id, prediction)

    res.json({
      id: prediction.id,
      status: prediction.status,
    })
  } catch (error) {
    console.error('Image to Video Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// TEXT TO IMAGE
// ============================================
app.post('/api/text-to-image', async (req, res) => {
  try {
    const { 
      prompt, 
      negativePrompt,
      model = 'flux-pro',
      aspectRatio = '1:1',
      resolution,
      numOutputs = 1
    } = req.body

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    const modelId = MODELS[model] || MODELS['flux-pro']
    
    // Calculate dimensions based on aspect ratio
    const dimensions = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '4:3': { width: 1152, height: 896 },
      '3:2': { width: 1216, height: 832 },
    }
    
    const { width, height } = dimensions[aspectRatio] || dimensions['1:1']
    
    let input = {}

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
      }
    } else if (modelId.includes('imagen-4-ultra')) {
      input = {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: 'jpg',
      }
    } else if (modelId.includes('seedream-4.5')) {
      const seedreamAspectRatio = aspectRatio === 'auto' ? 'match_input_image' : aspectRatio
      const seedreamSize = resolution ? String(resolution).toUpperCase() : '2K'
      input = {
        prompt,
        aspect_ratio: seedreamAspectRatio,
        size: seedreamSize,
      }
    } else if (modelId.includes('ideogram')) {
      input = {
        prompt,
        aspect_ratio: aspectRatio,
        style_type: 'AUTO',
      }
    }

    console.log(`[Text2Image] Model: ${modelId}, Prompt: ${prompt.substring(0, 50)}...`)

    const prediction = await replicate.predictions.create({
      model: modelId,
      input,
    })

    predictions.set(prediction.id, prediction)

    res.json({
      id: prediction.id,
      status: prediction.status,
    })
  } catch (error) {
    console.error('Text to Image Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// IMAGE TO IMAGE
// ============================================
app.post('/api/image-to-image', async (req, res) => {
  try {
    const { 
      imageUrl, 
      prompt,
      negativePrompt,
      model,
      transformType = 'style-transfer',
      style,
      strength = 0.7,
      resolution
    } = req.body

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' })
    }

    let modelId
    let input = {}

    if (transformType === 'upscale' || model === 'upscale') {
      modelId = MODELS['upscale']
      input = {
        image: imageUrl,
        scale: 4,
        face_enhance: true,
      }
    } else {
      // Style transfer / variation using selected model
      modelId = (model && MODELS[model]) ? MODELS[model] : MODELS['img2img-flux']
      
      const stylePrompts = {
        'anime': 'anime style, vibrant colors, clean lines',
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

      if (modelId.includes('nano-banana-pro')) {
        const nanoResolution = resolution ? String(resolution).toUpperCase() : '2K'
        input = {
          prompt: fullPrompt,
          image: imageUrl,
          prompt_strength: strength,
          resolution: nanoResolution,
        }
      } else if (modelId.includes('seedream-4.5')) {
        const seedreamSize = resolution ? String(resolution).toUpperCase() : '2K'
        input = {
          prompt: fullPrompt,
          image_input: [imageUrl],
          size: seedreamSize,
        }
      } else if (modelId.includes('sdxl') || modelId.includes('stable-diffusion-3.5')) {
        input = {
          prompt: fullPrompt,
          negative_prompt: negativePrompt || '',
          image: imageUrl,
          strength,
        }
      } else {
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

    predictions.set(prediction.id, prediction)

    res.json({
      id: prediction.id,
      status: prediction.status,
    })
  } catch (error) {
    console.error('Image to Image Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// GET PREDICTION STATUS
// ============================================
app.get('/api/predictions/:id', async (req, res) => {
  try {
    const { id } = req.params

    const prediction = await replicate.predictions.get(id)
    const outputUrl = await resolveOutputUrl(prediction.output)
    const normalizedOutput = outputUrl ? [outputUrl] : prediction.output

    res.json({
      id: prediction.id,
      status: prediction.status,
      output: normalizedOutput,
      error: prediction.error,
      metrics: prediction.metrics,
    })
  } catch (error) {
    console.error('Get Prediction Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// IMAGE UPLOAD
// ============================================
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' })
    }

    // Get the server URL (for development, use localhost)
    const protocol = req.protocol
    const host = req.get('host')
    const baseUrl = process.env.SERVER_URL || `${protocol}://${host}`
    
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`

    console.log(`[Upload] File saved: ${req.file.filename} (${(req.file.size / 1024).toFixed(2)} KB)`)

    res.json({
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    })
  } catch (error) {
    console.error('Upload Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Error handler for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande. Máximo: 10MB' })
    }
    return res.status(400).json({ error: error.message })
  }
  if (error) {
    return res.status(400).json({ error: error.message })
  }
  next()
})

// ============================================
// CANCEL PREDICTION
// ============================================
app.post('/api/predictions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params
    
    await replicate.predictions.cancel(id)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Cancel Prediction Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    hasToken: !!process.env.REPLICATE_API_TOKEN,
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Lumivids API Server running on http://localhost:${PORT}`)
  console.log(`📦 Replicate Token: ${process.env.REPLICATE_API_TOKEN ? 'Configured' : 'NOT CONFIGURED'}`)
})

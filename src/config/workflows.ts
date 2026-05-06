/**
 * Workflows configuration — ready-made presets by segment.
 * Each workflow builds a URL with query params that pre-fill
 * the corresponding generation page.
 */

export type WorkflowSegment = 'ecommerce' | 'infoproduct' | 'reels' | 'social'

export interface Workflow {
  id: string
  segment: WorkflowSegment
  page: '/text-to-video' | '/image-to-video' | '/text-to-image' | '/image-to-image'
  model: string
  prompt: string
  aspect?: string
  duration?: number
  resolution?: string
  style?: string
  /** estimated credits based on default settings */
  estimatedCost: number
}

export const WORKFLOWS: Workflow[] = [
  // ── E-COMMERCE ────────────────────────────────────────────────
  {
    id: 'ecommerce-product-showcase',
    segment: 'ecommerce',
    page: '/text-to-video',
    model: 'seedance-1-lite',
    prompt: 'A sleek product floating on a clean white background with a slow 360° rotation, soft studio lighting, minimal shadow, commercial photography style',
    aspect: '1:1',
    duration: 5,
    resolution: '1080p',
    estimatedCost: 10,
  },
  {
    id: 'ecommerce-product-image',
    segment: 'ecommerce',
    page: '/text-to-image',
    model: 'flux-2-pro',
    prompt: 'Professional product photo on white background, studio lighting, high detail, commercial photography, no background clutter',
    aspect: '1:1',
    resolution: '1080p',
    estimatedCost: 3,
  },
  {
    id: 'ecommerce-lifestyle-video',
    segment: 'ecommerce',
    page: '/text-to-video',
    model: 'seedance-1-lite',
    prompt: 'Happy customer using the product at home, warm natural light, lifestyle photography style, cinematic, 4K quality',
    aspect: '16:9',
    duration: 5,
    resolution: '720p',
    estimatedCost: 10,
  },
  {
    id: 'ecommerce-unboxing',
    segment: 'ecommerce',
    page: '/text-to-video',
    model: 'seedance-1-lite',
    prompt: 'Close-up unboxing of a premium product, hands gently opening packaging, smooth slow motion, cinematic lighting, luxury feel',
    aspect: '9:16',
    duration: 5,
    resolution: '720p',
    estimatedCost: 10,
  },

  // ── INFOPRODUCT ───────────────────────────────────────────────
  {
    id: 'infoproduct-course-promo',
    segment: 'infoproduct',
    page: '/text-to-video',
    model: 'seedance-1-lite',
    prompt: 'Person confidently presenting in a modern office with a large screen showing data charts, professional lighting, motivational tone, 4K',
    aspect: '16:9',
    duration: 5,
    resolution: '1080p',
    estimatedCost: 20,
  },
  {
    id: 'infoproduct-ebook-cover',
    segment: 'infoproduct',
    page: '/text-to-image',
    model: 'flux-2-pro',
    prompt: 'Modern professional ebook cover design, bold typography, gradient background, high-quality digital art',
    aspect: '3:4',
    resolution: '1080p',
    estimatedCost: 3,
  },
  {
    id: 'infoproduct-testimonial-bg',
    segment: 'infoproduct',
    page: '/text-to-video',
    model: 'seedance-1-lite',
    prompt: 'Abstract animated background with soft flowing gradients in blue and purple, subtle particle effects, loop-ready, professional',
    aspect: '16:9',
    duration: 5,
    resolution: '720p',
    estimatedCost: 10,
  },
  {
    id: 'infoproduct-webinar-thumbnail',
    segment: 'infoproduct',
    page: '/text-to-image',
    model: 'flux-2-pro',
    prompt: 'Professional webinar thumbnail, speaker on stage with microphone, modern tech conference backdrop, clean composition',
    aspect: '16:9',
    resolution: '1080p',
    estimatedCost: 3,
  },

  // ── REELS ─────────────────────────────────────────────────────
  {
    id: 'reels-talking-head-bg',
    segment: 'reels',
    page: '/text-to-video',
    model: 'seedance-1-lite',
    prompt: 'Aesthetic animated background for talking head video, soft bokeh lights, pastel colors, slow movement, vertical format',
    aspect: '9:16',
    duration: 5,
    resolution: '1080p',
    estimatedCost: 20,
  },
  {
    id: 'reels-hook-opener',
    segment: 'reels',
    page: '/text-to-video',
    model: 'seedance-1-lite',
    prompt: 'Dynamic zoom-in on a person with a surprised expression, bright colors, energetic movement, vertical format, social media hook style',
    aspect: '9:16',
    duration: 5,
    resolution: '720p',
    estimatedCost: 10,
  },
  {
    id: 'reels-aesthetic-cover',
    segment: 'reels',
    page: '/text-to-image',
    model: 'flux-2-pro',
    prompt: 'Aesthetic Instagram reel cover, minimal composition, vibrant colors, lifestyle photography, golden hour lighting, vertical',
    aspect: '9:16',
    resolution: '1080p',
    estimatedCost: 3,
  },
  {
    id: 'reels-cinematic-broll',
    segment: 'reels',
    page: '/text-to-video',
    model: 'seedance-1-lite',
    prompt: 'Cinematic b-roll footage of a city at night, neon reflections on wet pavement, slow motion, vertical format, moody atmosphere',
    aspect: '9:16',
    duration: 5,
    resolution: '720p',
    estimatedCost: 10,
  },

  // ── SOCIAL ────────────────────────────────────────────────────
  {
    id: 'social-ad-banner',
    segment: 'social',
    page: '/text-to-image',
    model: 'flux-2-pro',
    prompt: 'Eye-catching social media ad banner, bold headline typography, vibrant brand colors, clean layout, call-to-action area',
    aspect: '16:9',
    resolution: '1080p',
    estimatedCost: 3,
  },
  {
    id: 'social-story-video',
    segment: 'social',
    page: '/text-to-video',
    model: 'seedance-1-lite',
    prompt: 'Engaging social media story video, quick transitions, vibrant colors, trendy aesthetic, vertical format, upbeat energy',
    aspect: '9:16',
    duration: 5,
    resolution: '720p',
    estimatedCost: 10,
  },
  {
    id: 'social-square-post',
    segment: 'social',
    page: '/text-to-image',
    model: 'flux-2-pro',
    prompt: 'Creative square social media post, bold graphic design, minimalist composition, strong contrast, visually striking',
    aspect: '1:1',
    resolution: '1080p',
    estimatedCost: 3,
  },
]

/** Build the navigation URL for a workflow */
export function buildWorkflowUrl(workflow: Workflow): string {
  const params = new URLSearchParams()
  params.set('model', workflow.model)
  params.set('prompt', workflow.prompt)
  if (workflow.aspect) params.set('aspect', workflow.aspect)
  if (workflow.duration) params.set('duration', String(workflow.duration))
  if (workflow.resolution) params.set('resolution', workflow.resolution)
  if (workflow.style) params.set('style', workflow.style)
  return `${workflow.page}?${params.toString()}`
}

export const SEGMENT_ORDER: WorkflowSegment[] = ['ecommerce', 'infoproduct', 'reels', 'social']

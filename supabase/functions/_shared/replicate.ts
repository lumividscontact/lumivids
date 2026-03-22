import Replicate from 'npm:replicate@1.0.1'

export const MODELS: Record<string, string> = {
  // Text to Video
  'seedance-1-lite': 'bytedance/seedance-1-lite',
  'seedance-1.5-pro': 'bytedance/seedance-1.5-pro',
  'minimax': 'minimax/video-01',
  'kling': 'kwaivgi/kling-v1.6-pro',
  'luma-dream': 'luma/ray',
  'haiper': 'haiper-ai/haiper-video-2',
  'hunyuan': 'tencent/hunyuan-video',
  'cogvideo': 'tencent/hunyuan-video',
  'stable-video': 'stability-ai/stable-video-diffusion',
  'genmo': 'genmo/mochi-1-preview',
  'mochi': 'genmo/mochi-1-preview',
  'hailuo-2.3': 'minimax/hailuo-2.3',
  'wan-2.6': 'wan-video/wan-2.6-t2v',
  'google-veo-3.1-fast': 'google/veo-3.1-fast',
  'openai-sora-2': 'openai/sora-2',
  'openai-sora-2-pro': 'openai/sora-2-pro',
  'kling-v2.5-turbo-pro': 'kwaivgi/kling-v2.5-turbo-pro',

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
  'upscale': 'nightmareai/real-esrgan',
  'clarity-upscaler': 'nightmareai/real-esrgan',
  'esrgan': 'nightmareai/real-esrgan',
  'img2img-flux': 'black-forest-labs/flux-1.1-pro',
  'flux-img2img': 'black-forest-labs/flux-1.1-pro',
  'nano-banana-pro': 'google/nano-banana-pro',
  'seedream-4.5': 'bytedance/seedream-4.5',
}

export function getReplicate(): Replicate {
  const token = Deno.env.get('REPLICATE_API_TOKEN')
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN not configured')
  }
  return new Replicate({ auth: token })
}

export const resolutionMap: Record<string, Record<string, [number, number]>> = {
  '480p': { '16:9': [854, 480], '9:16': [480, 854], '1:1': [480, 480], '4:3': [640, 480], '3:4': [480, 640] },
  '576p': { '16:9': [1024, 576], '9:16': [576, 1024], '1:1': [576, 576], '4:3': [768, 576], '3:4': [576, 768] },
  '720p': { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [720, 720], '4:3': [960, 720], '3:4': [720, 960] },
  '768p': { '16:9': [1366, 768], '9:16': [768, 1366], '1:1': [768, 768], '4:3': [1024, 768], '3:4': [768, 1024] },
  '1080p': { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:3': [1440, 1080], '3:4': [1080, 1440] },
  '4k': { '16:9': [3840, 2160], '9:16': [2160, 3840], '1:1': [2160, 2160], '4:3': [2880, 2160], '3:4': [2160, 2880] },
}

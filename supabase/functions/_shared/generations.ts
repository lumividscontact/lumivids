import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface PersistGenerationStartInput {
  userId: string
  type: 'text-to-video' | 'text-to-image' | 'image-to-video' | 'image-to-image'
  predictionId: string
  modelId: string
  modelName?: string
  creditsUsed: number
  status?: string
  prompt?: string
  negativePrompt?: string
  inputImageUrl?: string
  settings?: Record<string, unknown>
}

function mapGenerationInsert(input: PersistGenerationStartInput) {
  return {
    user_id: input.userId,
    type: input.type,
    status: input.status || 'starting',
    prompt: input.prompt || null,
    negative_prompt: input.negativePrompt || null,
    input_image_url: input.inputImageUrl || null,
    output_url: null,
    thumbnail_url: input.inputImageUrl || null,
    model_id: input.modelId,
    model_name: input.modelName || null,
    settings: input.settings || {},
    credits_used: input.creditsUsed,
    replicate_prediction_id: input.predictionId,
    error_message: null,
    is_public: false,
    view_count: 0,
  }
}

export async function persistGenerationStart(input: PersistGenerationStartInput): Promise<void> {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { error } = await supabaseAdmin
    .from('generations')
    .insert(mapGenerationInsert(input))

  if (error) {
    console.error('[Generations] Persist start failed:', error)
    throw new Error(`Failed to persist generation: ${error.message}`)
  }
}

export async function persistGenerationStarts(inputs: PersistGenerationStartInput[]): Promise<void> {
  if (inputs.length === 0) {
    return
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { error } = await supabaseAdmin
    .from('generations')
    .insert(inputs.map(mapGenerationInsert))

  if (error) {
    console.error('[Generations] Persist batch start failed:', error)
    throw new Error(`Failed to persist generation batch: ${error.message}`)
  }
}
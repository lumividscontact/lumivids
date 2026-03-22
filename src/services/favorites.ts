import { supabase } from '@/lib/supabase'

export interface FavoriteGeneration {
  id: string
  type: string
  prompt: string
  output_url: string
  created_at: string
  model_id?: string
  model_name?: string | null
  credits_used?: number
  input_image_url?: string | null
  settings?: {
    duration?: number
    resolution?: string
    aspectRatio?: string
    aspect_ratio?: string
    withAudio?: boolean
    inputImageUrl?: string
    input_image_url?: string
    [key: string]: unknown
  }
  aspect_ratio?: string
  duration?: number
}

export async function fetchFavoriteIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('favorites')
    .select('generation_id')
    .eq('user_id', userId)

  if (error) throw error

  return new Set(data?.map((item) => item.generation_id) || [])
}

export async function fetchFavoriteGenerations(userId: string): Promise<FavoriteGeneration[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('generation:generations!inner(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false, referencedTable: 'generations' })

  if (error) throw error

  return (data || [])
    .map((row) => row.generation as FavoriteGeneration | null)
    .filter((item): item is FavoriteGeneration => !!item)
}

export async function addFavorite(userId: string, generationId: string) {
  const { error } = await supabase
    .from('favorites')
    .insert([{ user_id: userId, generation_id: generationId }])

  if (error) throw error
}

export async function removeFavorite(userId: string, generationId: string) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('generation_id', generationId)

  if (error) throw error
}

export async function removeFavorites(userId: string, generationIds: string[]) {
  if (generationIds.length === 0) return

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .in('generation_id', generationIds)

  if (error) throw error
}

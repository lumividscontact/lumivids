import { supabase } from '@/lib/supabase'

export interface UploadResult {
  publicUrl: string | null
  path: string | null
}

export async function uploadFileToSupabase(
  file: File,
  folder: 'images' | 'videos' = 'images'
): Promise<UploadResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('uploadFileToSupabase: user not authenticated')
      return { publicUrl: null, path: null }
    }

    const contentType = file.type || 'application/octet-stream'
    const extension = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('jpeg') || contentType.includes('jpg')
          ? 'jpg'
          : contentType.includes('gif')
            ? 'gif'
            : 'bin'

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
    const path = `${user.id}/${folder}/${filename}`

    const { error } = await supabase.storage
      .from('generations')
      .upload(path, file, { contentType, upsert: true })

    if (error) {
      console.error('Storage upload error:', error)
      return { publicUrl: null, path: null }
    }

    const { data } = supabase.storage.from('generations').getPublicUrl(path)
    return { publicUrl: data?.publicUrl ?? null, path }
  } catch (error) {
    console.error('uploadFileToSupabase failed:', error)
    return { publicUrl: null, path: null }
  }
}

export async function uploadRemoteFileToSupabase(
  remoteUrl: string,
  userId: string,
  folder: 'videos' | 'images' = 'videos'
): Promise<UploadResult> {
  try {
    const response = await fetch(remoteUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch remote file: ${response.statusText}`)
    }

    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || blob.type || 'application/octet-stream'

    const extension = contentType.includes('mp4')
      ? 'mp4'
      : contentType.includes('webm')
        ? 'webm'
        : contentType.includes('mov')
          ? 'mov'
          : contentType.includes('png')
            ? 'png'
            : contentType.includes('webp')
              ? 'webp'
              : contentType.includes('jpeg') || contentType.includes('jpg')
                ? 'jpg'
                : 'bin'

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
    const path = `${userId}/${folder}/${filename}`

    const { error } = await supabase.storage
      .from('generations')
      .upload(path, blob, { contentType, upsert: true })

    if (error) {
      console.error('Storage upload error:', error)
      return { publicUrl: null, path: null }
    }

    const { data } = supabase.storage.from('generations').getPublicUrl(path)
    return { publicUrl: data?.publicUrl ?? null, path }
  } catch (error) {
    console.error('uploadRemoteFileToSupabase failed:', error)
    return { publicUrl: null, path: null }
  }
}

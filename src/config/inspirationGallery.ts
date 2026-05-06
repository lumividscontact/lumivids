export interface InspirationItem {
  id: string
  title: string
  prompt: string
  model: string
  type: 'video' | 'image'
  thumbnailUrl: string
  mediaUrl: string
}

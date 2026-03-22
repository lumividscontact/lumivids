export type FilterType = 'all' | 'video' | 'image'
export type ViewMode = 'grid' | 'list'
export type SortType = 'recent' | 'oldest' | 'video' | 'image'

export function getItemType(type: string): 'video' | 'image' {
  return type === 'text-to-video' || type === 'image-to-video' ? 'video' : 'image'
}

import { en } from '@/i18n/translations/en'

export interface MediaItem {
  id: string
  predictionId?: string | null
  type: 'video' | 'image'
  thumbnail: string
  outputUrl?: string
  title: string
  prompt: string
  createdAt: string
  durationSec?: number
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3'
  model: string
  modelId?: string
  errorMessage?: string
  cost: number
  status: 'ready' | 'processing' | 'failed'
  isFavorite: boolean
  generationType: 'text-to-video' | 'image-to-video' | 'text-to-image' | 'image-to-image'
  settings?: {
    duration?: number
    resolution?: string
    aspectRatio?: string
    withAudio?: boolean
    inputImageUrl?: string
  }
}

export type FilterType = 'all' | 'video' | 'image'
export type ViewMode = 'grid' | 'list'
export type DurationFilter = 'all' | 'short' | 'medium' | 'long'
export type SortBy = 'recent' | 'cost' | 'duration'
export type StatusFilter = 'all' | 'ready' | 'processing' | 'failed'

export interface MediaFilters {
  filter: FilterType
  searchQuery: string
  dateFrom: string
  dateTo: string
  modelFilter: string
  durationFilter: DurationFilter
  aspectFilter: string
  statusFilter: StatusFilter
  sortBy: SortBy
}

export const PLACEHOLDER_THUMB = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0f172a"/>
        <stop offset="1" stop-color="#1f2937"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#g)"/>
  </svg>`
)

export type MyVideosTranslations = typeof en.myVideos

export const MY_VIDEOS_FALLBACK: MyVideosTranslations = en.myVideos

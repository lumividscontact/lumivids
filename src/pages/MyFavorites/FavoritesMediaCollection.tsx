import { Check, Copy, Flag, Image, Trash2, Video } from 'lucide-react'
import type { FavoriteGeneration } from '@/services/favorites'
import type { ViewMode } from './types'

interface FavoritesMediaCollectionProps {
  items: FavoriteGeneration[]
  viewMode: ViewMode
  selectedItems: string[]
  isSelectionMode: boolean
  isDeleting: boolean
  removingIds: Set<string>
  failedMediaIds: Set<string>
  copiedPromptId: string | null
  t: any
  onOpenPreview: (id: string) => void
  onToggleSelect: (id: string) => void
  onUseAgain: (item: FavoriteGeneration) => void
  onCopyPrompt: (id: string, prompt: string) => void
  onOpenDelete: (id: string) => void
  onReport: (item: FavoriteGeneration) => void
  onMarkMediaAsFailed: (id: string) => void
  formatFavoriteDate: (value: string) => string
  getItemType: (type: string) => 'video' | 'image'
  getModelLabel: (item: FavoriteGeneration) => string | null
  getAspectRatioLabel: (item: FavoriteGeneration) => string | null
  getDurationSeconds: (item: FavoriteGeneration) => number | null
}

export function FavoritesMediaCollection({
  items,
  viewMode,
  selectedItems,
  isSelectionMode,
  isDeleting,
  removingIds,
  failedMediaIds,
  copiedPromptId,
  t,
  onOpenPreview,
  onToggleSelect,
  onUseAgain,
  onCopyPrompt,
  onOpenDelete,
  onReport,
  onMarkMediaAsFailed,
  formatFavoriteDate,
  getItemType,
  getModelLabel,
  getAspectRatioLabel,
  getDurationSeconds,
}: FavoritesMediaCollectionProps) {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const itemType = getItemType(item.type)
          const isSelected = selectedItems.includes(item.id)
          const isRemoving = removingIds.has(item.id)
          const hasMediaError = !item.output_url || failedMediaIds.has(item.id)
          const modelLabel = getModelLabel(item)
          const aspectRatioLabel = getAspectRatioLabel(item)
          const durationSeconds = getDurationSeconds(item)
          const creditsUsed = typeof item.credits_used === 'number' ? item.credits_used : null

          return (
            <div
              key={item.id}
              className={`card-hover group cursor-pointer transition-all duration-200 ${isSelected ? 'ring-2 ring-primary-500' : ''} ${isRemoving ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}
              onClick={() => {
                if (isSelectionMode) {
                  onToggleSelect(item.id)
                  return
                }
                onOpenPreview(item.id)
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  if (isSelectionMode) {
                    onToggleSelect(item.id)
                    return
                  }
                  onOpenPreview(item.id)
                }
              }}
            >
              <div className="relative rounded-xl overflow-hidden mb-4">
                {hasMediaError ? (
                  <div className={`w-full flex items-center justify-center bg-dark-800 ${itemType === 'video' ? 'aspect-video' : 'aspect-square'}`}>
                    <Image className="w-8 h-8 text-dark-500" />
                  </div>
                ) : itemType === 'video' ? (
                  <video
                    src={item.output_url}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onError={() => onMarkMediaAsFailed(item.id)}
                    className="w-full object-cover aspect-video group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <img
                    src={item.output_url}
                    alt={item.prompt}
                    onError={() => onMarkMediaAsFailed(item.id)}
                    className="w-full object-cover aspect-square group-hover:scale-105 transition-transform duration-300"
                  />
                )}
                <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium ${
                  itemType === 'video' ? 'bg-primary-500' : 'bg-accent-500'
                } text-white`}>
                  {itemType === 'video' ? <Video className="w-3 h-3 inline mr-1" /> : <Image className="w-3 h-3 inline mr-1" />}
                  {itemType === 'video' ? t.myFavorites.filterVideos : t.myFavorites.filterImages}
                </div>
                {isSelectionMode && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleSelect(item.id)
                    }}
                    className={`absolute top-2 right-2 w-6 h-6 rounded-md border-2 transition-colors ${
                      isSelected
                        ? 'bg-primary-500 border-primary-500'
                        : 'bg-dark-900/70 border-dark-300'
                    }`}
                    aria-label={isSelected ? t.myVideos.deselectAll : t.myVideos.select}
                  />
                )}
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-dark-400 line-clamp-2">{item.prompt}</p>
                  <div className="flex items-center gap-2 text-xs text-dark-500 mt-2 flex-wrap">
                    <span>{formatFavoriteDate(item.created_at)}</span>
                    {modelLabel && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[120px]">{modelLabel}</span>
                      </>
                    )}
                    {aspectRatioLabel && (
                      <>
                        <span>•</span>
                        <span>{aspectRatioLabel}</span>
                      </>
                    )}
                    {durationSeconds !== null && (
                      <>
                        <span>•</span>
                        <span>{durationSeconds}s</span>
                      </>
                    )}
                    {creditsUsed !== null && creditsUsed > 0 && (
                      <>
                        <span>•</span>
                        <span>{creditsUsed} {t.myVideos.creditsLabel}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dark-800">
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onUseAgain(item)
                  }}
                  className="flex-1 btn-primary text-sm"
                >
                  {t.myFavorites.useAgain}
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onCopyPrompt(item.id, item.prompt)
                  }}
                  className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2"
                >
                  {copiedPromptId === item.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedPromptId === item.id ? t.common.success : t.common.copyPrompt}
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenDelete(item.id)
                  }}
                  disabled={isDeleting}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onReport(item)
                  }}
                  className="p-2 rounded-lg hover:bg-dark-700 transition-colors"
                  title="Reportar"
                >
                  <Flag className="w-5 h-5 text-dark-300" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const itemType = getItemType(item.type)
        const isSelected = selectedItems.includes(item.id)
        const isRemoving = removingIds.has(item.id)
        const hasMediaError = !item.output_url || failedMediaIds.has(item.id)
        const modelLabel = getModelLabel(item)
        const aspectRatioLabel = getAspectRatioLabel(item)
        const durationSeconds = getDurationSeconds(item)
        const creditsUsed = typeof item.credits_used === 'number' ? item.credits_used : null

        return (
          <div
            key={item.id}
            className={`card-hover flex items-center gap-4 cursor-pointer transition-all duration-200 ${isSelected ? 'ring-2 ring-primary-500' : ''} ${isRemoving ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}
            onClick={() => {
              if (isSelectionMode) {
                onToggleSelect(item.id)
                return
              }
              onOpenPreview(item.id)
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                if (isSelectionMode) {
                  onToggleSelect(item.id)
                  return
                }
                onOpenPreview(item.id)
              }
            }}
          >
            <div className="relative w-32 md:w-40 rounded-lg overflow-hidden shrink-0">
              {hasMediaError ? (
                <div className={`w-full flex items-center justify-center bg-dark-800 ${itemType === 'video' ? 'aspect-video' : 'aspect-square'}`}>
                  <Image className="w-6 h-6 text-dark-500" />
                </div>
              ) : itemType === 'video' ? (
                <video
                  src={item.output_url}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onError={() => onMarkMediaAsFailed(item.id)}
                  className="w-full object-cover aspect-video"
                />
              ) : (
                <img
                  src={item.output_url}
                  alt={item.prompt}
                  onError={() => onMarkMediaAsFailed(item.id)}
                  className="w-full object-cover aspect-square"
                />
              )}
              {isSelectionMode && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleSelect(item.id)
                  }}
                  className={`absolute top-2 right-2 w-6 h-6 rounded-md border-2 transition-colors ${
                    isSelected
                      ? 'bg-primary-500 border-primary-500'
                      : 'bg-dark-900/70 border-dark-300'
                  }`}
                  aria-label={isSelected ? t.myVideos.deselectAll : t.myVideos.select}
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {itemType === 'video' ? <Video className="w-4 h-4 text-primary-400" /> : <Image className="w-4 h-4 text-accent-400" />}
                <span className="text-xs text-dark-400">
                  {itemType === 'video' ? t.myFavorites.filterVideos : t.myFavorites.filterImages}
                </span>
              </div>
              <p className="text-sm text-dark-300 line-clamp-2">{item.prompt}</p>
              <div className="flex items-center gap-2 text-xs text-dark-500 mt-2 flex-wrap">
                <span>{formatFavoriteDate(item.created_at)}</span>
                {modelLabel && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[140px]">{modelLabel}</span>
                  </>
                )}
                {aspectRatioLabel && (
                  <>
                    <span>•</span>
                    <span>{aspectRatioLabel}</span>
                  </>
                )}
                {durationSeconds !== null && (
                  <>
                    <span>•</span>
                    <span>{durationSeconds}s</span>
                  </>
                )}
                {creditsUsed !== null && creditsUsed > 0 && (
                  <>
                    <span>•</span>
                    <span>{creditsUsed} {t.myVideos.creditsLabel}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onUseAgain(item)
                }}
                className="btn-primary text-sm"
              >
                {t.myFavorites.useAgain}
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onCopyPrompt(item.id, item.prompt)
                }}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                {copiedPromptId === item.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedPromptId === item.id ? t.common.success : t.common.copyPrompt}
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenDelete(item.id)
                }}
                disabled={isDeleting}
                className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onReport(item)
                }}
                className="p-2 rounded-lg hover:bg-dark-700 transition-colors"
                title="Reportar"
              >
                <Flag className="w-5 h-5 text-dark-300" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

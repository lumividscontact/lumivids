import { useCallback, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Download, Heart, Trash2, RefreshCw, Copy } from 'lucide-react'
import { MediaItem, MY_VIDEOS_FALLBACK, PLACEHOLDER_THUMB } from './types'
import { getFriendlyFailureReason } from './errorMessages'

interface MediaPreviewModalProps {
  item: MediaItem
  filteredMedia: MediaItem[]
  onClose: () => void
  onNavigate: (item: MediaItem) => void
  onDownload: (item: MediaItem) => void
  onToggleFavorite: (id: string) => void
  onDelete: (id: string) => void
  onRegenerate: (item: MediaItem) => void
  onCopyPrompt: (item: MediaItem) => void
  isDownloading?: boolean
  dateLocale?: string
  translations?: typeof MY_VIDEOS_FALLBACK
}

export function MediaPreviewModal({
  item,
  filteredMedia,
  onClose,
  onNavigate,
  onDownload,
  onToggleFavorite,
  onDelete,
  onRegenerate,
  onCopyPrompt,
  isDownloading = false,
  dateLocale = 'en-US',
  translations = MY_VIDEOS_FALLBACK,
}: MediaPreviewModalProps) {
  const t = translations
  const currentIndex = filteredMedia.findIndex(m => m.id === item.id)
  const [hasMediaError, setHasMediaError] = useState(false)
  const failedReason = item.status === 'failed' ? getFriendlyFailureReason(item.errorMessage, t) : null

  useEffect(() => {
    setHasMediaError(false)
  }, [item.id])

  const formatMediaDate = useCallback((value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return new Intl.DateTimeFormat(dateLocale).format(date)
  }, [dateLocale])

  const goToPrevious = useCallback(() => {
    if (filteredMedia.length === 0) return
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredMedia.length - 1
    onNavigate(filteredMedia[prevIndex])
  }, [currentIndex, filteredMedia, onNavigate])

  const goToNext = useCallback(() => {
    if (filteredMedia.length === 0) return
    const nextIndex = currentIndex < filteredMedia.length - 1 ? currentIndex + 1 : 0
    onNavigate(filteredMedia[nextIndex])
  }, [currentIndex, filteredMedia, onNavigate])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (filteredMedia.length <= 1) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToPrevious()
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredMedia.length, goToNext, goToPrevious, onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-dark-900 border border-dark-700 rounded-2xl max-w-4xl w-full overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-semibold truncate">{item.title}</h3>
            <p className="text-sm text-dark-400 truncate">{item.prompt}</p>
          </div>
          <button className="p-2 rounded-lg hover:bg-dark-700 ml-2" onClick={onClose}>
            <X className="w-5 h-5 text-dark-300" />
          </button>
        </div>

        {/* Media Content with Navigation */}
        <div className="bg-black relative">
          {/* Previous Button */}
          {filteredMedia.length > 1 && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              onClick={goToPrevious}
              aria-label={t.navigationPrevious}
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}

          {!hasMediaError && item.type === 'video' && item.outputUrl ? (
            <video
              key={item.id}
              src={item.outputUrl}
              controls
              autoPlay
              playsInline
              crossOrigin="anonymous"
              preload="metadata"
              className="w-full max-h-[60vh]"
              onError={() => setHasMediaError(true)}
            />
          ) : (
            <img
              src={hasMediaError ? PLACEHOLDER_THUMB : item.thumbnail}
              alt={item.title}
              onError={(event) => {
                const target = event.currentTarget
                if (target.src !== PLACEHOLDER_THUMB) {
                  target.src = PLACEHOLDER_THUMB
                }
              }}
              className="w-full max-h-[60vh] object-contain"
            />
          )}

          {/* Next Button */}
          {filteredMedia.length > 1 && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              onClick={goToNext}
              aria-label={t.navigationNext}
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-dark-700 space-y-3">
          {/* Info Row */}
          <div className="flex items-center gap-2 text-sm text-dark-400 flex-wrap">
            <span>{formatMediaDate(item.createdAt)}</span>
            <span>•</span>
            <span>{item.model}</span>
            <span>•</span>
            <span>{item.aspectRatio}</span>
            {item.durationSec && (
              <>
                <span>•</span>
                <span>{item.durationSec}s</span>
              </>
            )}
            {item.cost > 0 && (
              <>
                <span>•</span>
                <span>{item.cost} {t.creditsLabel}</span>
              </>
            )}
          </div>

          {/* Prompt Section */}
          {item.prompt && (
            <div className="bg-dark-800/50 rounded-lg p-3">
              <p className="text-sm text-dark-300 line-clamp-3">{item.prompt}</p>
            </div>
          )}

          {item.status === 'failed' && failedReason && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-sm text-red-300">
                <span className="font-medium">{t.failedReasonLabel}:</span> {failedReason}
              </p>
            </div>
          )}

          {/* Actions Row */}
          <div className="flex items-center justify-between">
            {/* Primary Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRegenerate(item)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors text-white text-sm font-medium"
                title={t.regenerateTitle}
              >
                <RefreshCw className="w-4 h-4" />
                {t.regenerate}
              </button>
              <button
                type="button"
                onClick={() => onCopyPrompt(item)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors text-white text-sm"
                title={t.copyPromptTitle}
              >
                <Copy className="w-4 h-4" />
                {t.copyPrompt}
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onDownload(item)}
                disabled={isDownloading}
                className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
                title={t.download}
              >
                <Download className={`w-5 h-5 text-white ${isDownloading ? 'animate-pulse' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(item.id)}
                className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
                title={t.favorite}
              >
                <Heart className={`w-5 h-5 ${item.isFavorite ? 'text-red-500 fill-red-500' : 'text-white'}`} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="p-2 rounded-lg bg-dark-800 hover:bg-red-500/20 transition-colors"
                title={t.delete}
              >
                <Trash2 className="w-5 h-5 text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

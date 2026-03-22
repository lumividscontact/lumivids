import type { MouseEvent } from 'react'
import { Video, Image, Download, Heart, Trash2, RefreshCw, Flag } from 'lucide-react'
import { MediaItem, MY_VIDEOS_FALLBACK, MyVideosTranslations, PLACEHOLDER_THUMB } from './types'
import { getFriendlyFailureReason } from './errorMessages'

const hoverPlayTimers = new WeakMap<HTMLVideoElement, ReturnType<typeof setTimeout>>()

function scheduleVideoPlay(video: HTMLVideoElement) {
  const existingTimer = hoverPlayTimers.get(video)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const timer = setTimeout(() => {
    video.play().catch(() => {
      // Ignore autoplay/playback interruption errors.
    })
  }, 150)

  hoverPlayTimers.set(video, timer)
}

function stopVideoPreview(video: HTMLVideoElement) {
  const existingTimer = hoverPlayTimers.get(video)
  if (existingTimer) {
    clearTimeout(existingTimer)
    hoverPlayTimers.delete(video)
  }

  video.pause()
  video.currentTime = 0.5
}

function formatMediaDate(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat(locale).format(date)
}

function getAspectClass(aspectRatio: MediaItem['aspectRatio']) {
  switch (aspectRatio) {
    case '1:1':
      return 'aspect-square'
    case '9:16':
      return 'aspect-[9/16]'
    case '4:3':
      return 'aspect-[4/3]'
    case '16:9':
    default:
      return 'aspect-video'
  }
}

interface BaseMediaItemProps {
  item: MediaItem
  isSelected: boolean
  selectionMode?: boolean
  onClick: (e: MouseEvent<HTMLDivElement>, item: MediaItem) => void
  onToggleSelect: (id: string) => void
  onDownload: (item: MediaItem) => void
  onRegenerate: (item: MediaItem) => void
  onToggleFavorite: (id: string) => void
  onDelete: (id: string) => void
  onReport: (item: MediaItem) => void
  dateLocale?: string
  translations?: MyVideosTranslations
}

type MediaCardProps = BaseMediaItemProps

export function MediaCard({
  item,
  isSelected,
  selectionMode = false,
  onClick,
  onToggleSelect,
  onDownload,
  onRegenerate,
  onToggleFavorite,
  onDelete,
  onReport,
  dateLocale = 'en-US',
  translations = MY_VIDEOS_FALLBACK,
}: MediaCardProps) {
  const t = translations
  const failedReason = item.status === 'failed' ? getFriendlyFailureReason(item.errorMessage, t) : null
  const canDownload = item.status === 'ready' && !!item.outputUrl
  const downloadDisabledReason = item.status === 'processing'
    ? t.downloadUnavailableProcessing
    : item.status === 'failed'
      ? t.downloadUnavailableFailed
      : t.downloadUnavailableMissing

  return (
    <div
      className={`card-hover group relative overflow-hidden ${
        isSelected ? 'ring-2 ring-primary-500' : ''
      }`}
      onClick={(e) => onClick(e, item)}
    >
      {/* Thumbnail */}
      <div className={`relative ${getAspectClass(item.aspectRatio)} rounded-lg overflow-hidden mb-3 bg-dark-800`}>
        {selectionMode && (
          <label className="absolute top-2 left-2 z-20 flex items-center justify-center w-5 h-5 rounded bg-dark-900/80 border border-dark-500 cursor-pointer">
            <input
              type="checkbox"
              className="sr-only"
              checked={isSelected}
              onChange={() => onToggleSelect(item.id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`${isSelected ? t.deselectItem : t.selectItem}: ${item.title}`}
            />
            <span className={`w-3 h-3 rounded-sm border ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-dark-300'}`} />
          </label>
        )}

        {item.type === 'video' && item.outputUrl ? (
          <video
            src={`${item.outputUrl}#t=0.5`}
            preload="metadata"
            poster={item.thumbnail}
            muted
            playsInline
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            onMouseEnter={(e) => scheduleVideoPlay(e.currentTarget)}
            onMouseLeave={(e) => stopVideoPreview(e.currentTarget)}
          />
        ) : (
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              const target = event.currentTarget
              if (target.src !== PLACEHOLDER_THUMB) {
                target.src = PLACEHOLDER_THUMB
              }
            }}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        )}
        
        {/* Type Badge */}
        <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium ${
          selectionMode ? 'ml-7' : ''
        } ${
          item.type === 'video' 
            ? 'bg-primary-500/80 text-white' 
            : 'bg-accent-500/80 text-white'
        }`}>
          {item.type === 'video' ? <Video className="w-3 h-3 inline mr-1" /> : <Image className="w-3 h-3 inline mr-1" />}
          {item.type === 'video' ? (item.durationSec ? `${item.durationSec}s` : t.mediaTypeVideo) : t.mediaTypeImage}
        </div>

        {/* Status Badge */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-medium ${
          item.status === 'ready' ? 'bg-green-500/80 text-white' :
          item.status === 'processing' ? 'bg-yellow-500/80 text-white' :
          'bg-red-500/80 text-white'
        }`}>
          {item.status === 'ready' ? t.statusReady :
           item.status === 'processing' ? t.statusProcessing : t.statusFailed}
        </div>

        {/* Hover Actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {item.status === 'failed' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRegenerate(item) }}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              title={t.regenerateTitle}
            >
              <RefreshCw className="w-5 h-5 text-white" />
            </button>
          )}
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onDownload(item) }}
            disabled={!canDownload}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={canDownload ? t.download : downloadDisabledReason}
          >
            <Download className="w-5 h-5 text-white" />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id) }}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            <Heart className={`w-5 h-5 ${item.isFavorite ? 'text-red-500 fill-red-500' : 'text-white'}`} />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            <Trash2 className="w-5 h-5 text-white" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReport(item) }}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            title="Reportar"
          >
            <Flag className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Info */}
      <h3 className="font-medium text-white truncate">{item.title}</h3>
      <p className="text-sm text-dark-400 truncate">{item.prompt}</p>
      {item.status === 'failed' && failedReason && (
        <p className="text-xs text-red-300 truncate mt-1">
          {t.failedReasonLabel}: {failedReason}
        </p>
      )}
      <p className="text-xs text-dark-500 mt-2">{formatMediaDate(item.createdAt, dateLocale)} • {item.model} • {item.aspectRatio}</p>
    </div>
  )
}

type MediaListItemProps = BaseMediaItemProps

export function MediaListItem({
  item,
  isSelected,
  selectionMode = false,
  onClick,
  onToggleSelect,
  onDownload,
  onRegenerate,
  onToggleFavorite,
  onDelete,
  onReport,
  dateLocale = 'en-US',
  translations = MY_VIDEOS_FALLBACK,
}: MediaListItemProps) {
  const t = translations
  const failedReason = item.status === 'failed' ? getFriendlyFailureReason(item.errorMessage, t) : null
  const canDownload = item.status === 'ready' && !!item.outputUrl
  const downloadDisabledReason = item.status === 'processing'
    ? t.downloadUnavailableProcessing
    : item.status === 'failed'
      ? t.downloadUnavailableFailed
      : t.downloadUnavailableMissing

  return (
    <div
      className={`card-hover flex items-center gap-4 ${
        isSelected ? 'ring-2 ring-primary-500' : ''
      }`}
      onClick={(e) => onClick(e, item)}
    >
      {selectionMode && (
        <label className="flex items-center justify-center w-5 h-5 rounded bg-dark-900/80 border border-dark-500 cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            className="sr-only"
            checked={isSelected}
            onChange={() => onToggleSelect(item.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${isSelected ? t.deselectItem : t.selectItem}: ${item.title}`}
          />
          <span className={`w-3 h-3 rounded-sm border ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-dark-300'}`} />
        </label>
      )}

      {/* Thumbnail */}
      <div className="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-dark-800">
        {item.type === 'video' && item.outputUrl ? (
          <video
            src={`${item.outputUrl}#t=0.5`}
            preload="metadata"
            poster={item.thumbnail}
            muted
            playsInline
            className="w-full h-full object-cover"
            onMouseEnter={(e) => scheduleVideoPlay(e.currentTarget)}
            onMouseLeave={(e) => stopVideoPreview(e.currentTarget)}
          />
        ) : (
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              const target = event.currentTarget
              if (target.src !== PLACEHOLDER_THUMB) {
                target.src = PLACEHOLDER_THUMB
              }
            }}
            className="w-full h-full object-cover"
          />
        )}
        <div className={`absolute top-1 left-1 px-2 py-0.5 rounded text-xs font-medium ${
          item.type === 'video' ? 'bg-primary-500/80' : 'bg-accent-500/80'
        } text-white`}>
          {item.type === 'video' ? (item.durationSec ? `${item.durationSec}s` : t.mediaTypeVideo) : t.mediaTypeImage}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-white truncate">{item.title}</h3>
        <p className="text-sm text-dark-400 truncate">{item.prompt}</p>
        {item.status === 'failed' && failedReason && (
          <p className="text-xs text-red-300 truncate mt-1">
            {t.failedReasonLabel}: {failedReason}
          </p>
        )}
      </div>

      {/* Date */}
      <span className="text-sm text-dark-400 hidden md:block">{formatMediaDate(item.createdAt, dateLocale)}</span>

      {/* Status */}
      <span className={`text-xs px-2 py-1 rounded-md ${
        item.status === 'ready' ? 'bg-green-500/20 text-green-400' :
        item.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' :
        'bg-red-500/20 text-red-400'
      }`}>
        {item.status === 'ready' ? t.statusReady :
         item.status === 'processing' ? t.statusProcessing : t.statusFailed}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {item.status === 'failed' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRegenerate(item) }}
            className="p-2 rounded-lg hover:bg-dark-700 transition-colors"
            title={t.regenerateTitle}
          >
            <RefreshCw className="w-5 h-5 text-dark-400" />
          </button>
        )}
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id) }}
          className="p-2 rounded-lg hover:bg-dark-700 transition-colors"
        >
          <Heart className={`w-5 h-5 ${item.isFavorite ? 'text-red-500 fill-red-500' : 'text-dark-400'}`} />
        </button>
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onDownload(item) }}
          disabled={!canDownload}
          className="p-2 rounded-lg hover:bg-dark-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={canDownload ? t.download : downloadDisabledReason}
        >
          <Download className="w-5 h-5 text-dark-400" />
        </button>
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
          className="p-2 rounded-lg hover:bg-dark-700 transition-colors"
        >
          <Trash2 className="w-5 h-5 text-dark-400" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReport(item) }}
          className="p-2 rounded-lg hover:bg-dark-700 transition-colors"
          title="Reportar"
        >
          <Flag className="w-5 h-5 text-dark-400" />
        </button>
      </div>
    </div>
  )
}

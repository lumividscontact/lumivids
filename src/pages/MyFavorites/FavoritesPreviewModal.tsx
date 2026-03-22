import { ChevronLeft, ChevronRight, Download, Image, X } from 'lucide-react'
import type { FavoriteGeneration } from '@/services/favorites'

interface FavoritesPreviewModalProps {
  previewItem: FavoriteGeneration
  hasMultipleItems: boolean
  isPreviewMediaFailed: boolean
  isDownloadingPreview: boolean
  t: any
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
  onUseAgain: (item: FavoriteGeneration) => void
  onDownload: () => void
  onSetPreviewMediaFailed: (value: boolean) => void
  getItemType: (type: string) => 'video' | 'image'
}

export function FavoritesPreviewModal({
  previewItem,
  hasMultipleItems,
  isPreviewMediaFailed,
  isDownloadingPreview,
  t,
  onClose,
  onPrevious,
  onNext,
  onUseAgain,
  onDownload,
  onSetPreviewMediaFailed,
  getItemType,
}: FavoritesPreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-dark-900 border border-dark-700 rounded-2xl max-w-4xl w-full overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-semibold truncate">{t.myFavorites.title}</h3>
            <p className="text-sm text-dark-400 truncate">{previewItem.prompt}</p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button
              className="px-3 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors text-white text-sm font-medium"
              onClick={() => onUseAgain(previewItem)}
            >
              {t.myFavorites.useAgain}
            </button>
            <button
              className="p-2 rounded-lg hover:bg-dark-700"
              onClick={onDownload}
              disabled={isDownloadingPreview}
              title={t.common.download}
            >
              <Download className={`w-5 h-5 text-dark-300 ${isDownloadingPreview ? 'animate-pulse' : ''}`} />
            </button>
            <button className="p-2 rounded-lg hover:bg-dark-700" onClick={onClose}>
              <X className="w-5 h-5 text-dark-300" />
            </button>
          </div>
        </div>

        <div className="bg-black relative">
          {hasMultipleItems && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              onClick={onPrevious}
              aria-label="Previous"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}

          {!previewItem.output_url || isPreviewMediaFailed ? (
            <div className="w-full h-[60vh] flex flex-col items-center justify-center gap-3 text-dark-400">
              <Image className="w-10 h-10 text-dark-500" />
              <span className="text-sm">{t.toast.noFileAvailable}</span>
            </div>
          ) : getItemType(previewItem.type) === 'video' ? (
            <video
              key={previewItem.id}
              src={previewItem.output_url}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onError={() => onSetPreviewMediaFailed(true)}
              className="w-full max-h-[60vh]"
            />
          ) : (
            <img
              src={previewItem.output_url}
              alt={previewItem.prompt}
              onError={() => onSetPreviewMediaFailed(true)}
              className="w-full max-h-[60vh] object-contain"
            />
          )}

          {hasMultipleItems && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              onClick={onNext}
              aria-label="Next"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

import { ReactNode, useEffect, useState } from 'react'
import { AlertCircle, Download, Loader2, X } from 'lucide-react'

interface GenerationVideoPreviewProps {
  error: string | null
  onReset: () => void
  videoUrl: string | null
  isVerticalPreview: boolean
  onDownload: () => void
  downloadLabel: string
  newGenerationLabel: string
  newGenerationButtonClassName: string
  emptyIcon: ReactNode
  emptyTitle: string
  emptyDescription: string
}

export default function GenerationVideoPreview({
  error,
  onReset,
  videoUrl,
  isVerticalPreview,
  onDownload,
  downloadLabel,
  newGenerationLabel,
  newGenerationButtonClassName,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: GenerationVideoPreviewProps) {
  const [isVideoLoading, setIsVideoLoading] = useState(false)

  useEffect(() => {
    setIsVideoLoading(!!videoUrl)
  }, [videoUrl])

  return (
    <>
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm flex-1">{error}</p>
          <button onClick={onReset} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {videoUrl ? (
        <div>
          <div className={`relative bg-dark-800 rounded-xl overflow-hidden flex justify-center ${isVerticalPreview ? 'py-6' : ''}`}>
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              onLoadStart={() => setIsVideoLoading(true)}
              onCanPlay={() => setIsVideoLoading(false)}
              onLoadedData={() => setIsVideoLoading(false)}
              onError={() => setIsVideoLoading(false)}
              className={`${isVerticalPreview ? 'max-w-[360px]' : 'w-full'} max-h-[70vh] object-contain`}
            />

            {isVideoLoading && (
              <div className="absolute inset-0 bg-dark-900/60 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={onDownload}
              className="flex-1 py-2.5 rounded-xl bg-dark-800 text-white font-medium flex items-center justify-center gap-2 hover:bg-dark-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              {downloadLabel}
            </button>
            <button
              onClick={onReset}
              className={newGenerationButtonClassName}
            >
              {newGenerationLabel}
            </button>
          </div>
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-dark-800 flex items-center justify-center mb-4">
            {emptyIcon}
          </div>
          <p className="text-dark-400 font-medium">{emptyTitle}</p>
          <p className="text-dark-500 text-sm mt-1">{emptyDescription}</p>
        </div>
      )}
    </>
  )
}
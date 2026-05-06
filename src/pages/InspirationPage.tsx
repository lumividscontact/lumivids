import { useState, useMemo, useEffect } from 'react'
import { Copy, Play, Image as ImageIcon, Filter, Loader2 } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { type InspirationItem } from '@/config/inspirationGallery'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

type TypeFilter = 'all' | 'video' | 'image'

const PLACEHOLDER_THUMB = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225'%3E%3Crect fill='%23374151' width='400' height='225'/%3E%3C/svg%3E`

function generationTypeToMediaType(type: string): 'video' | 'image' {
  return type === 'text-to-image' || type === 'image-to-image' ? 'image' : 'video'
}

function isReplicateUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && (url.includes('replicate.delivery') || url.includes('replicate.com'))
}

function isSignedStorageUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.includes('/storage/v1/object/sign/')
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice(7)}`
  }
  return trimmed
}

function pickBestUrl(...candidates: (string | null | undefined)[]): string {
  const permanent = candidates.find((u) => typeof u === 'string' && u.length > 0 && !isReplicateUrl(u) && !isSignedStorageUrl(u))
  if (permanent) return permanent

  const any = candidates.find((u) => typeof u === 'string' && u.length > 0)
  return any ?? ''
}

function getMobileFriendlyVideoSrc(url: string) {
  // iOS/Safari often shows preview more reliably with a tiny seek hint.
  if (url.includes('#')) return url
  return `${url}#t=0.1`
}

function useInspirationGallery() {
  const [items, setItems] = useState<InspirationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const { data, error: dbError } = await supabase.rpc('get_inspiration_admin_feed')

        if (dbError) throw dbError

        const mapped: InspirationItem[] = (data ?? [])
          .map((row) => {
            const mediaType = generationTypeToMediaType(row.type as string)
            const settings = (row.settings ?? {}) as Record<string, unknown>
            const settingsOutput = typeof settings.outputUrl === 'string'
              ? settings.outputUrl
              : typeof settings.output_url === 'string'
                ? settings.output_url
                : null
            const settingsThumb = typeof settings.thumbnailUrl === 'string'
              ? settings.thumbnailUrl
              : typeof settings.thumbnail_url === 'string'
                ? settings.thumbnail_url
                : null

            const rawThumbUrl = pickBestUrl(
              row.thumbnail_url as string | null | undefined,
              settingsThumb,
            )

            const mediaUrlRaw = mediaType === 'image'
              ? pickBestUrl(
                  row.output_url as string | null | undefined,
                  settingsOutput,
                  row.thumbnail_url as string | null | undefined,
                  settingsThumb,
                )
              : pickBestUrl(
                  row.output_url as string | null | undefined,
                  settingsOutput,
                )

            const mediaUrl = mediaUrlRaw ? normalizeUrl(mediaUrlRaw) : ''
            const rawThumb = rawThumbUrl ? normalizeUrl(rawThumbUrl) : ''
            // Para imagens sem thumbnail, usa a própria imagem como thumb
            const thumbnailUrl = rawThumb || (mediaType === 'image' ? mediaUrl : '')

            if (!mediaUrl) return null

            return {
              id: row.id as string,
              title: (row.prompt as string | null)?.slice(0, 60) ?? 'Untitled',
              prompt: (row.prompt as string | null) ?? '',
              model: (row.model_name as string | null) ?? '',
              type: mediaType,
              thumbnailUrl,
              mediaUrl,
            } satisfies InspirationItem
          })
          .filter((item): item is InspirationItem => item !== null)

        setItems(mapped)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  return { items, isLoading, error }
}

export default function InspirationPage() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [selectedType, setSelectedType] = useState<TypeFilter>('all')
  const [selectedItem, setSelectedItem] = useState<InspirationItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [thumbFallbackIds, setThumbFallbackIds] = useState<Set<string>>(new Set())

  const { items, isLoading, error } = useInspirationGallery()

  useEffect(() => {
    document.title = `${t.inspiration.title} | Lumivids`
  }, [t])

  const filteredItems = useMemo(() => {
    return items.filter((item) => selectedType === 'all' || item.type === selectedType)
  }, [items, selectedType])

  const handleCopyPrompt = (itemId: string, prompt: string) => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedId(itemId)
      showToast(t.common.promptCopied, 'success')
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t.inspiration.title}</h1>
        <p className="text-dark-300">{t.inspiration.description}</p>
      </div>

      {/* Filters */}
      <div className="mb-8">
        <label className="flex items-center gap-2 text-sm text-dark-300 mb-3">
          <Filter className="w-4 h-4" />
          {t.inspiration.filterByType}
        </label>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedType === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}
          >
            {t.common.all}
          </button>
          <button
            onClick={() => setSelectedType('video')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              selectedType === 'video'
                ? 'bg-primary-500 text-white'
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}
          >
            <Play className="w-4 h-4" />
            {t.inspiration.videos}
          </button>
          <button
            onClick={() => setSelectedType('image')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              selectedType === 'image'
                ? 'bg-primary-500 text-white'
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            {t.inspiration.images}
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="text-center py-12">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Results count */}
      {!isLoading && !error && (
        <div className="text-sm text-dark-300 mb-4">
          {t.inspiration.showing.replace('{count}', String(filteredItems.length))}
        </div>
      )}

      {/* Gallery Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group cursor-pointer relative rounded-lg overflow-hidden bg-dark-800 hover:bg-dark-700 transition-all duration-300"
              onClick={() => setSelectedItem(item)}
            >
              {/* Thumbnail */}
              <div className="relative w-full aspect-video bg-dark-900 overflow-hidden">
                {item.type === 'video' ? (
                  item.thumbnailUrl && !thumbFallbackIds.has(item.id) ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER_THUMB
                        setThumbFallbackIds((prev) => {
                          const next = new Set(prev)
                          next.add(item.id)
                          return next
                        })
                      }}
                    />
                  ) : (
                    <video
                      src={getMobileFriendlyVideoSrc(item.mediaUrl)}
                      preload="metadata"
                      poster={PLACEHOLDER_THUMB}
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <img
                    src={item.thumbnailUrl || item.mediaUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_THUMB }}
                  />
                )}

                {/* Play Button Overlay for Videos */}
                {item.type === 'video' && (
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-all flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary-500/80 group-hover:bg-primary-500 transition-all flex items-center justify-center">
                      <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>
                )}

                {/* Image Badge */}
                {item.type === 'image' && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-accent-500/80 text-white text-xs font-medium flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    {t.inspiration.image}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-white mb-1 truncate">{item.title}</h3>
                <p className="text-xs text-dark-300 mb-3 line-clamp-2">{item.prompt}</p>

                {/* Model Badge */}
                {item.model && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-1 rounded-full bg-dark-700 text-primary-300">
                      {item.model}
                    </span>
                  </div>
                )}
              </div>

              {/* Hover Actions */}
              {item.prompt && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopyPrompt(item.id, item.prompt)
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      copiedId === item.id
                        ? 'bg-green-500/80 text-white'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                    }`}
                  >
                    <Copy className="w-4 h-4" />
                    {copiedId === item.id ? t.common.copied : t.common.copyPrompt}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredItems.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="w-12 h-12 text-dark-500 mx-auto mb-4 opacity-50" />
          <p className="text-dark-300">{t.inspiration.noResults}</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-dark-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Media */}
            <div className="w-full aspect-video bg-dark-900 relative">
              {selectedItem.type === 'video' ? (
                <video
                  src={getMobileFriendlyVideoSrc(selectedItem.mediaUrl)}
                  preload="metadata"
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={selectedItem.mediaUrl}
                  alt={selectedItem.title}
                  className="w-full h-full object-contain"
                  onError={(e) => { e.currentTarget.src = PLACEHOLDER_THUMB }}
                />
              )}
            </div>

            {/* Details */}
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-2">{selectedItem.title}</h2>

              {/* Model */}
              {selectedItem.model && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  <span className="text-xs px-3 py-1 rounded-full bg-primary-500/20 text-primary-300">
                    {selectedItem.model}
                  </span>
                </div>
              )}

              {/* Prompt */}
              {selectedItem.prompt && (
                <div className="mb-6">
                  <label className="text-sm text-dark-300 block mb-2">{t.inspiration.prompt}</label>
                  <div className="relative">
                    <div className="bg-dark-900 rounded-lg p-4 text-dark-100 text-sm pr-12 break-words">
                      {selectedItem.prompt}
                    </div>
                    <button
                      onClick={() => handleCopyPrompt(selectedItem.id, selectedItem.prompt)}
                      className="absolute top-3 right-3 p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors"
                      title={t.common.copyPrompt}
                    >
                      <Copy className="w-4 h-4 text-dark-300" />
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 px-4 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-white font-medium transition-colors"
                >
                  {t.common.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

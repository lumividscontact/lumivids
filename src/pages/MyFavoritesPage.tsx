import { useState, useEffect, useCallback } from 'react'
import { Heart, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '@/i18n'
import { useToast } from '../components/Toast'
import { ConfirmModal } from '../components/ConfirmModal'
import { SkeletonGrid } from '@/components/Loading'
import { fetchFavoriteGenerations, removeFavorite, removeFavorites, type FavoriteGeneration } from '@/services/favorites'
import { createContentFlag } from '@/services/admin'
import { downloadFile, getGenerationFilename } from '@/utils/download'
import { Pagination } from './MyVideos/Pagination'
import { FavoritesToolbar } from './MyFavorites/FavoritesToolbar'
import { FavoritesMediaCollection } from './MyFavorites/FavoritesMediaCollection'
import { FavoritesPreviewModal } from './MyFavorites/FavoritesPreviewModal'
import { FilterType, SortType, ViewMode, getItemType } from './MyFavorites/types'

const FAVORITES_PAGE_SIZE = 8
const REMOVE_ANIMATION_MS = 220

export default function MyFavoritesPage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState<FavoriteGeneration[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortType>('recent')
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk'; id?: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [isDownloadingPreview, setIsDownloadingPreview] = useState(false)
  const [page, setPage] = useState(1)
  const [failedMediaIds, setFailedMediaIds] = useState<Set<string>>(new Set())
  const [isPreviewMediaFailed, setIsPreviewMediaFailed] = useState(false)
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const dateLocale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US'

  useEffect(() => {
    if (user) {
      loadFavorites()
    }
  }, [user])

  useEffect(() => {
    const title = t.myFavorites.title
    document.title = `${title} | Lumivids`
  }, [t])

  const loadFavorites = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const generationsData = await fetchFavoriteGenerations(user.id)
      setFavorites(generationsData)
    } catch (error) {
      console.error('Error loading favorites:', error)
      showToast(t.toast.errorLoadingData, 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredFavorites = favorites.filter((item) => {
    const itemType = item.type === 'text-to-video' || item.type === 'image-to-video' ? 'video' : 'image'
    const matchesFilter = filter === 'all' || itemType === filter
    const matchesSearch = (item.prompt || '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const sortedFavorites = [...filteredFavorites].sort((left, right) => {
    if (sortBy === 'oldest') {
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    }

    if (sortBy === 'video') {
      const leftVideo = getItemType(left.type) === 'video'
      const rightVideo = getItemType(right.type) === 'video'
      if (leftVideo !== rightVideo) return leftVideo ? -1 : 1
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    }

    if (sortBy === 'image') {
      const leftImage = getItemType(left.type) === 'image'
      const rightImage = getItemType(right.type) === 'image'
      if (leftImage !== rightImage) return leftImage ? -1 : 1
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })

  const totalPages = Math.max(1, Math.ceil(sortedFavorites.length / FAVORITES_PAGE_SIZE))
  const pagedFavorites = sortedFavorites.slice(
    (page - 1) * FAVORITES_PAGE_SIZE,
    page * FAVORITES_PAGE_SIZE
  )

  const videoCount = favorites.filter((item) => getItemType(item.type) === 'video').length
  const imageCount = favorites.filter((item) => getItemType(item.type) === 'image').length

  const previewItem = previewIndex !== null ? sortedFavorites[previewIndex] : null

  const closePreview = useCallback(() => {
    setPreviewIndex(null)
  }, [])

  const openPreviewById = useCallback((id: string) => {
    const index = sortedFavorites.findIndex((item) => item.id === id)
    if (index >= 0) {
      setPreviewIndex(index)
    }
  }, [sortedFavorites])

  useEffect(() => {
    setPage(1)
  }, [filter, searchQuery, sortBy])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const goToPreviousPreview = useCallback(() => {
    if (sortedFavorites.length <= 1 || previewIndex === null) return
    setPreviewIndex((current) => {
      if (current === null) return null
      return current > 0 ? current - 1 : sortedFavorites.length - 1
    })
  }, [previewIndex, sortedFavorites.length])

  const goToNextPreview = useCallback(() => {
    if (sortedFavorites.length <= 1 || previewIndex === null) return
    setPreviewIndex((current) => {
      if (current === null) return null
      return current < sortedFavorites.length - 1 ? current + 1 : 0
    })
  }, [previewIndex, sortedFavorites.length])

  useEffect(() => {
    if (previewIndex === null) return

    if (sortedFavorites.length === 0) {
      setPreviewIndex(null)
      return
    }

    if (previewIndex >= sortedFavorites.length) {
      setPreviewIndex(sortedFavorites.length - 1)
    }
  }, [sortedFavorites.length, previewIndex])

  useEffect(() => {
    setIsPreviewMediaFailed(false)
  }, [previewItem?.id])

  useEffect(() => {
    if (previewIndex === null) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePreview()
        return
      }

      if (sortedFavorites.length <= 1) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToPreviousPreview()
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToNextPreview()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closePreview, goToNextPreview, goToPreviousPreview, previewIndex, sortedFavorites.length])

  const handleRemoveFavorite = async (generationId: string) => {
    if (!user) return
    
    setIsDeleting(true)
    try {
      await removeFavorite(user.id, generationId)

      setRemovingIds((current) => {
        const next = new Set(current)
        next.add(generationId)
        return next
      })

      await new Promise((resolve) => window.setTimeout(resolve, REMOVE_ANIMATION_MS))

      setFavorites((current) => current.filter(item => item.id !== generationId))
      setSelectedItems((current) => current.filter(itemId => itemId !== generationId))
      setRemovingIds((current) => {
        const next = new Set(current)
        next.delete(generationId)
        return next
      })
      showToast(t.toast.removedFromFavorites, 'success')
    } catch (error) {
      console.error('Error removing favorite:', error)
      showToast(t.toast.errorRemovingFavorite, 'error')
      setRemovingIds((current) => {
        const next = new Set(current)
        next.delete(generationId)
        return next
      })
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleRemoveSelectedFavorites = async () => {
    if (!user || selectedItems.length === 0) return

    setIsDeleting(true)
    try {
      await removeFavorites(user.id, selectedItems)

      setRemovingIds((current) => {
        const next = new Set(current)
        selectedItems.forEach((id) => next.add(id))
        return next
      })

      await new Promise((resolve) => window.setTimeout(resolve, REMOVE_ANIMATION_MS))

      const selectedSet = new Set(selectedItems)
      setFavorites((current) => current.filter((item) => !selectedSet.has(item.id)))
      setSelectedItems([])
      setIsSelectionMode(false)
      setRemovingIds((current) => {
        const next = new Set(current)
        selectedItems.forEach((id) => next.delete(id))
        return next
      })
      showToast(t.toast.removedFromFavorites, 'success')
    } catch (error) {
      console.error('Error removing selected favorites:', error)
      showToast(t.toast.errorRemovingFavorite, 'error')
      setRemovingIds((current) => {
        const next = new Set(current)
        selectedItems.forEach((id) => next.delete(id))
        return next
      })
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const copyPrompt = useCallback(async (id: string, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPromptId(id)
      showToast(t.toast.promptCopied, 'success')
      window.setTimeout(() => {
        setCopiedPromptId((current) => (current === id ? null : current))
      }, 1600)
    } catch (error) {
      console.error('Error copying prompt:', error)
      showToast(t.toast.failedToCopy, 'error')
    }
  }, [showToast, t])

  const openDeleteModal = (id: string) => {
    setDeleteTarget({ type: 'single', id })
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedItems((current) => (
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    ))
  }, [])

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((current) => {
      if (current) {
        setSelectedItems([])
      }
      return !current
    })
  }, [])

  const confirmBulkDelete = useCallback(() => {
    if (selectedItems.length === 0) return
    setDeleteTarget({ type: 'bulk' })
  }, [selectedItems.length])

  const formatFavoriteDate = useCallback((value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return new Intl.DateTimeFormat(dateLocale).format(date)
  }, [dateLocale])

  const getAspectRatioLabel = useCallback((item: FavoriteGeneration) => {
    const settings = item.settings || {}
    if (typeof settings.aspectRatio === 'string' && settings.aspectRatio.length > 0) return settings.aspectRatio
    if (typeof settings.aspect_ratio === 'string' && settings.aspect_ratio.length > 0) return settings.aspect_ratio
    if (typeof item.aspect_ratio === 'string' && item.aspect_ratio.length > 0) return item.aspect_ratio
    return null
  }, [])

  const getDurationSeconds = useCallback((item: FavoriteGeneration) => {
    const settings = item.settings || {}
    if (typeof settings.duration === 'number') return settings.duration
    if (typeof item.duration === 'number') return item.duration
    return null
  }, [])

  const getModelLabel = useCallback((item: FavoriteGeneration) => {
    return item.model_name || item.model_id || null
  }, [])

  const markMediaAsFailed = useCallback((id: string) => {
    setFailedMediaIds((current) => {
      if (current.has(id)) return current
      const next = new Set(current)
      next.add(id)
      return next
    })
  }, [])

  const handleDownloadPreview = useCallback(async () => {
    if (!previewItem?.output_url) {
      showToast(t.toast.noFileAvailable, 'error')
      return
    }

    const mediaType = getItemType(previewItem.type)
    const safePrefix = (previewItem.prompt || 'lumivids').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40) || 'lumivids'

    setIsDownloadingPreview(true)
    try {
      const filename = getGenerationFilename(mediaType, safePrefix)
      await downloadFile(previewItem.output_url, filename)
      showToast(t.toast.downloadStarted, 'success')
    } catch (error) {
      console.error('Error downloading favorite preview:', error)
      showToast(t.toast.downloadFailed, 'error')
    } finally {
      setIsDownloadingPreview(false)
    }
  }, [previewItem, showToast, t])

  const handleUseAgain = useCallback((item: FavoriteGeneration) => {
    const params = new URLSearchParams()

    if (item.prompt) {
      params.set('prompt', item.prompt)
    }

    if (item.model_id) {
      params.set('model', item.model_id)
    }

    const settings = item.settings || {}

    if (typeof settings.duration === 'number') {
      params.set('duration', String(settings.duration))
    }

    if (typeof settings.aspectRatio === 'string' && settings.aspectRatio.length > 0) {
      params.set('aspect', settings.aspectRatio)
    }

    if (typeof settings.resolution === 'string' && settings.resolution.length > 0) {
      params.set('resolution', settings.resolution)
    }

    if (settings.withAudio) {
      params.set('audio', 'true')
    }

    const inputImageUrl =
      item.input_image_url
      || (typeof settings.inputImageUrl === 'string' ? settings.inputImageUrl : undefined)
      || (typeof settings.input_image_url === 'string' ? settings.input_image_url : undefined)

    if (inputImageUrl) {
      params.set('inputImageUrl', inputImageUrl)
    }

    const routes: Record<string, string> = {
      'text-to-video': '/text-to-video',
      'image-to-video': '/image-to-video',
      'text-to-image': '/text-to-image',
      'image-to-image': '/image-to-image',
    }

    const route = routes[item.type] || '/text-to-video'
    navigate(`${route}?${params.toString()}`)
    showToast(t.toast.settingsLoaded, 'info')
    setPreviewIndex(null)
  }, [navigate, showToast, t])

  const handleReport = useCallback(async (item: FavoriteGeneration) => {
    if (!user?.id) {
      showToast(t.toast.pleaseLogin, 'error')
      return
    }

    const reason = window.prompt('Motivo da denúncia:', 'Conteúdo impróprio')?.trim()
    if (!reason) return

    const details = window.prompt('Detalhes (opcional):')?.trim() || undefined

    try {
      await createContentFlag({
        generationId: item.id,
        reason,
        details,
        reporterUserId: user.id,
      })
      showToast('Denúncia enviada com sucesso.', 'success')
    } catch (error) {
      console.error('Error reporting favorite generation:', error)
      showToast('Falha ao enviar denúncia.', 'error')
    }
  }, [user?.id, showToast, t.toast.pleaseLogin])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Heart className="w-8 h-8 text-red-400" />
            {t.myFavorites.title}
          </h1>
        </div>
        <SkeletonGrid count={8} columns={3} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Heart className="w-8 h-8 text-red-400" />
          {t.myFavorites.title}
        </h1>
        <p className="text-dark-400">
          {t.myVideos.countSummary
            .replace('{total}', String(favorites.length))
            .replace('{videos}', String(videoCount))
            .replace('{images}', String(imageCount))}
        </p>
      </div>

      <FavoritesToolbar
        t={t}
        searchQuery={searchQuery}
        filter={filter}
        sortBy={sortBy}
        viewMode={viewMode}
        hasItems={filteredFavorites.length > 0}
        isSelectionMode={isSelectionMode}
        onSearchChange={setSearchQuery}
        onFilterChange={setFilter}
        onSortChange={setSortBy}
        onViewModeChange={setViewMode}
        onToggleSelectionMode={toggleSelectionMode}
      />

      {selectedItems.length > 0 && (
        <div className="card bg-primary-500/10 border-primary-500/30 flex items-center justify-between">
          <span className="text-white">
            {t.myVideos.selectedCount.replace('{count}', String(selectedItems.length))}
          </span>
          <button
            type="button"
            className="btn-secondary flex items-center gap-2"
            onClick={confirmBulkDelete}
            disabled={isDeleting}
          >
            <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
            {t.common.delete}
          </button>
        </div>
      )}

      <FavoritesMediaCollection
        items={pagedFavorites}
        viewMode={viewMode}
        selectedItems={selectedItems}
        isSelectionMode={isSelectionMode}
        isDeleting={isDeleting}
        removingIds={removingIds}
        failedMediaIds={failedMediaIds}
        copiedPromptId={copiedPromptId}
        t={t}
        onOpenPreview={openPreviewById}
        onToggleSelect={toggleSelect}
        onUseAgain={handleUseAgain}
        onCopyPrompt={copyPrompt}
        onOpenDelete={openDeleteModal}
        onReport={handleReport}
        onMarkMediaAsFailed={markMediaAsFailed}
        formatFavoriteDate={formatFavoriteDate}
        getItemType={getItemType}
        getModelLabel={getModelLabel}
        getAspectRatioLabel={getAspectRatioLabel}
        getDurationSeconds={getDurationSeconds}
      />

      {/* Empty State */}
      {filteredFavorites.length === 0 && (
        <div className="card text-center py-16">
          <Heart className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">
            {searchQuery
              ? t.myFavorites.empty.searchTitle
              : favorites.length > 0 && filter !== 'all'
                ? t.myFavorites.empty.filterTitle
                : t.myFavorites.empty.title}
          </h3>
          <p className="text-dark-400">
            {searchQuery
              ? t.myFavorites.empty.searchSubtitle
              : favorites.length > 0 && filter !== 'all'
                ? t.myFavorites.empty.filterSubtitle
                : t.myFavorites.empty.subtitle}
          </p>
        </div>
      )}

      {/* Pagination */}
      {filteredFavorites.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={sortedFavorites.length}
          pageSize={FAVORITES_PAGE_SIZE}
          onPageChange={setPage}
          translations={t.myVideos}
        />
      )}

      {/* Media Preview Modal */}
      {previewItem && (
        <FavoritesPreviewModal
          previewItem={previewItem}
          hasMultipleItems={sortedFavorites.length > 1}
          isPreviewMediaFailed={isPreviewMediaFailed}
          isDownloadingPreview={isDownloadingPreview}
          t={t}
          onClose={closePreview}
          onPrevious={goToPreviousPreview}
          onNext={goToNextPreview}
          onUseAgain={handleUseAgain}
          onDownload={handleDownloadPreview}
          onSetPreviewMediaFailed={setIsPreviewMediaFailed}
          getItemType={getItemType}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => {
          setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget?.type === 'single' && deleteTarget.id) {
            handleRemoveFavorite(deleteTarget.id)
            return
          }
          if (deleteTarget?.type === 'bulk') {
            handleRemoveSelectedFavorites()
          }
        }}
        title={deleteTarget?.type === 'bulk' ? t.myVideos.deleteConfirmBulkTitle : t.myFavorites.deleteConfirmTitle}
        message={
          deleteTarget?.type === 'bulk'
            ? t.myVideos.deleteConfirmBulkMessage.replace('{count}', String(selectedItems.length))
            : t.myFavorites.deleteConfirmMessage
        }
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}

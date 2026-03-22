import { useEffect, useState, useCallback, useMemo } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Download, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { downloadFile, downloadMultipleFiles, getGenerationFilename } from '@/utils/download'
import { useToast } from '@/components/Toast'
import { ConfirmModal } from '@/components/ConfirmModal'
import { LoadingSpinner, LoadingCard, SkeletonGrid } from '@/components/Loading'
import { useLanguage } from '@/i18n'
import { createContentFlag } from '@/services/admin'
import { useMediaGallery } from './useMediaGallery'
import { MediaFiltersBar } from './MediaFiltersBar'
import { MediaCard, MediaListItem } from './MediaCard'
import { MediaPreviewModal } from './MediaPreviewModal'
import { Pagination } from './Pagination'
import { MediaItem, ViewMode, MY_VIDEOS_FALLBACK } from './types'

export default function MyVideosPage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const toast = useToast()
  
  const myVideos = (t.myVideos ?? MY_VIDEOS_FALLBACK) as typeof MY_VIDEOS_FALLBACK
  const dateLocale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US'

  // Gallery hook with all data management
  const {
    media,
    filteredMedia,
    pagedMedia,
    modelOptions,
    aspectOptions,
    isLoading,
    isSyncing,
    page,
    setPage,
    totalPages,
    pageSize,
    filters,
    updateFilter,
    resetFilters,
    toggleFavorite,
    deleteItem,
    deleteItems,
  } = useMediaGallery({ pageSize: 8 })

  const hasActiveFilters =
    filters.filter !== 'all'
    || filters.searchQuery.trim().length > 0
    || filters.dateFrom !== ''
    || filters.dateTo !== ''
    || filters.modelFilter !== 'all'
    || filters.durationFilter !== 'all'
    || filters.aspectFilter !== 'all'
    || filters.statusFilter !== 'all'
    || filters.sortBy !== 'recent'

  const mediaCounts = useMemo(() => {
    let videos = 0
    let images = 0

    for (const item of media) {
      if (item.type === 'video') {
        videos += 1
      } else if (item.type === 'image') {
        images += 1
      }
    }

    return {
      total: media.length,
      videos,
      images,
    }
  }, [media])

  // Local UI state
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'bulk'; id?: string } | null>(null)
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)

  // Set document title
  useEffect(() => {
    document.title = `${myVideos.title} | Lumivids`
  }, [myVideos.title])

  // Selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }, [])

  const handleItemClick = useCallback((e: MouseEvent<HTMLDivElement>, item: MediaItem) => {
    if (isSelectionMode) {
      toggleSelect(item.id)
      return
    }

    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      toggleSelect(item.id)
      return
    }
    setPreviewItem(item)
  }, [isSelectionMode, toggleSelect])

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((current) => {
      if (current) {
        setSelectedItems([])
      }
      return !current
    })
  }, [])

  // Favorite handler with toast
  const handleToggleFavorite = useCallback(async (id: string) => {
    const result = await toggleFavorite(id)
    if (!result.success) {
      toast.error(t.toast.pleaseLogin)
      return
    }
    if (result.isFavorite) {
      toast.success(t.toast.addedToFavorites)
    } else {
      toast.success(t.toast.removedFromFavorites)
    }
  }, [toggleFavorite, toast, t])

  // Delete handlers
  const confirmDelete = useCallback((id: string) => {
    setDeleteConfirm({ type: 'single', id })
  }, [])

  const confirmBulkDelete = useCallback(() => {
    if (selectedItems.length === 0) return
    setDeleteConfirm({ type: 'bulk' })
  }, [selectedItems.length])

  const handleDelete = useCallback(async (id: string) => {
    setIsDeleting(true)
    const success = await deleteItem(id)
    if (success) {
      setSelectedItems(prev => prev.filter(itemId => itemId !== id))
      toast.success(t.toast.itemDeleted)
    } else {
      toast.error(t.common.error)
    }
    setIsDeleting(false)
    setDeleteConfirm(null)
  }, [deleteItem, toast, t])

  const handleBulkDelete = useCallback(async () => {
    if (selectedItems.length === 0) return
    setIsDeleting(true)
    const success = await deleteItems(selectedItems)
    if (success) {
      const message = t.toast.itemsDeleted.replace('{count}', String(selectedItems.length))
      toast.success(message)
      setSelectedItems([])
    } else {
      toast.error(t.common.error)
    }
    setIsDeleting(false)
    setDeleteConfirm(null)
  }, [selectedItems, deleteItems, toast, t])

  // Download handlers
  const handleDownload = useCallback(async (item: MediaItem) => {
    if (item.status !== 'ready' || !item.outputUrl) {
      toast.error(t.toast.noFileAvailable)
      return
    }

    setIsDownloading(true)
    try {
      const filename = getGenerationFilename(item.type, item.title.replace(/[^a-zA-Z0-9]/g, '-') || 'lumivids')
      await downloadFile(item.outputUrl, filename)
      toast.success(t.toast.downloadStarted)
    } catch (error) {
      console.error('Download error:', error)
      toast.error(t.toast.downloadFailed)
    } finally {
      setIsDownloading(false)
    }
  }, [toast, t])

  const handleBulkDownload = useCallback(async () => {
    const selectedMedia = media.filter((item) => selectedItems.includes(item.id))
    const urls = selectedMedia
      .filter((item) => item.status === 'ready' && !!item.outputUrl)
      .map((item) => item.outputUrl)
      .filter((url): url is string => !!url)

    if (urls.length === 0) {
      toast.error(t.toast.noFilesAvailable)
      return
    }

    setIsDownloading(true)
    try {
      await downloadMultipleFiles(urls, 'lumivids-batch')
      const message = t.toast.filesDownloaded.replace('{count}', String(urls.length))
      toast.success(message)
    } catch (error) {
      console.error('Bulk download error:', error)
      toast.error(t.toast.someDownloadsFailed)
    } finally {
      setIsDownloading(false)
      setSelectedItems([])
      setIsSelectionMode(false)
    }
  }, [media, selectedItems, toast, t])

  // Regenerate handler
  const handleRegenerate = useCallback((item: MediaItem) => {
    const params = new URLSearchParams()
    
    if (item.prompt) params.set('prompt', item.prompt)
    if (item.modelId) params.set('model', item.modelId)
    if (item.settings?.duration) params.set('duration', String(item.settings.duration))
    if (item.settings?.aspectRatio) params.set('aspect', item.settings.aspectRatio)
    if (item.settings?.resolution) params.set('resolution', item.settings.resolution)
    if (item.settings?.withAudio) params.set('audio', 'true')
    if (item.settings?.inputImageUrl) params.set('inputImageUrl', item.settings.inputImageUrl)
    
    const routes: Record<string, string> = {
      'text-to-video': '/text-to-video',
      'image-to-video': '/image-to-video',
      'text-to-image': '/text-to-image',
      'image-to-image': '/image-to-image',
    }
    
    const route = routes[item.generationType] || '/text-to-video'
    navigate(`${route}?${params.toString()}`)
    setPreviewItem(null)
    toast.info(t.toast.settingsLoaded)
  }, [navigate, toast, t])

  // Copy prompt handler
  const handleCopyPrompt = useCallback(async (item: MediaItem) => {
    if (!item.prompt) {
      toast.error(t.toast.noPromptAvailable)
      return
    }

    try {
      await navigator.clipboard.writeText(item.prompt)
      toast.success(t.toast.promptCopied)
    } catch (error) {
      console.error('Copy failed:', error)
      toast.error(t.toast.failedToCopy)
    }
  }, [toast, t])

  const handleReport = useCallback(async (item: MediaItem) => {
    if (!user?.id) {
      toast.error(t.toast.pleaseLogin)
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
      toast.success('Denúncia enviada com sucesso.')
    } catch (error) {
      console.error('Report content error:', error)
      toast.error('Falha ao enviar denúncia.')
    }
  }, [user?.id, toast, t.toast.pleaseLogin])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-primary-400" />
            {myVideos.title}
          </h1>
          <p className="text-dark-400">
            {myVideos.countSummary
              .replace('{total}', String(mediaCounts.total))
              .replace('{videos}', String(mediaCounts.videos))
              .replace('{images}', String(mediaCounts.images))}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <MediaFiltersBar
        filters={filters}
        onFilterChange={updateFilter}
        onClearFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        modelOptions={modelOptions}
        aspectOptions={aspectOptions}
        translations={myVideos}
      />

      {isSyncing && !isLoading && (
        <div className="card bg-yellow-500/10 border-yellow-500/30 flex items-center gap-3 text-yellow-300">
          <LoadingSpinner size="sm" />
          <span className="text-sm">
            <span className="font-medium">{myVideos.syncingTitle}</span> {myVideos.syncingDescription}
          </span>
        </div>
      )}

      {!isLoading && filteredMedia.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleSelectionMode}
            className="btn-secondary"
          >
            {isSelectionMode ? myVideos.cancelSelection : myVideos.select}
          </button>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="card bg-primary-500/10 border-primary-500/30 flex items-center justify-between">
          <span className="text-white">
            {myVideos.selectedCount.replace('{count}', String(selectedItems.length))}
          </span>
          <div className="flex gap-2">
            <button 
              className="btn-secondary flex items-center gap-2"
              onClick={handleBulkDownload}
              disabled={isDownloading}
            >
              <Download className={`w-4 h-4 ${isDownloading ? 'animate-pulse' : ''}`} />
              {isDownloading ? '...' : t.common.download}
            </button>
            <button 
              className="btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300" 
              onClick={confirmBulkDelete} 
              disabled={isDeleting}
            >
              {isDeleting ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
              {t.common.delete}
            </button>
          </div>
        </div>
      )}

      {/* Media Grid/List */}
      {isLoading ? (
        <SkeletonGrid count={8} columns={4} />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pagedMedia.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              isSelected={selectedItems.includes(item.id)}
              selectionMode={isSelectionMode}
              onClick={handleItemClick}
              onToggleSelect={toggleSelect}
              onDownload={handleDownload}
              onRegenerate={handleRegenerate}
              onToggleFavorite={handleToggleFavorite}
              onDelete={confirmDelete}
              onReport={handleReport}
              dateLocale={dateLocale}
              translations={myVideos}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {pagedMedia.map((item) => (
            <MediaListItem
              key={item.id}
              item={item}
              isSelected={selectedItems.includes(item.id)}
              selectionMode={isSelectionMode}
              onClick={handleItemClick}
              onToggleSelect={toggleSelect}
              onDownload={handleDownload}
              onRegenerate={handleRegenerate}
              onToggleFavorite={handleToggleFavorite}
              onDelete={confirmDelete}
              onReport={handleReport}
              dateLocale={dateLocale}
              translations={myVideos}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredMedia.length === 0 && (
        <div className="card text-center py-16">
          <FolderOpen className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">{myVideos.emptyTitle}</h3>
          <p className="text-dark-400">
            {filters.searchQuery ? myVideos.emptySearchHint : myVideos.emptyDefaultHint}
          </p>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && filteredMedia.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={filteredMedia.length}
          pageSize={pageSize}
          onPageChange={setPage}
          translations={myVideos}
        />
      )}

      {/* Preview Modal */}
      {previewItem && (
        <MediaPreviewModal
          item={previewItem}
          filteredMedia={filteredMedia}
          onClose={() => setPreviewItem(null)}
          onNavigate={setPreviewItem}
          onDownload={handleDownload}
          onToggleFavorite={handleToggleFavorite}
          onDelete={(id) => { confirmDelete(id); setPreviewItem(null) }}
          onRegenerate={handleRegenerate}
          onCopyPrompt={handleCopyPrompt}
          isDownloading={isDownloading}
          dateLocale={dateLocale}
          translations={myVideos}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.type === 'single' && deleteConfirm.id) {
            handleDelete(deleteConfirm.id)
          } else if (deleteConfirm?.type === 'bulk') {
            handleBulkDelete()
          }
        }}
        title={deleteConfirm?.type === 'bulk' ? myVideos.deleteConfirmBulkTitle : myVideos.deleteConfirmSingleTitle}
        message={
          deleteConfirm?.type === 'bulk'
            ? myVideos.deleteConfirmBulkMessage.replace('{count}', String(selectedItems.length))
            : myVideos.deleteConfirmSingleMessage
        }
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}

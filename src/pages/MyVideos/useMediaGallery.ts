import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchFavoriteIds, addFavorite, removeFavorite } from '@/services/favorites'
import { normalizeOutputUrls, replicateAPI } from '@/services/replicate'
import { MediaItem, MediaFilters, PLACEHOLDER_THUMB } from './types'

interface UseMediaGalleryOptions {
  pageSize?: number
}

const GENERATIONS_BATCH_SIZE = 100
const POLLING_MIN_DELAY_MS = 5000
const POLLING_MAX_DELAY_MS = 30000
const MY_VIDEOS_CACHE_KEY = 'lumivids_my_videos_cache_v1'
const MY_VIDEOS_CACHE_TTL_MS = 1000 * 60 * 10
const CACHE_WRITE_DEBOUNCE_MS = 300
const GENERATION_SELECT_COLUMNS = 'id, replicate_prediction_id, type, status, error_message, output_url, thumbnail_url, model_name, model_id, prompt, settings, credits_used, created_at, input_image_url'

const DEFAULT_FILTERS: MediaFilters = {
  filter: 'all',
  searchQuery: '',
  dateFrom: '',
  dateTo: '',
  modelFilter: 'all',
  durationFilter: 'all',
  aspectFilter: 'all',
  statusFilter: 'all',
  sortBy: 'recent',
}

interface Generation {
  id: string
  replicate_prediction_id?: string
  type: string
  status: string
  error_message?: string
  output_url?: string
  thumbnail_url?: string
  model_name?: string
  model_id?: string
  prompt?: string
  settings?: Record<string, unknown>
  credits_used?: number
  created_at: string
  input_image_url?: string
}

function readGenerationsCache(): Generation[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(MY_VIDEOS_CACHE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as { timestamp?: number; generations?: unknown }
    if (!parsed?.timestamp || !Array.isArray(parsed.generations)) return []

    const isExpired = Date.now() - parsed.timestamp > MY_VIDEOS_CACHE_TTL_MS
    if (isExpired) {
      window.localStorage.removeItem(MY_VIDEOS_CACHE_KEY)
      return []
    }

    return parsed.generations as Generation[]
  } catch {
    return []
  }
}

function writeGenerationsCache(generations: Generation[]): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      MY_VIDEOS_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        generations,
      })
    )
  } catch {
    // ignore cache write failures
  }
}

export function useMediaGallery(options: UseMediaGalleryOptions = {}) {
  const { pageSize = 8 } = options
  const initialCachedGenerationsRef = useRef<Generation[]>(readGenerationsCache())
  
  const [dbGenerations, setDbGenerations] = useState<Generation[]>(initialCachedGenerationsRef.current)
  const [userId, setUserId] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(initialCachedGenerationsRef.current.length === 0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [hasMoreGenerations, setHasMoreGenerations] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dbGenerationsRef = useRef<Generation[]>(initialCachedGenerationsRef.current)
  const isSyncingRef = useRef(false)
  const isLoadingMoreRef = useRef(false)
  const userIdRef = useRef<string | null>(null)
  const pollingBackoffStepRef = useRef(0)
  const isMountedRef = useRef(true)
  const cacheWriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const extractGenerationStoragePath = useCallback((url?: string) => {
    if (!url) return null

    const publicSegment = '/storage/v1/object/public/generations/'
    const signedSegment = '/storage/v1/object/sign/generations/'

    const getPathFromSegment = (value: string, segment: string) => {
      const index = value.indexOf(segment)
      if (index === -1) return null
      return decodeURIComponent(value.slice(index + segment.length).split('?')[0])
    }

    const directPath = getPathFromSegment(url, publicSegment) || getPathFromSegment(url, signedSegment)
    if (directPath) return directPath

    try {
      const parsed = new URL(url)
      return getPathFromSegment(parsed.pathname, publicSegment) || getPathFromSegment(parsed.pathname, signedSegment)
    } catch {
      return null
    }
  }, [])

  const deleteGenerationFiles = useCallback(async (generation: Generation) => {
    const paths = new Set<string>()
    const outputPath = extractGenerationStoragePath(generation.output_url)
    const thumbPath = extractGenerationStoragePath(generation.thumbnail_url)
    const inputPath = extractGenerationStoragePath(generation.input_image_url)

    if (outputPath) paths.add(outputPath)
    if (thumbPath) paths.add(thumbPath)
    if (inputPath) paths.add(inputPath)

    if (paths.size === 0) return

    const { error } = await supabase.storage.from('generations').remove(Array.from(paths))
    if (error) {
      console.error('Error deleting generation files from storage:', error)
    }
  }, [extractGenerationStoragePath])

  // Filters state
  const [filters, setFilters] = useState<MediaFilters>(DEFAULT_FILTERS)
  
  const [page, setPage] = useState(1)

  const clearPollingTimeout = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }
  }, [])

  const scheduleNextSync = useCallback((delayMs: number, callback: () => void) => {
    clearPollingTimeout()
    pollingTimeoutRef.current = setTimeout(() => {
      pollingTimeoutRef.current = null
      callback()
    }, delayMs)
  }, [clearPollingTimeout])

  const fetchGenerationsBatch = useCallback(async (options?: { reset?: boolean }) => {
    const reset = options?.reset ?? false
    const userId = userIdRef.current

    if (!userId || isLoadingMoreRef.current) {
      return
    }

    const offset = reset ? 0 : dbGenerationsRef.current.length

    isLoadingMoreRef.current = true
    if (isMountedRef.current) {
      setIsLoadingMore(true)
    }

    try {
      const { data, error } = await supabase
        .from('generations')
        .select(GENERATION_SELECT_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + GENERATIONS_BATCH_SIZE - 1)

      if (error) {
        console.error('Error loading generations batch:', error)
        return
      }

      const rows = data || []
      setHasMoreGenerations(rows.length === GENERATIONS_BATCH_SIZE)

      if (!isMountedRef.current) {
        return
      }

      if (reset) {
        dbGenerationsRef.current = rows
        setDbGenerations(rows)
      } else {
        setDbGenerations((prev) => {
          const existingIds = new Set(prev.map((item) => item.id))
          const merged = [...prev, ...rows.filter((item) => !existingIds.has(item.id))]
          dbGenerationsRef.current = merged
          return merged
        })
      }
    } finally {
      isLoadingMoreRef.current = false
      if (isMountedRef.current) {
        setIsLoadingMore(false)
      }
    }
  }, [])

  const upsertGeneration = useCallback((incoming: Generation) => {
    setDbGenerations((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === incoming.id)

      if (existingIndex === -1) {
        const merged = [incoming, ...prev]
        merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        dbGenerationsRef.current = merged
        return merged
      }

      const next = [...prev]
      next[existingIndex] = {
        ...next[existingIndex],
        ...incoming,
      }
      next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      dbGenerationsRef.current = next
      return next
    })
  }, [])

  const removeGenerationById = useCallback((id: string) => {
    setDbGenerations((prev) => {
      const next = prev.filter((item) => item.id !== id)
      dbGenerationsRef.current = next
      return next
    })
  }, [])

  // Load generations and favorites
  useEffect(() => {
    (async () => {
      try {
        // Try getUser() first; if it fails (e.g. network issues), fall back
        // to getSession() which can work from the local cache.
        let resolvedUserId: string | null = null

        try {
          const { data: { user } } = await supabase.auth.getUser()
          resolvedUserId = user?.id ?? null
        } catch (getUserError) {
          console.warn('[MyVideos] getUser() failed, trying getSession() fallback:', getUserError)
        }

        if (!resolvedUserId) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            resolvedUserId = session?.user?.id ?? null
          } catch (getSessionError) {
            console.warn('[MyVideos] getSession() fallback also failed:', getSessionError)
          }
        }

        if (!resolvedUserId) {
          if (isMountedRef.current) {
            setDbGenerations([])
            dbGenerationsRef.current = []
            writeGenerationsCache([])
            setUserId(null)
            setIsLoading(false)
          }
          return
        }

        userIdRef.current = resolvedUserId
        setUserId(resolvedUserId)

        await fetchGenerationsBatch({ reset: true })

        if (isMountedRef.current) {
          setIsLoading(false)
        }

        void (async () => {
          try {
            const favIds = await fetchFavoriteIds(resolvedUserId!)
            if (isMountedRef.current) {
              setFavoriteIds(favIds)
            }
          } catch (favoritesError) {
            console.error('Error loading favorites:', favoritesError)
          }
        })()
      } catch (error) {
        console.error('Error fetching data:', error)
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      clearPollingTimeout()
    }
  }, [clearPollingTimeout, fetchGenerationsBatch])

  useEffect(() => {
    if (!userId) {
      return
    }

    const channel = supabase
      .channel(`my-videos-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generations',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!isMountedRef.current) return

          if (payload.eventType === 'DELETE') {
            const removedId = (payload.old as { id?: string } | null)?.id
            if (removedId) {
              removeGenerationById(removedId)
            }
            return
          }

          const changed = payload.new as Generation | null
          if (!changed?.id) return
          upsertGeneration(changed)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, upsertGeneration, removeGenerationById])

  useEffect(() => {
    dbGenerationsRef.current = dbGenerations

    if (cacheWriteTimeoutRef.current) {
      clearTimeout(cacheWriteTimeoutRef.current)
    }

    cacheWriteTimeoutRef.current = setTimeout(() => {
      writeGenerationsCache(dbGenerationsRef.current)
      cacheWriteTimeoutRef.current = null
    }, CACHE_WRITE_DEBOUNCE_MS)

    return () => {
      if (cacheWriteTimeoutRef.current) {
        clearTimeout(cacheWriteTimeoutRef.current)
        cacheWriteTimeoutRef.current = null
      }
    }
  }, [dbGenerations])

  // Sync processing generations
  const syncProcessingGenerations = useCallback(async () => {
    if (isSyncingRef.current) return

    const pending = dbGenerationsRef.current.filter(
      (gen) => (
        gen.status === 'starting'
        || gen.status === 'processing'
        || (gen.status === 'succeeded' && !gen.output_url)
      ) && gen.replicate_prediction_id
    )

    if (pending.length === 0) {
      clearPollingTimeout()
      pollingBackoffStepRef.current = 0
      return
    }

    isSyncingRef.current = true
    if (isMountedRef.current) {
      setIsSyncing(true)
    }
    try {
      let hasTerminalUpdate = false
      const changedGenerationIds = new Set<string>()

      for (const gen of pending) {
        if (!isMountedRef.current) {
          return
        }

        const prediction = await replicateAPI.getPrediction(gen.replicate_prediction_id!)

        if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
          hasTerminalUpdate = true
          changedGenerationIds.add(gen.id)
          const outputUrls = normalizeOutputUrls(prediction.output)
          const replicateUrl = outputUrls[0] || null
          const outputUrl = (prediction as { local_output_url?: string }).local_output_url || replicateUrl

          const updateData: Record<string, unknown> = {
            status: prediction.status,
            output_url: outputUrl,
            thumbnail_url: outputUrl,
            error_message: prediction.error || null,
            completed_at: prediction.status === 'succeeded' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          }

          await supabase
            .from('generations')
            .update(updateData)
            .eq('id', gen.id)
        }
      }

      const userId = userIdRef.current
      if (userId && changedGenerationIds.size > 0) {
        const idsToRefresh = Array.from(changedGenerationIds)
        const { data } = await supabase
          .from('generations')
          .select(GENERATION_SELECT_COLUMNS)
          .eq('user_id', userId)
          .in('id', idsToRefresh)

        if (data && data.length > 0 && isMountedRef.current) {
          setDbGenerations((prev) => {
            const updatesById = new Map(data.map((item) => [item.id, item]))
            const merged = prev.map((item) => updatesById.get(item.id) ?? item)
            dbGenerationsRef.current = merged
            return merged
          })
        }
      }

      if (hasTerminalUpdate) {
        pollingBackoffStepRef.current = 0
      } else {
        pollingBackoffStepRef.current = Math.min(pollingBackoffStepRef.current + 1, 3)
      }

      const baseDelay = Math.max(POLLING_MIN_DELAY_MS, Math.min(POLLING_MAX_DELAY_MS, Math.round(20000 / pending.length)))
      const nextDelay = Math.min(POLLING_MAX_DELAY_MS, baseDelay * (pollingBackoffStepRef.current + 1))

      scheduleNextSync(nextDelay, () => {
        void syncProcessingGenerations()
      })
    } catch (error) {
      console.error('Error syncing processing generations:', error)
      scheduleNextSync(POLLING_MAX_DELAY_MS, () => {
        void syncProcessingGenerations()
      })
    } finally {
      isSyncingRef.current = false
      if (isMountedRef.current) {
        setIsSyncing(false)
      }
    }
  }, [clearPollingTimeout, scheduleNextSync])

  // Setup polling for processing generations (dynamic timeout + backoff)
  useEffect(() => {
    const hasPending = dbGenerations.some(
      (gen) => (
        gen.status === 'starting'
        || gen.status === 'processing'
        || (gen.status === 'succeeded' && !gen.output_url)
      ) && gen.replicate_prediction_id
    )

    if (hasPending && !pollingTimeoutRef.current) {
      void syncProcessingGenerations()
    } else if (!hasPending) {
      clearPollingTimeout()
      pollingBackoffStepRef.current = 0
    }
  }, [dbGenerations, syncProcessingGenerations, clearPollingTimeout])

  // Incremental loading: fetch next server batch as user reaches end of loaded data
  useEffect(() => {
    if (!hasMoreGenerations || isLoadingMoreRef.current || isLoading) {
      return
    }

    const requiredCountForPage = page * pageSize
    const isNearLoadedEnd = requiredCountForPage >= Math.max(dbGenerations.length - pageSize, 0)

    if (isNearLoadedEnd) {
      void fetchGenerationsBatch()
    }
  }, [page, pageSize, dbGenerations.length, hasMoreGenerations, isLoading, fetchGenerationsBatch])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [filters])

  // Transform generations to MediaItems
  const media = useMemo<MediaItem[]>(() => {
    return dbGenerations.map((gen) => {
      const isVideo = gen.type === 'text-to-video' || gen.type === 'image-to-video'
      const settings = gen.settings as Record<string, unknown> || {}
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
      const resolvedOutputUrl = gen.output_url || settingsOutput || undefined
      const resolvedThumbnail =
        gen.thumbnail_url
        || settingsThumb
        || resolvedOutputUrl
        || gen.input_image_url
        || PLACEHOLDER_THUMB
      const aspectRatio: MediaItem['aspectRatio'] = ['16:9', '9:16', '1:1', '4:3'].includes(settings.aspectRatio as string)
        ? settings.aspectRatio as MediaItem['aspectRatio']
        : '16:9'
      const status: MediaItem['status'] = (gen.status === 'succeeded' || resolvedOutputUrl)
        ? 'ready'
        : gen.status === 'starting' || gen.status === 'processing'
          ? 'processing'
          : 'failed'
      const createdAt = gen.created_at
      
      return {
        id: gen.id,
        predictionId: gen.replicate_prediction_id,
        type: isVideo ? 'video' : 'image',
        thumbnail: resolvedThumbnail,
        outputUrl: resolvedOutputUrl,
        title: gen.model_name || (isVideo ? 'Video' : 'Image'),
        prompt: gen.prompt || '',
        createdAt,
        durationSec: settings.duration as number | undefined,
        aspectRatio,
        model: gen.model_name || 'AI',
        modelId: gen.model_id || undefined,
        errorMessage: gen.error_message || undefined,
        cost: gen.credits_used || 0,
        status,
        isFavorite: favoriteIds.has(gen.id),
        generationType: gen.type as MediaItem['generationType'],
        settings: {
          duration: settings.duration as number | undefined,
          resolution: settings.resolution as string | undefined,
          aspectRatio: settings.aspectRatio as string | undefined,
          withAudio: settings.withAudio as boolean | undefined,
          inputImageUrl: gen.input_image_url,
        },
      }
    })
  }, [dbGenerations, favoriteIds])

  // Filter options
  const modelOptions = useMemo(() => Array.from(new Set(media.map((item) => item.model))), [media])
  const aspectOptions = useMemo(() => Array.from(new Set(media.map((item) => item.aspectRatio))), [media])

  // Filtered and sorted media
  const filteredMedia = useMemo(() => {
    return media
      .filter((item) => {
        const { filter, searchQuery, modelFilter, aspectFilter, statusFilter, dateFrom, dateTo, durationFilter } = filters
        const matchesFilter = filter === 'all' || item.type === filter
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              item.prompt.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesModel = modelFilter === 'all' || item.model === modelFilter
        const matchesAspect = aspectFilter === 'all' || item.aspectRatio === aspectFilter
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter
        const createdDate = new Date(item.createdAt)
        const matchesDateFrom = dateFrom ? createdDate >= new Date(dateFrom) : true
        const matchesDateTo = dateTo ? createdDate <= new Date(dateTo) : true
        const matchesDuration = durationFilter === 'all'
          ? true
          : item.durationSec
            ? (durationFilter === 'short' && item.durationSec <= 5) ||
              (durationFilter === 'medium' && item.durationSec > 5 && item.durationSec <= 10) ||
              (durationFilter === 'long' && item.durationSec > 10)
            : false
        return matchesFilter && matchesSearch && matchesModel && matchesAspect && matchesStatus && matchesDateFrom && matchesDateTo && matchesDuration
      })
      .sort((a, b) => {
        const { sortBy } = filters
        if (sortBy === 'cost') return b.cost - a.cost
        if (sortBy === 'duration') return (b.durationSec || 0) - (a.durationSec || 0)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [media, filters])

  // Paginated media
  const pagedMedia = useMemo(() => {
    return filteredMedia.slice((page - 1) * pageSize, page * pageSize)
  }, [filteredMedia, page, pageSize])

  const totalPages = Math.ceil(filteredMedia.length / pageSize)

  // Toggle favorite
  const toggleFavorite = useCallback(async (id: string): Promise<{ success: boolean; isFavorite: boolean }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, isFavorite: favoriteIds.has(id) }
    }

    const isFav = favoriteIds.has(id)

    try {
      if (isFav) {
        await removeFavorite(user.id, id)
        setFavoriteIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
        return { success: true, isFavorite: false }
      }

      await addFavorite(user.id, id)
      setFavoriteIds((prev) => new Set([...prev, id]))
      return { success: true, isFavorite: true }
    } catch {
      return { success: false, isFavorite: isFav }
    }
  }, [favoriteIds])

  // Delete single item
  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    try {
      const targetGeneration = dbGenerations.find((item) => item.id === id)
      if (targetGeneration) {
        await deleteGenerationFiles(targetGeneration)
      }

      const { error } = await supabase.from('generations').delete().eq('id', id)
      if (error) throw error
      setDbGenerations((prev) => prev.filter((item) => item.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting generation:', error)
      return false
    }
  }, [dbGenerations, deleteGenerationFiles])

  // Delete multiple items
  const deleteItems = useCallback(async (ids: string[]): Promise<boolean> => {
    if (ids.length === 0) return false
    try {
      const targetGenerations = dbGenerations.filter((item) => ids.includes(item.id))
      if (targetGenerations.length > 0) {
        await Promise.allSettled(targetGenerations.map((generation) => deleteGenerationFiles(generation)))
      }

      const { error } = await supabase.from('generations').delete().in('id', ids)
      if (error) throw error
      setDbGenerations((prev) => prev.filter((item) => !ids.includes(item.id)))
      return true
    } catch (error) {
      console.error('Error deleting generations:', error)
      return false
    }
  }, [dbGenerations, deleteGenerationFiles])

  // Update filters
  const updateFilter = useCallback(<K extends keyof MediaFilters>(key: K, value: MediaFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  return {
    // Data
    media,
    filteredMedia,
    pagedMedia,
    favoriteIds,
    
    // Options
    modelOptions,
    aspectOptions,
    
    // State
    isLoading,
    isSyncing,
    
    // Pagination
    page,
    setPage,
    totalPages,
    pageSize,
    
    // Filters
    filters,
    updateFilter,
    resetFilters,
    setFilters,
    
    // Actions
    toggleFavorite,
    deleteItem,
    deleteItems,
  }
}

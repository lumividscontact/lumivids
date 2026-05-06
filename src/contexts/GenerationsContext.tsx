import React, { createContext, useContext, useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { replicateAPI, PredictionResult } from '@/services/replicate'
import { supabase } from '@/lib/supabase'
import { createEstimatedPollingProgress } from '@/hooks/estimatedProgress'
import type { GenerationInsert, GenerationUpdate } from '@/lib/database.types'

export type GenerationType = 'text-to-video' | 'image-to-video' | 'text-to-image' | 'image-to-image'

export interface Generation {
  id: string
  predictionId: string
  type: GenerationType
  status: PredictionResult['status']
  output: string | string[] | null
  error: string | null
  progress: number
  creditsUsed: number
  createdAt: number
  modelName: string
  prompt?: string
  thumbnail?: string
  durationSec?: number
  aspectRatio?: string
}

interface GenerationsContextType {
  generations: Generation[]
  activeGenerations: Generation[]
  addGeneration: (gen: Omit<Generation, 'id' | 'createdAt'>) => string
  updateGeneration: (id: string, updates: Partial<Generation>) => void
  removeGeneration: (id: string, options?: { persistHide?: boolean }) => void
  getGeneration: (id: string) => Generation | undefined
  pollGeneration: (id: string) => Promise<void>
  clearCompleted: () => void
}

const GenerationsContext = createContext<GenerationsContextType | null>(null)

export function GenerationsProvider({ children }: { children: React.ReactNode }) {
  const [generations, setGenerations] = useState<Generation[]>([])

  const pollingRefs = useRef<Map<string, boolean>>(new Map())
  const generationsRef = useRef<Generation[]>([])
  const dbRestoreRef = useRef(false)

  // Track DB insert completion so updateGeneration can wait for the row to exist
  // before attempting an UPDATE (prevents race condition where UPDATE runs before INSERT)
  const insertPromisesRef = useRef<Map<string, Promise<void>>>(new Map())

  // useLayoutEffect ensures the ref is up-to-date BEFORE any child useEffect
  // reads it (child useEffect fires after parent useLayoutEffect).
  useLayoutEffect(() => {
    generationsRef.current = generations
  }, [generations])

  const activeGenerations = useMemo(
    () => generations.filter(g => g.status === 'starting' || g.status === 'processing'),
    [generations]
  )

  const addGeneration = useCallback((gen: Omit<Generation, 'id' | 'createdAt'>): string => {
    const id = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newGen: Generation = {
      ...gen,
      id,
      createdAt: Date.now(),
    }
    setGenerations(prev => [newGen, ...prev])
    
    // Save to Supabase — tracked by insertPromisesRef so updateGeneration
    // can wait for the row to exist before attempting an UPDATE.
    const insertPromise = (async () => {
      try {
        // Try getUser() first; fall back to getSession() if it fails
        let user: { id: string } | null = null
        try {
          const { data } = await supabase.auth.getUser()
          user = data.user
        } catch {
          // getUser() failed – try local session
        }
        if (!user) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            user = session?.user ?? null
          } catch {
            // session fallback also failed
          }
        }
        if (!user) {
          console.error('No user logged in')
          return
        }

        const outputUrl = Array.isArray(gen.output) ? gen.output[0] : gen.output
        
        const generationData: GenerationInsert = {
          user_id: user.id,
          type: gen.type,
          status: gen.status,
          prompt: gen.prompt || null,
          negative_prompt: null,
          input_image_url: gen.thumbnail || null,
          output_url: outputUrl || null,
          thumbnail_url: gen.thumbnail || null,
          model_id: gen.modelName || 'unknown',
          model_name: gen.modelName || null,
          settings: {
            duration: gen.durationSec,
            aspectRatio: gen.aspectRatio,
          },
          credits_used: gen.creditsUsed || 0,
          replicate_prediction_id: gen.predictionId,
          error_message: gen.error || null,
          is_public: false,
          view_count: 0,
        }

        const { data: existingGeneration, error: existingError } = await supabase
          .from('generations')
          .select('id')
          .eq('user_id', user.id)
          .eq('replicate_prediction_id', gen.predictionId)
          .maybeSingle()

        if (existingError) {
          console.error('Error checking existing generation:', existingError)
          return
        }

        if (existingGeneration?.id) {
          return
        }

        const { error } = await supabase
          .from('generations')
          .insert(generationData)

        if (error) {
          console.error('Error saving generation to database:', error)
        } else {
          console.log('Generation saved to database:', id)
        }
      } catch (error) {
        console.error('Error in addGeneration database save:', error)
      } finally {
        // Clean up once resolved
        insertPromisesRef.current.delete(id)
      }
    })()

    insertPromisesRef.current.set(id, insertPromise)
    
    return id
  }, [])

  const updateGeneration = useCallback((id: string, updates: Partial<Generation>) => {
    setGenerations(prev =>
      prev.map(g => (g.id === id ? { ...g, ...updates } : g))
    )

    const hasDbRelevantUpdate =
      updates.status !== undefined
      || updates.error !== undefined
      || updates.output !== undefined
      || updates.thumbnail !== undefined
      || updates.durationSec !== undefined
      || updates.aspectRatio !== undefined

    if (!hasDbRelevantUpdate) {
      return
    }
    
    // Update in Supabase
    ;(async () => {
      try {
        // Wait for the DB INSERT to complete before attempting UPDATE,
        // otherwise the row may not exist yet and the UPDATE matches 0 rows.
        const pendingInsert = insertPromisesRef.current.get(id)
        if (pendingInsert) {
          await pendingInsert
        }

        // Try getUser() first; fall back to getSession() if it fails
        // (e.g. network issue or auth timeout)
        let userId: string | null = null
        try {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id ?? null
        } catch {
          // getUser() failed – try local session
        }
        if (!userId) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            userId = session?.user?.id ?? null
          } catch {
            // session fallback also failed
          }
        }
        if (!userId) return

        // Find the generation to get the prediction ID
        const generation = generationsRef.current.find(g => g.id === id)
        if (!generation?.predictionId) return

        const outputUrl = Array.isArray(updates.output) ? updates.output[0] : updates.output
        
        const updateData: GenerationUpdate = {}
        
        if (updates.status && updates.status !== generation.status) updateData.status = updates.status
        if (updates.error !== undefined && updates.error !== generation.error) updateData.error_message = updates.error
        if (outputUrl !== undefined) {
          updateData.output_url = outputUrl
          // Se não houver thumbnail específico, use o output_url como thumbnail para vídeos
          if (!updates.thumbnail && outputUrl) {
            updateData.thumbnail_url = outputUrl
          }
        }
        if (updates.thumbnail !== undefined) updateData.thumbnail_url = updates.thumbnail
        
        // Update settings if needed
        if (updates.durationSec !== undefined || updates.aspectRatio !== undefined) {
          const currentSettings = (generation as any).settings || {}
          updateData.settings = {
            ...currentSettings,
            ...(updates.durationSec !== undefined && { duration: updates.durationSec }),
            ...(updates.aspectRatio !== undefined && { aspectRatio: updates.aspectRatio }),
          }
        }

        // Set completed_at when status is succeeded
        if (updates.status === 'succeeded' && generation.status !== 'succeeded') {
          updateData.completed_at = new Date().toISOString()
        }

        if (Object.keys(updateData).length === 0) {
          return
        }

        updateData.updated_at = new Date().toISOString()

        const { error, count } = await supabase
          .from('generations')
          .update(updateData)
          .eq('replicate_prediction_id', generation.predictionId)
          .eq('user_id', userId)

        if (error) {
          console.error('[Generations] Error updating generation in database:', error)
        } else {
          console.log('[Generations] DB update for prediction', generation.predictionId,
            '— status:', updates.status, '— output_url:', updateData.output_url ? 'set' : 'not set')
        }
      } catch (error) {
        console.error('Error in updateGeneration database update:', error)
      }
    })()
  }, [])

  const removeGeneration = useCallback((id: string, options?: { persistHide?: boolean }) => {
    pollingRefs.current.delete(id)
    const persistHide = options?.persistHide ?? true

    // Capture predictionId BEFORE removing from state/ref,
    // otherwise generationsRef won't contain the entry anymore.
    const generation = generationsRef.current.find(g => g.id === id)
    const predictionId = generation?.predictionId ?? null

    setGenerations(prev => prev.filter(g => g.id !== id))
    
    if (!persistHide || !predictionId) return

    // Soft-hide in Supabase so the record remains auditable.
    ;(async () => {
      try {
        let userId: string | null = null
        try {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id ?? null
        } catch { /* ignore */ }
        if (!userId) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            userId = session?.user?.id ?? null
          } catch { /* ignore */ }
        }
        if (!userId) return

        // Hide only one row (latest visible for this prediction) to avoid
        // accidentally hiding historical records that share prediction_id.
        const { data: targetRow, error: findError } = await supabase
          .from('generations')
          .select('id')
          .eq('replicate_prediction_id', predictionId)
          .eq('user_id', userId)
          .is('hidden_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (findError) {
          console.error('Error finding generation to hide:', findError)
          return
        }

        if (!targetRow?.id) return

        const { error } = await supabase
          .from('generations')
          .update({ hidden_at: new Date().toISOString() })
          .eq('id', targetRow.id)
          .eq('user_id', userId)

        if (error) {
          console.error('Error hiding generation from database:', error)
        } else {
          console.log('Generation hidden in database:', id)
        }
      } catch (error) {
        console.error('Error in removeGeneration database hide:', error)
      }
    })()
  }, [])

  const getGeneration = useCallback((id: string) => {
    return generationsRef.current.find(g => g.id === id)
  }, [])

  const pollGeneration = useCallback(async (id: string) => {
    // Get current state of generation
    let predictionId: string | null = null
    setGenerations(prev => {
      const gen = prev.find(g => g.id === id)
      if (gen) predictionId = gen.predictionId
      return prev
    })
    
    if (!predictionId) return

    // Prevent duplicate polling
    if (pollingRefs.current.get(id)) return
    pollingRefs.current.set(id, true)

    try {
      const getEstimatedProgress = createEstimatedPollingProgress()

      const result = await replicateAPI.waitForPrediction(predictionId, (prediction) => {
        setGenerations(prev =>
          prev.map(g =>
            g.id === id
              ? {
                  ...g,
                  status: prediction.status,
                  progress:
                    prediction.status === 'starting' || prediction.status === 'processing'
                      ? getEstimatedProgress(prediction.status)
                      : g.progress,
                }
              : g
          )
        )
      })

      if (result.status === 'succeeded') {
        const outputValue = result.output ?? null
        setGenerations(prev =>
          prev.map(g =>
            g.id === id
              ? {
                  ...g,
                  status: 'succeeded',
                  output: outputValue,
                  progress: 100,
                }
              : g
          )
        )

        // Persist to Supabase so the generation shows up in My Creations
        updateGeneration(id, {
          status: 'succeeded',
          output: outputValue as Generation['output'],
          progress: 100,
        })
      } else {
        setGenerations(prev =>
          prev.map(g =>
            g.id === id
              ? {
                  ...g,
                  status: result.status,
                  error: result.error || 'Generation failed',
                  progress: 0,
                }
              : g
          )
        )

        // Persist failure to Supabase
        updateGeneration(id, {
          status: result.status,
          error: result.error || 'Generation failed',
          progress: 0,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setGenerations(prev =>
        prev.map(g =>
          g.id === id
            ? {
                ...g,
                status: 'failed',
                error: errorMessage,
                progress: 0,
              }
            : g
        )
      )

      // Persist failure to Supabase
      updateGeneration(id, {
        status: 'failed',
        error: errorMessage,
        progress: 0,
      })
    } finally {
      pollingRefs.current.delete(id)
    }
  }, [updateGeneration])

  // Restore recent/pending generations from DB on first mount so pages can
  // show results when the user navigates away and comes back.
  useEffect(() => {
    if (dbRestoreRef.current) return
    dbRestoreRef.current = true

    ;(async () => {
      try {
        let userId: string | null = null
        try {
          const { data } = await supabase.auth.getUser()
          userId = data.user?.id ?? null
        } catch { /* ignore */ }
        if (!userId) {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            userId = session?.user?.id ?? null
          } catch { /* ignore */ }
        }
        if (!userId) return

        // Fetch in-progress + recently succeeded generations (last 24 h)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: rows, error } = await supabase
          .from('generations')
          .select('id, replicate_prediction_id, type, status, output_url, error_message, model_id, model_name, prompt, credits_used, settings, thumbnail_url, created_at')
          .eq('user_id', userId)
          .is('hidden_at', null)
          .in('status', ['starting', 'processing', 'succeeded'])
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(20)

        if (error || !rows?.length) return

        setGenerations(prev => {
          const existingIds = new Set(prev.map(g => g.predictionId))
          const toAdd: Generation[] = []

          for (const row of rows) {
            if (!row.replicate_prediction_id) continue
            if (existingIds.has(row.replicate_prediction_id)) continue

            const settings = (row.settings as { duration?: number; aspectRatio?: string } | null) ?? {}
            const outputVal = row.output_url ? [row.output_url] : null
            toAdd.push({
              id: `restored_${row.id}`,
              predictionId: row.replicate_prediction_id,
              type: row.type as GenerationType,
              status: row.status as Generation['status'],
              output: outputVal,
              error: row.error_message ?? null,
              progress: row.status === 'succeeded' ? 100 : 10,
              creditsUsed: row.credits_used ?? 0,
              createdAt: new Date(row.created_at).getTime(),
              modelName: row.model_name ?? row.model_id ?? 'unknown',
              prompt: row.prompt ?? undefined,
              thumbnail: row.thumbnail_url ?? undefined,
              durationSec: settings.duration,
              aspectRatio: settings.aspectRatio,
            })
          }

          return toAdd.length === 0 ? prev : [...toAdd, ...prev]
        })
      } catch (e) {
        console.error('[Generations] Failed to restore from DB:', e)
      }
    })()
  }, [])

  // Resume polling for any active generation (including ones restored from DB).
  // pollingRefs deduplicates — safe to run on every activeGenerations change.
  useEffect(() => {
    activeGenerations.forEach((gen) => {
      if (!pollingRefs.current.get(gen.id)) {
        void pollGeneration(gen.id)
      }
    })
  }, [activeGenerations, pollGeneration])

  const clearCompleted = useCallback(() => {
    setGenerations(prev =>
      prev.filter(g => g.status === 'starting' || g.status === 'processing')
    )
  }, [])

  return (
    <GenerationsContext.Provider
      value={{
        generations,
        activeGenerations,
        addGeneration,
        updateGeneration,
        removeGeneration,
        getGeneration,
        pollGeneration,
        clearCompleted,
      }}
    >
      {children}
    </GenerationsContext.Provider>
  )
}

export function useGenerations() {
  const context = useContext(GenerationsContext)
  if (!context) {
    throw new Error('useGenerations must be used within a GenerationsProvider')
  }
  return context
}

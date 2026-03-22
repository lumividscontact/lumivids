import { useCallback, useEffect, useRef, useState } from 'react'
import { replicateAPI, type PredictionResult } from '@/services/replicate'
import { useCredits } from '@/contexts/CreditsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useGenerations, type Generation, type GenerationType } from '@/contexts/GenerationsContext'
import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/services/analytics'
import { findPromptBlacklistMatch, getMaintenanceMode } from '@/services/admin'

interface GenerationState<TOutput> {
  isGenerating: boolean
  predictionId: string | null
  status: PredictionResult['status'] | null
  output: TOutput | null
  error: string | null
  progress: number
  creditsUsed: number
  generationId: string | null
}

interface WaitForCompletionArgs {
  predictionId: string
  parallelIds?: string[]
  onProgress: (update: { status: PredictionResult['status']; progress: number }) => void
}

interface UseGenerationConfig<TInput, TOutput> {
  generationType: GenerationType
  calculateCost: (input: TInput) => number
  createPrediction: (input: TInput) => Promise<{ id: string; parallelIds?: string[] }>
  waitForCompletion: (args: WaitForCompletionArgs) => Promise<TOutput>
  buildInitialGeneration: (args: {
    input: TInput
    predictionId: string
    cost: number
  }) => Omit<Generation, 'id' | 'createdAt'>
  buildSuccessGenerationUpdate?: (args: {
    input: TInput
    output: TOutput
  }) => Partial<Generation>
  mapGenerationOutput?: (output: Generation['output']) => TOutput | null
  formatInsufficientCreditsError: (args: { cost: number; credits: number }) => string
  formatFailureError?: (args: { errorMessage: string; cost: number }) => string
  onCompleted?: (args: { input: TInput; output: TOutput; cost: number }) => Promise<void> | void
}

function getPromptFromInput(input: unknown): string | null {
  if (input && typeof input === 'object' && 'prompt' in input) {
    const value = (input as { prompt?: unknown }).prompt
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return null
}

function getRequestedOutputCount(input: unknown): number {
  if (!input || typeof input !== 'object') return 1

  const value = (input as { numOutputs?: unknown; numImages?: unknown }).numOutputs
    ?? (input as { numOutputs?: unknown; numImages?: unknown }).numImages

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.trunc(value))
  }

  return 1
}

const defaultMapGenerationOutput = <TOutput,>(output: Generation['output']) => output as TOutput | null

export function useGeneration<TInput, TOutput>(config: UseGenerationConfig<TInput, TOutput>) {
  const { credits, refreshCredits } = useCredits()
  const { user, isAdmin } = useAuth()
  const { addGeneration, updateGeneration, getGeneration, activeGenerations } = useGenerations()

  const [state, setState] = useState<GenerationState<TOutput>>({
    isGenerating: false,
    predictionId: null,
    status: null,
    output: null,
    error: null,
    progress: 0,
    creditsUsed: 0,
    generationId: null,
  })

  const mapGenerationOutput = config.mapGenerationOutput || defaultMapGenerationOutput<TOutput>
  const mapGenerationOutputRef = useRef(mapGenerationOutput)
  const activeGenerationsCountRef = useRef(activeGenerations.length)

  useEffect(() => {
    mapGenerationOutputRef.current = mapGenerationOutput
  }, [mapGenerationOutput])

  useEffect(() => {
    activeGenerationsCountRef.current = activeGenerations.length
  }, [activeGenerations.length])

  useEffect(() => {
    if (!state.generationId) return

    const generation = getGeneration(state.generationId)
    if (!generation) return

    setState((prev) => {
      const nextOutput = mapGenerationOutputRef.current(generation.output)
      const nextIsGenerating = generation.status === 'starting' || generation.status === 'processing'

      if (
        prev.status === generation.status
        && prev.output === nextOutput
        && prev.error === generation.error
        && prev.progress === generation.progress
        && prev.isGenerating === nextIsGenerating
      ) {
        return prev
      }

      return {
        ...prev,
        status: generation.status,
        output: nextOutput,
        error: generation.error,
        progress: generation.progress,
        isGenerating: nextIsGenerating,
      }
    })
  }, [state.generationId, getGeneration, activeGenerations])

  const generate = useCallback(async (input: TInput) => {
    let generationId: string | null = null
    let cost = config.calculateCost(input)
    const modelId = typeof (input as { model?: unknown })?.model === 'string'
      ? (input as { model: string }).model
      : undefined
    let availableCredits = credits
    const prompt = getPromptFromInput(input)
    const userPlan = user?.plan ?? 'free'

    const [creditsResult, modelSettingsResult, planLimitResult, maintenanceModeResult, blacklistResult] = await Promise.allSettled([
      user?.id
        ? supabase
            .from('user_credits')
            .select('credits')
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      modelId
        ? supabase
            .from('ai_model_settings')
            .select('is_enabled, credit_cost_override')
            .eq('model_id', modelId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      !isAdmin
        ? supabase
            .from('plan_limits')
            .select('max_concurrent_generations')
            .eq('plan', userPlan)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      !isAdmin ? getMaintenanceMode() : Promise.resolve(false),
      prompt ? findPromptBlacklistMatch(prompt) : Promise.resolve(null),
    ])

    if (creditsResult.status === 'fulfilled') {
      const creditsData = creditsResult.value.data as { credits?: number } | null
      if (typeof creditsData?.credits === 'number') {
        availableCredits = creditsData.credits
      }
    }

    if (modelSettingsResult.status === 'fulfilled') {
      const modelSettings = modelSettingsResult.value.data as { is_enabled?: boolean; credit_cost_override?: number | null } | null
      if (modelSettings) {
        if (modelSettings.is_enabled === false && !isAdmin) {
          const modelDisabledError = 'Este modelo está temporariamente indisponível.'
          setState((prev) => ({ ...prev, error: modelDisabledError, isGenerating: false, status: 'failed' }))
          throw new Error(modelDisabledError)
        }

        if (typeof modelSettings.credit_cost_override === 'number' && Number.isFinite(modelSettings.credit_cost_override)) {
          const override = Math.max(0, Math.trunc(modelSettings.credit_cost_override))
          cost = override * getRequestedOutputCount(input)
        }
      }
    } else {
      console.warn('[Generation] Failed to load ai_model_settings, continuing with default model config.')
    }

    if (!isAdmin) {
      if (planLimitResult.status === 'fulfilled') {
        const planLimit = planLimitResult.value.data as { max_concurrent_generations?: number } | null
        if (
          planLimit
          && typeof planLimit.max_concurrent_generations === 'number'
          && planLimit.max_concurrent_generations > 0
          && activeGenerationsCountRef.current >= planLimit.max_concurrent_generations
        ) {
          const planLimitError = `Você atingiu o limite de ${planLimit.max_concurrent_generations} geração(ões) simultânea(s) do seu plano.`
          setState((prev) => ({ ...prev, error: planLimitError, isGenerating: false, status: 'failed' }))
          throw new Error(planLimitError)
        }
      } else {
        console.warn('[Generation] Failed to load plan limits, continuing generation flow.')
      }

      if (maintenanceModeResult.status === 'fulfilled') {
        if (maintenanceModeResult.value) {
          const maintenanceError = 'Gerações temporariamente indisponíveis: manutenção em andamento.'
          setState((prev) => ({ ...prev, error: maintenanceError, isGenerating: false, status: 'failed' }))
          throw new Error(maintenanceError)
        }
      } else {
        console.warn('[Generation] Failed to check maintenance mode, continuing generation flow.')
      }
    }

    if (blacklistResult.status === 'rejected') {
      throw blacklistResult.reason
    }

    const blacklistMatch = blacklistResult.value
    if (blacklistMatch) {
      const reason = blacklistMatch.reason || 'Prompt bloqueado por política de segurança'
      setState((prev) => ({ ...prev, error: reason, isGenerating: false, status: 'failed' }))
      throw new Error(reason)
    }

    if (availableCredits < cost) {
      const insufficientError = config.formatInsufficientCreditsError({ cost, credits: availableCredits })
      setState((prev) => ({ ...prev, error: insufficientError }))
      throw new Error('Insufficient credits')
    }

    setState({
      isGenerating: true,
      predictionId: null,
      status: 'starting',
      output: null,
      error: null,
      progress: 0,
      creditsUsed: cost,
      generationId: null,
    })

    trackEvent('generation_start', {
      generation_type: config.generationType,
      model_id: modelId,
      credits_cost: cost,
    })

    try {
      const { id, parallelIds } = await config.createPrediction(input)

      generationId = addGeneration(config.buildInitialGeneration({ input, predictionId: id, cost }))

      setState((prev) => ({
        ...prev,
        predictionId: id,
        progress: 10,
        generationId,
      }))

      const output = await config.waitForCompletion({
        predictionId: id,
        parallelIds,
        onProgress: ({ status, progress }) => {
          // Skip terminal statuses — the main flow below handles them with the output
          if (status === 'succeeded' || status === 'failed' || status === 'canceled') return
          setState((prev) => ({ ...prev, status, progress }))
          if (generationId) {
            updateGeneration(generationId, { status, progress })
          }
        },
      })

      // Set output in state IMMEDIATELY so the UI shows the result
      // before any async post-completion tasks
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        status: 'succeeded',
        output,
        progress: 100,
      }))

      if (generationId) {
        updateGeneration(generationId, {
          status: 'succeeded',
          output: output as Generation['output'],
          progress: 100,
          ...(config.buildSuccessGenerationUpdate?.({ input, output }) || {}),
        })
      }

      trackEvent('generation_success', {
        generation_type: config.generationType,
        model_id: modelId,
        credits_cost: cost,
      })

      // Post-completion tasks (non-blocking for UI)
      await refreshCredits(true)
      await config.onCompleted?.({ input, output, cost })

      return output
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const formattedError = config.formatFailureError
        ? config.formatFailureError({ errorMessage, cost })
        : errorMessage

      trackEvent('generation_failed', {
        generation_type: config.generationType,
        model_id: modelId,
        credits_cost: cost,
        error_message: errorMessage.slice(0, 120),
      })

      setState((prev) => ({
        ...prev,
        isGenerating: false,
        status: 'failed',
        error: formattedError,
        progress: 0,
      }))

      if (generationId) {
        updateGeneration(generationId, {
          status: 'failed',
          error: errorMessage,
          progress: 0,
        })
      }

      await refreshCredits(true)
      throw error
    }
  }, [credits, user?.id, user?.plan, isAdmin, refreshCredits, addGeneration, updateGeneration, config])

  const cancel = useCallback(async () => {
    if (!state.predictionId) return

    await replicateAPI.cancelPrediction(state.predictionId)
    setState((prev) => ({ ...prev, isGenerating: false, status: 'canceled', creditsUsed: 0 }))

    if (state.generationId) {
      updateGeneration(state.generationId, { status: 'canceled', creditsUsed: 0 })
    }

    // Refresh credits to reflect the refund from the backend
    await refreshCredits(true)
  }, [state.predictionId, state.generationId, updateGeneration, refreshCredits])

  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      predictionId: null,
      status: null,
      output: null,
      error: null,
      progress: 0,
      creditsUsed: 0,
      generationId: null,
    })
  }, [])

  const restoreGeneration = useCallback((generationId: string) => {
    const generation = getGeneration(generationId)
    if (!generation || generation.type !== config.generationType) return

    setState({
      isGenerating: generation.status === 'starting' || generation.status === 'processing',
      predictionId: generation.predictionId,
      status: generation.status,
      output: mapGenerationOutput(generation.output),
      error: generation.error,
      progress: generation.progress,
      creditsUsed: generation.creditsUsed,
      generationId: generation.id,
    })
  }, [getGeneration, config.generationType, mapGenerationOutput])

  return {
    ...state,
    credits,
    generate,
    cancel,
    reset,
    restoreGeneration,
  }
}

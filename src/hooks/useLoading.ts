import { useState, useCallback, useRef } from 'react'

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

interface UseLoadingOptions {
  /** Minimum loading time in ms to avoid flashing */
  minLoadingTime?: number
  /** Callback on success */
  onSuccess?: () => void
  /** Callback on error */
  onError?: (error: Error) => void
}

interface UseLoadingReturn<T> {
  /** Current loading state */
  state: LoadingState
  /** Is currently loading */
  isLoading: boolean
  /** Is in idle state */
  isIdle: boolean
  /** Is in success state */
  isSuccess: boolean
  /** Is in error state */
  isError: boolean
  /** Error message if any */
  error: string | null
  /** Result data if successful */
  data: T | null
  /** Execute an async operation with loading state management */
  execute: (asyncFn: () => Promise<T>) => Promise<T | null>
  /** Reset to idle state */
  reset: () => void
  /** Manually set loading state */
  setLoading: () => void
  /** Manually set success state with data */
  setSuccess: (data: T) => void
  /** Manually set error state */
  setError: (error: string) => void
}

export function useLoading<T = void>(options: UseLoadingOptions = {}): UseLoadingReturn<T> {
  const { minLoadingTime = 0, onSuccess, onError } = options
  
  const [state, setState] = useState<LoadingState>('idle')
  const [error, setErrorMsg] = useState<string | null>(null)
  const [data, setData] = useState<T | null>(null)
  const startTimeRef = useRef<number>(0)

  const setLoading = useCallback(() => {
    setState('loading')
    setErrorMsg(null)
    startTimeRef.current = Date.now()
  }, [])

  const setSuccess = useCallback((resultData: T) => {
    setState('success')
    setData(resultData)
    setErrorMsg(null)
  }, [])

  const setError = useCallback((errorMessage: string) => {
    setState('error')
    setErrorMsg(errorMessage)
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setErrorMsg(null)
    setData(null)
  }, [])

  const execute = useCallback(async (asyncFn: () => Promise<T>): Promise<T | null> => {
    setLoading()
    
    try {
      const result = await asyncFn()
      
      // Ensure minimum loading time
      if (minLoadingTime > 0) {
        const elapsed = Date.now() - startTimeRef.current
        if (elapsed < minLoadingTime) {
          await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsed))
        }
      }
      
      setSuccess(result)
      onSuccess?.()
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(err instanceof Error ? err : new Error(errorMessage))
      return null
    }
  }, [minLoadingTime, onSuccess, onError, setLoading, setSuccess, setError])

  return {
    state,
    isLoading: state === 'loading',
    isIdle: state === 'idle',
    isSuccess: state === 'success',
    isError: state === 'error',
    error,
    data,
    execute,
    reset,
    setLoading,
    setSuccess,
    setError,
  }
}

interface UseMultiLoadingReturn {
  /** Check if a specific key is loading */
  isLoading: (key: string) => boolean
  /** Check if any key is loading */
  isAnyLoading: boolean
  /** Get all loading keys */
  loadingKeys: string[]
  /** Start loading for a key */
  startLoading: (key: string) => void
  /** Stop loading for a key */
  stopLoading: (key: string) => void
  /** Execute async operation for a specific key */
  execute: <T>(key: string, asyncFn: () => Promise<T>) => Promise<T | null>
}

export function useMultiLoading(): UseMultiLoadingReturn {
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set())

  const isLoading = useCallback((key: string) => loadingKeys.has(key), [loadingKeys])
  const isAnyLoading = loadingKeys.size > 0

  const startLoading = useCallback((key: string) => {
    setLoadingKeys(prev => new Set([...prev, key]))
  }, [])

  const stopLoading = useCallback((key: string) => {
    setLoadingKeys(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  const execute = useCallback(async <T>(key: string, asyncFn: () => Promise<T>): Promise<T | null> => {
    startLoading(key)
    try {
      const result = await asyncFn()
      return result
    } catch {
      return null
    } finally {
      stopLoading(key)
    }
  }, [startLoading, stopLoading])

  return {
    isLoading,
    isAnyLoading,
    loadingKeys: Array.from(loadingKeys),
    startLoading,
    stopLoading,
    execute,
  }
}

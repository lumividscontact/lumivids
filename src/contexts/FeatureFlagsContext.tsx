import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchFeatureFlags } from '@/services/admin'

interface FeatureFlagsContextType {
  flags: Record<string, boolean>
  isLoading: boolean
  isEnabled: (key: string, defaultValue?: boolean) => boolean
  refreshFlags: () => Promise<void>
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | null>(null)

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(false)

  const refreshFlags = useCallback(async () => {
    if (!isAuthenticated) {
      setFlags({})
      return
    }

    setIsLoading(true)
    try {
      const rows = await fetchFeatureFlags()
      const nextFlags = rows.reduce<Record<string, boolean>>((acc, row) => {
        acc[row.key] = row.enabled
        return acc
      }, {})
      setFlags(nextFlags)
    } catch (error) {
      console.error('[FeatureFlags] Failed to fetch flags:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (authLoading) return
    refreshFlags()
  }, [authLoading, refreshFlags])

  const value = useMemo<FeatureFlagsContextType>(() => ({
    flags,
    isLoading,
    isEnabled: (key: string, defaultValue = true) => {
      if (!(key in flags)) return defaultValue
      return flags[key]
    },
    refreshFlags,
  }), [flags, isLoading, refreshFlags])

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext)
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider')
  }
  return context
}

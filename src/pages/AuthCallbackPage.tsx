import { useEffect, useState, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/i18n'

export default function AuthCallbackPage() {
  const [isDone, setIsDone] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false)
  const [authHint, setAuthHint] = useState<'password' | null>(null)
  const location = useLocation()
  const processedRef = useRef(false)
  const { t } = useLanguage()

  useEffect(() => {
    const run = async () => {
      // Prevent double execution in Strict Mode or re-renders
      if (processedRef.current) return
      processedRef.current = true

      try {
        // Proactively clear excessive storage usage to ensure auth token can be saved
        // If 'lumivids_generations' is taking up too much space, delete it.
        const gens = localStorage.getItem('lumivids_generations')
        if (gens && gens.length > 500000) { // If > 500KB
           localStorage.removeItem('lumivids_generations')
           console.log('[Auth] Cleared generations history to ensure login space')
        }
      } catch (e) {
        // ignore
      }

      const url = new URL(window.location.href)
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
      const recoveryFromSearch = url.searchParams.get('type') === 'recovery' || url.searchParams.get('flow') === 'recovery'
      const recoveryFromHash = hashParams.get('type') === 'recovery'
      const isRecovery = recoveryFromSearch || recoveryFromHash

      if (isRecovery) {
        setIsRecoveryFlow(true)
      }

      const errorParam = url.searchParams.get('error') || url.searchParams.get('error_description')
      if (errorParam) {
        if (!isRecovery) {
          setAuthHint('password')
        }
        setHasError(true)
        setIsDone(true)
        return
      }

      const code = url.searchParams.get('code')
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('[Auth] exchangeCodeForSession error:', error)
            // Tenta verificar se a sessão foi criada mesmo com erro (ex: StrictMode rodou 2x)
            const { data } = await supabase.auth.getSession()
            if (!data.session) {
              if (!isRecovery) {
                setAuthHint('password')
              }
              setHasError(true)
            } else {
              console.log('[Auth] Recovered from error, session exists.')
            }
          }
        } catch (err: any) {
          console.error('[Auth] Critical error during exchange:', err)
          if (err?.name === 'QuotaExceededError' || err?.message?.includes('QuotaExceededError')) {
            // Se faltar espaço, limpa o cache de gerações para permitir o login
            try {
              localStorage.removeItem('lumivids_generations')
              console.log('[Auth] Cleared generations cache to free space')
            } catch (e) {
              // ignore
            }
            // Não podemos recuperar este login pois o code foi queimado, mas o próximo deve funcionar
          }
          if (!isRecovery) {
            setAuthHint('password')
          }
          setHasError(true)
        }
      } else {
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          if (!isRecovery) {
            setAuthHint('password')
          }
          setHasError(true)
        }
      }

      setIsDone(true)
    }

    run()
  }, [location.search, location.hash])

  if (!isDone) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <span className="text-dark-300 text-sm">{t.common.loading}</span>
      </div>
    )
  }

  if (hasError) {
    if (isRecoveryFlow) {
      return <Navigate to="/auth?force=1&type=recovery" replace />
    }
    const hintSuffix = authHint ? `&auth_hint=${authHint}` : ''
    return <Navigate to={`/auth?force=1${hintSuffix}`} replace />
  }

  if (isRecoveryFlow) {
    return <Navigate to="/auth?force=1&type=recovery" replace />
  }

  return <Navigate to="/home" replace />
}

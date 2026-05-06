import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react'
import { pt } from './translations/pt'
import { en } from './translations/en'
import { es } from './translations/es'
import { id } from './translations/id'
import { buildPathForLanguage, getRuntimeLanguage, getStoredRuntimeLanguage, setStoredRuntimeLanguage } from './runtime'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export type Language = 'pt' | 'en' | 'es' | 'id'

export const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
]

type AnyRecord = Record<string, unknown>

function isPlainObject(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeTranslations(base: AnyRecord, target: AnyRecord): AnyRecord {
  const result: AnyRecord = {}
  const keys = new Set([...Object.keys(base), ...Object.keys(target)])
  keys.forEach((key) => {
    const baseValue = base[key]
    const targetValue = target[key]
    if (isPlainObject(baseValue)) {
      const targetObject = isPlainObject(targetValue) ? targetValue : {}
      result[key] = mergeTranslations(baseValue, targetObject)
      return
    }
    result[key] = targetValue === undefined ? baseValue : targetValue
  })
  return result
}

type TranslationKeys = typeof pt

const TRANSLATIONS: Record<Language, TranslationKeys> = {
  pt,
  en: mergeTranslations(pt as AnyRecord, en as AnyRecord) as TranslationKeys,
  es: mergeTranslations(pt as AnyRecord, es as AnyRecord) as TranslationKeys,
  id: mergeTranslations(pt as AnyRecord, id as AnyRecord) as TranslationKeys,
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: TranslationKeys
  languages: typeof languages
  isLoading: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const HTML_LANG_BY_APP_LANGUAGE: Record<Language, string> = {
  pt: 'pt-BR',
  en: 'en',
  es: 'es',
  id: 'id',
}

function isLanguage(value: string | null | undefined): value is Language {
  return value === 'pt' || value === 'en' || value === 'es' || value === 'id'
}

function getInitialLanguage(): Language {
  return getRuntimeLanguage()
}

function getTranslation(language: Language): TranslationKeys {
  return TRANSLATIONS[language]
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const initialLanguage = getInitialLanguage()
  const [language, setLanguageState] = useState<Language>(initialLanguage)
  const [t, setTranslations] = useState<TranslationKeys>(() => getTranslation(initialLanguage))
  const [isLoading] = useState<boolean>(false)
  const authenticatedUserIdRef = useRef<string | null>(null)

  const persistProfileLanguage = useCallback(async (userId: string, lang: Language) => {
    const { error } = await supabase
      .from('profiles')
      .update({ language: lang })
      .eq('user_id', userId)

    if (error) {
      console.warn('[i18n] Failed to persist profile language:', error)
    }
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    setStoredRuntimeLanguage(lang)

    if (typeof window !== 'undefined') {
      const targetPath = buildPathForLanguage(window.location.pathname, lang)
      const currentPath = window.location.pathname
      if (targetPath !== currentPath) {
        const targetUrl = `${targetPath}${window.location.search}${window.location.hash}`
        window.location.assign(targetUrl)
        return
      }
    }

    const authenticatedUserId = authenticatedUserIdRef.current
    if (isSupabaseConfigured && authenticatedUserId) {
      void persistProfileLanguage(authenticatedUserId, lang)
    }
  }, [persistProfileLanguage])

  useEffect(() => {
    document.documentElement.lang = HTML_LANG_BY_APP_LANGUAGE[language]
    setTranslations(getTranslation(language))
  }, [language])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    let cancelled = false

    const syncLanguageForUser = async (userId: string | null | undefined) => {
      authenticatedUserIdRef.current = userId ?? null

      if (!userId) {
        return
      }

      const storedLanguage = getStoredRuntimeLanguage()
      const detectedLanguage = getRuntimeLanguage()
      const fallbackLanguage = storedLanguage ?? detectedLanguage

      const { data, error } = await supabase
        .from('profiles')
        .select('language')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.warn('[i18n] Failed to load profile language:', error)
        return
      }

      const profileLanguage = isLanguage(data?.language) ? data.language : null

      if (storedLanguage) {
        if (profileLanguage !== storedLanguage) {
          void persistProfileLanguage(userId, storedLanguage)
        }

        if (!cancelled) {
          setLanguageState(storedLanguage)
        }
        return
      }

      if (profileLanguage) {
        setStoredRuntimeLanguage(profileLanguage)
        if (!cancelled) {
          setLanguageState(profileLanguage)
        }
        return
      }

      setStoredRuntimeLanguage(fallbackLanguage)
      if (!cancelled) {
        setLanguageState(fallbackLanguage)
      }
      void persistProfileLanguage(userId, fallbackLanguage)
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.warn('[i18n] Failed to get auth session for language sync:', error)
        return
      }

      void syncLanguageForUser(data.session?.user?.id)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncLanguageForUser(session?.user?.id)
    })

    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
    }
  }, [persistProfileLanguage])

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languages,
        isLoading,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

// Utility function for nested translations
export function getNestedTranslation(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let result: unknown = obj
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key]
    } else {
      return path // Return the path if translation not found
    }
  }
  
  return typeof result === 'string' ? result : path
}

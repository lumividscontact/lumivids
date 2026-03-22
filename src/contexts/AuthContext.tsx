import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { PlanType, UserRole } from '@/lib/database.types'
import { INITIAL_CREDITS, USER_CREDITS_CACHE_KEY } from '@/config/constants'
import { detectRuntimeLanguage, getRuntimeMessage, getStoredRuntimeLanguage } from '@/i18n/runtime'
import { trackEvent } from '@/services/analytics'

// ============================================
// Credits Cache Helpers
// ============================================
interface CachedCredits {
  userId: string
  credits: number
  plan: PlanType
  role?: string
  timestamp: number
}

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

const AUTH_LOGIN_CONFIRM_EMAIL = {
  pt: 'Por favor, confirme seu email antes de fazer login. Verifique sua caixa de entrada.',
  en: 'Please confirm your email before signing in. Check your inbox.',
  es: 'Por favor, confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
} as const

const AUTH_INVALID_CREDENTIALS = {
  pt: 'Email ou senha incorretos.',
  en: 'Incorrect email or password.',
  es: 'Correo o contraseña incorrectos.',
} as const

const AUTH_REGISTER_RATE_LIMIT = {
  pt: 'Limite de criação de contas atingido. Aguarde alguns minutos e tente novamente.',
  en: 'Account creation limit reached. Please wait a few minutes and try again.',
  es: 'Límite de creación de cuentas alcanzado. Espera unos minutos e inténtalo nuevamente.',
} as const

const AUTH_REGISTER_ACCOUNT_EXISTS = {
  pt: 'Este e-mail já está cadastrado. Se a conta foi criada com Google, entre com Google.',
  en: 'This email is already registered. If the account was created with Google, sign in with Google.',
  es: 'Este correo ya está registrado. Si la cuenta fue creada con Google, inicia sesión con Google.',
} as const

const AUTH_REGISTER_WEAK_PASSWORD = {
  pt: 'Sua senha deve ter pelo menos 8 caracteres.',
  en: 'Your password must be at least 8 characters long.',
  es: 'Tu contraseña debe tener al menos 8 caracteres.',
} as const

const AUTH_ACCOUNT_SUSPENDED = {
  pt: 'Sua conta está suspensa. Entre em contato com o suporte.',
  en: 'Your account is suspended. Please contact support.',
  es: 'Tu cuenta está suspendida. Contacta con soporte.',
} as const

function getCachedCredits(userId: string): CachedCredits | null {
  try {
    const cached = localStorage.getItem(USER_CREDITS_CACHE_KEY)
    if (!cached) return null
    
    const data: CachedCredits = JSON.parse(cached)
    
    // Check if cache is for the same user and not expired
    if (data.userId !== userId) return null
    if (Date.now() - data.timestamp > CACHE_MAX_AGE_MS) return null
    
    return data
  } catch {
    return null
  }
}

function setCachedCredits(userId: string, credits: number, plan: PlanType, role?: string): void {
  try {
    const data: CachedCredits = {
      userId,
      credits,
      plan,
      role,
      timestamp: Date.now(),
    }
    localStorage.setItem(USER_CREDITS_CACHE_KEY, JSON.stringify(data))
  } catch {
    // Ignore localStorage errors
  }
}

function clearCachedCredits(): void {
  try {
    localStorage.removeItem(USER_CREDITS_CACHE_KEY)
  } catch {
    // Ignore
  }
}

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  plan: PlanType
  credits: number
  role: UserRole
  isSuspended?: boolean
  mustResetPassword?: boolean
  forceLogoutAt?: string | null
  createdAt?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isAdmin: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  updateProfile: (updates: { name?: string; avatar?: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Mock auth for development without Supabase
function useMockAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = async (email: string, _password: string) => {
    setUser({
      id: '1',
      name: email.split('@')[0],
      email,
      plan: null,
      credits: INITIAL_CREDITS,
      role: 'user',
      createdAt: new Date().toISOString(),
    })
  }

  const register = async (name: string, email: string, _password: string) => {
    setUser({
      id: '1',
      name,
      email,
      plan: null,
      credits: INITIAL_CREDITS,
      role: 'user',
      createdAt: new Date().toISOString(),
    })
  }

  const requestPasswordReset = async (_email: string) => {
    // Mock mode: no-op to keep UX behavior during local development
    return
  }

  const logout = async () => {
    setUser(null)
  }

  const loginWithGoogle = async () => {
    setUser({
      id: 'google-1',
      name: 'Google User',
      email: 'user@gmail.com',
      plan: null,
      credits: INITIAL_CREDITS,
      role: 'user',
      createdAt: new Date().toISOString(),
    })
  }

  const updateProfile = async (updates: { name?: string; avatar?: string }) => {
    setUser(prev => {
      if (!prev) {
        return prev
      }
      return {
        ...prev,
        name: updates.name ?? prev.name,
        avatar: updates.avatar ?? prev.avatar,
      }
    })
  }

  return { user, isLoading, login, register, requestPasswordReset, loginWithGoogle, logout, updateProfile }
}

// Real Supabase auth
function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const isAuthenticatingRef = useRef(false)

  const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T | null> => {
    let timeoutId: number | null = null

    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = window.setTimeout(() => {
        console.warn(timeoutMessage)
        resolve(null)
      }, timeoutMs)
    })

    try {
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }

  const ensureProfile = async (userId: string, email?: string, name?: string | null, avatarUrl?: string | null) => {
    const preferredLanguage = getStoredRuntimeLanguage() ?? detectRuntimeLanguage()

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email, avatar_url, language, role, is_suspended, must_reset_password, force_logout_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (profile) {
      return profile
    }

    await supabase.from('profiles').insert({
      user_id: userId,
      display_name: name ?? null,
      email: email ?? null,
      avatar_url: avatarUrl ?? null,
      language: preferredLanguage,
    })

    const { data: createdProfile } = await supabase
      .from('profiles')
      .select('display_name, email, avatar_url, language, role, is_suspended, must_reset_password, force_logout_at')
      .eq('user_id', userId)
      .maybeSingle()

    return createdProfile ?? null
  }

  const ensureCredits = async (userId: string) => {
    const { data: creditsRow, error: selectError } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .maybeSingle()

    if (selectError) {
      console.error('[Auth] ensureCredits select error:', selectError)
    }

    if (creditsRow) {
      return creditsRow.credits
    }

    // RLS lockdown: credits row must be created by trigger/service role, not frontend.
    console.warn('[Auth] user_credits row not found yet; using initial credits fallback')
    return INITIAL_CREDITS
  }

  const ensureSubscription = async (userId: string) => {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .maybeSingle()

    // Se não tem assinatura, retorna null (não cria automaticamente)
    if (!subscription?.plan) {
      return null
    }

    return subscription.plan as PlanType
  }

  // Create user instantly from auth data (no DB calls) - uses cache for credits
  const createUserFromAuth = (authUser: { id: string; email?: string | null; user_metadata?: Record<string, any>; created_at?: string }): User => {
    const email = authUser.email ?? ''
    const nameFromMetadata =
      authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.display_name
    const avatarFromMetadata = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture

    // Try to get cached credits to avoid "flash" of wrong value
    const cached = getCachedCredits(authUser.id)

    return {
      id: authUser.id,
      name: nameFromMetadata || (email ? email.split('@')[0] : 'User'),
      email,
      avatar: avatarFromMetadata || undefined,
      plan: cached?.plan ?? (null as PlanType),
      credits: cached?.credits ?? INITIAL_CREDITS,
      role: (cached?.role as UserRole) || ('user' as UserRole),
      createdAt: authUser.created_at,
    }
  }

  // Load user data from DB and return updates for safe hydration
  const loadUserDataFromDB = async (userId: string): Promise<Partial<User>> => {
    try {
      const [profileResult, creditsResult, subscriptionResult] = await Promise.all([
        supabase.from('profiles').select('display_name, email, avatar_url, role, is_suspended, must_reset_password, force_logout_at').eq('user_id', userId).maybeSingle(),
        supabase.from('user_credits').select('credits').eq('user_id', userId).maybeSingle(),
        supabase.from('subscriptions').select('plan').eq('user_id', userId).maybeSingle(),
      ])

      if (profileResult.error) {
        console.warn('[Auth] profile query failed; trying fallback query:', profileResult.error)
      }
      if (creditsResult.error) {
        console.warn('[Auth] user_credits query failed:', creditsResult.error)
      }
      if (subscriptionResult.error) {
        console.warn('[Auth] subscriptions query failed:', subscriptionResult.error)
      }

      let fallbackProfile: { display_name: string | null; role: string | null } | null = null
      if (profileResult.error) {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, role')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) {
          console.warn('[Auth] fallback profile query failed:', error)
        } else {
          fallbackProfile = data
        }
      }

      const updates: Partial<User> = {}
      
      const profileData = profileResult.data ?? fallbackProfile

      if (profileData?.display_name) {
        updates.name = profileData.display_name
      }
      if (profileData?.role) {
        updates.role = profileData.role as UserRole
      }
      if (profileResult.data?.is_suspended !== undefined) {
        updates.isSuspended = profileResult.data.is_suspended
      }
      if (profileResult.data?.must_reset_password !== undefined) {
        updates.mustResetPassword = profileResult.data.must_reset_password
      }
      if (profileResult.data?.force_logout_at !== undefined) {
        updates.forceLogoutAt = profileResult.data.force_logout_at
      }
      if (creditsResult.data?.credits !== undefined) {
        updates.credits = creditsResult.data.credits
      }
      if (subscriptionResult.data?.plan) {
        updates.plan = subscriptionResult.data.plan as PlanType
      }

      return updates
    } catch (err) {
      console.warn('[Auth] Failed to load user data from DB:', err)
      return {}
    }
  }

  const createHydratedUserFromAuth = async (authUser: { id: string; email?: string | null; user_metadata?: Record<string, any>; created_at?: string }): Promise<User> => {
    const baseUser = createUserFromAuth(authUser)
    const updates = await withTimeout(
      loadUserDataFromDB(authUser.id),
      4_000,
      '[Auth] loadUserDataFromDB timed out after 4 s; using base user data'
    )
    const hydratedUser: User = { ...baseUser, ...(updates ?? {}) }

    setCachedCredits(hydratedUser.id, hydratedUser.credits, hydratedUser.plan, hydratedUser.role)

    return hydratedUser
  }

  const enforceAccountState = async (userId: string, lastSignInAt?: string | null): Promise<boolean> => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_suspended, force_logout_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !profile) {
      return false
    }

    if (profile.is_suspended) {
      clearCachedCredits()
      await supabase.auth.signOut()
      setUser(null)
      throw new Error(getRuntimeMessage(AUTH_ACCOUNT_SUSPENDED))
    }

    if (profile.force_logout_at && lastSignInAt) {
      const forcedAt = new Date(profile.force_logout_at).getTime()
      const signedInAt = new Date(lastSignInAt).getTime()

      if (forcedAt > signedInAt) {
        clearCachedCredits()
        await supabase.auth.signOut()
        setUser(null)
        return true
      }
    }

    return false
  }

  useEffect(() => {
    let isMounted = true

    // ── Instant load: read stored session from localStorage synchronously ──
    // Supabase persists the session JSON under the 'lumivids-auth' key.
    // By reading it sync we can release isLoading in the SAME render tick,
    // eliminating the 3-5 s "Carregando..." splash entirely.
    try {
      const raw = localStorage.getItem('lumivids-auth')
      if (raw) {
        const stored = JSON.parse(raw)
        const storedUser = stored?.user
        if (storedUser?.id) {
          console.log('[Auth] instant load from localStorage, user:', storedUser.id)
          const baseUser = createUserFromAuth(storedUser)
          setUser(baseUser)
          setIsLoading(false) // ← released on first render tick
        } else {
          // Stored data exists but has no user – anonymous
          setUser(null)
          setIsLoading(false)
        }
      } else {
        // No stored session at all – anonymous visitor
        setUser(null)
        setIsLoading(false)
      }
    } catch {
      // localStorage parse error – release loading and let background fix it
      setUser(null)
      setIsLoading(false)
    }

    // ── Background: validate session, hydrate from DB, enforce account state ──
    const backgroundInit = async () => {
      console.log('[Auth] background init started')
      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          5_000,
          '[Auth] getSession timed out after 5 s'
        )

        // If getSession timed out, sessionResult is null.
        // A timeout does NOT mean the session is invalid — it only means the
        // network / Supabase was slow.  Keep the localStorage-based user and
        // let onAuthStateChange correct it later if needed.
        if (sessionResult === null) {
          console.warn('[Auth] getSession timed out; keeping current user from localStorage')
          return
        }

        const session = sessionResult?.data?.session

        if (sessionResult?.error) {
          console.error('[Auth] getSession error:', sessionResult.error)
        }

        if (session?.user && isMounted) {
          const hydratedUser = await withTimeout(
            createHydratedUserFromAuth(session.user),
            4_000,
            '[Auth] hydration timed out after 4 s'
          )
          if (hydratedUser && isMounted) {
            setUser(hydratedUser)
          }

          enforceAccountState(session.user.id, session.user.last_sign_in_at).catch((err) => {
            console.warn('[Auth] enforceAccountState failed (non-blocking):', err)
          })
        } else if (isMounted) {
          // getSession returned an actual response with no session –
          // user is truly anonymous (or session expired and couldn't refresh)
          setUser((prev) => {
            if (prev && !session?.user) {
              console.warn('[Auth] stored session invalid; clearing user')
              clearCachedCredits()
              return null
            }
            return prev
          })
        }
      } catch (err) {
        console.error('[Auth] background init failed:', err)
      }
    }

    void backgroundInit()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (isAuthenticatingRef.current) {
          return
        }

        const currentUrl = new URL(window.location.href)
        const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
        const isRecoveryFlow =
          currentUrl.searchParams.get('type') === 'recovery' ||
          currentUrl.searchParams.get('flow') === 'recovery' ||
          hashParams.get('type') === 'recovery'

        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isRecoveryFlow)) {
          return
        }

        if (event === 'SIGNED_OUT') {
          if (isMounted) {
            setUser(null)
          }
          return
        }

        if (session?.user && isMounted) {
          const hydratedUser = await createHydratedUserFromAuth(session.user)
          if (isMounted) {
            setUser(hydratedUser)
          }

          // Enforce account state in background – never blocks auth state change
          enforceAccountState(session.user.id, session.user.last_sign_in_at).catch((err) => {
            console.warn('[Auth] enforceAccountState in onAuthStateChange failed:', err)
          })
        }
      } catch (err) {
        console.error('[Auth] onAuthStateChange failed:', err)
      }
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    setIsAuthenticating(true)
    isAuthenticatingRef.current = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // Provide user-friendly error messages
        if (error.message.includes('Email not confirmed')) {
          throw new Error(getRuntimeMessage(AUTH_LOGIN_CONFIRM_EMAIL))
        } else if (error.message.includes('Invalid login credentials')) {
          throw new Error(getRuntimeMessage(AUTH_INVALID_CREDENTIALS))
        }
        throw error
      }
      if (data.user) {
        await ensureProfile(
          data.user.id,
          data.user.email,
          data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.user_metadata?.display_name,
          data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture
        )

        await enforceAccountState(data.user.id, data.user.last_sign_in_at)

        const hydratedUser = await createHydratedUserFromAuth(data.user)
        setUser(hydratedUser)
        trackEvent('login', { method: 'email' })
      }
    } finally {
      setIsAuthenticating(false)
      isAuthenticatingRef.current = false
    }
  }

  useEffect(() => {
    if (!user?.id) {
      return
    }

    const interval = window.setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const lastSignInAt = data.session?.user?.last_sign_in_at
        await enforceAccountState(user.id, lastSignInAt)
      } catch (err) {
        console.warn('[Auth] Failed to enforce account state:', err)
      }
    }, 60_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [user?.id])

  const register = async (name: string, email: string, password: string) => {
    setIsAuthenticating(true)
    isAuthenticatingRef.current = true
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            display_name: name,
          },
        },
      })
      if (error) {
        if (error.message?.toLowerCase().includes('rate limit')) {
          throw new Error(getRuntimeMessage(AUTH_REGISTER_RATE_LIMIT))
        }
        if (error.message?.toLowerCase().includes('password')) {
          throw new Error(getRuntimeMessage(AUTH_REGISTER_WEAK_PASSWORD))
        }
        throw error
      }

      const identities = (data.user as { identities?: unknown[] } | null)?.identities
      if (Array.isArray(identities) && identities.length === 0) {
        throw new Error(getRuntimeMessage(AUTH_REGISTER_ACCOUNT_EXISTS))
      }

      if (data.user) {
        const hydratedUser = await createHydratedUserFromAuth(data.user)
        setUser(hydratedUser)
        trackEvent('sign_up', { method: 'email' })
      }
    } finally {
      setIsAuthenticating(false)
      isAuthenticatingRef.current = false
    }
  }

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?force=1&type=recovery`,
    })

    if (error) {
      throw error
    }
  }

  const logout = async () => {
    clearCachedCredits() // Clear cache on logout
    await supabase.auth.signOut()
    setUser(null)
  }

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      throw error
    }
  }

  const updateProfile = async (updates: { name?: string; avatar?: string }) => {
    if (!user) {
      return
    }

    const profileUpdates: Record<string, string | null> = {}
    if (updates.name !== undefined) {
      profileUpdates.display_name = updates.name
    }
    if (updates.avatar !== undefined) {
      profileUpdates.avatar_url = updates.avatar || null
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('user_id', user.id)

      if (error) {
        throw error
      }
    }

    const metadataUpdates: Record<string, string> = {}
    if (updates.name !== undefined) {
      metadataUpdates.full_name = updates.name
      metadataUpdates.display_name = updates.name
    }
    if (updates.avatar !== undefined) {
      metadataUpdates.avatar_url = updates.avatar
      metadataUpdates.picture = updates.avatar
    }

    if (Object.keys(metadataUpdates).length > 0) {
      const { error } = await supabase.auth.updateUser({
        data: metadataUpdates,
      })
      if (error) {
        throw error
      }
    }

    setUser(prev => {
      if (!prev) {
        return prev
      }
      return {
        ...prev,
        name: updates.name ?? prev.name,
        avatar: updates.avatar ?? prev.avatar,
      }
    })
  }

  return {
    user,
    isLoading: isLoading || isAuthenticating,
    login,
    register,
    requestPasswordReset,
    loginWithGoogle,
    logout,
    updateProfile,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (isSupabaseConfigured) {
    return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  }

  return <MockAuthProvider>{children}</MockAuthProvider>
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const auth = useSupabaseAuth()

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        isAuthenticated: !!auth.user,
        isAdmin: auth.user?.role === 'admin',
        isLoading: auth.isLoading,
        login: auth.login,
        register: auth.register,
        requestPasswordReset: auth.requestPasswordReset,
        loginWithGoogle: auth.loginWithGoogle,
        logout: auth.logout,
        updateProfile: auth.updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

function MockAuthProvider({ children }: { children: ReactNode }) {
  const auth = useMockAuth()

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        isAuthenticated: !!auth.user,
        isAdmin: auth.user?.role === 'admin',
        isLoading: auth.isLoading,
        login: auth.login,
        register: auth.register,
        requestPasswordReset: auth.requestPasswordReset,
        loginWithGoogle: auth.loginWithGoogle,
        logout: auth.logout,
        updateProfile: auth.updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

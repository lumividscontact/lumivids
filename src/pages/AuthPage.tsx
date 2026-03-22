import { useEffect, useRef, useState } from 'react'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import BrandLogo from '@/components/BrandLogo'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/i18n'
import { useSEO, getSeoPages } from '@/hooks'
import { supabase } from '@/lib/supabase'

type AuthMode = 'login' | 'register' | 'recovery'
type AccountAuthMethod = 'google' | 'email' | 'both' | 'unknown' | 'not_found'

export default function AuthPage() {
  const MAX_LOGIN_ATTEMPTS = 5
  const LOGIN_ATTEMPT_WINDOW_MS = 2 * 60 * 1000
  const LOGIN_LOCKOUT_MS = 60 * 1000
  const API_BASE_URL = import.meta.env.PROD
    ? ''
    : import.meta.env.VITE_API_URL || 'http://localhost:3001'

  const getAuthUrlState = () => {
    const url = new URL(window.location.href)
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
    const searchType = url.searchParams.get('type')
    const hashType = hashParams.get('type')
    const authHint = url.searchParams.get('auth_hint')
    const isRecovery = searchType === 'recovery' || hashType === 'recovery'

    return { isRecovery, authHint }
  }

  const [mode, setMode] = useState<AuthMode>(() => (getAuthUrlState().isRecovery ? 'recovery' : 'login'))
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loginLockedUntil, setLoginLockedUntil] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const failedLoginAttemptsRef = useRef<number[]>([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register, loginWithGoogle, requestPasswordReset } = useAuth()
  const { t } = useLanguage()
  const featureTags = [
    t.home.features.textToVideo.title,
    t.home.features.imageToVideo.title,
    t.home.features.textToImage.title,
    t.imageToImage.transformTypes.styleTransfer,
  ]

  const looksLikeInvalidCredentialsError = (message: string) => {
    const normalized = message.toLowerCase()
    return (
      normalized.includes('invalid login credentials') ||
      normalized.includes('invalid credentials') ||
      normalized.includes('credenciais inválidas') ||
      normalized.includes('credenciales inválidas')
    )
  }

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const getAccountAuthMethod = async (email: string): Promise<AccountAuthMethod> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/account-method?email=${encodeURIComponent(email)}`)
      if (!response.ok) {
        return 'unknown'
      }

      const data = (await response.json()) as { method?: AccountAuthMethod }
      return data.method || 'unknown'
    } catch {
      return 'unknown'
    }
  }

  useEffect(() => {
    const { isRecovery, authHint } = getAuthUrlState()

    if (isRecovery) {
      setMode('recovery')
      setErrorMessage(null)
      setSuccessMessage(null)
      setInfoMessage(null)
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }))
    }

    if (authHint === 'password') {
      setInfoMessage(t.auth.loginMethodHintPassword)
    }
  }, [location.search, location.hash, t.auth.loginMethodHintPassword])

  // SEO meta tags
  const seoPages = getSeoPages(t)
  useSEO({
    ...seoPages.auth,
    hreflang: {
      'pt-BR': '/auth?lang=pt',
      en: '/auth?lang=en',
      es: '/auth?lang=es',
      'x-default': '/auth',
    },
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: seoPages.auth.title,
      description: seoPages.auth.description,
      url: `${window.location.origin}/auth`,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Lumivids',
        url: window.location.origin,
      },
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'login' && Date.now() < loginLockedUntil) {
      setErrorMessage(t.errors.rateLimitExceeded)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    setInfoMessage(null)

    try {
      if (mode === 'recovery') {
        if (!formData.password || formData.password.length < 8) {
          throw new Error(t.settings.security.errorInvalidPassword)
        }

        if (formData.password !== formData.confirmPassword) {
          throw new Error(t.settings.security.errorMismatch)
        }

        const { error } = await supabase.auth.updateUser({ password: formData.password })
        if (error) {
          throw error
        }

        setSuccessMessage(t.auth.passwordResetSuccess)
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }))
        setTimeout(() => navigate('/home'), 1200)
        return
      }

      if (mode === 'login') {
        await login(formData.email, formData.password)
        failedLoginAttemptsRef.current = []
        setLoginLockedUntil(0)
      } else {
        if (!formData.password || formData.password.length < 8) {
          throw new Error(t.settings.security.errorInvalidPassword)
        }

        if (formData.password !== formData.confirmPassword) {
          throw new Error(t.settings.security.errorMismatch)
        }

        await register(formData.name, formData.email, formData.password)
      }
      const from = (location.state as { from?: string } | undefined)?.from
      navigate(from || '/home')
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : t.errors.generic
      setErrorMessage(message)

      if (mode === 'login' && looksLikeInvalidCredentialsError(message)) {
        const now = Date.now()
        const recentAttempts = failedLoginAttemptsRef.current.filter(
          (timestamp) => now - timestamp <= LOGIN_ATTEMPT_WINDOW_MS,
        )
        recentAttempts.push(now)
        failedLoginAttemptsRef.current = recentAttempts

        if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
          setLoginLockedUntil(now + LOGIN_LOCKOUT_MS)
          setErrorMessage(t.errors.rateLimitExceeded)
          setInfoMessage(null)
          return
        }

        setInfoMessage(t.auth.loginMethodHintGoogle)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    setInfoMessage(null)
    try {
      await loginWithGoogle()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t.errors.generic)
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const email = formData.email.trim()
    setErrorMessage(null)
    setSuccessMessage(null)
    setInfoMessage(null)

    if (!email) {
      setErrorMessage(t.auth.forgotPasswordEmailRequired)
      return
    }

    if (!isValidEmail(email)) {
      setErrorMessage(t.auth.forgotPasswordEmailInvalid)
      return
    }

    setIsLoading(true)
    try {
      const accountMethod = await getAccountAuthMethod(email)

      if (accountMethod === 'google') {
        setInfoMessage(t.auth.forgotPasswordGoogleOnly)
        return
      }

      await requestPasswordReset(email)

      if (accountMethod === 'both') {
        setInfoMessage(t.auth.forgotPasswordBothMethods)
      } else if (accountMethod === 'email') {
        setInfoMessage(t.auth.forgotPasswordEmailMethod)
      }

      setSuccessMessage(t.auth.forgotPasswordEmailSent)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t.auth.forgotPasswordEmailFailed)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-accent-500/20" />
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary-500/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent-500/30 rounded-full blur-3xl" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3 mb-8">
            <BrandLogo
              iconClassName="w-14 h-14 object-contain shrink-0"
              textClassName="text-4xl font-bold gradient-text"
            />
          </Link>

          <h1 className="text-5xl font-bold text-white mb-6">
            {t.home.title}
          </h1>
          <p className="text-xl text-dark-300 mb-8 max-w-lg">
            {t.home.subtitle}
          </p>

          <div className="flex flex-wrap gap-3">
            {featureTags.map((feature) => (
              <span
                key={feature}
                className="px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                {mode === 'login' ? t.auth.loginTitle : mode === 'register' ? t.auth.registerTitle : t.auth.resetPasswordTitle}
              </h2>
              <p className="text-dark-400 mt-2">
                {mode === 'login'
                  ? t.auth.loginSubtitle
                  : mode === 'register'
                    ? t.auth.registerSubtitle
                    : t.auth.resetPasswordSubtitle}
              </p>
            </div>

            {/* Google Button */}
            {mode !== 'recovery' && (
              <>
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-gray-100 transition-colors disabled:opacity-60"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-gray-800 font-medium">{mode === 'register' ? t.auth.googleRegisterButton : t.auth.googleLoginButton}</span>
                </button>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dark-700" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-dark-900 text-dark-400 text-sm">{t.auth.orSignInWithEmail}</span>
                  </div>
                </div>
              </>
            )}

            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-300 text-sm">
                {successMessage}
              </div>
            )}

            {infoMessage && (
              <div className="mb-4 rounded-xl border border-primary-500/40 bg-primary-500/10 px-4 py-3 text-primary-200 text-sm">
                {infoMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">{t.auth.nameLabel}</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t.auth.namePlaceholder}
                      className="input-field pl-12"
                      required
                    />
                  </div>
                </div>
              )}

              {mode !== 'recovery' && (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">{t.auth.emailLabel}</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder={t.auth.emailPlaceholder}
                      className="input-field pl-12"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  {mode === 'recovery' ? t.settings.security.newPasswordLabel : t.auth.passwordLabel}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={t.auth.passwordPlaceholder}
                    className="input-field pl-12 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {(mode === 'register' || mode === 'recovery') && (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">{t.auth.confirmPasswordLabel}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder={t.auth.passwordPlaceholder}
                      className="input-field pl-12 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {mode === 'login' ? t.auth.loginButton : mode === 'register' ? t.auth.registerButton : t.auth.resetPasswordButton}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {mode !== 'recovery' && (
              <div className="mt-6 text-center text-sm text-dark-400">
                {mode === 'login' ? t.auth.noAccount : t.auth.hasAccount}{' '}
                <button
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login')
                    setErrorMessage(null)
                    setSuccessMessage(null)
                    setInfoMessage(null)
                    setFormData({ name: '', email: '', password: '', confirmPassword: '' })
                  }}
                  className="text-primary-400 hover:text-primary-300 font-medium"
                >
                  {mode === 'login' ? t.auth.registerButton : t.auth.loginButton}
                </button>
              </div>
            )}

            {mode === 'login' && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                  className="text-dark-400 text-sm hover:text-white underline transition-colors disabled:opacity-50"
                >
                  {t.auth.forgotPassword}
                </button>
              </div>
            )}

            {mode === 'recovery' && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setErrorMessage(null)
                    setSuccessMessage(null)
                    setInfoMessage(null)
                    setFormData({ name: '', email: '', password: '', confirmPassword: '' })
                    navigate('/auth', { replace: true })
                  }}
                  className="text-dark-400 text-sm hover:text-white underline transition-colors"
                >
                  {t.auth.loginButton}
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-dark-500 mt-6">
            {t.auth.termsAgree}{' '}
            <Link to="/terms" className="text-primary-400 hover:text-primary-300 underline">
              {t.auth.terms}
            </Link>{' '}
            {t.auth.and}{' '}
            <Link to="/privacy" className="text-primary-400 hover:text-primary-300 underline">
              {t.auth.privacy}
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CreditsProvider } from './contexts/CreditsContext'
import { GenerationsProvider } from './contexts/GenerationsContext'
import { FeatureFlagsProvider, useFeatureFlags } from './contexts/FeatureFlagsContext'
import { LanguageProvider, useLanguage } from './i18n'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { trackEvent } from './services/analytics'

const MainLayout = lazy(() => import('./components/layout/MainLayout'))
const HomePage = lazy(() => import('./pages/HomePage'))
const TextToVideoPage = lazy(() => import('./pages/TextToVideoPage'))
const ImageToVideoPage = lazy(() => import('./pages/ImageToVideoPage'))
const TextToImagePage = lazy(() => import('./pages/TextToImagePage'))
const ImageToImagePage = lazy(() => import('./pages/ImageToImagePage'))
const MyVideosPage = lazy(() => import('./pages/MyVideos'))
const MyAccountPage = lazy(() => import('./pages/MyAccountPage'))
const MyFavoritesPage = lazy(() => import('./pages/MyFavoritesPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const PublicPricingPage = lazy(() => import('./pages/PublicPricingPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const PreferencesPage = lazy(() => import('./pages/PreferencesPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const SecurityPage = lazy(() => import('./pages/SecurityPage'))
const UsageHistoryPage = lazy(() => import('./pages/UsageHistoryPage'))
const SupportPage = lazy(() => import('./pages/SupportPage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

function LoadingScreen() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center">
      <span className="text-dark-300 text-sm">{t.common.loading}</span>
    </div>
  )
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()
  if (isLoading) {
    return <LoadingScreen />
  }
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/home" replace />
  }
  return <>{children}</>
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) {
    return <LoadingScreen />
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" state={{ from: location.pathname }} replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  const forceAuth = new URLSearchParams(location.search).get('force') === '1'
  if (isLoading) {
    return <LoadingScreen />
  }
  if (forceAuth) {
    return <>{children}</>
  }
  return !isAuthenticated ? <>{children}</> : <Navigate to="/home" replace />
}

function NotFoundRedirect() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return <LoadingScreen />
  }
  return <Navigate to={isAuthenticated ? '/home' : '/'} replace />
}

function FeatureFlagRoute({ featureKey, children }: { featureKey: string; children: React.ReactNode }) {
  const { isEnabled, isLoading } = useFeatureFlags()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isEnabled(featureKey, true)) {
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}

function PageBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

function LegacyAuthRedirect({ targetPath }: { targetPath: string }) {
  const location = useLocation()
  return <Navigate to={`${targetPath}${location.search}${location.hash}`} replace />
}

function RoutePageViewTracker() {
  const location = useLocation()

  useEffect(() => {
    trackEvent('page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${location.pathname}${location.search}`,
    })
  }, [location.pathname, location.search])

  return null
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public Routes (No Auth Required) */}
        <Route path="/" element={<PageBoundary><LandingPage /></PageBoundary>} />
        <Route path="/landing" element={<Navigate to="/" />} />
        <Route path="/plans" element={<PageBoundary><PublicPricingPage /></PageBoundary>} />
        <Route path="/privacy" element={<PageBoundary><PrivacyPolicyPage /></PageBoundary>} />
        <Route path="/terms" element={<PageBoundary><TermsOfServicePage /></PageBoundary>} />

        {/* Public App Entry */}
        <Route element={<PageBoundary><MainLayout /></PageBoundary>}>
          <Route path="/text-to-video" element={<PageBoundary><TextToVideoPage /></PageBoundary>} />
          <Route path="/image-to-video" element={<PageBoundary><ImageToVideoPage /></PageBoundary>} />
          <Route path="/text-to-image" element={<PageBoundary><TextToImagePage /></PageBoundary>} />
          <Route path="/image-to-image" element={<PageBoundary><ImageToImagePage /></PageBoundary>} />
        </Route>
        
        <Route path="/auth/callback" element={<PageBoundary><AuthCallbackPage /></PageBoundary>} />
        <Route path="/auth1/callback" element={<LegacyAuthRedirect targetPath="/auth/callback" />} />
        <Route
          path="/auth"
          element={
            <PageBoundary>
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            </PageBoundary>
          }
        />
        <Route path="/auth1" element={<LegacyAuthRedirect targetPath="/auth" />} />

        {/* Private Routes */}
        <Route
          element={
            <PageBoundary>
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            </PageBoundary>
          }
        >
          <Route path="/home" element={<PageBoundary><HomePage /></PageBoundary>} />
          <Route path="/my-videos" element={<PageBoundary><MyVideosPage /></PageBoundary>} />
          <Route path="/my-account" element={<PageBoundary><MyAccountPage /></PageBoundary>} />
          <Route path="/settings/preferences" element={<PageBoundary><PreferencesPage /></PageBoundary>} />
          <Route path="/settings/notifications" element={<PageBoundary><NotificationsPage /></PageBoundary>} />
          <Route path="/settings/security" element={<PageBoundary><SecurityPage /></PageBoundary>} />
          <Route path="/settings/payment" element={<Navigate to="/pricing" replace />} />
          <Route path="/usage-history" element={<PageBoundary><UsageHistoryPage /></PageBoundary>} />
          <Route path="/my-favorites" element={<PageBoundary><MyFavoritesPage /></PageBoundary>} />
          <Route path="/pricing" element={<PageBoundary><PricingPage /></PageBoundary>} />
          <Route
            path="/support"
            element={
              <PageBoundary>
                <FeatureFlagRoute featureKey="support_center">
                  <SupportPage />
                </FeatureFlagRoute>
              </PageBoundary>
            }
          />
          <Route path="/admin" element={<PageBoundary><AdminRoute><AdminDashboard /></AdminRoute></PageBoundary>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<NotFoundRedirect />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <RoutePageViewTracker />
      <LanguageProvider>
        <AuthProvider>
          <FeatureFlagsProvider>
            <ToastProvider>
              <CreditsProvider>
                <GenerationsProvider>
                  <AppRoutes />
                </GenerationsProvider>
              </CreditsProvider>
            </ToastProvider>
          </FeatureFlagsProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}

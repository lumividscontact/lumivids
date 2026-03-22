import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Video,
  Image,
  ImagePlus,
  Layers,
  FolderOpen,
  User,
  Heart,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Zap,
  X,
  Shield,
  LifeBuoy,
} from 'lucide-react'
import { memo, useEffect, useMemo, useState } from 'react'
import BrandLogo from '@/components/BrandLogo'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext'
import { useLanguage } from '@/i18n'

type NavKey = 'home' | 'textToVideo' | 'imageToVideo' | 'textToImage' | 'imageToImage' | 'myVideos' | 'myFavorites' | 'myAccount' | 'pricing' | 'support'

const navigation: { key: NavKey; href: string; icon: typeof Home }[] = [
  { key: 'home', href: '/home', icon: Home },
  { key: 'textToVideo', href: '/text-to-video', icon: Video },
  { key: 'imageToVideo', href: '/image-to-video', icon: Layers },
  { key: 'textToImage', href: '/text-to-image', icon: ImagePlus },
  { key: 'imageToImage', href: '/image-to-image', icon: Image },
  { key: 'myVideos', href: '/my-videos', icon: FolderOpen },
  { key: 'myFavorites', href: '/my-favorites', icon: Heart },
  { key: 'myAccount', href: '/my-account', icon: User },
  { key: 'pricing', href: '/pricing', icon: CreditCard },
  { key: 'support', href: '/support', icon: LifeBuoy },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const SIDEBAR_COLLAPSED_KEY = 'lumivids_sidebar_collapsed'

const SidebarNavigation = memo(function SidebarNavigation({
  collapsed,
  onClose,
  pathname,
}: {
  collapsed: boolean
  onClose: () => void
  pathname: string
}) {
  const { isAdmin } = useAuth()
  const { isEnabled } = useFeatureFlags()
  const { t } = useLanguage()

  const supportEnabled = isEnabled('support_center', true)
  const visibleNavigation = useMemo(
    () => navigation.filter((item) => item.key !== 'support' || supportEnabled),
    [supportEnabled]
  )

  return (
    <nav className="flex-1 min-h-0 p-3 space-y-1 overflow-y-auto">
      {visibleNavigation.map((item) => {
        const isActive = pathname === item.href
        const name = t.nav[item.key]
        return (
          <Link
            key={item.key}
            to={item.href}
            onClick={onClose}
            className={`${isActive ? 'sidebar-link-active' : 'sidebar-link'} px-3 py-2 text-sm`}
            title={collapsed ? name : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{name}</span>}
          </Link>
        )
      })}

      {isAdmin && (
        <>
          <div className="my-2 border-t border-dark-800" />
          <Link
            to="/admin"
            onClick={onClose}
            className={`${pathname === '/admin' ? 'sidebar-link-active' : 'sidebar-link'} px-3 py-2 text-sm`}
            title={collapsed ? t.admin.title : undefined}
          >
            <Shield className="w-5 h-5 flex-shrink-0 text-red-400" />
            {!collapsed && <span className="text-red-400 font-medium">{t.admin.title}</span>}
          </Link>
        </>
      )}
    </nav>
  )
})

const SidebarUserSection = memo(function SidebarUserSection({
  collapsed,
  onClose,
}: {
  collapsed: boolean
  onClose: () => void
}) {
  const { user, logout } = useAuth()
  const { credits, currentPlan } = useCredits()
  const { t } = useLanguage()

  return (
    <div className="p-3 border-t border-dark-800 flex-none">
      {user && !collapsed && (
        <Link
          to="/pricing"
          onClick={onClose}
          className="mb-4 p-3 rounded-xl bg-gradient-to-r from-primary-500/20 to-accent-500/20 
                       border border-primary-500/30 hover:border-primary-500/50 transition-colors block"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-dark-400 uppercase tracking-wide">{t.common.credits}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 font-medium">
              {currentPlan.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-400" />
            <span className="text-2xl font-bold text-white">{credits}</span>
          </div>
          <div className="mt-2 text-xs text-primary-400 flex items-center gap-1">
            <span>{t.common.upgradeAvailable}</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </Link>
      )}

      {user && collapsed && (
        <Link
          to="/pricing"
          onClick={onClose}
          className="mb-4 p-2 rounded-xl bg-gradient-to-r from-primary-500/20 to-accent-500/20 
                       border border-primary-500/30 hover:border-primary-500/50 transition-colors 
                       flex flex-col items-center justify-center"
          title={`${credits} ${t.common.credits}`}
        >
          <Zap className="w-5 h-5 text-primary-400" />
          <span className="text-xs font-bold text-white mt-1">{credits}</span>
        </Link>
      )}

      {!collapsed && user && (
        <div className="mb-4 p-3 rounded-xl bg-dark-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.name.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.name}
              </p>
              <p className="text-xs text-dark-400">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      )}

      {!user && !collapsed && (
        <Link
          to="/auth?force=1"
          onClick={onClose}
          className="btn-primary w-full justify-center px-3 py-2 text-sm inline-flex items-center gap-2"
        >
          {t.auth.login}
        </Link>
      )}

      {user && (
        <button
          onClick={logout}
          className="sidebar-link w-full justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 text-sm"
          title={collapsed ? t.nav.logout : undefined}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>{t.nav.logout}</span>}
        </button>
      )}
    </div>
  )
})

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  })
  const location = useLocation()

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-dark-900/95 lg:bg-dark-900/80 backdrop-blur-xl border-r border-dark-800 
                  transition-all duration-300 z-50 flex flex-col overflow-hidden
                  ${collapsed ? 'lg:w-20' : 'lg:w-64'} w-64
                  ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-dark-800 flex-none">
        <div className="flex items-center gap-3">
          <BrandLogo
            iconClassName="w-10 h-10 object-contain shrink-0"
            textClassName="text-xl font-bold gradient-text"
            showText={!collapsed}
          />
        </div>
        {/* Close button for mobile */}
        <button 
          onClick={onClose}
          className="lg:hidden p-2 rounded-xl hover:bg-dark-800 transition-colors"
        >
          <X className="w-5 h-5 text-dark-400" />
        </button>
      </div>

      <SidebarNavigation collapsed={collapsed} onClose={onClose} pathname={location.pathname} />

      <SidebarUserSection collapsed={collapsed} onClose={onClose} />

      {/* Collapse Button - hidden on mobile */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full 
                   bg-dark-800 border border-dark-700 items-center justify-center 
                   hover:bg-dark-700 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  )
}

export default memo(Sidebar)

import { Bell, Search, Zap, Menu, X } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'
import { useLanguage } from '@/i18n'
import LanguageSelector from '@/components/LanguageSelector'
import { ActiveGenerations } from '@/components/ActiveGenerations'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { credits } = useCredits()
  const { t } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)

  const searchRoutes = useMemo(
    () => [
      { path: '/home', keywords: ['home', 'início', 'inicio', 'inicio', 'casa', 'inicio'] },
      { path: '/plans', keywords: ['plan', 'plans', 'pricing', 'preço', 'precos', 'precios', 'assinatura', 'subscription'] },
      { path: '/my-videos', keywords: ['videos', 'vídeos', 'video', 'my videos', 'minhas criações', 'mis videos'] },
      { path: '/my-favorites', keywords: ['favorites', 'favoritos', 'favourites', 'meus favoritos', 'mis favoritos'] },
      { path: '/my-account', keywords: ['account', 'conta', 'perfil', 'profile'] },
      { path: '/text-to-video', keywords: ['text to video', 'texto para vídeo', 'texto para video', 'seedance', 'kling', 'hailuo', 'wan', 'veo', 'sora'] },
      { path: '/image-to-video', keywords: ['image to video', 'imagem para vídeo', 'imagem para video'] },
      { path: '/text-to-image', keywords: ['text to image', 'texto para imagem', 'flux', 'imagen', 'ideogram', 'seedream', 'nano banana'] },
      { path: '/image-to-image', keywords: ['image to image', 'imagem para imagem', 'upscale'] },
      { path: '/settings/notifications', keywords: ['notifications', 'notificações', 'notificaciones', 'alertas'] },
    ],
    []
  )

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const query = searchQuery.trim().toLowerCase()
    if (!query) return

    const directMatch = searchRoutes.find((item) =>
      item.keywords.some((keyword) => query.includes(keyword))
    )

    if (directMatch) {
      navigate(directMatch.path)
      setIsMobileSearchOpen(false)
      return
    }

    navigate(`/my-videos?search=${encodeURIComponent(searchQuery.trim())}`)
    setIsMobileSearchOpen(false)
  }

  return (
    <header className="relative z-50 h-16 bg-dark-900/50 backdrop-blur-xl border-b border-dark-800 flex items-center justify-between px-4 md:px-6">
      {/* Mobile Menu Button */}
      <button 
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl hover:bg-dark-800 transition-colors mr-2"
      >
        <Menu className="w-6 h-6 text-dark-300" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-xl hidden sm:block">
        <form className="relative" onSubmit={handleSearch}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
          <input
            type="text"
            placeholder={t.common.search + '...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-800/50 border border-dark-700 rounded-xl pl-12 pr-4 py-2.5 
                       text-white placeholder-dark-400 focus:outline-none focus:border-primary-500 
                       focus:ring-2 focus:ring-primary-500/20 transition-all"
          />
        </form>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 md:gap-4 ml-auto">
        {/* Mobile Search Toggle */}
        <button
          type="button"
          onClick={() => setIsMobileSearchOpen((prev) => !prev)}
          className="sm:hidden p-2 rounded-xl hover:bg-dark-800 transition-colors"
          aria-label={t.common.search}
        >
          {isMobileSearchOpen ? <X className="w-5 h-5 text-dark-300" /> : <Search className="w-5 h-5 text-dark-300" />}
        </button>

        {/* Active Generations */}
        <ActiveGenerations />

        {/* Language Selector */}
        <LanguageSelector />

        {user ? (
          <>
            {/* Credits - compact on mobile */}
            <div className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-xl bg-gradient-to-r from-primary-500/20 to-accent-500/20 border border-primary-500/30">
              <Zap className="w-4 h-4 text-primary-400" />
              <span className="text-xs md:text-sm font-medium text-white">
                <span className="hidden md:inline">{credits} {t.common.credits}</span>
                <span className="md:hidden">{credits}</span>
              </span>
            </div>

            {/* Notifications - hidden on mobile */}
            <button
              onClick={() => navigate('/settings/notifications')}
              className="relative p-2 rounded-xl hover:bg-dark-800 transition-colors hidden md:block"
              aria-label={t.settings.notifications.title}
            >
              <Bell className="w-5 h-5 text-dark-300" />
            </button>

            {/* User Avatar */}
            <button
              onClick={() => navigate('/my-account')}
              className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center"
              aria-label={t.myAccount.title}
            >
              <span className="text-white font-semibold text-sm md:text-base">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </button>
          </>
        ) : (
          <Link to="/auth?force=1" className="btn-primary px-4 py-2 text-sm">
            {t.auth.login}
          </Link>
        )}
      </div>

      {isMobileSearchOpen && (
        <div className="sm:hidden absolute left-0 right-0 top-full border-b border-dark-800 bg-dark-900/95 backdrop-blur-xl px-4 py-3">
          <form className="relative" onSubmit={handleSearch}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              autoFocus
              placeholder={t.common.search + '...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-800/50 border border-dark-700 rounded-xl pl-12 pr-4 py-2.5 
                         text-white placeholder-dark-400 focus:outline-none focus:border-primary-500 
                         focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
          </form>
        </div>
      )}
    </header>
  )
}

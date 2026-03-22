import { useState, useEffect, useCallback } from 'react'
import { Video, ImagePlus, Layers, Image, ArrowRight, Zap, Clock, Star, Sparkles, Heart, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/i18n'
import { useSEO, getSeoPages } from '@/hooks'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

interface RecentActivityItem {
  id: string
  type: 'video' | 'image'
  title: string
  time: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
}

const featuredVideos = [
  {
    id: 1,
    title: 'Cosmic Journey',
    prompt: '"A spaceship traveling through a colorful nebula, cinematic lighting, 4K"',
    model: 'Kling 2.1',
    modelId: 'kling-v2.5-turbo-pro',
    likes: '1.247',
    videoUrl: 'https://lumivids.com/videos/nave-espacial.mp4',
  },
  {
    id: 2,
    title: 'Ocean Dreams',
    prompt: '"Ethereal jellyfish floating in deep ocean, bioluminescent, dreamy atmosphere"',
    model: 'Seedance',
    modelId: 'seedance-1.5-pro',
    likes: '982',
    videoUrl: 'https://lumivids.com/videos/seedance-jellfish.mp4',
  },
  {
    id: 3,
    title: 'Neon City',
    prompt: '"Cyberpunk city at night, neon lights, rain, futuristic buildings, 4K"',
    model: 'Hailuo',
    modelId: 'hailuo-2.3',
    likes: '1.534',
    videoUrl: 'https://lumivids.com/videos/Hailuo_Video_Cyberpunk-city.mp4',
  },
  {
    id: 4,
    title: 'Nature Awakens',
    prompt: '"Beautiful flowers blooming in timelapse, macro photography, vibrant colors"',
    model: 'Wan',
    modelId: 'wan-2.6',
    likes: '876',
    videoUrl: 'https://lumivids.com/videos/wan-flowers.mp4',
  },
]

export default function HomePage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [activeVideoIndex, setActiveVideoIndex] = useState(0)
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([])
  const [isRecentActivityLoading, setIsRecentActivityLoading] = useState(true)
  
  // SEO meta tags
  useSEO(getSeoPages(t).home)

  // Auto-advance carousel every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveVideoIndex((prev) => (prev + 1) % featuredVideos.length)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  const formatRelativeTime = useCallback((dateString: string) => {
    const localeMap: Record<string, string> = {
      pt: 'pt-BR',
      en: 'en-US',
      es: 'es-ES',
    }

    const locale = localeMap[language] || 'en-US'
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    const diffMs = new Date(dateString).getTime() - Date.now()
    const diffSec = Math.round(diffMs / 1000)
    const absSec = Math.abs(diffSec)

    if (absSec < 60) return rtf.format(diffSec, 'second')

    const diffMin = Math.round(diffSec / 60)
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')

    const diffHour = Math.round(diffMin / 60)
    if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour')

    const diffDay = Math.round(diffHour / 24)
    return rtf.format(diffDay, 'day')
  }, [language])

  useEffect(() => {
    const loadRecentActivity = async () => {
      if (!user?.id) {
        setRecentActivity([])
        setIsRecentActivityLoading(false)
        return
      }

      if (!isSupabaseConfigured) {
        setRecentActivity([])
        setIsRecentActivityLoading(false)
        return
      }

      setIsRecentActivityLoading(true)

      const { data, error } = await supabase
        .from('generations')
        .select('id, type, prompt, model_name, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6)

      if (error) {
        console.error('Error loading recent activity:', error)
        setRecentActivity([])
        setIsRecentActivityLoading(false)
        return
      }

      const normalized = (data ?? []).map((item) => ({
        id: item.id,
        type: item.type.includes('video') ? 'video' : 'image',
        title: (item.prompt?.trim() || item.model_name || item.type).slice(0, 80),
        time: formatRelativeTime(item.created_at),
        status: item.status,
      }))

      setRecentActivity(normalized)
      setIsRecentActivityLoading(false)
    }

    loadRecentActivity()
  }, [user?.id, formatRelativeTime])

  const activeVideo = featuredVideos[activeVideoIndex]

  const goToPrevious = () => {
    setActiveVideoIndex((prev) => (prev - 1 + featuredVideos.length) % featuredVideos.length)
  }

  const goToNext = () => {
    setActiveVideoIndex((prev) => (prev + 1) % featuredVideos.length)
  }

  const getActivityStatusLabel = (status: RecentActivityItem['status']) => {
    if (status === 'starting' || status === 'processing') return t.status.processing
    if (status === 'succeeded') return t.status.succeeded
    if (status === 'failed') return t.status.failed || t.common.error
    return t.status.canceled || 'Canceled'
  }

  const quickActions = [
    {
      title: t.nav.textToVideo,
      description: t.home.features.textToVideo.description,
      icon: Video,
      href: '/text-to-video',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: t.nav.imageToVideo,
      description: t.home.features.imageToVideo.description,
      icon: Layers,
      href: '/image-to-video',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      title: t.nav.textToImage,
      description: t.home.features.textToImage.description,
      icon: ImagePlus,
      href: '/text-to-image',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      title: t.nav.imageToImage,
      description: t.home.features.imageToImage.description,
      icon: Image,
      href: '/image-to-image',
      gradient: 'from-green-500 to-emerald-500',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="card bg-gradient-to-r from-primary-500/10 to-accent-500/10 border-primary-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {t.home.welcome.greeting}, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-dark-300">
              {t.home.welcome.subtitle}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center">
              <div className="flex items-center gap-2 text-primary-400">
                <Zap className="w-5 h-5" />
                <span className="text-2xl font-bold">{user?.credits}</span>
              </div>
              <p className="text-sm text-dark-400">{t.common.credits}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-2 text-accent-400">
                <Star className="w-5 h-5" />
                <span className="text-2xl font-bold capitalize">{user?.plan}</span>
              </div>
              <p className="text-sm text-dark-400">{t.common.currentPlan}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Creation - Video Carousel */}
      <section className="card p-0 overflow-hidden">
        <div className="relative">
          {/* Main Video Player */}
          <div className="relative aspect-video md:aspect-[21/9] bg-dark-950">
            <video
              src={activeVideo.videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-950/90 via-dark-950/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-dark-950/80 via-transparent to-transparent" />

            {/* Navigation Arrows */}
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors z-20"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors z-20"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Content Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 mb-4">
                <Sparkles className="w-4 h-4 text-accent-400" />
                <span className="text-sm text-white/90 font-medium">{t.home.sections.featuredCreation}</span>
              </div>

              <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">
                {activeVideo.title}
              </h2>
              <p className="text-white/70 max-w-2xl mb-4 text-sm md:text-base">
                {activeVideo.prompt}
              </p>

              <div className="flex flex-wrap items-center gap-4 mb-5">
                <span className="px-3 py-1 rounded-full bg-white/10 text-white text-sm">{activeVideo.model}</span>
                <span className="flex items-center gap-2 text-white/80 text-sm">
                  <Heart className="w-4 h-4 text-pink-400" />
                  {activeVideo.likes}
                </span>
              </div>

              <Link to={`/text-to-video?model=${activeVideo.modelId}`} className="btn-primary inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {t.home.sections.createSimilar}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">{t.home.sections.create}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              to={action.href}
              className="card-hover group"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} 
                            flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              >
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">
                {action.title}
              </h3>
              <p className="text-sm text-dark-400 mb-4">{action.description}</p>
              <div className="flex items-center text-primary-400 text-sm font-medium">
                <span>{t.home.sections.startNow}</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">{t.home.sections.recentActivity}</h2>
        <div className="card space-y-4">
          {isRecentActivityLoading && (
            [...Array(3)].map((_, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-xl animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-dark-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/5 bg-dark-700 rounded" />
                  <div className="h-2.5 w-2/5 bg-dark-700 rounded" />
                </div>
                <div className="h-2.5 w-16 bg-dark-700 rounded" />
              </div>
            ))
          )}

          {!isRecentActivityLoading && recentActivity.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-dark-800/50 transition-colors"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  item.type === 'video'
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'bg-accent-500/20 text-accent-400'
                }`}
              >
                {item.type === 'video' ? <Video className="w-5 h-5" /> : <Image className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{item.title}</p>
                <p className="text-dark-400 text-xs">{item.time}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-dark-400 whitespace-nowrap">
                <Clock className="w-3 h-3" />
                <span>{getActivityStatusLabel(item.status)}</span>
              </div>
            </div>
          ))}

          {!isRecentActivityLoading && recentActivity.length === 0 && (
            <p className="text-sm text-dark-400 text-center py-4">—</p>
          )}

          <Link
            to="/my-videos"
            className="flex items-center justify-center gap-2 text-primary-400 text-sm font-medium hover:text-primary-300 transition-colors pt-2"
          >
            <span>{t.home.sections.viewAll}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { History, AlertCircle, Video, Image as ImageIcon, Camera } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/i18n'
import { formatDate } from '@/i18n/runtime'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { LoadingSpinner, SkeletonList } from '@/components/Loading'
import type { UsageStats } from '@/lib/database.types'

const formatDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

export default function UsageHistoryPage() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState<UsageStats[]>([])

  useEffect(() => {
    const loadUsage = async () => {
      if (!isSupabaseConfigured || !user?.id) {
        setUsage([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      const { data, error: usageError } = await supabase
        .from('usage_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(100)

      if (usageError) {
        console.error('[UsageHistory] Load error:', usageError)
        setError(usageError.message)
        setUsage([])
      } else {
        setUsage(data ?? [])
      }
      setLoading(false)
    }

    loadUsage()
  }, [user?.id])

  const typeLabels = useMemo(() => ({
    'text-to-video': t.myAccount.usage.actions.textToVideo,
    'image-to-video': t.myAccount.usage.actions.imageToVideo,
    'text-to-image': t.myAccount.usage.actions.textToImage,
    'image-to-image': t.myAccount.usage.actions.imageToImage,
  }), [t])

  const typeIcons = {
    'text-to-video': Video,
    'image-to-video': Camera,
    'text-to-image': ImageIcon,
    'image-to-image': ImageIcon,
  } as const

  const emptyState = !loading && usage.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <History className="w-8 h-8 text-primary-400" />
          {t.myAccount.usage.title}
        </h1>
        <p className="text-dark-400">
          {t.myAccount.usage.emptySubtitle}
        </p>
      </div>

      <div className="card">
        {loading && (
          <SkeletonList count={5} />
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {emptyState && (
          <div className="text-center py-10">
            <p className="text-white font-semibold mb-2">{t.myAccount.usage.emptyTitle}</p>
            <p className="text-dark-400">{t.myAccount.usage.emptySubtitle}</p>
          </div>
        )}

        {!loading && !error && usage.length > 0 && (
          <div className="space-y-3">
            {usage.map((item) => {
              const Icon = typeIcons[item.generation_type]
              const formattedDate = item.date
                ? formatDate(item.date, language, { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-dark-800/50 border border-dark-700">
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{typeLabels[item.generation_type]}</p>
                      <p className="text-xs text-dark-400">{formattedDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-dark-400">{t.ui.creditsLabel}</p>
                      <p className="text-sm font-semibold text-white">{item.credits_used}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-dark-400">{t.activeGenerations.generations}</p>
                      <p className="text-sm font-semibold text-white">{item.generation_count}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-dark-400">{t.textToVideo.durationLabel}</p>
                      <p className="text-sm font-semibold text-white">{formatDuration(item.total_duration_seconds)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

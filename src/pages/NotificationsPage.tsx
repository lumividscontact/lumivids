import { useEffect, useState } from 'react'
import { Bell, Mail, Smartphone, Sparkles } from 'lucide-react'
import { useLanguage } from '@/i18n'

const NOTIFICATIONS_KEY = 'lumivids-notifications'

type NotificationState = {
  emailUpdates: boolean
  emailPromotions: boolean
  pushGenerations: boolean
  pushBilling: boolean
}

const defaultNotifications: NotificationState = {
  emailUpdates: true,
  emailPromotions: false,
  pushGenerations: true,
  pushBilling: true,
}

export default function NotificationsPage() {
  const { t } = useLanguage()
  const [notifications, setNotifications] = useState<NotificationState>(defaultNotifications)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as NotificationState
        setNotifications({
          emailUpdates: parsed.emailUpdates ?? defaultNotifications.emailUpdates,
          emailPromotions: parsed.emailPromotions ?? defaultNotifications.emailPromotions,
          pushGenerations: parsed.pushGenerations ?? defaultNotifications.pushGenerations,
          pushBilling: parsed.pushBilling ?? defaultNotifications.pushBilling,
        })
      } catch {
        setNotifications(defaultNotifications)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications))
    setSaved(true)
    const timeout = setTimeout(() => setSaved(false), 1500)
    return () => clearTimeout(timeout)
  }, [notifications])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Bell className="w-8 h-8 text-primary-400" />
          {t.settings.notifications.title}
        </h1>
        <p className="text-dark-400">
          {t.settings.notifications.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary-400" />
              {t.settings.notifications.emailTitle}
            </h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-800/40">
                <div>
                  <p className="font-medium text-white">{t.settings.notifications.emailUpdatesTitle}</p>
                  <p className="text-sm text-dark-400">{t.settings.notifications.emailUpdatesDescription}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.emailUpdates}
                  onChange={(event) =>
                    setNotifications((prev) => ({ ...prev, emailUpdates: event.target.checked }))
                  }
                  className="h-5 w-5"
                />
              </label>
              <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-800/40">
                <div>
                  <p className="font-medium text-white">{t.settings.notifications.emailPromotionsTitle}</p>
                  <p className="text-sm text-dark-400">{t.settings.notifications.emailPromotionsDescription}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.emailPromotions}
                  onChange={(event) =>
                    setNotifications((prev) => ({ ...prev, emailPromotions: event.target.checked }))
                  }
                  className="h-5 w-5"
                />
              </label>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary-400" />
              {t.settings.notifications.pushTitle}
            </h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-800/40">
                <div>
                  <p className="font-medium text-white">{t.settings.notifications.pushGenerationsTitle}</p>
                  <p className="text-sm text-dark-400">{t.settings.notifications.pushGenerationsDescription}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.pushGenerations}
                  onChange={(event) =>
                    setNotifications((prev) => ({ ...prev, pushGenerations: event.target.checked }))
                  }
                  className="h-5 w-5"
                />
              </label>
              <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-800/40">
                <div>
                  <p className="font-medium text-white">{t.settings.notifications.pushBillingTitle}</p>
                  <p className="text-sm text-dark-400">{t.settings.notifications.pushBillingDescription}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.pushBilling}
                  onChange={(event) =>
                    setNotifications((prev) => ({ ...prev, pushBilling: event.target.checked }))
                  }
                  className="h-5 w-5"
                />
              </label>
            </div>
            {saved && (
              <p className="mt-3 text-sm text-green-400">{t.settings.notifications.saved}</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card bg-gradient-to-br from-primary-500/10 to-accent-500/10 border-primary-500/30">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="w-5 h-5 text-accent-400" />
              <h3 className="font-semibold text-white">{t.settings.notifications.tipTitle}</h3>
            </div>
            <p className="text-sm text-dark-300">
              {t.settings.notifications.tipText}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

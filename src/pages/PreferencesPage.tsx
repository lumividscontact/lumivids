import { useState, useEffect } from 'react'
import { Sliders, Sparkles, Monitor, Languages } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { useLanguage } from '@/i18n'

const PREFS_KEY = 'lumivids-preferences'

type PreferencesState = {
  autoplayPreviews: boolean
  reduceMotion: boolean
  compactMode: boolean
}

const defaultPreferences: PreferencesState = {
  autoplayPreviews: true,
  reduceMotion: false,
  compactMode: false,
}

export default function PreferencesPage() {
  const { t } = useLanguage()
  const [preferences, setPreferences] = useState<PreferencesState>(defaultPreferences)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PreferencesState
        setPreferences({
          autoplayPreviews: parsed.autoplayPreviews ?? defaultPreferences.autoplayPreviews,
          reduceMotion: parsed.reduceMotion ?? defaultPreferences.reduceMotion,
          compactMode: parsed.compactMode ?? defaultPreferences.compactMode,
        })
      } catch {
        setPreferences(defaultPreferences)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences))
    setSaved(true)
    const timeout = setTimeout(() => setSaved(false), 1500)
    return () => clearTimeout(timeout)
  }, [preferences])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Sliders className="w-8 h-8 text-primary-400" />
          {t.settings.preferences.title}
        </h1>
        <p className="text-dark-400">
          {t.settings.preferences.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary-400" />
              {t.settings.preferences.experienceTitle}
            </h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-800/40">
                <div>
                  <p className="font-medium text-white">{t.settings.preferences.autoplayTitle}</p>
                  <p className="text-sm text-dark-400">{t.settings.preferences.autoplayDescription}</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.autoplayPreviews}
                  onChange={(event) =>
                    setPreferences((prev) => ({ ...prev, autoplayPreviews: event.target.checked }))
                  }
                  className="h-5 w-5"
                />
              </label>
              <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-800/40">
                <div>
                  <p className="font-medium text-white">{t.settings.preferences.reduceMotionTitle}</p>
                  <p className="text-sm text-dark-400">{t.settings.preferences.reduceMotionDescription}</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.reduceMotion}
                  onChange={(event) =>
                    setPreferences((prev) => ({ ...prev, reduceMotion: event.target.checked }))
                  }
                  className="h-5 w-5"
                />
              </label>
              <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-800/40">
                <div>
                  <p className="font-medium text-white">{t.settings.preferences.compactTitle}</p>
                  <p className="text-sm text-dark-400">{t.settings.preferences.compactDescription}</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.compactMode}
                  onChange={(event) =>
                    setPreferences((prev) => ({ ...prev, compactMode: event.target.checked }))
                  }
                  className="h-5 w-5"
                />
              </label>
            </div>
            {saved && (
              <p className="mt-3 text-sm text-green-400">{t.settings.preferences.saved}</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Languages className="w-5 h-5 text-primary-400" />
              {t.settings.preferences.languageTitle}
            </h2>
            <p className="text-sm text-dark-400 mb-4">
              {t.settings.preferences.languageSubtitle}
            </p>
            <LanguageSelector />
          </div>

          <div className="card bg-gradient-to-br from-primary-500/10 to-accent-500/10 border-primary-500/30">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="w-5 h-5 text-accent-400" />
              <h3 className="font-semibold text-white">{t.settings.preferences.tipTitle}</h3>
            </div>
            <p className="text-sm text-dark-300">
              {t.settings.preferences.tipText}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

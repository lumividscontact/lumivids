import { Clock3, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCredits } from '@/contexts/CreditsContext'
import { useLanguage } from '@/i18n'

interface FreemiumDailyStatusProps {
  className?: string
  currentCost?: number
}

export default function FreemiumDailyStatus({ className = '', currentCost = 0 }: FreemiumDailyStatusProps) {
  const { freemium } = useCredits()
  const { t } = useLanguage()
  const navigate = useNavigate()

  if (!freemium?.isEligible) {
    return null
  }

  const blockedByCost = currentCost > 0 && freemium.remainingToday < currentCost
  const isWarning = freemium.isLimitReached || blockedByCost || freemium.bonusCapReached

  return (
    <div className={`rounded-xl border p-3 ${isWarning ? 'border-amber-500/40 bg-amber-500/10' : 'border-primary-500/30 bg-primary-500/10'} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{t.freemium.dailyCreditsTitle}</p>
          <p className="text-xs text-dark-300 mt-1">
            {t.freemium.dailyUsageSummary
              .replace('{remaining}', String(freemium.remainingToday))
              .replace('{limit}', String(freemium.dailyLimit))}
          </p>
          {/* Bonus days progress */}
          <p className="text-xs text-dark-400 mt-0.5">
            {t.freemium.bonusDaysInfo
              .replace('{used}', String(freemium.bonusDaysUsed))
              .replace('{max}', String(freemium.bonusDaysMax))}
          </p>
          {(freemium.isLimitReached || blockedByCost) && !freemium.bonusCapReached && (
            <p className="text-xs text-amber-300 mt-1">{t.freemium.limitReachedHint}</p>
          )}
          {freemium.bonusCapReached && (
            <p className="text-xs text-amber-300 mt-1">
              {t.freemium.bonusCapReachedHint.replace('{max}', String(freemium.bonusDaysMax))}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 text-primary-300 shrink-0">
          <Zap className="w-4 h-4" />
          <span className="text-sm font-semibold">{freemium.remainingToday}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {!freemium.bonusCapReached && (
          <span className="inline-flex items-center gap-1 text-xs text-dark-400">
            <Clock3 className="w-3 h-3" />
            {t.freemium.resetsDaily}
          </span>
        )}

        {isWarning && (
          <button
            type="button"
            onClick={() => navigate('/pricing')}
            className="text-xs px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors ml-auto"
          >
            {t.freemium.upgradeToContinue}
          </button>
        )}
      </div>
    </div>
  )
}

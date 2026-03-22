import { AlertTriangle, Zap } from 'lucide-react'

interface CreditsCardProps {
  title: string
  currentCredits: number
  creditsRemainingLabel: string
  isLowCredits: boolean
  lowCreditsWarning: string
  creditsPercentage: number
  buyMoreLabel: string
  onBuyMore: () => void
}

export function CreditsCard({
  title,
  currentCredits,
  creditsRemainingLabel,
  isLowCredits,
  lowCreditsWarning,
  creditsPercentage,
  buyMoreLabel,
  onBuyMore,
}: CreditsCardProps) {
  return (
    <div className={`card border-primary-500/30 ${isLowCredits ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20' : 'bg-gradient-to-br from-primary-500/20 to-accent-500/20'}`}>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLowCredits ? 'bg-red-500/30' : 'bg-primary-500/30'}`}>
          {isLowCredits ? (
            <AlertTriangle className="w-6 h-6 text-red-400" />
          ) : (
            <Zap className="w-6 h-6 text-primary-400" />
          )}
        </div>
        <div>
          <p className="text-sm text-dark-300">{title}</p>
          <p className={`text-3xl font-bold ${isLowCredits ? 'text-red-400' : 'text-white'}`}>{currentCredits}</p>
          <p className="text-xs text-dark-300 mt-1">{creditsRemainingLabel}</p>
        </div>
      </div>
      {isLowCredits && (
        <p className="text-sm text-red-400 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {lowCreditsWarning}
        </p>
      )}
      <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${isLowCredits ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-primary-500 to-accent-500'}`}
          style={{ width: `${Math.min(creditsPercentage, 100)}%` }}
        />
      </div>
      <button onClick={onBuyMore} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
        {buyMoreLabel}
      </button>
    </div>
  )
}
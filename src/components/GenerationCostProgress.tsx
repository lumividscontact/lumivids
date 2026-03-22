import { Zap } from 'lucide-react'

interface GenerationCostProgressProps {
  estimatedCostLabel: string
  creditsLabel: string
  currentCost: number
  isGenerating: boolean
  statusText: string
  progress: number
  costColorClassName: string
  progressColorClassName: string
  progressBarGradientClassName: string
}

export default function GenerationCostProgress({
  estimatedCostLabel,
  creditsLabel,
  currentCost,
  isGenerating,
  statusText,
  progress,
  costColorClassName,
  progressColorClassName,
  progressBarGradientClassName,
}: GenerationCostProgressProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm text-dark-400">{estimatedCostLabel}</span>
        <div className="flex items-center gap-1">
          <Zap className={`w-4 h-4 ${costColorClassName}`} />
          <span className={`font-bold ${costColorClassName}`}>{currentCost}</span>
          <span className="text-dark-400 text-sm">{creditsLabel}</span>
        </div>
      </div>

      {isGenerating && (
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-dark-400">{statusText}</span>
            <span className={progressColorClassName}>{progress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressBarGradientClassName}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </>
  )
}
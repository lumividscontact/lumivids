import { ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'

interface GenerationActionButtonsProps {
  isGenerating: boolean
  onGenerate: () => void
  onCancel: () => Promise<void>
  generateDisabled: boolean
  generateLabel: string
  generatingLabel: string
  cancelLabel: string
  generateIcon: ReactNode
  generateButtonClassName: string
}

export default function GenerationActionButtons({
  isGenerating,
  onGenerate,
  onCancel,
  generateDisabled,
  generateLabel,
  generatingLabel,
  cancelLabel,
  generateIcon,
  generateButtonClassName,
}: GenerationActionButtonsProps) {
  return (
    <>
      <button
        onClick={onGenerate}
        disabled={generateDisabled}
        className={generateButtonClassName}
      >
        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : generateIcon}
        {isGenerating ? generatingLabel : generateLabel}
      </button>

      {isGenerating && (
        <button
          onClick={() => {
            onCancel().catch((err) => {
              console.error('Failed to cancel generation:', err)
            })
          }}
          className="w-full py-3 rounded-xl bg-dark-800 text-dark-200 font-medium flex items-center justify-center gap-2 hover:bg-dark-700 transition-colors"
        >
          <X className="w-4 h-4" />
          {cancelLabel}
        </button>
      )}
    </>
  )
}
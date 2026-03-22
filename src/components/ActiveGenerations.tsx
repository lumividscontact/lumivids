import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Video, CheckCircle, XCircle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useGenerations, Generation, GenerationType } from '@/contexts/GenerationsContext'
import { useLanguage } from '@/i18n'

const getTypeLabels = (t: any): Record<GenerationType, string> => ({
  'text-to-video': t.nav.textToVideo,
  'image-to-video': t.nav.imageToVideo,
  'text-to-image': t.nav.textToImage,
  'image-to-image': t.nav.imageToImage,
})

const typeRoutes: Record<GenerationType, string> = {
  'text-to-video': '/text-to-video',
  'image-to-video': '/image-to-video',
  'text-to-image': '/text-to-image',
  'image-to-image': '/image-to-image',
}

function GenerationItem({ gen, onNavigate }: { gen: Generation; onNavigate: () => void }) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const typeLabels = getTypeLabels(t)
  const isActive = gen.status === 'starting' || gen.status === 'processing'
  const isSuccess = gen.status === 'succeeded'
  const isFailed = gen.status === 'failed' || gen.status === 'canceled'

  const handleClick = () => {
    navigate(typeRoutes[gen.type])
    onNavigate()
  }

  return (
    <button
      onClick={handleClick}
      className="w-full p-3 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          isActive ? 'bg-purple-500/20' : 
          isSuccess ? 'bg-green-500/20' : 
          isFailed ? 'bg-red-500/20' : 'bg-dark-700'
        }`}>
          {isActive ? (
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {gen.modelName}
          </p>
          <p className="text-xs text-dark-400 truncate">
            {typeLabels[gen.type]}
          </p>
        </div>

        {/* Progress */}
        {isActive && (
          <span className="text-xs text-purple-400 font-medium">
            {gen.progress}%
          </span>
        )}
      </div>

      {/* Progress bar for active generations */}
      {isActive && (
        <div className="mt-2 h-1 bg-dark-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${gen.progress}%` }}
          />
        </div>
      )}
    </button>
  )
}

export function ActiveGenerations() {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useLanguage()
  const { generations, activeGenerations, clearCompleted } = useGenerations()
  
  const recentGenerations = generations.slice(0, 5) // Show last 5
  const hasActive = activeGenerations.length > 0

  if (generations.length === 0) {
    return null
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
          hasActive 
            ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' 
            : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
        }`}
      >
        {hasActive ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">{activeGenerations.length} {t.activeGenerations.generating}</span>
          </>
        ) : (
          <>
            <Video className="w-4 h-4" />
            <span className="text-sm font-medium">{t.activeGenerations.generations}</span>
          </>
        )}
        {isOpen ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-dark-900 border border-dark-700 rounded-xl shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <h3 className="text-sm font-semibold text-white">{t.activeGenerations.recentGenerations}</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active generations */}
            {hasActive && (
              <div className="p-3 border-b border-dark-700 bg-dark-800/50">
                <p className="text-xs text-purple-400 font-medium mb-2 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t.activeGenerations.inProgress} ({activeGenerations.length})
                </p>
                <div className="space-y-2">
                  {activeGenerations.map(gen => (
                    <GenerationItem 
                      key={gen.id} 
                      gen={gen} 
                      onNavigate={() => setIsOpen(false)} 
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent completed */}
            <div className="p-3 max-h-64 overflow-y-auto">
              {recentGenerations.filter(g => g.status !== 'starting' && g.status !== 'processing').length > 0 ? (
                <div className="space-y-2">
                  {recentGenerations
                    .filter(g => g.status !== 'starting' && g.status !== 'processing')
                    .map(gen => (
                      <GenerationItem 
                        key={gen.id} 
                        gen={gen} 
                        onNavigate={() => setIsOpen(false)} 
                      />
                    ))}
                </div>
              ) : !hasActive && (
                <p className="text-sm text-dark-400 text-center py-4">
                  {t.activeGenerations.noRecent}
                </p>
              )}
            </div>

            {/* Footer */}
            {generations.filter(g => g.status !== 'starting' && g.status !== 'processing').length > 0 && (
              <div className="p-3 border-t border-dark-700">
                <button
                  onClick={clearCompleted}
                  className="w-full py-2 text-sm text-dark-400 hover:text-white transition-colors"
                >
                  {t.activeGenerations.clearCompleted}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

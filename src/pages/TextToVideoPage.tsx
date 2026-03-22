import { useState, useMemo, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Video, ChevronDown, X, Volume2, VolumeX, Monitor, Smartphone, Square } from 'lucide-react'
import { useTextToVideo, useSEO, SEO_PAGES } from '@/hooks'
import { useLanguage } from '@/i18n'
import { useAuth } from '@/contexts/AuthContext'
import AuthModal from '@/components/AuthModal'
import GenerationActionButtons from '@/components/GenerationActionButtons'
import GenerationCostProgress from '@/components/GenerationCostProgress'
import GenerationVideoPreview from '@/components/GenerationVideoPreview'
import { 
  TEXT_TO_VIDEO_MODELS, 
  ModelConfig, 
  Resolution,
  AspectRatio,
  calculateCredits,
  getDurationOptions,
} from '@/config/models'
import { downloadFile, getGenerationFilename } from '@/utils/download'
import { truncateAtWordBoundary } from '@/utils/text'

const STYLE_PRESETS = [
  {
    id: 'cinematic',
    nameKey: 'cinematic',
    descriptionKey: 'cinematicDesc',
    prompt: 'cinematic lighting, smooth camera movement, high contrast',
  },
  {
    id: 'anime',
    nameKey: 'anime',
    descriptionKey: 'animeDesc',
    prompt: 'anime style, vibrant colors, clean line art',
  },
  {
    id: 'realistic',
    nameKey: 'realistic',
    descriptionKey: 'realisticDesc',
    prompt: 'photorealistic, natural lighting, high detail',
  },
  {
    id: 'cyberpunk',
    nameKey: 'cyberpunk',
    descriptionKey: 'cyberpunkDesc',
    prompt: 'cyberpunk, neon lights, futuristic city, moody atmosphere',
  },
  {
    id: 'documentary',
    nameKey: 'documentary',
    descriptionKey: 'documentaryDesc',
    prompt: 'documentary style, handheld camera, natural lighting',
  },
  {
    id: 'fantasy',
    nameKey: 'fantasy',
    descriptionKey: 'fantasyDesc',
    prompt: 'fantasy, ethereal lighting, magical atmosphere',
  },
]

const MAX_PROMPT_CHARS = 2000

export default function TextToVideoPage() {
  const { t } = useLanguage()
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const examplePrompts = t.textToVideo.examplePrompts
  
  // SEO meta tags
  useSEO(SEO_PAGES.textToVideo)
  
  // Get initial model from URL query param
  const getInitialModel = (): ModelConfig => {
    const modelId = searchParams.get('model')
    if (modelId) {
      const foundModel = TEXT_TO_VIDEO_MODELS.find(m => m.id === modelId)
      if (foundModel) return foundModel
    }
    return TEXT_TO_VIDEO_MODELS[0]
  }

  // Get initial values from URL (for regeneration)
  const getInitialPrompt = () => searchParams.get('prompt') || ''
  const getInitialAspect = (model: ModelConfig): AspectRatio => {
    const aspect = searchParams.get('aspect')
    if (aspect && model.supportedAspectRatios.includes(aspect as AspectRatio)) {
      return aspect as AspectRatio
    }
    return model.supportedAspectRatios[0] || '16:9'
  }
  const getInitialDuration = (model: ModelConfig) => {
    const dur = searchParams.get('duration')
    if (dur) {
      const parsed = parseInt(dur)
      if (!isNaN(parsed)) return parsed
    }
    return model.defaultDuration || 5
  }
  const getInitialResolution = (model: ModelConfig): Resolution => {
    const res = searchParams.get('resolution')
    if (res && model.supportedResolutions.includes(res as Resolution)) {
      return res as Resolution
    }
    return model.defaultResolution
  }
  const getInitialAudio = () => searchParams.get('audio') === 'true'

  const initialValuesRef = useRef<{
    model: ModelConfig
    prompt: string
    aspectRatio: AspectRatio
    duration: number
    resolution: Resolution
    withAudio: boolean
  } | null>(null)

  if (!initialValuesRef.current) {
    const model = getInitialModel()
    initialValuesRef.current = {
      model,
      prompt: getInitialPrompt(),
      aspectRatio: getInitialAspect(model),
      duration: getInitialDuration(model),
      resolution: getInitialResolution(model),
      withAudio: getInitialAudio(),
    }
  }

  const [prompt, setPrompt] = useState(() => initialValuesRef.current!.prompt)
  const [selectedModel, setSelectedModel] = useState<ModelConfig>(() => initialValuesRef.current!.model)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => initialValuesRef.current!.aspectRatio)
  const [duration, setDuration] = useState(() => initialValuesRef.current!.duration)
  const [resolution, setResolution] = useState<Resolution>(() => initialValuesRef.current!.resolution)
  const [withAudio, setWithAudio] = useState(() => initialValuesRef.current!.withAudio)
  const [stylePresetId, setStylePresetId] = useState<string | null>(null)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { isGenerating, status, output, error, progress, generate, cancel, reset, credits } = useTextToVideo()

  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModelDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Open auth modal if requested via query param
  useEffect(() => {
    const wantsAuth = searchParams.get('auth') === '1'
    if (wantsAuth && !isAuthenticated) {
      setShowAuthPrompt(true)
    }
  }, [searchParams, isAuthenticated])
  // Get available options based on selected model
  const availableAspectRatios = selectedModel.supportedAspectRatios
  const availableResolutions = selectedModel.supportedResolutions
  const availableDurations = useMemo(() => getDurationOptions(selectedModel), [selectedModel])

  // Calculate credit cost
  const currentCost = useMemo(() => {
    return calculateCredits(selectedModel, duration, resolution, withAudio)
  }, [selectedModel, duration, resolution, withAudio])

  const selectedStylePreset = useMemo(() => {
    return STYLE_PRESETS.find((item) => item.id === stylePresetId) || null
  }, [stylePresetId])

  const finalPrompt = useMemo(() => {
    const basePrompt = prompt.trim()
    if (!basePrompt) return ''
    return selectedStylePreset ? `${basePrompt}, ${selectedStylePreset.prompt}` : basePrompt
  }, [prompt, selectedStylePreset])

  const isFinalPromptTooLong = finalPrompt.length > MAX_PROMPT_CHARS

  // Update states when model changes
  const handleModelChange = (model: ModelConfig) => {
    setSelectedModel(model)
    setResolution(model.defaultResolution)
    setDuration(model.defaultDuration || 5)
    setWithAudio(false)
    setIsModelDropdownOpen(false)
    if (!model.supportedAspectRatios.includes(aspectRatio)) {
      setAspectRatio(model.supportedAspectRatios[0])
    }
  }

  const handleGenerate = async () => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true)
      return
    }
    if (!prompt.trim() || isFinalPromptTooLong) return
    
    try {
      await generate({
        prompt: finalPrompt,
        model: selectedModel.id,
        aspectRatio,
        duration: String(duration),
        resolution,
        withAudio: selectedModel.supportsAudio ? withAudio : undefined,
      })
    } catch (err) {
      console.error('Generation failed:', err)
    }
  }

  const videoUrl = output ? (Array.isArray(output) ? output[0] : output) : null

  const getStatusText = () => {
    switch (status) {
      case 'starting': return t.status.starting
      case 'processing': return t.status.processing
      default: return t.common.generating
    }
  }

  const getModelIcon = (modelId: string) => {
    if (modelId.includes('seedance')) return '📊'
    if (modelId.includes('kling')) return '✨'
    if (modelId.includes('minimax')) return '🎬'
    if (modelId.includes('luma')) return '🌙'
    if (modelId.includes('haiper')) return '🚀'
    if (modelId.includes('wan')) return '🔄'
    if (modelId.includes('hailuo')) return '🎭'
    return '🎥'
  }

  const getAspectRatioIcon = (ratio: AspectRatio) => {
    switch (ratio) {
      case '16:9': return <Monitor className="w-4 h-4" />
      case '9:16': return <Smartphone className="w-4 h-4" />
      case '1:1': return <Square className="w-4 h-4" />
      default: return <Monitor className="w-4 h-4" />
    }
  }

  const isVerticalPreview = aspectRatio === '9:16' || aspectRatio === '3:4'

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* Model Dropdown */}
          <div className="card" ref={dropdownRef}>
            <label className="block text-sm font-medium text-dark-400 mb-2">{t.ui.model}</label>
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              disabled={isGenerating}
              className="w-full flex items-center justify-between p-3 bg-dark-800 rounded-xl hover:bg-dark-700 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{getModelIcon(selectedModel.id)}</span>
                <div className="text-left">
                  <p className="font-medium text-white">{selectedModel.name}</p>
                  <p className="text-xs text-dark-400">
                    {selectedModel.credits.perSecond
                      ? `${selectedModel.credits.perSecond[resolution] * (duration || selectedModel.minDuration || 5)} ${t.ui.creditsLabel.toLowerCase()} (${selectedModel.credits.perSecond[resolution]}/s)`
                      : `${selectedModel.credits.base} ${t.ui.creditsLabel.toLowerCase()}`}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown List */}
            {isModelDropdownOpen && (
              <div className="mt-2 max-h-80 overflow-y-auto rounded-xl bg-dark-800 border border-dark-700">
                {TEXT_TO_VIDEO_MODELS.map((model) => {
                  const isSelected = selectedModel.id === model.id
                  const cost = model.credits.perSecond 
                    ? model.credits.perSecond[model.defaultResolution] * (model.minDuration || 5)
                    : model.credits.base
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleModelChange(model)}
                      className={`w-full flex items-center justify-between p-3 hover:bg-dark-700 transition-colors ${
                        isSelected ? 'bg-primary-500/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getModelIcon(model.id)}</span>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white text-sm">{model.name}</p>
                            {model.badge && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                model.badge === 'POPULAR' ? 'bg-orange-500/20 text-orange-400' :
                                model.badge === 'NEW' ? 'bg-green-500/20 text-green-400' :
                                'bg-primary-500/20 text-primary-400'
                              }`}>
                                {model.badge === 'POPULAR' ? t.common.popular : model.badge === 'NEW' ? t.common.new : model.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-dark-400">
                            {truncateAtWordBoundary(model.description, 30)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-primary-400">{cost}</p>
                        <p className="text-[10px] text-dark-500">{t.ui.creditsLabel.toLowerCase()}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Prompt Input */}
          <div className="card">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))}
              placeholder={t.ui.videoPlaceholder}
              className="w-full bg-transparent border-none text-white placeholder-dark-500 resize-none focus:outline-none min-h-[100px]"
              disabled={isGenerating}
              maxLength={MAX_PROMPT_CHARS}
            />

            <div className="mt-2 flex justify-end">
              <span className={`text-xs ${prompt.length > MAX_PROMPT_CHARS * 0.9 ? 'text-orange-400' : 'text-dark-500'}`}>
                {prompt.length}/{MAX_PROMPT_CHARS}
              </span>
            </div>
            
            {/* Example Prompts */}
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-dark-700">
              {examplePrompts.slice(0, 2).map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(example)}
                  disabled={isGenerating}
                  className="px-3 py-1.5 text-xs bg-dark-800 text-dark-300 rounded-lg hover:bg-dark-700 hover:text-white transition-colors truncate max-w-[180px] disabled:opacity-50"
                >
                  {example.length > 25 ? example.substring(0, 25) + '...' : example}
                </button>
              ))}
            </div>
          </div>

          {/* Style Presets */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-dark-400">{t.textToVideo.stylePresetsLabel}</label>
              {stylePresetId && (
                <button
                  onClick={() => setStylePresetId(null)}
                  className="text-xs text-dark-500 hover:text-white transition-colors"
                  disabled={isGenerating}
                >
                  {t.common.clear}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {STYLE_PRESETS.map((preset) => {
                const isSelected = stylePresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    onClick={() => setStylePresetId(preset.id)}
                    disabled={isGenerating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                      isSelected
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-800 text-dark-300 hover:bg-dark-700 hover:text-white'
                    }`}
                  >
                    {t.textToVideo.stylePresets[preset.nameKey]}
                  </button>
                )
              })}
            </div>

            {stylePresetId && (
              <p className="text-xs text-dark-400 mt-3">
                {t.textToVideo.stylePresetDescriptions[STYLE_PRESETS.find((p) => p.id === stylePresetId)?.descriptionKey || 'cinematicDesc']}
              </p>
            )}

            {stylePresetId && prompt.trim() && (
              <div className="mt-3 p-3 rounded-lg bg-dark-800 border border-dark-700">
                <p className="text-[11px] uppercase tracking-wide text-dark-500 mb-1">{t.textToVideo.finalPromptLabel}</p>
                <p className="text-xs text-dark-300 break-words">{finalPrompt}</p>
                <p className={`text-[11px] mt-2 ${isFinalPromptTooLong ? 'text-red-400' : 'text-dark-500'}`}>
                  {finalPrompt.length}/{MAX_PROMPT_CHARS}
                </p>
              </div>
            )}
          </div>


          {/* Duration */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-dark-400">{t.textToVideo.durationLabel}</label>
              <span className="text-xs text-dark-500">{duration}s</span>
            </div>
            <div className="flex gap-2">
              {availableDurations.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  disabled={isGenerating}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                    duration === d
                      ? 'bg-primary-500 text-white'
                      : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="card">
            <label className="block text-sm font-medium text-dark-400 mb-3">{t.textToVideo.aspectRatioLabel}</label>
            <div className="flex gap-2">
              {availableAspectRatios.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  disabled={isGenerating}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    aspectRatio === ratio
                      ? 'bg-primary-500 text-white'
                      : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  {getAspectRatioIcon(ratio)}
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          {!selectedModel.hideResolutionSelector && (
            <div className="card">
              <label className="block text-sm font-medium text-dark-400 mb-3">{t.textToVideo.resolutionLabel}</label>
              <div className="flex gap-2">
                {availableResolutions.map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    disabled={isGenerating}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                      resolution === res
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Audio Toggle */}
          {selectedModel.supportsAudio && (
            <div className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {withAudio ? <Volume2 className="w-5 h-5 text-orange-400" /> : <VolumeX className="w-5 h-5 text-dark-400" />}
                  <div>
                    <p className="text-sm font-medium text-white">{t.textToVideo.generateAudio}</p>
                    <p className="text-xs text-dark-400">+1cr/s {t.common.additional}</p>
                  </div>
                </div>
                <button
                  onClick={() => setWithAudio(!withAudio)}
                  disabled={isGenerating}
                  className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${
                    withAudio ? 'bg-primary-500' : 'bg-dark-700'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    withAudio ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          )}

          {/* Auth Modal */}
          <AuthModal
            isOpen={showAuthPrompt}
            onClose={() => setShowAuthPrompt(false)}
          />

          {/* Cost & Generate Button */}
          <div className="card space-y-4">
            <GenerationCostProgress
              estimatedCostLabel={t.ui.estimatedCost}
              creditsLabel={t.ui.creditsLabel}
              currentCost={currentCost}
              isGenerating={isGenerating}
              statusText={getStatusText()}
              progress={progress}
              costColorClassName="text-primary-400"
              progressColorClassName="text-primary-400"
              progressBarGradientClassName="bg-gradient-to-r from-primary-500 to-accent-500"
            />

            <GenerationActionButtons
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
              onCancel={cancel}
              generateDisabled={!prompt.trim() || isFinalPromptTooLong || isGenerating || (isAuthenticated && credits < currentCost)}
              generateLabel={`${t.ui.createButton} | ${currentCost} ${t.ui.creditsLabel}`}
              generatingLabel={t.common.generating}
              cancelLabel={t.common.cancel}
              generateIcon={<Video className="w-5 h-5" />}
              generateButtonClassName="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-medium flex items-center justify-center gap-2 hover:from-primary-600 hover:to-accent-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {isAuthenticated && credits < currentCost && !isGenerating && (
              <p className="text-xs text-red-400 text-center">
                {t.ui.insufficientCreditsMessage} {credits} {t.common.credits}.
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Generated Videos */}
        <div className="lg:col-span-7 card flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-4">{t.ui.generatedVideos}</h2>

          <GenerationVideoPreview
            error={error}
            onReset={reset}
            videoUrl={videoUrl}
            isVerticalPreview={isVerticalPreview}
            onDownload={() => downloadFile(videoUrl!, getGenerationFilename('video', 'text-to-video'))}
            downloadLabel={t.textToVideo.downloadVideo}
            newGenerationLabel={t.textToVideo.newGeneration}
            newGenerationButtonClassName="flex-1 py-2.5 rounded-xl bg-primary-500/20 text-primary-400 font-medium hover:bg-primary-500/30 transition-colors"
            emptyIcon={<Video className="w-10 h-10 text-dark-600" />}
            emptyTitle={t.textToVideo.noPreview}
            emptyDescription={t.textToVideo.emptyDescription}
          />
        </div>
      </div>
    </div>
  )
}

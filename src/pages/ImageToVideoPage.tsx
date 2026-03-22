import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layers, ChevronDown, X, Monitor, Smartphone, Square } from 'lucide-react'
import { useImageToVideo, useSEO, SEO_PAGES } from '@/hooks'
import { useLanguage } from '@/i18n'
import { useAuth } from '@/contexts/AuthContext'
import AuthModal from '@/components/AuthModal'
import GenerationActionButtons from '@/components/GenerationActionButtons'
import GenerationCostProgress from '@/components/GenerationCostProgress'
import GenerationVideoPreview from '@/components/GenerationVideoPreview'
import { 
  IMAGE_TO_VIDEO_MODELS, 
  ModelConfig, 
  AspectRatio,
  Resolution,
  calculateCredits,
  getDurationOptions,
} from '@/config/models'
import ImageUpload from '@/components/ImageUpload'
import { downloadFile, getGenerationFilename } from '@/utils/download'
import { truncateAtWordBoundary } from '@/utils/text'

const MAX_PROMPT_CHARS = 2000

export default function ImageToVideoPage() {
  const { t } = useLanguage()
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const examplePrompts = t.imageToVideo.examplePrompts
  
  // SEO meta tags
  useSEO(SEO_PAGES.imageToVideo)

  // Compute initial values from URL once (lazy initializer pattern)
  const initialValuesRef = useRef<{
    model: ModelConfig
    prompt: string
    inputImageUrl: string | null
    aspectRatio: AspectRatio
    duration: number
    resolution: Resolution
  } | null>(null)

  if (!initialValuesRef.current) {
    const getModel = (): ModelConfig => {
      const modelId = searchParams.get('model')
      if (modelId) {
        const found = IMAGE_TO_VIDEO_MODELS.find(m => m.id === modelId)
        if (found) return found
      }
      return IMAGE_TO_VIDEO_MODELS[0]
    }
    const getAspect = (selectedModel: ModelConfig): AspectRatio => {
      const aspect = searchParams.get('aspect')
      if (aspect && selectedModel.supportedAspectRatios.includes(aspect as AspectRatio)) {
        return aspect as AspectRatio
      }
      return selectedModel.supportedAspectRatios[0] || '16:9'
    }
    const getResolution = (selectedModel: ModelConfig): Resolution => {
      const res = searchParams.get('resolution')
      if (res && selectedModel.supportedResolutions.includes(res as Resolution)) {
        return res as Resolution
      }
      return selectedModel.defaultResolution
    }
    const model = getModel()
    const dur = searchParams.get('duration')
    initialValuesRef.current = {
      model,
      prompt: searchParams.get('prompt') || '',
      inputImageUrl: searchParams.get('inputImageUrl') || null,
      aspectRatio: getAspect(model),
      duration: dur ? (parseInt(dur) || model.defaultDuration || 5) : (model.defaultDuration || 5),
      resolution: getResolution(model),
    }
  }

  const motionTypes = useMemo(() => [
    { id: 'auto', name: t.ui.automatic, description: t.ui.aiDecides },
    { id: 'zoom-in', name: t.ui.zoomIn, description: t.ui.smoothZoomIn },
    { id: 'zoom-out', name: t.ui.zoomOut, description: t.ui.smoothZoomOut },
    { id: 'pan-left', name: t.ui.panLeft, description: t.ui.moveLeft },
    { id: 'pan-right', name: t.ui.panRight, description: t.ui.moveRight },
    { id: 'orbit', name: t.ui.orbit, description: t.ui.orbitalMovement },
  ], [t])
  const motionPresets = useMemo(() => [
    {
      id: 'subtle',
      name: t.imageToVideo.motionPresets.subtle,
      description: t.imageToVideo.motionPresetDescriptions.subtleDesc,
      motionTypeId: 'auto',
      strength: 30,
    },
    {
      id: 'cinematic',
      name: t.imageToVideo.motionPresets.cinematic,
      description: t.imageToVideo.motionPresetDescriptions.cinematicDesc,
      motionTypeId: 'zoom-in',
      strength: 45,
    },
    {
      id: 'dynamic',
      name: t.imageToVideo.motionPresets.dynamic,
      description: t.imageToVideo.motionPresetDescriptions.dynamicDesc,
      motionTypeId: 'pan-right',
      strength: 65,
    },
    {
      id: 'orbit',
      name: t.imageToVideo.motionPresets.orbit,
      description: t.imageToVideo.motionPresetDescriptions.orbitDesc,
      motionTypeId: 'orbit',
      strength: 60,
    },
    {
      id: 'drama',
      name: t.imageToVideo.motionPresets.drama,
      description: t.imageToVideo.motionPresetDescriptions.dramaDesc,
      motionTypeId: 'zoom-out',
      strength: 75,
    },
  ], [t])
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(() => initialValuesRef.current!.inputImageUrl)
  const [prompt, setPrompt] = useState(() => initialValuesRef.current!.prompt)
  const [selectedModel, setSelectedModel] = useState<ModelConfig>(() => initialValuesRef.current!.model)
  const [motionType, setMotionType] = useState(motionTypes[0])
  const [motionStrength, setMotionStrength] = useState(50)
  const [duration, setDuration] = useState(() => initialValuesRef.current!.duration)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => initialValuesRef.current!.aspectRatio)
  const [resolution, setResolution] = useState<Resolution>(() => initialValuesRef.current!.resolution)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { isGenerating, status, output, error, progress, generate, cancel, reset, credits } = useImageToVideo()

  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  useEffect(() => {
    setMotionType((current) => motionTypes.find((item) => item.id === current.id) ?? motionTypes[0])
  }, [motionTypes])

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

  // Get available options
  const availableDurations = useMemo(() => getDurationOptions(selectedModel), [selectedModel])
  const availableAspectRatios = selectedModel.supportedAspectRatios
  const availableResolutions = selectedModel.supportedResolutions

  // Calculate credit cost
  const currentCost = useMemo(() => {
    if (selectedModel.credits.perSecond) {
      return calculateCredits(selectedModel, duration, resolution)
    }
    return selectedModel.credits.base
  }, [selectedModel, duration, resolution])

  const handleModelChange = (model: ModelConfig) => {
    setSelectedModel(model)
    setDuration(model.defaultDuration || 5)
    setResolution(model.defaultResolution)
    setIsModelDropdownOpen(false)
    if (!model.supportedAspectRatios.includes(aspectRatio)) {
      setAspectRatio(model.supportedAspectRatios[0])
    }
  }

  const isPromptTooLong = prompt.length > MAX_PROMPT_CHARS

  const handleGenerate = async () => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true)
      return
    }
    if (!uploadedImageUrl || isPromptTooLong) return
    
    try {
      await generate({
        imageUrl: uploadedImageUrl,
        prompt,
        model: selectedModel.id,
        motionType: motionType.id,
        motionStrength,
        aspectRatio,
        duration: String(duration),
        resolution,
      })
    } catch (err) {
      console.error('Generation failed:', err)
    }
  }

  const videoUrl = output ? (Array.isArray(output) ? output[0] : output) : null

  const getModelIcon = (modelId: string) => {
    if (modelId.includes('kling')) return '✨'
    if (modelId.includes('luma')) return '🌙'
    if (modelId.includes('stable')) return '🎬'
    if (modelId.includes('minimax')) return '⚡'
    if (modelId.includes('haiper')) return '🚀'
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

  const getStatusText = () => {
    switch (status) {
      case 'starting': return t.status.starting
      case 'processing': return t.status.processing
      default: return t.common.generating
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
                {IMAGE_TO_VIDEO_MODELS.map((model) => {
                  const isSelected = selectedModel.id === model.id
                  const cost = model.credits.perSecond 
                    ? model.credits.perSecond[model.defaultResolution] * (model.minDuration || 5)
                    : model.credits.base
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleModelChange(model)}
                      className={`w-full flex items-center justify-between p-3 hover:bg-dark-700 transition-colors ${
                        isSelected ? 'bg-purple-500/20' : ''
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
                                'bg-purple-500/20 text-purple-400'
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
                        <p className="text-sm font-medium text-purple-400">{cost}</p>
                        <p className="text-[10px] text-dark-500">{t.ui.creditsLabel.toLowerCase()}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div className="card">
            <label className="block text-sm font-medium text-dark-400 mb-3">{t.imageToVideo.uploadLabel}</label>
            <ImageUpload
              value={uploadedImageUrl}
              onChange={setUploadedImageUrl}
              disabled={isGenerating}
              aspectRatio={aspectRatio === '1:1' ? '1:1' : aspectRatio === '9:16' ? '9:16' : '16:9'}
            />
          </div>

          {/* Motion Prompt */}
          <div className="card">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))}
              placeholder={t.imageToVideo.promptPlaceholder}
              className="w-full bg-transparent border-none text-white placeholder-dark-500 resize-none focus:outline-none min-h-[80px]"
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

          {/* Duration */}
          {availableDurations.length > 1 && (
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
                        ? 'bg-purple-500 text-white'
                        : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Aspect Ratio */}
          {!selectedModel.hideAspectRatioSelector && (
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
                      ? 'bg-purple-500 text-white'
                      : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  {getAspectRatioIcon(ratio)}
                  {ratio}
                </button>
              ))}
            </div>
          </div>
          )}

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
                        ? 'bg-purple-500 text-white'
                        : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Motion Type */}
          <div className="card">
            <label className="block text-sm font-medium text-dark-400 mb-3">{t.imageToVideo.motionPresetsLabel}</label>
            <div className="flex flex-wrap gap-2">
              {motionPresets.map((preset) => {
                const isSelected = motionType.id === preset.motionTypeId && motionStrength === preset.strength
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      const nextMotion = motionTypes.find((item) => item.id === preset.motionTypeId) ?? motionTypes[0]
                      setMotionType(nextMotion)
                      setMotionStrength(preset.strength)
                    }}
                    disabled={isGenerating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                      isSelected
                        ? 'bg-purple-500 text-white'
                        : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                    }`}
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-dark-500 mt-3">
              {t.imageToVideo.motionPresetsHint}
            </p>
          </div>

          {/* Motion Type */}
          <div className="card">
            <label className="block text-sm font-medium text-dark-400 mb-3">{t.imageToVideo.motionTypeLabel}</label>
            <div className="grid grid-cols-3 gap-2">
              {motionTypes.map((motion) => (
                <button
                  key={motion.id}
                  onClick={() => setMotionType(motion)}
                  disabled={isGenerating}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-all disabled:opacity-50 ${
                    motionType.id === motion.id
                      ? 'bg-purple-500 text-white'
                      : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  {motion.name}
                </button>
              ))}
            </div>
          </div>

          {/* Motion Strength */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-dark-400">{t.imageToVideo.motionStrengthLabel}</label>
              <span className="text-xs text-dark-500">{motionStrength}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={motionStrength}
              onChange={(e) => setMotionStrength(Number(e.target.value))}
              disabled={isGenerating}
              className="w-full accent-purple-500"
            />
          </div>

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
              costColorClassName="text-purple-400"
              progressColorClassName="text-purple-400"
              progressBarGradientClassName="bg-gradient-to-r from-purple-500 to-pink-500"
            />

            <GenerationActionButtons
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
              onCancel={cancel}
              generateDisabled={!uploadedImageUrl || isPromptTooLong || isGenerating || (isAuthenticated && credits < currentCost)}
              generateLabel={`${t.imageToVideo.generateButton} | ${currentCost} ${t.ui.creditsLabel}`}
              generatingLabel={t.common.generating}
              cancelLabel={t.common.cancel}
              generateIcon={<Layers className="w-5 h-5" />}
              generateButtonClassName="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium flex items-center justify-center gap-2 hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            onDownload={() => downloadFile(videoUrl!, getGenerationFilename('video', 'image-to-video'))}
            downloadLabel={t.imageToVideo.downloadVideo}
            newGenerationLabel={t.imageToVideo.newGeneration}
            newGenerationButtonClassName="flex-1 py-2.5 rounded-xl bg-purple-500/20 text-purple-400 font-medium hover:bg-purple-500/30 transition-colors"
            emptyIcon={<Layers className="w-10 h-10 text-dark-600" />}
            emptyTitle={t.imageToVideo.noPreview}
            emptyDescription={t.imageToVideo.uploadHint}
          />
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Sparkles, ChevronDown, X, Image as ImageIcon, Download, AlertCircle, Monitor, Smartphone, Square, Grid, ZoomIn, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useTextToImage, useSEO, SEO_PAGES } from '@/hooks'
import { useLanguage } from '@/i18n'
import { useAuth } from '@/contexts/AuthContext'
import AuthModal from '@/components/AuthModal'
import GenerationActionButtons from '@/components/GenerationActionButtons'
import GenerationCostProgress from '@/components/GenerationCostProgress'
import { 
  TEXT_TO_IMAGE_MODELS, 
  ModelConfig, 
  AspectRatio,
  Resolution,
} from '@/config/models'
import { downloadFile, getGenerationFilename } from '@/utils/download'
import { truncateAtWordBoundary } from '@/utils/text'

const MAX_PROMPT_CHARS = 2000

/* ── Image Gallery with lightbox ── */
function ImageGallery({ images, onReset, newGenerationLabel }: { images: string[]; onReset: () => void; newGenerationLabel: string }) {
  const { t } = useLanguage()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const isMultiple = images.length > 1
  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null

  const goPrev = useCallback(() => {
    setSelectedIndex(prev => prev !== null ? (prev - 1 + images.length) % images.length : 0)
  }, [images.length])

  const goNext = useCallback(() => {
    setSelectedIndex(prev => prev !== null ? (prev + 1) % images.length : 0)
  }, [images.length])

  // Keyboard nav for lightbox
  useEffect(() => {
    if (selectedIndex === null) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIndex(null)
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedIndex, goPrev, goNext])

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Single image ── */}
      {!isMultiple && (
        <div className="flex-1 flex flex-col items-center">
          <div className="relative group w-full rounded-2xl overflow-hidden bg-dark-800/60 border border-dark-700/50">
            <img
              src={images[0]}
              alt="Generated image"
              className="w-full h-auto object-contain max-h-[520px]"
            />
            {/* Overlay actions */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <button
                  onClick={() => setSelectedIndex(0)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/15 backdrop-blur-sm text-white text-sm hover:bg-white/25 transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                  {t.textToImage.expand}
                </button>
                <button
                  onClick={() => downloadFile(images[0], getGenerationFilename('image', 'text-to-image-1'))}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/15 backdrop-blur-sm text-white text-sm hover:bg-white/25 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {t.common.download}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Multiple images – masonry-style grid ── */}
      {isMultiple && (
        <div className="grid gap-3 flex-1 grid-cols-2">
          {images.map((imageUrl, idx) => (
            <div
              key={idx}
              className="relative group rounded-2xl overflow-hidden bg-dark-800/60 border border-dark-700/50 cursor-pointer hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10"
              onClick={() => setSelectedIndex(idx)}
            >
              <img
                src={imageUrl}
                alt={`Generated ${idx + 1}`}
                className="w-full h-full object-cover aspect-square"
              />
              {/* Image number badge */}
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-black/50 backdrop-blur-sm text-[11px] font-medium text-white/80">
                {idx + 1}/{images.length}
              </div>
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedIndex(idx) }}
                    className="p-2 rounded-xl bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 transition-colors"
                    aria-label={t.textToImage.expand}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadFile(imageUrl, getGenerationFilename('image', `text-to-image-${idx + 1}`)) }}
                    className="p-2 rounded-xl bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 transition-colors"
                    aria-label={t.common.download}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Action bar ── */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={() => {
            images.forEach((url, i) => downloadFile(url, getGenerationFilename('image', `text-to-image-${i + 1}`)))
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-dark-800 text-dark-300 hover:bg-dark-700 hover:text-white transition-colors text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          {isMultiple ? `${t.textToImage.downloadAll} (${images.length})` : t.common.download}
        </button>
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-500/20 text-purple-400 font-medium hover:bg-purple-500/30 transition-colors text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          {newGenerationLabel}
        </button>
      </div>

      {/* ── Lightbox Modal ── */}
      {selectedImage && selectedIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            onClick={() => setSelectedIndex(null)}
            aria-label={t.common.close}
          >
            <X className="w-6 h-6" />
          </button>

          {/* Counter */}
          {isMultiple && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-sm text-white/80 z-10">
              {selectedIndex + 1} / {images.length}
            </div>
          )}

          {/* Nav arrows */}
          {isMultiple && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); goPrev() }}
                aria-label={t.common.previous}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); goNext() }}
                aria-label={t.common.next}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Image */}
          <img
            src={selectedImage}
            alt={`Generated ${selectedIndex + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Bottom bar */}
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => downloadFile(selectedImage, getGenerationFilename('image', `text-to-image-${selectedIndex + 1}`))}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm text-white text-sm font-medium hover:bg-white/25 transition-colors"
            >
              <Download className="w-4 h-4" />
              {t.textToImage.downloadImage}
            </button>
          </div>

          {/* Thumbnail strip */}
          {isMultiple && (
            <div
              className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    i === selectedIndex
                      ? 'border-purple-500 scale-110 shadow-lg shadow-purple-500/30'
                      : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/40'
                  }`}
                >
                  <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TextToImagePage() {
  const { t } = useLanguage()
  const { isAuthenticated } = useAuth()
  
  // SEO meta tags
  useSEO(SEO_PAGES.textToImage)
  const examplePrompts = t.textToImage.examplePrompts
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<ModelConfig>(TEXT_TO_IMAGE_MODELS[0])
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [resolution, setResolution] = useState<Resolution>(selectedModel.defaultResolution)
  const [numImages, setNumImages] = useState(1)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { isGenerating, status, output, error, progress, generate, cancel, reset, credits } = useTextToImage()

  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  // Close dropdown when clicking outside or pressing Escape
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

  // Calculate credit cost
  const currentCost = useMemo(() => {
    return selectedModel.credits.base * numImages
  }, [selectedModel, numImages])

  const isPromptTooLong = prompt.length > MAX_PROMPT_CHARS

  const handleModelChange = (model: ModelConfig) => {
    setSelectedModel(model)
    setResolution(model.defaultResolution)
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
    if (!prompt.trim() || isPromptTooLong) return

    try {
      await generate({
        prompt,
        negativePrompt: selectedModel.supportsNegativePrompt ? negativePrompt : undefined,
        model: selectedModel.id,
        aspectRatio,
        resolution,
        numOutputs: numImages,
      })
    } catch (err) {
      console.error('Generation failed:', err)
    }
  }

  const getModelIcon = (modelId: string) => {
    if (modelId.includes('flux')) return '⚡'
    if (modelId.includes('stable')) return '🎨'
    if (modelId.includes('ideogram')) return '✏️'
    return '🖼️'
  }

  const getAspectRatioIcon = (ratio: AspectRatio) => {
    switch (ratio) {
      case 'auto': return <Sparkles className="w-4 h-4" />
      case '16:9': return <Monitor className="w-4 h-4" />
      case '9:16': return <Smartphone className="w-4 h-4" />
      case '1:1': return <Square className="w-4 h-4" />
      case '4:3': return <Grid className="w-4 h-4" />
      case '3:4': return <Grid className="w-4 h-4 rotate-90" />
      case '3:2': return <Grid className="w-4 h-4" />
      case '2:3': return <Grid className="w-4 h-4 rotate-90" />
      case '21:9': return <Monitor className="w-4 h-4" />
      default: return <Square className="w-4 h-4" />
    }
  }

  const getAspectRatioLabel = (ratio: AspectRatio) => (ratio === 'auto' ? 'Auto' : ratio)

  const getStatusText = () => {
    switch (status) {
      case 'starting': return t.status.starting
      case 'processing': return t.status.processing
      default: return t.common.generating
    }
  }

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
                  <p className="text-xs text-dark-400">{selectedModel.credits.base}cr {t.ui.perImage}</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown List */}
            {isModelDropdownOpen && (
              <div className="mt-2 max-h-80 overflow-y-auto rounded-xl bg-dark-800 border border-dark-700">
                {TEXT_TO_IMAGE_MODELS.map((model) => {
                  const isSelected = selectedModel.id === model.id
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
                                model.badge === 'FAST' ? 'bg-blue-500/20 text-blue-400' :
                                model.badge === 'NEW' ? 'bg-green-500/20 text-green-400' :
                                'bg-purple-500/20 text-purple-400'
                              }`}>
                                {model.badge === 'POPULAR' ? t.common.popular : model.badge === 'NEW' ? t.common.new : model.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-dark-400">{truncateAtWordBoundary(model.description, 30)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-purple-400">{model.credits.base}</p>
                        <p className="text-[10px] text-dark-500">{t.ui.creditsLabel.toLowerCase()}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="card">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))}
              placeholder={t.textToImage.promptPlaceholder}
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
                  className="px-3 py-1.5 text-xs bg-dark-800 text-dark-300 rounded-lg hover:bg-dark-700 hover:text-white transition-colors truncate max-w-[200px] disabled:opacity-50"
                >
                  {truncateAtWordBoundary(example, 28)}
                </button>
              ))}
            </div>
          </div>

          {/* Negative Prompt */}
          {selectedModel.supportsNegativePrompt && (
            <div className="card">
              <label className="block text-sm font-medium text-dark-400 mb-2">{t.textToImage.negativePromptLabel}</label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder={t.textToImage.negativePromptPlaceholder}
                className="w-full bg-dark-800 rounded-xl p-3 text-white placeholder-dark-500 resize-none focus:outline-none min-h-[60px]"
                disabled={isGenerating}
              />
            </div>
          )}

          {/* Aspect Ratio */}
          <div className="card">
            <label className="block text-sm font-medium text-dark-400 mb-3">{t.textToImage.aspectRatioLabel}</label>
            <div className="flex gap-2 flex-wrap">
              {selectedModel.supportedAspectRatios.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  disabled={isGenerating}
                  className={`flex-1 min-w-[70px] py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    aspectRatio === ratio
                      ? 'bg-purple-500 text-white'
                      : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  {getAspectRatioIcon(ratio)}
                  {getAspectRatioLabel(ratio)}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          {selectedModel.supportedResolutions.length > 1 && (
            <div className="card">
              <label className="block text-sm font-medium text-dark-400 mb-3">{t.textToVideo.resolutionLabel}</label>
              <div className="flex gap-2">
                {selectedModel.supportedResolutions.map((res) => (
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

          {/* Number of Images */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-dark-400">{t.textToImage.numImagesLabel}</label>
              <span className="text-xs text-dark-500">{numImages} {numImages === 1 ? t.ui.image : t.textToImage.nImages}</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => setNumImages(num)}
                  disabled={isGenerating}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                    numImages === num
                      ? 'bg-purple-500 text-white'
                      : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
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
              generateDisabled={!prompt.trim() || isPromptTooLong || isGenerating || (isAuthenticated && credits < currentCost)}
              generateLabel={`${t.ui.createButton} | ${currentCost} ${t.ui.creditsLabel}`}
              generatingLabel={t.common.generating}
              cancelLabel={t.common.cancel}
              generateIcon={<Sparkles className="w-5 h-5" />}
              generateButtonClassName="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium flex items-center justify-center gap-2 hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {isAuthenticated && credits < currentCost && !isGenerating && (
              <p className="text-xs text-red-400 text-center">
                {t.ui.insufficientCreditsMessage} {credits} {t.common.credits}.
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Generated Images */}
        <div className="lg:col-span-7 card min-h-[600px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{t.ui.generatedImages}</h2>
            {output && output.length > 1 && (
              <span className="text-xs text-dark-400 bg-dark-800 px-2.5 py-1 rounded-lg">
                {output.length} {output.length === 1 ? t.ui.image : t.textToImage.nImages}
              </span>
            )}
          </div>
          
          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm flex-1">{error}</p>
              <button onClick={reset} className="text-red-400 hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {output && output.length > 0 ? (
            <ImageGallery
              images={output}
              onReset={reset}
              newGenerationLabel={t.textToImage.newGeneration}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-dark-800 flex items-center justify-center mb-4">
                <ImageIcon className="w-10 h-10 text-dark-600" />
              </div>
              <p className="text-dark-400 font-medium">{t.textToImage.noResults}</p>
              <p className="text-dark-500 text-sm mt-1">
                {t.ui.emptyMessage} {t.ui.image}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

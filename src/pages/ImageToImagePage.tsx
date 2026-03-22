import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wand2, ChevronDown, X, Image as ImageIcon, Download, AlertCircle, Zap, ZoomIn, RotateCcw, ArrowRight, Heart } from 'lucide-react'
import { useImageToImage, useSEO, SEO_PAGES } from '@/hooks'
import { useLanguage } from '@/i18n'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'
import { useGenerations } from '@/contexts/GenerationsContext'
import { useToast } from '@/components/Toast'
import { addFavorite, fetchFavoriteIds, removeFavorite } from '@/services/favorites'
import AuthModal from '@/components/AuthModal'
import { 
  IMAGE_TO_IMAGE_MODELS, 
  ModelConfig,
  AspectRatio,
} from '@/config/models'
import ImageUpload from '@/components/ImageUpload'
import { supabase } from '@/lib/supabase'
import { downloadFile, getGenerationFilename } from '@/utils/download'

export default function ImageToImagePage() {
  const { t } = useLanguage()
  const { isAuthenticated, user } = useAuth()
  const [searchParams] = useSearchParams()
  const { getCost } = useCredits()
  const { generations, removeGeneration } = useGenerations()
  const toast = useToast()
  
  // SEO meta tags
  useSEO(SEO_PAGES.imageToImage)
  
  const STYLE_PRESETS = useMemo(
    () => [
      { id: 'none', name: t.ui.none, description: t.ui.noAdditionalStyle },
      { id: 'enhance', name: t.ui.enhance, description: t.ui.improveQuality },
      { id: 'anime', name: t.ui.anime, description: t.ui.japaneseAnimeStyle },
      { id: 'photographic', name: t.ui.photographic, description: t.ui.photorealisticStyle },
      { id: 'digital-art', name: t.ui.digitalArt, description: t.ui.digitalArtStyle },
      { id: 'cinematic', name: t.ui.cinematic, description: t.ui.movieStyle },
    ],
    [t]
  )
  
  const getInitialInputImageUrl = () => searchParams.get('inputImageUrl') || null
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(getInitialInputImageUrl)
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<ModelConfig>(IMAGE_TO_IMAGE_MODELS[0])
  const [resolution, setResolution] = useState(selectedModel.defaultResolution)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(selectedModel.supportedAspectRatios[0])
  const [selectedStyleId, setSelectedStyleId] = useState('none')
  const [strength, setStrength] = useState(70)
  const [currentGenerationDbId, setCurrentGenerationDbId] = useState<string | null>(null)
  const [isResultFavorite, setIsResultFavorite] = useState(false)
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedStyle = useMemo(
    () => STYLE_PRESETS.find((style) => style.id === selectedStyleId) ?? STYLE_PRESETS[0],
    [STYLE_PRESETS, selectedStyleId]
  )

  const { isGenerating, status, output, error, progress, generate, cancel, reset, credits, restoreGeneration, predictionId } = useImageToImage()

  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  const promptSuggestions = useMemo(
    () => [
      t.imageToImage.promptSuggestions.portrait,
      t.imageToImage.promptSuggestions.product,
      t.imageToImage.promptSuggestions.background,
      t.imageToImage.promptSuggestions.color,
    ],
    [t]
  )

  const imageHistory = useMemo(() => {
    return generations
      .filter((generation) => generation.type === 'image-to-image' && generation.status === 'succeeded')
      .map((generation) => {
        const outputUrl = Array.isArray(generation.output)
          ? (generation.output[0] ?? null)
          : generation.output

        return {
          id: generation.id,
          prompt: generation.prompt || '',
          createdAt: generation.createdAt,
          outputUrl,
        }
      })
      .filter((generation) => !!generation.outputUrl)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
  }, [generations])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!lightboxOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [lightboxOpen])

  useEffect(() => {
    const syncFavoriteState = async () => {
      if (!user?.id || !predictionId || status !== 'succeeded') {
        setCurrentGenerationDbId(null)
        setIsResultFavorite(false)
        return
      }

      const { data, error: generationLookupError } = await supabase
        .from('generations')
        .select('id')
        .eq('user_id', user.id)
        .eq('replicate_prediction_id', predictionId)
        .maybeSingle()

      if (generationLookupError || !data?.id) {
        setCurrentGenerationDbId(null)
        setIsResultFavorite(false)
        return
      }

      setCurrentGenerationDbId(data.id)
      const favoriteIds = await fetchFavoriteIds(user.id)
      setIsResultFavorite(favoriteIds.has(data.id))
    }

    syncFavoriteState().catch(() => {
      setCurrentGenerationDbId(null)
      setIsResultFavorite(false)
    })
  }, [user?.id, predictionId, status])

  // Calculate credit cost
  const currentCost = useMemo(() => {
    return getCost('image-to-image', selectedModel.id, resolution)
  }, [getCost, selectedModel, resolution])

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
    if (!uploadedImageUrl) return
    
    try {
      await generate({
        imageUrl: uploadedImageUrl,
        prompt,
        negativePrompt: selectedModel.supportsNegativePrompt ? negativePrompt : undefined,
        model: selectedModel.id,
        transformType: selectedStyleId === 'enhance' ? 'enhance' : 'style-transfer',
        resolution,
        aspectRatio,
        style: selectedStyleId !== 'none' ? selectedStyleId : undefined,
        strength: strength / 100,
      })
    } catch (err) {
      console.error('Generation failed:', err)
    }
  }

  const handleToggleFavorite = async () => {
    if (!user?.id) {
      toast.error(t.toast.pleaseLogin)
      return
    }

    if (!currentGenerationDbId) {
      toast.error(t.common.error)
      return
    }

    setIsFavoriteLoading(true)
    try {
      if (isResultFavorite) {
        await removeFavorite(user.id, currentGenerationDbId)
        setIsResultFavorite(false)
        toast.success(t.toast.removedFromFavorites)
      } else {
        await addFavorite(user.id, currentGenerationDbId)
        setIsResultFavorite(true)
        toast.success(t.toast.addedToFavorites)
      }
    } catch {
      toast.error(t.toast.failedToUpdate)
    } finally {
      setIsFavoriteLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!output) {
      toast.error(t.toast.noFileAvailable)
      return
    }

    try {
      await downloadFile(output, getGenerationFilename('image', 'image-to-image'))
      toast.success(t.toast.downloadStarted)
    } catch (downloadError) {
      console.error('Download failed:', downloadError)
      toast.error(t.toast.downloadFailed)
    }
  }

  const handleUseResultAsInput = () => {
    if (!output) return

    setUploadedImageUrl(output)
    setLightboxOpen(false)
    reset()
  }

  const getModelIcon = (modelId: string) => {
    if (modelId.includes('flux')) return '⚡'
    if (modelId.includes('upscale') || modelId.includes('esrgan')) return '🔍'
    if (modelId.includes('stable')) return '🎨'
    return '🖼️'
  }

  const getModelDescription = (modelId: string, fallback: string) => {
    const descriptions: Record<string, string> = {
      'flux-img2img': t.imageToImage.modelDescriptions.fluxImg2img,
      'nano-banana-pro': t.imageToImage.modelDescriptions.nanoBananaPro,
      'seedream-4.5': t.imageToImage.modelDescriptions.seedream45,
    }

    return descriptions[modelId] || fallback
  }

  const getBadgeLabel = (badge: string) => {
    if (badge === 'NEW') return t.imageToImage.badges.new
    if (badge === 'POPULAR') return t.imageToImage.badges.popular
    if (badge === 'FAST') return t.imageToImage.badges.fast
    return badge
  }

  const getStatusText = () => {
    switch (status) {
      case 'starting': return t.status.starting
      case 'processing': return t.status.processing
      default: return t.common.generating
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">{t.imageToImage.title}</h1>
        <p className="text-dark-400 mt-1">{t.imageToImage.subtitle}</p>
      </div>

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
                  <p className="text-xs text-dark-400">{selectedModel.credits.base} {t.ui.creditsLabel.toLowerCase()} {t.ui.perImage}</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown List */}
            {isModelDropdownOpen && (
              <div className="mt-2 max-h-80 overflow-y-auto rounded-xl bg-dark-800 border border-dark-700">
                {IMAGE_TO_IMAGE_MODELS.map((model) => {
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
                                {getBadgeLabel(model.badge)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-dark-400">{getModelDescription(model.id, model.description)}</p>
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

          {/* Image Upload */}
          <div className="card">
            <label className="block text-sm font-medium text-dark-400 mb-3">{t.ui.originalImage}</label>
            <ImageUpload
              value={uploadedImageUrl}
              onChange={setUploadedImageUrl}
              disabled={isGenerating}
              aspectRatio="auto"
            />
          </div>

          {/* Prompt */}
          <div className="card">
            <label className="block text-sm font-medium text-dark-400 mb-2">{t.imageToImage.promptLabel}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.imageToImage.promptPlaceholder}
              className="w-full bg-dark-800 rounded-xl p-3 text-white placeholder-dark-500 resize-none focus:outline-none min-h-[80px]"
              disabled={isGenerating}
            />

            <div className="flex flex-wrap gap-2 mt-3">
              {promptSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setPrompt(suggestion)}
                  disabled={isGenerating}
                  className="px-3 py-1.5 rounded-lg bg-dark-800 text-dark-300 text-xs hover:bg-dark-700 hover:text-white transition-colors disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Negative Prompt */}
          {selectedModel.supportsNegativePrompt && (
            <div className="card">
              <label className="block text-sm font-medium text-dark-400 mb-2">{t.imageToImage.negativePromptLabel}</label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder={t.imageToImage.negativePromptPlaceholder}
                className="w-full bg-dark-800 rounded-xl p-3 text-white placeholder-dark-500 resize-none focus:outline-none min-h-[60px]"
                disabled={isGenerating}
              />
            </div>
          )}

          {/* Resolution */}
          {selectedModel.supportedResolutions.length > 1 && (
            <div className="card">
              <label className="block text-sm font-medium text-dark-400 mb-3">{t.imageToImage.resolutionLabel}</label>
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

          {/* Aspect Ratio */}
          {selectedModel.supportedAspectRatios.length > 1 && (
            <div className="card">
              <label className="block text-sm font-medium text-dark-400 mb-3">{t.imageToImage.aspectRatioLabel}</label>
              <div className="grid grid-cols-3 gap-2">
                {selectedModel.supportedAspectRatios.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    disabled={isGenerating}
                    className={`py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50 ${
                      aspectRatio === ratio
                        ? 'bg-purple-500 text-white'
                        : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                    }`}
                  >
                    {ratio === 'auto' ? 'Auto' : ratio}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Style Presets */}
          <div className="card">
            <label className="block text-sm font-medium text-dark-400 mb-3">{t.imageToImage.styleLabel}</label>
            <div className="grid grid-cols-3 gap-2">
              {STYLE_PRESETS.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyleId(style.id)}
                  disabled={isGenerating}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-all disabled:opacity-50 ${
                    selectedStyleId === style.id
                      ? 'bg-purple-500 text-white'
                      : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  {style.name}
                </button>
              ))}
            </div>
          </div>

          {/* Transformation Strength */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-dark-400">{t.imageToImage.strengthLabel}</label>
              <span className="text-xs text-dark-500">{strength}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              disabled={isGenerating}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-dark-500 mt-1">
              <span>{t.imageToImage.subtle}</span>
              <span>{t.imageToImage.strong}</span>
            </div>
          </div>

          {/* Auth Modal */}
          <AuthModal
            isOpen={showAuthPrompt}
            onClose={() => setShowAuthPrompt(false)}
          />

          {/* Cost & Generate Button */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-dark-400">{t.ui.estimatedCost}</span>
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 font-bold">{currentCost}</span>
                <span className="text-dark-400 text-sm">{t.ui.creditsLabel}</span>
              </div>
            </div>

            {/* Progress Bar */}
            {isGenerating && (
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-dark-400">{getStatusText()}</span>
                  <span className="text-purple-400">{progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-dark-800 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {isGenerating ? (
              <button
                onClick={cancel}
                className="w-full py-3.5 rounded-xl bg-dark-700 text-white font-medium flex items-center justify-center gap-2 hover:bg-dark-600 transition-colors"
              >
                <X className="w-5 h-5" />
                {t.common.cancel}
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!uploadedImageUrl || isGenerating || (isAuthenticated && credits < currentCost)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium flex items-center justify-center gap-2 hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wand2 className="w-5 h-5" />
                {t.imageToImage.generateButton} | {currentCost} {t.ui.creditsLabel}
              </button>
            )}

            {isAuthenticated && credits < currentCost && !isGenerating && (
              <p className="text-xs text-red-400 text-center">
                {t.common.insufficientCredits}. {t.pricing.youHave} {credits} {t.ui.creditsLabel.toLowerCase()}.
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Generated Images */}
        <div className="lg:col-span-7 card min-h-[600px] flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-4">{t.ui.generatedImages}</h2>
          
          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm flex-1">{error}</p>
              <button
                onClick={handleGenerate}
                disabled={!uploadedImageUrl || isGenerating}
                className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.common.retry}
              </button>
              <button onClick={reset} className="text-red-400 hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isGenerating ? (
            <div className="flex-1 flex flex-col">
              <div className="relative flex-1 bg-dark-800/50 rounded-2xl overflow-hidden border border-dark-700/50 min-h-[350px] animate-pulse">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-dark-700 mx-auto mb-3" />
                    <p className="text-dark-400 text-sm">{getStatusText()}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 animate-pulse">
                <div className="h-20 rounded-xl bg-dark-800 border border-dark-700/50" />
                <div className="h-20 rounded-xl bg-dark-800 border border-dark-700/50" />
              </div>

              <div className="mt-4 h-10 rounded-xl bg-dark-800 border border-dark-700/50 animate-pulse" />
            </div>
          ) : output ? (
            <div className="flex-1 flex flex-col">
              {/* Main Result Image */}
              <div
                className="relative group flex-1 flex items-center justify-center bg-dark-800/50 rounded-2xl overflow-hidden cursor-pointer border border-dark-700/50 min-h-[350px]"
                onClick={() => setLightboxOpen(true)}
              >
                <img
                  src={output}
                  alt="Generated"
                  className="w-full h-full max-h-[450px] object-contain p-2"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-dark-900/80 backdrop-blur-sm rounded-full p-3">
                    <ZoomIn className="w-6 h-6 text-white" />
                  </div>
                </div>
                <span className="absolute top-3 left-3 text-xs font-medium bg-purple-500/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-white">
                  {t.ui.result}
                </span>
              </div>

              {/* Before → After Strip */}
              {uploadedImageUrl && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="relative flex-1 group/orig cursor-pointer rounded-xl overflow-hidden border border-dark-700/50" onClick={() => setLightboxOpen(true)}>
                    <img
                      src={uploadedImageUrl}
                      alt="Original"
                      className="w-full h-20 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-900/70 to-transparent" />
                    <span className="absolute bottom-1.5 left-2 text-[10px] font-medium text-dark-300">
                      {t.ui.originalImage}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-dark-500 flex-shrink-0" />
                  <div className="relative flex-1 group/result cursor-pointer rounded-xl overflow-hidden border border-purple-500/30" onClick={() => setLightboxOpen(true)}>
                    <img
                      src={output}
                      alt="Result"
                      className="w-full h-20 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-900/70 to-transparent" />
                    <span className="absolute bottom-1.5 left-2 text-[10px] font-medium text-purple-300">
                      {t.ui.result}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-4">
                <button
                  onClick={handleDownload}
                  className="py-2.5 rounded-xl bg-dark-800 text-white font-medium flex items-center justify-center gap-2 hover:bg-dark-700 transition-colors border border-dark-700/50"
                >
                  <Download className="w-4 h-4" />
                  {t.common.download}
                </button>
                <button
                  onClick={handleUseResultAsInput}
                  className="py-2.5 rounded-xl bg-dark-800 text-primary-300 font-medium hover:bg-dark-700 transition-colors flex items-center justify-center gap-2 border border-primary-500/30"
                >
                  <ArrowRight className="w-4 h-4" />
                  {t.imageToImage.useResultAsInput}
                </button>
                <button
                  onClick={handleToggleFavorite}
                  disabled={!currentGenerationDbId || isFavoriteLoading}
                  className={`py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border ${
                    isResultFavorite
                      ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                      : 'bg-dark-800 text-dark-300 border-dark-700/50 hover:bg-dark-700 hover:text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Heart className={`w-4 h-4 ${isResultFavorite ? 'fill-current' : ''}`} />
                  {isResultFavorite ? t.common.unfavorite : t.common.favorite}
                </button>
                <button 
                  onClick={reset} 
                  className="py-2.5 rounded-xl bg-purple-500/20 text-purple-400 font-medium hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t.imageToImage.newGeneration}
                </button>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-dark-300 mb-3">{t.imageToImage.historyTitle}</h3>
                {imageHistory.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {imageHistory.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => restoreGeneration(item.id)}
                        className="group relative rounded-xl overflow-hidden border border-dark-700/60 hover:border-primary-500/60 transition-colors bg-dark-900"
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={t.common.delete}
                          onClick={(event) => {
                            event.stopPropagation()
                            removeGeneration(item.id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              event.stopPropagation()
                              removeGeneration(item.id)
                            }
                          }}
                          className="absolute top-1.5 right-1.5 z-10 p-1 rounded-md bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                        <img
                          src={item.outputUrl || ''}
                          alt={t.ui.result}
                          className="w-full h-20 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <span className="absolute bottom-1.5 left-2 right-2 text-[10px] text-white/90 text-left truncate">
                          {item.prompt || t.ui.result}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-dark-500">{t.imageToImage.historyEmpty}</p>
                )}
              </div>

              {/* Lightbox Modal */}
              {lightboxOpen && (
                <div
                  className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                  onClick={() => setLightboxOpen(false)}
                >
                  <button
                    className="absolute top-4 right-4 text-white/70 hover:text-white z-50 bg-dark-800/60 backdrop-blur-sm rounded-full p-2"
                    onClick={() => setLightboxOpen(false)}
                  >
                    <X className="w-6 h-6" />
                  </button>

                  {/* Side by side in lightbox */}
                  <div className="flex flex-col md:flex-row items-center gap-4 max-w-6xl w-full max-h-none md:max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                    {uploadedImageUrl && (
                      <>
                        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                          <img
                            src={uploadedImageUrl}
                            alt="Original"
                            className="max-h-[38vh] md:max-h-[75vh] max-w-full object-contain rounded-xl"
                          />
                          <span className="text-sm text-dark-400 font-medium">{t.ui.originalImage}</span>
                        </div>
                        <ArrowRight className="w-6 h-6 text-dark-500 flex-shrink-0" />
                      </>
                    )}
                    <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                      <img
                        src={output}
                        alt="Result"
                        className="max-h-[38vh] md:max-h-[75vh] max-w-full object-contain rounded-xl"
                      />
                      <span className="text-sm text-purple-400 font-medium">{t.ui.result}</span>
                    </div>
                  </div>

                  {/* Download from lightbox */}
                  <button
                    className="absolute bottom-4 right-4 bg-dark-800/80 backdrop-blur-sm text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-dark-700 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownload()
                    }}
                  >
                    <Download className="w-4 h-4" />
                    {t.common.download}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-dark-800 flex items-center justify-center mb-4">
                <ImageIcon className="w-10 h-10 text-dark-600" />
              </div>
              <p className="text-dark-400 font-medium">{t.imageToImage.noResults}</p>
              <p className="text-dark-500 text-sm mt-1">
                {t.imageToImage.uploadHint}
              </p>

              <div className="w-full mt-8 text-left">
                <h3 className="text-sm font-medium text-dark-300 mb-3">{t.imageToImage.historyTitle}</h3>
                {imageHistory.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {imageHistory.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => restoreGeneration(item.id)}
                        className="group relative rounded-xl overflow-hidden border border-dark-700/60 hover:border-primary-500/60 transition-colors bg-dark-900"
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={t.common.delete}
                          onClick={(event) => {
                            event.stopPropagation()
                            removeGeneration(item.id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              event.stopPropagation()
                              removeGeneration(item.id)
                            }
                          }}
                          className="absolute top-1.5 right-1.5 z-10 p-1 rounded-md bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                        <img
                          src={item.outputUrl || ''}
                          alt={t.ui.result}
                          className="w-full h-20 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <span className="absolute bottom-1.5 left-2 right-2 text-[10px] text-white/90 text-left truncate">
                          {item.prompt || t.ui.result}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-dark-500">{t.imageToImage.historyEmpty}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

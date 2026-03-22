import { useState, useRef, useCallback } from 'react'
import { Upload, X, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { uploadFileToSupabase } from '@/utils/storage'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const API_BASE_URL = SUPABASE_URL 
  ? `${SUPABASE_URL}/functions/v1` 
  : import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface ImageUploadProps {
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
  className?: string
  aspectRatio?: '16:9' | '9:16' | '1:1' | 'auto'
  maxSizeMB?: number
  acceptedFormats?: string[]
}

interface UploadResponse {
  url: string
  filename: string
  size: number
  mimetype: string
}

export default function ImageUpload({
  value,
  onChange,
  disabled = false,
  className = '',
  aspectRatio = 'auto',
  maxSizeMB = 10,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
}: ImageUploadProps) {
  const { t } = useLanguage()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '16:9': return 'aspect-video'
      case '9:16': return 'aspect-[9/16]'
      case '1:1': return 'aspect-square'
      default: return 'aspect-video'
    }
  }

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedFormats.includes(file.type)) {
      return t.errors.invalidFile
    }

    // Check file size
    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes) {
      return t.errors.fileTooLarge
    }

    return null
  }

  const uploadFile = async (file: File): Promise<string> => {
    // In production (Supabase), upload directly to Storage to avoid CORS issues
    if (SUPABASE_URL) {
      setUploadProgress(20)
      const result = await uploadFileToSupabase(file, 'images')
      if (!result.publicUrl) {
        throw new Error(t.errors.generic)
      }
      setUploadProgress(100)
      return result.publicUrl
    }

    // Local dev fallback (server API)
    const formData = new FormData()
    formData.append('image', file)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response: UploadResponse = JSON.parse(xhr.responseText)
            resolve(response.url)
          } catch {
            reject(new Error(t.errors.generic))
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.error || t.errors.generic))
          } catch {
            reject(new Error(t.errors.generic))
          }
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error(t.errors.network))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error(t.status.canceled))
      })

      xhr.open('POST', `${API_BASE_URL}/api/upload`)
      xhr.send(formData)
    })
  }

  const handleFile = useCallback(async (file: File) => {
    setError(null)

    // Validate
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    // Create local preview immediately
    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)

    // Upload to server
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const uploadedUrl = await uploadFile(file)
      onChange(uploadedUrl)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.imageUpload.uploadError)
      setPreviewUrl(null)
      onChange(null)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      // Clean up local preview URL
      URL.revokeObjectURL(localPreview)
    }
  }, [onChange, acceptedFormats, maxSizeMB, t])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && !isUploading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled || isUploading) return

    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleFile(file)
    } else {
      setError(t.imageUpload.dragOnlyImages)
    }
  }

  const handleClear = () => {
    onChange(null)
    setPreviewUrl(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click()
    }
  }

  const displayUrl = value || previewUrl

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {displayUrl ? (
        // Image Preview
        <div className={`relative ${getAspectRatioClass()} rounded-xl overflow-hidden bg-dark-800 border border-dark-700`}>
          <img
            src={displayUrl}
            alt="Preview"
            className="absolute inset-0 w-full h-full object-contain"
          />
          
          {/* Uploading Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
              <div className="w-32 h-2 bg-dark-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
                <span className="text-sm text-dark-300">{t.imageUpload.uploading} {uploadProgress}%</span>
            </div>
          )}

          {/* Clear Button */}
          {!isUploading && !disabled && (
            <button
              onClick={handleClear}
              className="absolute top-3 right-3 p-2 bg-dark-900/80 rounded-lg hover:bg-red-500/80 transition-colors group"
            >
              <X className="w-4 h-4 text-dark-300 group-hover:text-white" />
            </button>
          )}

          {/* Change Image Button */}
          {!isUploading && !disabled && (
            <button
              onClick={handleClick}
              className="absolute bottom-3 right-3 px-3 py-1.5 bg-dark-900/80 rounded-lg hover:bg-dark-700/90 transition-colors text-xs text-dark-300 hover:text-white flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {t.imageUpload.change}
            </button>
          )}
        </div>
      ) : (
        // Upload Dropzone
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            ${getAspectRatioClass()}
            rounded-xl border-2 border-dashed transition-all cursor-pointer
            flex flex-col items-center justify-center gap-3
            ${isDragging 
              ? 'border-primary-400 bg-primary-500/10' 
              : 'border-dark-600 bg-dark-800/50 hover:border-dark-500 hover:bg-dark-800'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
              <div className="w-32 h-2 bg-dark-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
                <span className="text-sm text-dark-400">{t.imageUpload.uploading} {uploadProgress}%</span>
            </>
          ) : (
            <>
              <div className={`p-4 rounded-full ${isDragging ? 'bg-primary-500/20' : 'bg-dark-700'}`}>
                {isDragging ? (
                  <ImageIcon className="w-8 h-8 text-primary-400" />
                ) : (
                  <Upload className="w-8 h-8 text-dark-400" />
                )}
              </div>
              <div className="text-center px-4">
                <p className="text-dark-300 font-medium">
                  {isDragging ? t.imageUpload.dropHere : t.imageUpload.dragOrClick}
                </p>
                <p className="text-xs text-dark-500 mt-1">
                  {acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')} • {t.imageUpload.max} {maxSizeMB}MB
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-2 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

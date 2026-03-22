/**
 * Downloads a file from a URL with proper filename
 * Works with both same-origin and cross-origin URLs
 */
export async function downloadFile(url: string, filename?: string): Promise<void> {
  try {
    // If no filename provided, extract from URL or use timestamp
    if (!filename) {
      const urlParts = url.split('/')
      const urlFilename = urlParts[urlParts.length - 1].split('?')[0]
      filename = urlFilename || `lumivids-${Date.now()}`
    }

    // Ensure proper extension
    if (!filename.match(/\.(mp4|webm|mov|gif|jpg|jpeg|png|webp)$/i)) {
      // Try to detect from URL or default to appropriate extension
      if (url.includes('.mp4') || url.includes('video')) {
        filename += '.mp4'
      } else if (url.includes('.webm')) {
        filename += '.webm'
      } else if (url.includes('.gif')) {
        filename += '.gif'
      } else if (url.includes('.png')) {
        filename += '.png'
      } else if (url.includes('.webp')) {
        filename += '.webp'
      } else {
        // Default to jpg for images
        filename += '.jpg'
      }
    }

    // Fetch the file
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`)
    }

    const blob = await response.blob()
    
    // Create download link
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100)
  } catch (error) {
    console.error('Download failed:', error)
    // Fallback: try to open in new tab
    window.open(url, '_blank')
  }
}

/**
 * Downloads multiple files sequentially
 */
export async function downloadMultipleFiles(
  urls: string[],
  baseFilename: string = 'lumivids'
): Promise<void> {
  for (let i = 0; i < urls.length; i++) {
    const filename = urls.length > 1 ? `${baseFilename}-${i + 1}` : baseFilename
    await downloadFile(urls[i], filename)
    // Small delay between downloads to avoid browser blocking
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }
}

/**
 * Gets appropriate filename based on generation type and timestamp
 */
export function getGenerationFilename(
  type: 'video' | 'image',
  prefix: string = 'lumivids'
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const extension = type === 'video' ? 'mp4' : 'png'
  return `${prefix}-${timestamp}.${extension}`
}

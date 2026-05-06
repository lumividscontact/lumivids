type ModelLogoAsset = {
  alt: string
  src: string
}

function getModelLogoAsset(modelId: string): ModelLogoAsset | null {
  if (modelId.includes('seedance') || modelId.includes('seedream')) {
    return {
      alt: 'ByteDance',
      src: '/model-logos/bytedance.png',
    }
  }

  if (modelId.includes('flux')) {
    return {
      alt: 'Black Forest Labs',
      src: '/model-logos/blackforestlabs.ico',
    }
  }

  if (modelId.includes('stable')) {
    return {
      alt: 'Stability AI',
      src: '/model-logos/stability.png',
    }
  }

  if (modelId.includes('ideogram')) {
    return {
      alt: 'Ideogram',
      src: '/model-logos/ideogram.svg',
    }
  }

  if (modelId.includes('grok')) {
    return {
      alt: 'Grok',
      src: '/model-logos/grok.png',
    }
  }

  if (modelId.includes('google-veo') || modelId.includes('nano-banana') || modelId.includes('imagen')) {
    return {
      alt: 'Google',
      src: '/model-logos/google.ico',
    }
  }

  if (modelId.includes('openai-sora') || modelId.includes('gpt-image-2')) {
    return {
      alt: 'OpenAI',
      src: '/model-logos/openai.png',
    }
  }

  if (modelId.includes('kling')) {
    return {
      alt: 'Kling',
      src: '/model-logos/kling.ico',
    }
  }

  if (modelId.includes('hailuo')) {
    return {
      alt: 'Hailuo',
      src: '/model-logos/hailuo.ico',
    }
  }

  if (modelId.includes('wan')) {
    return {
      alt: 'Wan',
      src: '/model-logos/wan.ico',
    }
  }

  if (modelId.includes('p-video') || modelId.includes('pruna')) {
    return {
      alt: 'Pruna AI',
      src: '/model-logos/pruna.svg',
    }
  }

  if (modelId.includes('runway')) {
    return {
      alt: 'Runway',
      src: '/model-logos/runway.png',
    }
  }

  return null
}

type ModelLogoProps = {
  modelId: string
  className?: string
  containerClassName?: string
}

export default function ModelLogo({
  modelId,
  className = 'h-5 w-5',
  containerClassName = 'flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/95 p-1 ring-1 ring-white/10',
}: ModelLogoProps) {
  const asset = getModelLogoAsset(modelId)

  if (!asset) {
    return (
      <span
        className={containerClassName}
        aria-hidden="true"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-900">AI</span>
      </span>
    )
  }

  return (
    <span className={containerClassName}>
      <img
        src={asset.src}
        alt={`${asset.alt} logo`}
        className={`${className} object-contain`}
        loading="lazy"
        decoding="async"
      />
    </span>
  )
}
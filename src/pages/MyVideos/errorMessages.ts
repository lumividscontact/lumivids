import { MyVideosTranslations } from './types'

export function getFriendlyFailureReason(
  rawError: string | undefined,
  translations: MyVideosTranslations,
): string {
  if (!rawError) {
    return translations.failedReasonUnknown
  }

  const normalized = rawError.toLowerCase()

  if (
    normalized.includes('timeout')
    || normalized.includes('timed out')
    || normalized.includes('deadline')
  ) {
    return translations.failedReasonTimeout
  }

  if (
    normalized.includes('moderation')
    || normalized.includes('policy')
    || normalized.includes('safety')
    || normalized.includes('content')
  ) {
    return translations.failedReasonModeration
  }

  if (
    normalized.includes('invalid')
    || normalized.includes('unsupported')
    || normalized.includes('input')
    || normalized.includes('format')
    || normalized.includes('resolution')
  ) {
    return translations.failedReasonInput
  }

  if (
    normalized.includes('rate limit')
    || normalized.includes('too many requests')
    || normalized.includes('quota')
    || normalized.includes('unavailable')
    || normalized.includes('overloaded')
    || normalized.includes('503')
  ) {
    return translations.failedReasonUnavailable
  }

  return translations.failedReasonUnknown
}

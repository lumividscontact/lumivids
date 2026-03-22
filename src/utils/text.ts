/**
 * Truncate text at the nearest word boundary, avoiding mid-word cuts.
 * Falls back to a hard cut if the last space is too far from the target length.
 */
export function truncateAtWordBoundary(text: string, maxChars = 30): string {
  if (text.length <= maxChars) return text

  const candidate = text.slice(0, maxChars + 1)
  const lastSpaceIndex = candidate.lastIndexOf(' ')
  const cutoff = lastSpaceIndex > Math.floor(maxChars * 0.6) ? lastSpaceIndex : maxChars

  return `${text.slice(0, cutoff).trimEnd()}...`
}

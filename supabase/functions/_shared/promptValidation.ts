/** Maximum allowed prompt length in characters */
export const MAX_PROMPT_LENGTH = 10_000

/** Maximum number of outputs per text-to-image request */
export const MAX_NUM_OUTPUTS = 4

/**
 * Validates and sanitizes a prompt string.
 * Returns { valid: true, prompt } on success, or { valid: false, error } on failure.
 */
export function validatePrompt(
  prompt: unknown,
): { valid: true; prompt: string } | { valid: false; error: string } {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'Prompt is required' }
  }

  const trimmed = prompt.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'Prompt is required' }
  }

  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      error: `Prompt too long (${trimmed.length} chars). Maximum is ${MAX_PROMPT_LENGTH} characters.`,
    }
  }

  return { valid: true, prompt: trimmed }
}

/**
 * Clamp numOutputs to a safe range [1, MAX_NUM_OUTPUTS].
 */
export function clampNumOutputs(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(Math.floor(n), MAX_NUM_OUTPUTS)
}

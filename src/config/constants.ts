/**
 * APPLICATION CONSTANTS
 * 
 * Centralized configuration values used across the application.
 * This file is the single source of truth for magic numbers and strings.
 */

// ============================================
// CREDITS CONFIGURATION
// ============================================

/**
 * Initial credits given to new users (welcome bonus)
 */
export const INITIAL_CREDITS = 10

/**
 * Minimum credits percentage to show "low credits" warning
 */
export const LOW_CREDITS_THRESHOLD_PERCENT = 10

/**
 * Default credits to show when user has no data
 */
export const DEFAULT_CREDITS = 0

/**
 * LocalStorage key for caching user credits
 */
export const USER_CREDITS_CACHE_KEY = 'lumivids_user_credits'

// ============================================
// CACHE CONFIGURATION
// ============================================

/**
 * How long to cache credits data before refreshing (in milliseconds)
 */
export const CREDITS_CACHE_DURATION_MS = 30_000 // 30 seconds

/**
 * Debounce time for rapid credit refresh calls (in milliseconds)
 */
export const CREDITS_DEBOUNCE_MS = 500

// ============================================
// POLLING CONFIGURATION
// ============================================

/**
 * Initial polling interval for checking prediction status (in milliseconds)
 */
export const POLLING_INITIAL_INTERVAL_MS = 1_000 // 1 second

/**
 * Maximum polling interval (exponential backoff cap) (in milliseconds)
 */
export const POLLING_MAX_INTERVAL_MS = 8_000 // 8 seconds

/**
 * Multiplier for exponential backoff
 */
export const POLLING_BACKOFF_MULTIPLIER = 1.5

/**
 * Maximum time to wait for a prediction before timing out (in milliseconds)
 */
export const POLLING_TIMEOUT_MS = 600_000 // 10 minutes

// ============================================
// PAGINATION
// ============================================

/**
 * Default page size for galleries and lists
 */
export const DEFAULT_PAGE_SIZE = 12

/**
 * Maximum page size allowed
 */
export const MAX_PAGE_SIZE = 50

// ============================================
// UPLOAD LIMITS
// ============================================

/**
 * Maximum file size for image uploads (in bytes)
 */
export const MAX_IMAGE_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Maximum file size for video uploads (in bytes)
 */
export const MAX_VIDEO_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB

/**
 * Allowed image MIME types
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

/**
 * Allowed video MIME types
 */
export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const

// ============================================
// SUBSCRIPTION ALERTS
// ============================================

/**
 * Days before expiration to show renewal warning
 */
export const SUBSCRIPTION_WARNING_DAYS = 7

// ============================================
// GENERATION LIMITS
// ============================================

/**
 * Maximum concurrent generations per user (varies by plan)
 */
export const MAX_CONCURRENT_GENERATIONS = {
  free: 1,
  creator: 2,
  studio: 3,
  director: 5,
} as const

// ============================================
// UI CONSTANTS
// ============================================

/**
 * Toast notification duration (in milliseconds)
 */
export const TOAST_DURATION_MS = 5_000 // 5 seconds

/**
 * Animation duration for modals (in milliseconds)
 */
export const MODAL_ANIMATION_MS = 200

// ============================================
// API RATE LIMITS
// ============================================

/**
 * Minimum time between API calls for the same operation (in milliseconds)
 */
export const API_RATE_LIMIT_MS = 1_000 // 1 second

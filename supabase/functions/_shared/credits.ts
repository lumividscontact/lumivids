import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { 
  CREDIT_COSTS, 
  calculateCreditCost as calculateCost, 
  type OperationType, 
  type Resolution 
} from './creditCosts.ts'

// Re-export for backwards compatibility
export { CREDIT_COSTS, type OperationType, type Resolution }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface CreditCalculationParams {
  model: string
  duration?: number
  resolution?: string
  withAudio?: boolean
  numOutputs?: number
}

interface ModelRuntimeSettings {
  isEnabled: boolean
  creditCostOverride: number | null
}

/**
 * Calculate the credit cost for a generation
 * Uses centralized credit costs from creditCosts.ts
 */
export async function getModelRuntimeSettings(model: string): Promise<ModelRuntimeSettings> {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data, error } = await supabaseAdmin
    .from('ai_model_settings')
    .select('is_enabled, credit_cost_override')
    .eq('model_id', model)
    .maybeSingle()

  if (error || !data) {
    return { isEnabled: true, creditCostOverride: null }
  }

  return {
    isEnabled: data.is_enabled !== false,
    creditCostOverride: typeof data.credit_cost_override === 'number' ? data.credit_cost_override : null,
  }
}

export async function ensureModelEnabled(model: string): Promise<void> {
  const settings = await getModelRuntimeSettings(model)
  if (!settings.isEnabled) {
    throw new Error('MODEL_DISABLED')
  }
}

export async function calculateCreditCost(
  operationType: OperationType,
  params: CreditCalculationParams
): Promise<number> {
  const { model, duration = 5, resolution = '720p', withAudio = false, numOutputs = 1 } = params

  const settings = await getModelRuntimeSettings(model)
  if (typeof settings.creditCostOverride === 'number' && Number.isFinite(settings.creditCostOverride)) {
    const override = Math.max(0, Math.trunc(settings.creditCostOverride))
    return override * Math.max(1, numOutputs)
  }

  return calculateCost(operationType, model, duration, resolution as Resolution, withAudio, numOutputs)
}

/**
 * Get user from authorization header
 */
export async function getUserFromAuth(req: Request): Promise<{ userId: string | null; error: string | null }> {
  const authHeader = req.headers.get('Authorization')
  const xSupabaseAuth = req.headers.get('x-supabase-auth')
  const finalAuthHeader = authHeader || xSupabaseAuth

  if (!finalAuthHeader) {
    return { userId: null, error: 'Not authenticated' }
  }

  const token = finalAuthHeader.startsWith('Bearer ')
    ? finalAuthHeader.replace('Bearer ', '')
    : finalAuthHeader

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    return { userId: null, error: 'Invalid token' }
  }

  return { userId: user.id, error: null }
}

/**
 * Deduct credits from user account (atomic operation)
 * Returns true if successful, false if insufficient credits
 */
export async function deductCredits(
  userId: string,
  amount: number,
  description?: string,
  referenceId?: string
): Promise<{ success: boolean; error: string | null; newBalance?: number }> {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Use RPC for atomic credit deduction
  const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
    user_id: userId,
    amount: amount,
  })

  if (error) {
    console.error('[Credits] Deduction error:', error)
    return { success: false, error: error.message }
  }

  if (data === false) {
    return { success: false, error: 'Insufficient credits' }
  }

  // Get new balance for response
  const { data: creditsData } = await supabaseAdmin
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single()

  console.log(`[Credits] Deducted ${amount} credits from user ${userId}. New balance: ${creditsData?.credits}`)

  return { success: true, error: null, newBalance: creditsData?.credits }
}

/**
 * Refund credits to user account (for failed generations)
 */
export async function refundCredits(
  userId: string,
  amount: number,
  description?: string,
  referenceId?: string
): Promise<{ success: boolean; error: string | null }> {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { error } = await supabaseAdmin.rpc('refund_credits', {
    user_id: userId,
    amount: amount,
  })

  if (error) {
    console.warn('[Credits] refund_credits RPC unavailable, falling back to add_credits:', error.message)

    const { error: fallbackError } = await supabaseAdmin.rpc('add_credits', {
      user_id: userId,
      amount: amount,
    })

    if (fallbackError) {
      console.error('[Credits] Refund error:', fallbackError)
      return { success: false, error: fallbackError.message }
    }
  }

  console.log(`[Credits] Refunded ${amount} credits to user ${userId}`)
  return { success: true, error: null }
}

/**
 * Atomically claim refundable credits from a generation.
 * Returns the claimed amount (0 if already claimed/not refundable).
 */
export async function claimRefundableCredits(
  userId: string,
  predictionId: string,
  newStatus: 'failed' | 'canceled'
): Promise<{ success: boolean; error: string | null; amount: number }> {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data, error } = await supabaseAdmin.rpc('claim_generation_refund_credits', {
    p_user_id: userId,
    p_prediction_id: predictionId,
    p_status: newStatus,
  })

  if (error) {
    console.error('[Credits] Claim refundable credits error:', error)
    return { success: false, error: error.message, amount: 0 }
  }

  const amount = typeof data === 'number' ? data : 0
  return { success: true, error: null, amount }
}

/**
 * Check if user has enough credits
 */
export async function checkCredits(userId: string, amount: number): Promise<{ hasEnough: boolean; currentBalance: number }> {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data, error } = await supabaseAdmin
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return { hasEnough: false, currentBalance: 0 }
  }

  return { hasEnough: data.credits >= amount, currentBalance: data.credits }
}

export interface SubscriptionStatus {
  isActive: boolean
  isExpired: boolean
  isPastDue: boolean
  isCanceling: boolean
  plan: string | null
  currentPeriodEnd: Date | null
  daysUntilExpiration: number | null
}

/**
 * Check subscription status including expiration
 * Returns detailed status about the subscription
 */
export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: subscription, error } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !subscription) {
    return {
      isActive: false,
      isExpired: false,
      isPastDue: false,
      isCanceling: false,
      plan: null,
      currentPeriodEnd: null,
      daysUntilExpiration: null,
    }
  }

  const now = new Date()
  const periodEnd = subscription.current_period_end 
    ? new Date(subscription.current_period_end) 
    : null

  // Calculate days until expiration
  let daysUntilExpiration: number | null = null
  if (periodEnd) {
    const diffMs = periodEnd.getTime() - now.getTime()
    daysUntilExpiration = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  }

  // Check if subscription has expired (period end is in the past)
  const isExpired = periodEnd ? periodEnd < now : false

  // If expired and status is still 'active', update it
  if (isExpired && subscription.status === 'active') {
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('user_id', userId)
    
    console.log(`[Subscription] Marked subscription as expired for user ${userId}`)
  }

  return {
    isActive: subscription.status === 'active' && !isExpired,
    isExpired,
    isPastDue: subscription.status === 'past_due',
    isCanceling: subscription.cancel_at_period_end === true,
    plan: subscription.plan,
    currentPeriodEnd: periodEnd,
    daysUntilExpiration,
  }
}

/**
 * Update usage statistics for a user
 * Upserts a record aggregating daily usage by generation type
 */
export async function updateUsageStats(
  userId: string,
  generationType: string,
  creditsUsed: number,
  durationSeconds: number = 0
): Promise<{ success: boolean; error: string | null }> {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // Try to upsert - increment existing or insert new
  const { error } = await supabaseAdmin
    .from('usage_stats')
    .upsert(
      {
        user_id: userId,
        date: today,
        generation_type: generationType,
        generation_count: 1,
        credits_used: creditsUsed,
        total_duration_seconds: durationSeconds,
      },
      {
        onConflict: 'user_id,date,generation_type',
        ignoreDuplicates: false,
      }
    )
    .select()

  if (error) {
    // If upsert fails, try manual increment with update
    const { error: updateError } = await supabaseAdmin.rpc('increment_usage_stats', {
      p_user_id: userId,
      p_date: today,
      p_generation_type: generationType,
      p_credits_used: creditsUsed,
      p_duration_seconds: durationSeconds,
    })

    if (updateError) {
      console.error('[UsageStats] Update error:', updateError)
      // Don't fail the generation for stats error
      return { success: false, error: updateError.message }
    }
  }

  console.log(`[UsageStats] Updated stats for user ${userId}: ${generationType}, ${creditsUsed} credits`)
  return { success: true, error: null }
}

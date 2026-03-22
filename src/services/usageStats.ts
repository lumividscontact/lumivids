import { supabase } from '@/lib/supabase'

export type GenerationType = 'text-to-video' | 'image-to-video' | 'text-to-image' | 'image-to-image'

let usageStatsDisabledReason: string | null = null
let hasWarnedUsageStatsDisabled = false

function disableUsageStats(reason: string) {
  usageStatsDisabledReason = reason
  if (!hasWarnedUsageStatsDisabled) {
    console.warn('[UsageStats] Disabled:', reason)
    hasWarnedUsageStatsDisabled = true
  }
}

/**
 * Update usage statistics for the current user
 * This tracks daily usage by generation type
 */
export async function updateUsageStats(
  generationType: GenerationType,
  creditsUsed: number,
  durationSeconds: number = 0
): Promise<boolean> {
  if (usageStatsDisabledReason) {
    return false
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // Try RPC first (atomic increment)
    const { error: rpcError } = await supabase.rpc('increment_usage_stats', {
      p_user_id: user.id,
      p_date: today,
      p_generation_type: generationType,
      p_credits_used: creditsUsed,
      p_duration_seconds: durationSeconds,
    })

    if (rpcError) {
      if (
        rpcError.code === 'PGRST202'
        || rpcError.message.includes('Could not find the function')
      ) {
        disableUsageStats('RPC increment_usage_stats not available in current schema')
        return false
      }

      if (
        rpcError.code === '42501'
        || rpcError.message.toLowerCase().includes('permission denied')
      ) {
        disableUsageStats('RPC increment_usage_stats not permitted by RLS/policies')
        return false
      }

      console.warn('[UsageStats] RPC failed, trying upsert:', rpcError.message)
      
      // Fallback: direct upsert (may have race conditions but better than nothing)
      // First try to get existing record
      const { data: existing } = await supabase
        .from('usage_stats')
        .select('id, generation_count, credits_used, total_duration_seconds')
        .eq('user_id', user.id)
        .eq('date', today)
        .eq('generation_type', generationType)
        .maybeSingle()

      if (existing) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('usage_stats')
          .update({
            generation_count: existing.generation_count + 1,
            credits_used: existing.credits_used + creditsUsed,
            total_duration_seconds: existing.total_duration_seconds + durationSeconds,
          })
          .eq('id', existing.id)

        if (updateError) {
          if (updateError.code === '42501') {
            disableUsageStats('usage_stats update not permitted by RLS/policies')
            return false
          }
          console.error('[UsageStats] Update error:', updateError)
          return false
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('usage_stats')
          .insert({
            user_id: user.id,
            date: today,
            generation_type: generationType,
            generation_count: 1,
            credits_used: creditsUsed,
            total_duration_seconds: durationSeconds,
          })

        if (insertError) {
          if (insertError.code === '42501') {
            disableUsageStats('usage_stats insert not permitted by RLS/policies')
            return false
          }
          console.error('[UsageStats] Insert error:', insertError)
          return false
        }
      }
    }

    return true
  } catch (error) {
    console.error('[UsageStats] Error:', error)
    return false
  }
}

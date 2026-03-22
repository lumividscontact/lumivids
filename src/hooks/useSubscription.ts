import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { SubscriptionStatus } from '@/lib/database.types'

interface UseSubscriptionParams {
  userId?: string
  userPlan?: string | null
}

export function useSubscription({ userId, userPlan }: UseSubscriptionParams) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [subscriptionRenewal, setSubscriptionRenewal] = useState<string | null>(null)
  const [subscriptionCancelAtPeriodEnd, setSubscriptionCancelAtPeriodEnd] = useState(false)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadSubscription = async () => {
      if (!isSupabaseConfigured || !userId) {
        if (!isMounted) {
          return
        }
        setSubscriptionStatus(null)
        setSubscriptionRenewal(null)
        setSubscriptionCancelAtPeriodEnd(false)
        setSubscriptionLoading(false)
        return
      }

      setSubscriptionLoading(true)

      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, current_period_end, cancel_at_period_end, plan')
        .eq('user_id', userId)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      if (error) {
        setSubscriptionStatus(userPlan ? 'active' : null)
        setSubscriptionRenewal(null)
        setSubscriptionCancelAtPeriodEnd(false)
      } else if (data) {
        setSubscriptionStatus((data.status as SubscriptionStatus) ?? 'active')
        setSubscriptionRenewal(data.current_period_end ?? null)
        setSubscriptionCancelAtPeriodEnd(!!data.cancel_at_period_end)
      } else {
        setSubscriptionStatus(userPlan ? 'active' : null)
        setSubscriptionRenewal(null)
        setSubscriptionCancelAtPeriodEnd(false)
      }

      setSubscriptionLoading(false)
    }

    void loadSubscription()

    return () => {
      isMounted = false
    }
  }, [userId, userPlan])

  return {
    subscriptionStatus,
    subscriptionRenewal,
    subscriptionCancelAtPeriodEnd,
    subscriptionLoading,
  }
}
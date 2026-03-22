import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '@/lib/supabase'
import { CREDIT_COSTS, calculateCreditCost, type OperationType, type Resolution } from '@/config/creditCosts'
import { CREDITS_CACHE_DURATION_MS, CREDITS_DEBOUNCE_MS, USER_CREDITS_CACHE_KEY, INITIAL_CREDITS } from '@/config/constants'
import { PLAN_CREDITS } from '../../supabase/functions/_shared/planConfig.ts'

// Re-export for backwards compatibility
export { CREDIT_COSTS }
export type { OperationType, Resolution }

export type PlanType = 'creator' | 'studio' | 'director' | null

// Update credits cache in localStorage
function updateCreditsCache(userId: string, credits: number, plan: PlanType): void {
  try {
    const data = {
      userId,
      credits,
      plan,
      timestamp: Date.now(),
    }
    localStorage.setItem(USER_CREDITS_CACHE_KEY, JSON.stringify(data))
  } catch {
    // Ignore localStorage errors
  }
}

export interface Plan {
  id: PlanType
  name: string
  tagline?: string
  credits: number
  price: number
  annualMonthlyPrice?: number
  priceId?: string
  features: string[]
  popular?: boolean
}

// Free bonus tier for users without active subscription
export const FREE_PLAN: Plan = {
  id: null,
  name: 'Bônus',
  tagline: 'Créditos iniciais para começar',
  credits: INITIAL_CREDITS,
  price: 0,
  features: [
    `${INITIAL_CREDITS.toLocaleString('pt-BR')} créditos de boas-vindas`,
    '1 tarefa paralela',
    'Modelos essenciais',
    'Comece sem assinatura',
  ],
}

export const PLANS: Plan[] = [
  {
    id: 'creator',
    name: 'Creator',
    tagline: 'Perfeito para começar',
    credits: PLAN_CREDITS.creator,
    price: 14.9,
    annualMonthlyPrice: 11.9,
    features: [
      `${PLAN_CREDITS.creator.toLocaleString('pt-BR')} créditos/mês`,
      `Até ~${Math.floor(PLAN_CREDITS.creator / 5)} vídeos/mês`,
      '2 tarefas paralelas',
      '1080p HD Output',
      'Acesso a 10+ modelos de IA',
      'Suporte 24/7',
      'Cancele quando quiser',
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    tagline: 'Para criadores regulares',
    credits: PLAN_CREDITS.studio,
    price: 29.9,
    annualMonthlyPrice: 23.9,
    popular: true,
    features: [
      `${PLAN_CREDITS.studio.toLocaleString('pt-BR')} créditos/mês`,
      `Até ~${Math.floor(PLAN_CREDITS.studio / 5)} vídeos/mês`,
      '3 tarefas paralelas',
      'Saída em HD 1080p',
      'Sem marca d\'água',
      'Acesso a 10+ modelos de IA',
      'Suporte 24/7',
      'Cancele quando quiser',
    ],
  },
  {
    id: 'director',
    name: 'Director',
    tagline: 'Para profissionais',
    credits: PLAN_CREDITS.director,
    price: 69.9,
    annualMonthlyPrice: 55.9,
    features: [
      `${PLAN_CREDITS.director.toLocaleString('pt-BR')} créditos/mês`,
      `Até ~${Math.floor(PLAN_CREDITS.director / 5)} vídeos/mês`,
      '5 tarefas paralelas',
      'Saída em HD 1080p',
      'Sem marca d\'água',
      'Acesso a 10+ modelos de IA',
      'Suporte 24/7 prioritário',
      'Cancele quando quiser',
    ],
  },
]

interface SubscriptionInfo {
  isActive: boolean
  isExpired: boolean
  isPastDue: boolean
  isCanceling: boolean
  currentPeriodEnd: Date | null
  daysUntilExpiration: number | null
}

interface CreditsContextType {
  credits: number
  plan: PlanType
  plans: Plan[]
  currentPlan: Plan
  subscription: SubscriptionInfo | null
  canAfford: (cost: number) => boolean
  getCost: (
    type: keyof typeof CREDIT_COSTS,
    model: string,
    resolutionOrOptions?:
      | string
      | {
          resolution?: string
          duration?: number
          withAudio?: boolean
          numOutputs?: number
        }
  ) => number
  deductCredits: (amount: number) => Promise<boolean>
  addCredits: (amount: number) => Promise<void>
  refreshCredits: (force?: boolean) => Promise<void>
  isRefreshing: boolean
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined)

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [credits, setCredits] = useState(user?.credits ?? 0)
  const [plan, setPlan] = useState<PlanType>((user?.plan as PlanType) ?? null)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Cache refs
  const lastFetchTimestamp = useRef<number>(0)
  const pendingRefresh = useRef<Promise<void> | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (user) {
      setCredits(user.credits)
      setPlan((user.plan as PlanType) ?? null)
      // Reset subscription on user change, will be fetched in refreshCredits
      setSubscription(null)
      return
    }
    setCredits(0)
    setPlan(null)
    setSubscription(null)
  }, [user])

  // Get current plan details - fallback to default if plan not found
  const currentPlan = !plan
    ? FREE_PLAN
    : (PLANS.find((p) => p.id === plan) ?? FREE_PLAN)

  const canAfford = useCallback((cost: number) => credits >= cost, [credits])

  const getCost = useCallback(
    (
      type: OperationType,
      model: string,
      resolutionOrOptions?:
        | string
        | {
            resolution?: string
            duration?: number
            withAudio?: boolean
            numOutputs?: number
          }
    ): number => {
      const options =
        typeof resolutionOrOptions === 'string'
          ? { resolution: resolutionOrOptions }
          : (resolutionOrOptions || {})

      // Use centralized credit calculation
      return calculateCreditCost(
        type,
        model,
        options.duration || 5,
        (options.resolution as Resolution) || '720p',
        options.withAudio || false,
        options.numOutputs || 1
      )
    },
    []
  )

  const deductCredits = useCallback(
    async (amount: number): Promise<boolean> => {
      if (credits < amount) {
        return false
      }

      if (!user) {
        console.error('No user logged in')
        return false
      }

      try {
        // Deduzir créditos no banco de dados
        const { data, error } = await supabase.rpc('deduct_credits', {
          user_id: user.id,
          amount: amount
        })

        if (error) {
          console.error('Error deducting credits:', error)
          return false
        }

        // Atualizar estado local apenas se sucesso
        const newCredits = credits - amount
        setCredits(newCredits)
        
        // Atualizar cache no localStorage
        updateCreditsCache(user.id, newCredits, plan)
        
        return true
      } catch (error) {
        console.error('Error in deductCredits:', error)
        return false
      }
    },
    [credits, user, plan]
  )

  const addCredits = useCallback(async (amount: number) => {
    if (!user) return

    try {
      const { error } = await supabase.rpc('add_credits', {
        user_id: user.id,
        amount: amount
      })

      if (error) {
        console.error('Error adding credits:', error)
        return
      }

      const newCredits = credits + amount
      setCredits(newCredits)
      
      // Atualizar cache no localStorage
      updateCreditsCache(user.id, newCredits, plan)
    } catch (error) {
      console.error('Error in addCredits:', error)
    }
  }, [user, credits, plan])

  const refreshCredits = useCallback(async (force: boolean = false) => {
    if (!userId) return

    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchTimestamp.current
    
    // Return cached data if within cache duration and not forced
    if (!force && timeSinceLastFetch < CREDITS_CACHE_DURATION_MS) {
      return
    }
    
    // If there's already a pending refresh, return that promise (deduplication)
    if (pendingRefresh.current) {
      return pendingRefresh.current
    }
    
    // Clear any pending debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }

    // Create the actual fetch function
    const doFetch = async () => {
      setIsRefreshing(true)
      try {
        // Fetch credits and subscription in parallel
        const [creditsResult, subResult] = await Promise.all([
          supabase
            .from('user_credits')
            .select('credits')
            .eq('user_id', userId)
            .single(),
          supabase
            .from('subscriptions')
            .select('plan, status, current_period_end, cancel_at_period_end')
            .eq('user_id', userId)
            .maybeSingle()
        ])

        if (creditsResult.error) {
          console.error('Error fetching credits:', creditsResult.error)
        } else if (creditsResult.data) {
          setCredits(creditsResult.data.credits ?? 0)
        }

        let newPlan: PlanType = null
        
        if (subResult.data) {
          const sub = subResult.data
          const now = new Date()
          const periodEnd = sub.current_period_end 
            ? new Date(sub.current_period_end) 
            : null
          
          // Calculate days until expiration
          let daysUntilExpiration: number | null = null
          if (periodEnd) {
            const diffMs = periodEnd.getTime() - now.getTime()
            daysUntilExpiration = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
          }

          // Check if subscription has expired
          const isExpired = periodEnd ? periodEnd < now : false
          const isActive = sub.status === 'active' && !isExpired

          newPlan = isActive ? (sub.plan as PlanType) : null
          setPlan(newPlan)
          setSubscription({
            isActive,
            isExpired,
            isPastDue: sub.status === 'past_due',
            isCanceling: sub.cancel_at_period_end === true,
            currentPeriodEnd: periodEnd,
            daysUntilExpiration,
          })
        } else {
          setPlan(null)
          setSubscription(null)
        }

        // Update localStorage cache with fresh credits data
        if (creditsResult.data) {
          updateCreditsCache(userId, creditsResult.data.credits ?? 0, newPlan)
        }

        // Update cache timestamp on successful fetch
        lastFetchTimestamp.current = Date.now()
      } catch (error) {
        console.error('Error in refreshCredits:', error)
      } finally {
        setIsRefreshing(false)
        pendingRefresh.current = null
      }
    }

    // Store the promise for deduplication
    pendingRefresh.current = doFetch()
    return pendingRefresh.current
  }, [userId])

  useEffect(() => {
    if (!userId) {
      return
    }

    void refreshCredits(true)
  }, [userId, refreshCredits])

  return (
    <CreditsContext.Provider
      value={{
        credits,
        plan,
        plans: PLANS,
        currentPlan,
        subscription,
        canAfford,
        getCost,
        deductCredits,
        addCredits,
        refreshCredits,
        isRefreshing,
      }}
    >
      {children}
    </CreditsContext.Provider>
  )
}

export function useCredits() {
  const context = useContext(CreditsContext)
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider')
  }
  return context
}

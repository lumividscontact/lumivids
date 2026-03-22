export type PlanId = 'creator' | 'studio' | 'director'

export const PLAN_CREDITS: Record<PlanId, number> = {
  creator: 450,
  studio: 1000,
  director: 2700,
}

export function isPlanId(value: string): value is PlanId {
  return value in PLAN_CREDITS
}

export function getPlanCredits(planId: string | null | undefined): number {
  if (!planId || !isPlanId(planId)) {
    return 0
  }
  return PLAN_CREDITS[planId]
}
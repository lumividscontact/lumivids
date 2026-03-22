import { supabase } from '@/lib/supabase'
import type { AdminTargetPlan, GenerationStatus, GenerationType, PaidPlanType, PlanType, UserRole } from '@/lib/database.types'
import { getModelById, getModelsByCategory } from '@/config/models'
import { replicateAPI } from '@/services/replicate'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const PROMPT_BLACKLIST_CACHE_TTL_MS = 60_000

/** Escape special PostgREST filter characters to prevent filter injection */
function sanitizePostgrestValue(value: string): string {
  return value.replace(/[.,()\\%_]/g, (ch) => `\\${ch}`)
}

let promptBlacklistCache: { expiresAt: number; entries: PromptBlacklistRow[] } | null = null
let promptBlacklistFetchPromise: Promise<PromptBlacklistRow[]> | null = null

export interface AdminUserRow {
  user_id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
  role: UserRole
  is_suspended: boolean
  suspended_reason: string | null
  must_reset_password: boolean
  force_logout_at: string | null
  created_at: string
}

export interface AdminUserWithDetails extends AdminUserRow {
  credits: number
  plan: PlanType
  subscriptionStatus: string | null
}

export interface UserActivityHistory {
  recentGenerations: Array<{
    id: string
    type: GenerationType
    status: GenerationStatus
    credits_used: number
    created_at: string
    model_name: string | null
  }>
  usageStats: Array<{
    date: string
    generation_type: GenerationType
    generation_count: number
    credits_used: number
  }>
  creditTransactions: Array<{
    id: string
    type: string
    amount: number
    balance_after: number
    description: string | null
    created_at: string
  }>
}

export interface AdminGenerationFilters {
  search?: string
  status?: GenerationStatus | 'all'
  type?: GenerationType | 'all'
  model?: string
  dateFrom?: string
  dateTo?: string
}

export interface AdminGenerationRow {
  id: string
  user_id: string
  type: GenerationType
  status: GenerationStatus
  prompt: string | null
  output_url: string | null
  thumbnail_url: string | null
  model_name: string | null
  credits_used: number
  error_message: string | null
  created_at: string
  completed_at: string | null
  profile: {
    display_name: string | null
    email: string | null
  } | null
}

export interface AdminStats {
  totalUsers: number
  activeSubscriptions: number
  totalCreditsInCirculation: number
  totalGenerations: number
}

export interface AdminGenerationAnalytics {
  total: number
  succeeded: number
  failed: number
  processing: number
  canceled: number
  last7Days: number
  creditsLast7Days: number
  topModels: Array<{ model: string; count: number }>
}

interface AdminGenerationAnalyticsRpcRow {
  total: number | null
  succeeded: number | null
  failed: number | null
  processing: number | null
  canceled: number | null
  last_n_days: number | null
  credits_last_n_days: number | null
  top_models: unknown
}

interface AdminStatsRpcRow {
  total_users: number | null
  active_subscriptions: number | null
  total_credits_in_circulation: number | null
  total_generations: number | null
}

interface AdminReportsSummaryRpcRow {
  generations_per_day: unknown
  new_users_per_week: unknown
  monthly_mrr: unknown
  conversion_rate: number | null
  top_models: unknown
  top_users_by_credits: unknown
  current_mrr: number | null
}

function normalizeReportPoints(value: unknown): ReportPoint[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: any) => ({
      label: typeof item?.label === 'string' ? item.label : '',
      value: Number(item?.value ?? 0),
    }))
    .filter((item) => item.label.length > 0 && Number.isFinite(item.value))
}

function normalizeRevenuePoints(value: unknown): RevenuePoint[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: any) => ({
      month: typeof item?.month === 'string' ? item.month : '',
      value: Number(item?.value ?? 0),
    }))
    .filter((item) => item.month.length > 0 && Number.isFinite(item.value))
}

function normalizeTopModels(value: unknown): Array<{ model: string; count: number }> {
  if (!Array.isArray(value)) return []
  return value
    .map((item: any) => ({
      model: typeof item?.model === 'string' && item.model.trim() ? item.model : 'unknown',
      count: Number(item?.count ?? 0),
    }))
    .filter((item) => Number.isFinite(item.count) && item.count > 0)
}

function normalizeTopUsers(value: unknown): TopCreditUser[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: any) => ({
      userId: typeof item?.userId === 'string' ? item.userId : '',
      name: typeof item?.name === 'string' && item.name.trim() ? item.name : '—',
      email: typeof item?.email === 'string' && item.email.trim() ? item.email : '—',
      creditsUsed: Number(item?.creditsUsed ?? 0),
    }))
    .filter((item) => item.userId.length > 0 && Number.isFinite(item.creditsUsed))
}

async function fetchProfilesByUserIds(userIds: string[]): Promise<Map<string, { display_name: string | null; email: string | null }>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter((value) => typeof value === 'string' && value.length > 0)))

  if (uniqueUserIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, email')
    .in('user_id', uniqueUserIds)

  if (error) {
    throw error
  }

  return new Map((data ?? []).map((row) => [row.user_id, { display_name: row.display_name, email: row.email }]))
}

async function fetchActivePromptBlacklistCached(): Promise<PromptBlacklistRow[]> {
  const now = Date.now()
  if (promptBlacklistCache && promptBlacklistCache.expiresAt > now) {
    return promptBlacklistCache.entries
  }

  if (!promptBlacklistFetchPromise) {
    promptBlacklistFetchPromise = (async () => {
      const { data, error } = await supabase
        .from('prompt_blacklist')
        .select('id, pattern, reason, is_regex, is_active, created_by, created_at')
        .eq('is_active', true)

      if (error) {
        throw error
      }

      const entries = (data ?? []) as PromptBlacklistRow[]
      promptBlacklistCache = {
        entries,
        expiresAt: Date.now() + PROMPT_BLACKLIST_CACHE_TTL_MS,
      }
      return entries
    })()
  }

  try {
    return await promptBlacklistFetchPromise
  } finally {
    promptBlacklistFetchPromise = null
  }
}

function invalidatePromptBlacklistCache(): void {
  promptBlacklistCache = null
  promptBlacklistFetchPromise = null
}

export interface ReportPoint {
  label: string
  value: number
}

export interface RevenuePoint {
  month: string
  value: number
}

export interface TopCreditUser {
  userId: string
  name: string
  email: string
  creditsUsed: number
}

export interface AdminReportsData {
  generationsPerDay: ReportPoint[]
  newUsersPerWeek: ReportPoint[]
  monthlyMrr: RevenuePoint[]
  conversionRate: number
  topModels: Array<{ model: string; count: number }>
  topUsersByCredits: TopCreditUser[]
  currentMrr: number
}

export interface StripeWebhookEventRow {
  event_id: string
  event_type: string
  status: 'processing' | 'processed' | 'failed'
  last_error: string | null
  received_at: string
  processed_at: string | null
}

export interface AdminSubscriptionRow {
  id: string
  user_id: string
  plan: PlanType
  status: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  profile: {
    display_name: string | null
    email: string | null
  } | null
}

export interface ContentFlagRow {
  id: string
  generation_id: string
  reporter_user_id: string | null
  reason: string
  details: string | null
  status: 'open' | 'reviewing' | 'dismissed' | 'removed'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  generation: {
    id: string
    prompt: string | null
    model_name: string | null
    output_url: string | null
    status: string
  } | null
  reporter: {
    display_name: string | null
    email: string | null
  } | null
}

export interface PromptBlacklistRow {
  id: string
  pattern: string
  reason: string | null
  is_regex: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface AiModelSettingRow {
  id: string
  model_id: string
  is_enabled: boolean
  credit_cost_override: number | null
  updated_by: string | null
  updated_at: string
}

export interface PlanLimitRow {
  id: string
  plan: string
  max_concurrent_generations: number
  updated_by: string | null
  updated_at: string
}

export interface FeatureFlagRow {
  id: string
  key: string
  enabled: boolean
  description: string | null
  updated_by: string | null
  updated_at: string
}

export interface ServiceHealthStatus {
  service: 'ai_api' | 'supabase' | 'stripe'
  status: 'healthy' | 'degraded' | 'down'
  details: string
}

export interface SupportTicketRow {
  id: string
  user_id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assigned_admin_id: string | null
  created_at: string
  updated_at: string
  profile: {
    display_name: string | null
    email: string | null
  } | null
}

export interface SupportMessageRow {
  id: string
  ticket_id: string
  sender_user_id: string | null
  sender_role: 'user' | 'admin' | 'system'
  message: string
  created_at: string
}

export interface UserInternalNoteRow {
  id: string
  user_id: string
  admin_user_id: string | null
  note: string
  created_at: string
}

async function callAdminEdgeFunction<T>(functionName: string, payload: Record<string, unknown>): Promise<T> {
  let { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession()
    session = data.session
  }

  if (!session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.')
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'x-supabase-auth': session.access_token,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  })

  const json = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error((json as { error?: string }).error || 'Erro ao chamar função administrativa')
  }

  return json as T
}

async function callAdminRpc<T>(rpc: string, params?: Record<string, unknown>): Promise<T> {
  const response = await callAdminEdgeFunction<{ data: T }>('admin-rpc', {
    rpc,
    params: params ?? {},
  })

  return response.data
}

const PLAN_MONTHLY_MRR: Record<PaidPlanType, number> = {
  creator: 14.9,
  studio: 29.9,
  director: 69.9,
}

const PLAN_ANNUAL_MONTHLY_MRR: Record<PaidPlanType, number> = {
  creator: 11.9,
  studio: 23.9,
  director: 55.9,
}

function isPaidPlan(plan: PlanType): plan is PaidPlanType {
  return plan === 'creator' || plan === 'studio' || plan === 'director'
}

/**
 * Fetch high-level admin stats from the database.
 * Each query is independent so we run them in parallel.
 */
export async function fetchAdminStats(): Promise<AdminStats> {
  let rpcData: unknown = null
  let rpcError: Error | null = null

  try {
    rpcData = await callAdminRpc<unknown>('admin_stats_summary')
  } catch (err) {
    rpcError = err instanceof Error ? err : new Error('admin_stats_summary failed')
  }

  if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
    const row = rpcData[0] as AdminStatsRpcRow
    return {
      totalUsers: Number(row.total_users ?? 0),
      activeSubscriptions: Number(row.active_subscriptions ?? 0),
      totalCreditsInCirculation: Number(row.total_credits_in_circulation ?? 0),
      totalGenerations: Number(row.total_generations ?? 0),
    }
  }

  if (rpcError) {
    console.warn('[Admin] admin_stats_summary RPC failed, using fallback queries:', rpcError)
  }

  const [usersRes, subsRes, creditsRes, gensRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('user_credits').select('credits'),
    supabase.from('usage_stats').select('generation_count'),
  ])

  const totalCredits = (creditsRes.data ?? []).reduce((sum, r) => sum + (r.credits ?? 0), 0)
  const totalGenerations = (gensRes.data ?? []).reduce((sum, r) => sum + (r.generation_count ?? 0), 0)

  return {
    totalUsers: usersRes.count ?? 0,
    activeSubscriptions: subsRes.count ?? 0,
    totalCreditsInCirculation: totalCredits,
    totalGenerations,
  }
}

/**
 * Fetch paginated user list with credits and subscription details.
 */
export async function fetchAdminUsers(
  page = 0,
  pageSize = 20,
  search = ''
): Promise<{ users: AdminUserWithDetails[]; total: number }> {
  // Get profiles
  let query = supabase
    .from('profiles')
    .select('user_id, display_name, email, avatar_url, role, is_suspended, suspended_reason, must_reset_password, force_logout_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (search) {
    const safe = sanitizePostgrestValue(search)
    query = query.or(`display_name.ilike.%${safe}%,email.ilike.%${safe}%`)
  }

  const { data: profiles, count } = await query

  if (!profiles || profiles.length === 0) {
    return { users: [], total: count ?? 0 }
  }

  const userIds = profiles.map((p) => p.user_id)

  const [creditsRes, subsRes] = await Promise.all([
    supabase.from('user_credits').select('user_id, credits').in('user_id', userIds),
    supabase.from('subscriptions').select('user_id, plan, status').in('user_id', userIds),
  ])

  const creditsMap = new Map((creditsRes.data ?? []).map((c) => [c.user_id, c.credits]))
  const subsMap = new Map((subsRes.data ?? []).map((s) => [s.user_id, s]))

  const users: AdminUserWithDetails[] = profiles.map((p) => {
    const sub = subsMap.get(p.user_id)
    return {
      ...p,
      credits: creditsMap.get(p.user_id) ?? 0,
      plan: sub?.plan ?? null,
      subscriptionStatus: sub?.status ?? null,
    }
  })

  return { users, total: count ?? 0 }
}

/**
 * Adjust credits for a given user (add or subtract).
 */
export async function adjustUserCredits(userId: string, delta: number): Promise<void> {
  const normalizedDelta = Math.trunc(delta)
  if (!Number.isFinite(normalizedDelta) || normalizedDelta === 0) {
    throw new Error('Delta de créditos inválido')
  }

  await callAdminRpc('admin_adjust_user_credits', {
    p_user_id: userId,
    p_delta: normalizedDelta,
    p_description: `Ajuste manual via admin (${normalizedDelta > 0 ? '+' : ''}${normalizedDelta})`,
  })
}

export async function updateUserPlan(userId: string, plan: PlanType): Promise<void> {
  const payload = {
    user_id: userId,
    plan,
    status: plan ? 'active' : 'canceled',
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    throw error
  }
}

export async function setUserSuspended(userId: string, suspended: boolean, reason: string | null = null): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      is_suspended: suspended,
      suspended_reason: suspended ? reason ?? null : null,
      force_logout_at: suspended ? new Date().toISOString() : null,
    })
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError

  if (authData.user?.id === userId && role !== 'admin') {
    throw new Error('Você não pode remover seu próprio acesso de admin')
  }

  await callAdminRpc('admin_update_user_role', {
    p_user_id: userId,
    p_role: role,
  })
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error('Email inválido')
  }

  try {
    await callAdminRpc('admin_guard_password_reset', {
      p_target_email: normalizedEmail,
    })
  } catch (guardError) {
    throw guardError
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth?force=1&type=recovery`,
  })

  if (error) {
    throw error
  }
}

export async function forceUserLogout(userId: string): Promise<void> {
  await callAdminRpc('admin_force_logout_user', {
    p_user_id: userId,
  })
}

export async function fetchUserActivityHistory(userId: string): Promise<UserActivityHistory> {
  const [generationsRes, usageStatsRes, transactionsRes] = await Promise.all([
    supabase
      .from('generations')
      .select('id, type, status, credits_used, created_at, model_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('usage_stats')
      .select('date, generation_type, generation_count, credits_used')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30),
    supabase
      .from('credit_transactions')
      .select('id, type, amount, balance_after, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return {
    recentGenerations: (generationsRes.data ?? []) as UserActivityHistory['recentGenerations'],
    usageStats: (usageStatsRes.data ?? []) as UserActivityHistory['usageStats'],
    creditTransactions: (transactionsRes.data ?? []) as UserActivityHistory['creditTransactions'],
  }
}

export async function fetchAdminGenerations(
  page = 0,
  pageSize = 20,
  filters: AdminGenerationFilters = {}
): Promise<{ generations: AdminGenerationRow[]; total: number }> {
  let query = supabase
    .from('generations')
    .select(
      'id, user_id, type, status, prompt, output_url, thumbnail_url, model_name, credits_used, error_message, created_at, completed_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters.type && filters.type !== 'all') {
    query = query.eq('type', filters.type)
  }

  if (filters.search) {
    const search = filters.search.trim()
    if (search) {
      const safe = sanitizePostgrestValue(search)
      query = query.or(`prompt.ilike.%${safe}%,model_name.ilike.%${safe}%`)
    }
  }

  if (filters.model && filters.model.trim()) {
    const safeModel = sanitizePostgrestValue(filters.model.trim())
    query = query.ilike('model_name', `%${safeModel}%`)
  }

  if (filters.dateFrom) {
    query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`)
  }

  if (filters.dateTo) {
    query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`)
  }

  const { data, error, count } = await query

  if (error) {
    throw error
  }

  const userIds = (data ?? []).map((row) => row.user_id)
  const profilesByUserId = await fetchProfilesByUserIds(userIds)

  const generations = (data ?? []).map((row: any) => ({
    ...row,
    profile: profilesByUserId.get(row.user_id) ?? null,
  })) as AdminGenerationRow[]

  return {
    generations,
    total: count ?? 0,
  }
}

export async function deleteGenerationAsAdmin(generationId: string): Promise<void> {
  const { error } = await supabase
    .from('generations')
    .update({
      status: 'canceled',
      output_url: null,
      thumbnail_url: null,
      error_message: 'Removed by admin moderation',
      completed_at: new Date().toISOString(),
    })
    .eq('id', generationId)

  if (error) {
    throw error
  }
}

export async function updateGenerationStatus(generationId: string, status: GenerationStatus): Promise<void> {
  const updates: { status: GenerationStatus; completed_at?: string } = { status }
  if (status === 'canceled' || status === 'failed' || status === 'succeeded') {
    updates.completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('generations')
    .update(updates)
    .eq('id', generationId)

  if (error) {
    throw error
  }
}

export async function moderateGenerationContent(generationId: string): Promise<void> {
  return deleteGenerationAsAdmin(generationId)
}

export async function retryFailedGeneration(generationId: string): Promise<void> {
  const { data: generation, error: readError } = await supabase
    .from('generations')
    .select('id, type, status, prompt, negative_prompt, input_image_url, model_id, model_name, settings')
    .eq('id', generationId)
    .maybeSingle()

  if (readError) {
    throw readError
  }

  if (!generation) {
    throw new Error('Geração não encontrada')
  }

  if (generation.status !== 'failed') {
    throw new Error('Apenas gerações com status failed podem ser reexecutadas')
  }

  const settings = ((generation.settings ?? {}) as Record<string, unknown>)

  const resolveModelId = (): string | null => {
    const modelFromSettings = typeof settings.model === 'string' ? settings.model.trim() : ''
    if (modelFromSettings) {
      return modelFromSettings
    }

    const directModelId = typeof generation.model_id === 'string' ? generation.model_id.trim() : ''
    if (directModelId && getModelById(directModelId)) {
      return directModelId
    }

    const fallbackCategory = generation.type as GenerationType
    const candidates = getModelsByCategory(fallbackCategory)
    const normalized = (typeof generation.model_name === 'string' ? generation.model_name : directModelId).toLowerCase().trim()

    if (!normalized) return null

    const byId = candidates.find((model) => model.id.toLowerCase() === normalized)
    if (byId) return byId.id

    const byName = candidates.find((model) => model.name.toLowerCase() === normalized)
    if (byName) return byName.id

    return null
  }

  const model = resolveModelId()
  if (!model) {
    throw new Error('Não foi possível determinar o modelo para reexecutar esta geração')
  }

  let predictionId: string

  if (generation.type === 'text-to-video') {
    if (!generation.prompt?.trim()) {
      throw new Error('A geração não possui prompt para reexecução')
    }

    const result = await replicateAPI.createTextToVideo({
      prompt: generation.prompt,
      negativePrompt: generation.negative_prompt ?? undefined,
      model,
      aspectRatio: typeof settings.aspectRatio === 'string' ? settings.aspectRatio : '16:9',
      duration: String(settings.duration ?? 5),
      resolution: typeof settings.resolution === 'string' ? settings.resolution : '720p',
      withAudio: Boolean(settings.withAudio),
      seed: typeof settings.seed === 'number' ? settings.seed : undefined,
    })
    predictionId = result.id
  } else if (generation.type === 'image-to-video') {
    if (!generation.input_image_url?.trim()) {
      throw new Error('A geração não possui imagem de entrada para reexecução')
    }

    const result = await replicateAPI.createImageToVideo({
      imageUrl: generation.input_image_url,
      prompt: generation.prompt ?? undefined,
      model,
      motionType: typeof settings.motionType === 'string' ? settings.motionType : 'natural',
      motionStrength: typeof settings.motionStrength === 'number' ? settings.motionStrength : 50,
      aspectRatio: typeof settings.aspectRatio === 'string' ? settings.aspectRatio : '16:9',
      duration: String(settings.duration ?? 5),
      resolution: typeof settings.resolution === 'string' ? settings.resolution : '720p',
    })
    predictionId = result.id
  } else if (generation.type === 'text-to-image') {
    if (!generation.prompt?.trim()) {
      throw new Error('A geração não possui prompt para reexecução')
    }

    const result = await replicateAPI.createTextToImage({
      prompt: generation.prompt,
      negativePrompt: generation.negative_prompt ?? undefined,
      model,
      aspectRatio: typeof settings.aspectRatio === 'string' ? settings.aspectRatio : '1:1',
      resolution: typeof settings.resolution === 'string' ? settings.resolution : undefined,
      numOutputs: typeof settings.numOutputs === 'number' ? settings.numOutputs : 1,
    })
    predictionId = result.id
  } else if (generation.type === 'image-to-image') {
    if (!generation.input_image_url?.trim()) {
      throw new Error('A geração não possui imagem de entrada para reexecução')
    }

    const result = await replicateAPI.createImageToImage({
      imageUrl: generation.input_image_url,
      prompt: generation.prompt ?? undefined,
      negativePrompt: generation.negative_prompt ?? undefined,
      model,
      aspectRatio: typeof settings.aspectRatio === 'string' ? settings.aspectRatio : undefined,
      resolution: typeof settings.resolution === 'string' ? settings.resolution : undefined,
      transformType: typeof settings.transformType === 'string' ? settings.transformType : undefined,
      style: typeof settings.style === 'string' ? settings.style : undefined,
      strength: typeof settings.strength === 'number' ? settings.strength : 0.7,
    })
    predictionId = result.id
  } else {
    throw new Error('Tipo de geração não suportado para reexecução')
  }

  const timestamp = new Date().toISOString()
  const note = `Reexecutada pelo admin em ${timestamp} (nova prediction: ${predictionId})`

  const { error: updateError } = await supabase
    .from('generations')
    .update({
      error_message: note,
      updated_at: timestamp,
    })
    .eq('id', generationId)

  if (updateError) {
    throw updateError
  }
}

export async function fetchGenerationAnalytics(): Promise<AdminGenerationAnalytics> {
  const data = await callAdminRpc<unknown>('admin_generation_analytics', { p_days: 7 })
  const row = Array.isArray(data) ? (data[0] as AdminGenerationAnalyticsRpcRow | undefined) : undefined
  const topModelsRaw = Array.isArray(row?.top_models) ? row?.top_models : []
  const topModels = topModelsRaw
    .map((item: any) => ({
      model: typeof item?.model === 'string' && item.model.trim() ? item.model : 'unknown',
      count: typeof item?.count === 'number' ? item.count : Number(item?.count ?? 0),
    }))
    .filter((item) => Number.isFinite(item.count) && item.count > 0)

  return {
    total: Number(row?.total ?? 0),
    succeeded: Number(row?.succeeded ?? 0),
    failed: Number(row?.failed ?? 0),
    processing: Number(row?.processing ?? 0),
    canceled: Number(row?.canceled ?? 0),
    last7Days: Number(row?.last_n_days ?? 0),
    creditsLast7Days: Number(row?.credits_last_n_days ?? 0),
    topModels,
  }
}

function getLastNDates(days: number): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    result.push(d.toISOString().slice(0, 10))
  }
  return result
}

function getWeekStart(dateIso: string): string {
  const date = new Date(dateIso)
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)
  return monday.toISOString().slice(0, 10)
}

function getLastNMonths(months: number): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

function getEstimatedMonthlyValue(plan: PlanType, stripePriceId: string | null): number {
  if (!isPaidPlan(plan)) return 0
  const isAnnual = Boolean(stripePriceId && /annual|year/i.test(stripePriceId))
  return isAnnual ? PLAN_ANNUAL_MONTHLY_MRR[plan] : PLAN_MONTHLY_MRR[plan]
}

export async function fetchAdminReportsData(): Promise<AdminReportsData> {
  let rpcData: unknown = null
  let rpcError: Error | null = null

  try {
    rpcData = await callAdminRpc<unknown>('admin_reports_summary')
  } catch (err) {
    rpcError = err instanceof Error ? err : new Error('admin_reports_summary failed')
  }

  if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
    const row = rpcData[0] as AdminReportsSummaryRpcRow
    return {
      generationsPerDay: normalizeReportPoints(row.generations_per_day),
      newUsersPerWeek: normalizeReportPoints(row.new_users_per_week),
      monthlyMrr: normalizeRevenuePoints(row.monthly_mrr),
      conversionRate: Number(row.conversion_rate ?? 0),
      topModels: normalizeTopModels(row.top_models),
      topUsersByCredits: normalizeTopUsers(row.top_users_by_credits),
      currentMrr: Number(row.current_mrr ?? 0),
    }
  }

  if (rpcError) {
    console.warn('[Admin] admin_reports_summary RPC failed, using fallback queries:', rpcError)
  }

  const now = new Date()
  const days90Ago = new Date(now)
  days90Ago.setDate(now.getDate() - 90)

  const days84Ago = new Date(now)
  days84Ago.setDate(now.getDate() - 84)

  const months12Ago = new Date(now)
  months12Ago.setMonth(now.getMonth() - 12)

  const days30Ago = new Date(now)
  days30Ago.setDate(now.getDate() - 30)

  const [generationsRes, profilesRecentRes, subscriptionsRes, usageStatsRes, totalUsersRes] = await Promise.all([
    supabase
      .from('generations')
      .select('created_at, model_name')
      .gte('created_at', days90Ago.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('user_id, created_at')
      .gte('created_at', days84Ago.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('subscriptions')
      .select('user_id, plan, status, stripe_price_id, current_period_start, created_at')
      .gte('created_at', months12Ago.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('usage_stats')
      .select('user_id, credits_used, date')
      .gte('date', days30Ago.toISOString().slice(0, 10)),
    supabase
      .from('profiles')
      .select('user_id', { count: 'exact', head: true }),
  ])

  const dateKeys = getLastNDates(30)
  const dailyMap = new Map(dateKeys.map((d) => [d, 0]))

  for (const row of generationsRes.data ?? []) {
    const key = row.created_at.slice(0, 10)
    if (dailyMap.has(key)) {
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
    }
  }

  const generationsPerDay: ReportPoint[] = dateKeys.map((d) => ({ label: d.slice(5), value: dailyMap.get(d) ?? 0 }))

  const weeklyMap = new Map<string, number>()
  for (const row of profilesRecentRes.data ?? []) {
    const weekKey = getWeekStart(row.created_at)
    weeklyMap.set(weekKey, (weeklyMap.get(weekKey) ?? 0) + 1)
  }

  const weekKeys = Array.from(weeklyMap.keys()).sort((a, b) => a.localeCompare(b))
  const newUsersPerWeek: ReportPoint[] = weekKeys.map((week) => ({
    label: week.slice(5),
    value: weeklyMap.get(week) ?? 0,
  }))

  const monthKeys = getLastNMonths(12)
  const monthMrrMap = new Map(monthKeys.map((m) => [m, 0]))

  for (const row of subscriptionsRes.data ?? []) {
    if (!isPaidPlan(row.plan as PlanType)) continue
    if (!['active', 'trialing', 'past_due'].includes(row.status ?? '')) continue

    const referenceDate = row.current_period_start ?? row.created_at
    const month = referenceDate.slice(0, 7)
    if (!monthMrrMap.has(month)) continue

    const value = getEstimatedMonthlyValue(row.plan as PlanType, row.stripe_price_id)
    monthMrrMap.set(month, (monthMrrMap.get(month) ?? 0) + value)
  }

  const monthlyMrr: RevenuePoint[] = monthKeys.map((month) => ({
    month,
    value: Number((monthMrrMap.get(month) ?? 0).toFixed(2)),
  }))

  const paidUsers = new Set(
    (subscriptionsRes.data ?? [])
      .filter((row) => isPaidPlan(row.plan as PlanType) && ['active', 'trialing', 'past_due'].includes(row.status ?? ''))
      .map((row) => row.user_id)
  )

  const totalUsers = totalUsersRes.count ?? 0
  const conversionRate = totalUsers > 0 ? Number(((paidUsers.size / totalUsers) * 100).toFixed(2)) : 0

  const modelMap = new Map<string, number>()
  for (const row of generationsRes.data ?? []) {
    const key = (row.model_name ?? '').trim() || 'unknown'
    modelMap.set(key, (modelMap.get(key) ?? 0) + 1)
  }

  const topModels = Array.from(modelMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([model, count]) => ({ model, count }))

  const creditsByUser = new Map<string, number>()
  for (const row of usageStatsRes.data ?? []) {
    creditsByUser.set(row.user_id, (creditsByUser.get(row.user_id) ?? 0) + (row.credits_used ?? 0))
  }

  const topCreditsUsers = Array.from(creditsByUser.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const userIds = topCreditsUsers.map(([userId]) => userId)
  const { data: profileRows } = userIds.length > 0
    ? await supabase
      .from('profiles')
      .select('user_id, display_name, email')
      .in('user_id', userIds)
    : { data: [] as Array<{ user_id: string; display_name: string | null; email: string | null }> }

  const profileMap = new Map((profileRows ?? []).map((row) => [row.user_id, row]))

  const topUsersByCredits: TopCreditUser[] = topCreditsUsers.map(([userId, creditsUsed]) => {
    const profile = profileMap.get(userId)
    return {
      userId,
      name: profile?.display_name ?? '—',
      email: profile?.email ?? '—',
      creditsUsed,
    }
  })

  const currentMrr = monthlyMrr.length > 0 ? monthlyMrr[monthlyMrr.length - 1].value : 0

  return {
    generationsPerDay,
    newUsersPerWeek,
    monthlyMrr,
    conversionRate,
    topModels,
    topUsersByCredits,
    currentMrr,
  }
}

export async function createAdminCoupon(params: {
  code: string
  percentOff?: number
  amountOff?: number
  currency?: string
  duration?: 'once' | 'repeating' | 'forever'
  durationInMonths?: number
}) {
  return callAdminEdgeFunction<{ couponId: string; promotionCodeId: string; code: string }>('admin-create-coupon', params)
}

export async function createDiscountCoupon(params: {
  code: string
  percentOff?: number
  amountOff?: number
  currency?: string
  duration?: 'once' | 'repeating' | 'forever'
  durationInMonths?: number
}) {
  return createAdminCoupon(params)
}

export async function createAdminRefund(params: {
  paymentIntentId?: string
  chargeId?: string
  amount?: number
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
}) {
  return callAdminEdgeFunction<{ refundId: string; status: string }>('admin-create-refund', params)
}

export async function createStripeRefund(params: {
  paymentIntentId?: string
  chargeId?: string
  amount?: number
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
}) {
  return createAdminRefund(params)
}

export async function fetchStripeWebhookEvents(
  page = 0,
  pageSize = 12,
  search = ''
): Promise<{ events: StripeWebhookEventRow[]; total: number }> {
  let query = supabase
    .from('stripe_webhook_events')
    .select('event_id, event_type, status, last_error, received_at, processed_at')
    .order('received_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (search.trim()) {
    const safe = sanitizePostgrestValue(search.trim())
    query = query.or(`event_id.ilike.%${safe}%,event_type.ilike.%${safe}%,status.ilike.%${safe}%`)
  }

  const { data, error, count } = await query

  if (error) {
    throw error
  }

  return {
    events: (data ?? []) as StripeWebhookEventRow[],
    total: count ?? 0,
  }
}

export async function fetchAdminSubscriptions(
  page = 0,
  pageSize = 20,
  status: 'all' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' = 'all'
): Promise<{ subscriptions: AdminSubscriptionRow[]; total: number }> {
  let query = supabase
    .from('subscriptions')
    .select(
      'id, user_id, plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_start, current_period_end, cancel_at_period_end, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query

  if (error) {
    throw error
  }

  const userIds = (data ?? []).map((row) => row.user_id)
  const profilesByUserId = await fetchProfilesByUserIds(userIds)

  const subscriptions = (data ?? []).map((row: any) => ({
    ...row,
    profile: profilesByUserId.get(row.user_id) ?? null,
  })) as AdminSubscriptionRow[]

  return {
    subscriptions,
    total: count ?? 0,
  }
}

export async function grantBulkCredits(params: {
  amount: number
  targetPlan: AdminTargetPlan
  subscriptionStatus: 'all' | 'active' | 'canceled' | 'past_due'
  description?: string
}): Promise<{ updatedUsers: number }> {
  const amount = Math.trunc(params.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Quantidade de créditos inválida')
  }

  const data = await callAdminRpc<unknown>('admin_grant_bulk_credits', {
    p_amount: amount,
    p_target_plan: params.targetPlan,
    p_subscription_status: params.subscriptionStatus,
    p_description: params.description ?? null,
  })

  return {
    updatedUsers: typeof data === 'number' ? data : Number(data ?? 0),
  }
}

export async function sendBulkNotification(params: {
  title: string
  message: string
  type?: 'system' | 'subscription' | 'credits_low'
  targetPlan?: AdminTargetPlan
}): Promise<{ notifiedUsers: number }> {
  const title = params.title.trim()
  const message = params.message.trim()

  if (!title || !message) {
    throw new Error('Título e mensagem são obrigatórios')
  }

  const targetPlan = params.targetPlan ?? 'all'

  const data = await callAdminRpc<unknown>('admin_send_bulk_notification', {
    p_title: title,
    p_message: message,
    p_type: params.type ?? 'system',
    p_target_plan: targetPlan,
  })

  return {
    notifiedUsers: typeof data === 'number' ? data : Number(data ?? 0),
  }
}

export async function fetchRecentNotifications(limit = 30) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, message, read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const userIds = (data ?? []).map((row) => row.user_id)
  const profilesByUserId = await fetchProfilesByUserIds(userIds)

  return (data ?? []).map((row: any) => ({
    ...row,
    profile: profilesByUserId.get(row.user_id) ?? null,
  }))
}

export async function sendScheduledMaintenanceNotification(params: {
  startsAt: string
  endsAt?: string
  message?: string
  targetPlan?: AdminTargetPlan
}) {
  const startsAtText = new Date(params.startsAt).toLocaleString()
  const endsAtText = params.endsAt ? new Date(params.endsAt).toLocaleString() : null
  const message = params.message || `Manutenção programada em ${startsAtText}${endsAtText ? ` até ${endsAtText}` : ''}. O serviço pode apresentar instabilidade.`

  return sendBulkNotification({
    title: 'Manutenção programada',
    message,
    type: 'system',
    targetPlan: params.targetPlan ?? 'all',
  })
}

export async function sendHighUsageAlerts(params: {
  creditsThreshold: number
  days?: number
}): Promise<{ notifiedUsers: number }> {
  const threshold = Math.max(1, Math.trunc(params.creditsThreshold))
  const days = Math.max(1, Math.trunc(params.days ?? 7))
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data: usageRows, error } = await supabase
    .from('usage_stats')
    .select('user_id, credits_used, date')
    .gte('date', startDate.toISOString().slice(0, 10))

  if (error) throw error

  const usageByUser = new Map<string, number>()
  for (const row of usageRows ?? []) {
    usageByUser.set(row.user_id, (usageByUser.get(row.user_id) ?? 0) + (row.credits_used ?? 0))
  }

  const targetUsers = Array.from(usageByUser.entries())
    .filter(([, used]) => used >= threshold)
    .map(([userId, used]) => ({ userId, used }))

  if (targetUsers.length === 0) {
    return { notifiedUsers: 0 }
  }

  const payload = targetUsers.map((item) => ({
    user_id: item.userId,
    type: 'credits_low' as const,
    title: 'Uso elevado detectado',
    message: `Nos últimos ${days} dias, você utilizou ${item.used} créditos. Considere revisar seu plano para evitar interrupções.`,
  }))

  const { error: insertError } = await supabase.from('notifications').insert(payload)
  if (insertError) throw insertError

  return { notifiedUsers: payload.length }
}

export async function fetchContentFlags(
  page = 0,
  pageSize = 20,
  status: 'all' | 'open' | 'reviewing' | 'dismissed' | 'removed' = 'all'
): Promise<{ flags: ContentFlagRow[]; total: number }> {
  let query = supabase
    .from('content_flags')
    .select('id, generation_id, reporter_user_id, reason, details, status, reviewed_by, reviewed_at, created_at, generation:generations!content_flags_generation_id_fkey(id, prompt, model_name, output_url, status), reporter:profiles!content_flags_reporter_user_id_fkey(display_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query
  if (error) throw error

  const flags = (data ?? []).map((row: any) => ({
    ...row,
    generation: Array.isArray(row.generation) ? row.generation[0] ?? null : row.generation,
    reporter: Array.isArray(row.reporter) ? row.reporter[0] ?? null : row.reporter,
  })) as ContentFlagRow[]

  return { flags, total: count ?? 0 }
}

export async function createContentFlag(params: {
  generationId: string
  reason: string
  details?: string
  reporterUserId?: string
}): Promise<void> {
  const { error } = await supabase
    .from('content_flags')
    .insert({
      generation_id: params.generationId,
      reason: params.reason,
      details: params.details ?? null,
      reporter_user_id: params.reporterUserId ?? null,
    })

  if (error) throw error
}

export async function updateContentFlagStatus(
  flagId: string,
  status: 'reviewing' | 'dismissed' | 'removed',
  reviewedBy?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('content_flags')
    .update({
      status,
      reviewed_by: reviewedBy ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', flagId)

  if (error) throw error
}

export async function fetchPromptBlacklist(): Promise<PromptBlacklistRow[]> {
  const { data, error } = await supabase
    .from('prompt_blacklist')
    .select('id, pattern, reason, is_regex, is_active, created_by, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PromptBlacklistRow[]
}

export async function addPromptBlacklistEntry(params: {
  pattern: string
  reason?: string
  isRegex?: boolean
  createdBy?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('prompt_blacklist')
    .insert({
      pattern: params.pattern,
      reason: params.reason ?? null,
      is_regex: params.isRegex ?? false,
      is_active: true,
      created_by: params.createdBy ?? null,
    })

  if (error) throw error
  invalidatePromptBlacklistCache()
}

export async function setPromptBlacklistEntryActive(entryId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('prompt_blacklist')
    .update({ is_active: isActive })
    .eq('id', entryId)

  if (error) throw error
  invalidatePromptBlacklistCache()
}

export async function deletePromptBlacklistEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('prompt_blacklist')
    .delete()
    .eq('id', entryId)

  if (error) throw error
  invalidatePromptBlacklistCache()
}

export async function findPromptBlacklistMatch(prompt: string): Promise<PromptBlacklistRow | null> {
  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) return null

  const entries = await fetchActivePromptBlacklistCached()
  const normalizedPrompt = trimmedPrompt.toLowerCase()

  for (const entry of entries) {
    if (entry.is_regex) {
      try {
        const regex = new RegExp(entry.pattern, 'i')
        if (regex.test(trimmedPrompt)) return entry
      } catch {
      }
    } else if (normalizedPrompt.includes(entry.pattern.toLowerCase())) {
      return entry
    }
  }

  return null
}

export async function fetchAiModelSettings(): Promise<AiModelSettingRow[]> {
  const { data, error } = await supabase
    .from('ai_model_settings')
    .select('id, model_id, is_enabled, credit_cost_override, updated_by, updated_at')
    .order('model_id', { ascending: true })

  if (error) throw error
  return (data ?? []) as AiModelSettingRow[]
}

export async function upsertAiModelSetting(params: {
  modelId: string
  isEnabled: boolean
  creditCostOverride?: number | null
  updatedBy?: string | null
}): Promise<void> {
  const normalizedOverride = typeof params.creditCostOverride === 'number'
    ? Math.trunc(params.creditCostOverride)
    : null

  if (normalizedOverride !== null && (!Number.isFinite(normalizedOverride) || normalizedOverride <= 0)) {
    throw new Error('credit_cost_override deve ser maior que zero')
  }

  const { error } = await supabase
    .from('ai_model_settings')
    .upsert({
      model_id: params.modelId,
      is_enabled: params.isEnabled,
      credit_cost_override: normalizedOverride,
      updated_by: params.updatedBy ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'model_id' })

  if (error) throw error
}

export async function fetchPlanLimits(): Promise<PlanLimitRow[]> {
  const { data, error } = await supabase
    .from('plan_limits')
    .select('id, plan, max_concurrent_generations, updated_by, updated_at')
    .order('plan', { ascending: true })

  if (error) throw error
  return (data ?? []) as PlanLimitRow[]
}

export async function upsertPlanLimit(params: {
  plan: string
  maxConcurrentGenerations: number
  updatedBy?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('plan_limits')
    .upsert({
      plan: params.plan,
      max_concurrent_generations: params.maxConcurrentGenerations,
      updated_by: params.updatedBy ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'plan' })

  if (error) throw error
}

export async function getMaintenanceMode(): Promise<boolean> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'maintenance_mode')
    .maybeSingle()

  if (error) throw error
  const raw = data?.value as Record<string, unknown> | null
  return Boolean(raw?.enabled)
}

export async function setMaintenanceMode(enabled: boolean, updatedBy?: string | null): Promise<void> {
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key: 'maintenance_mode',
      value: { enabled },
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  if (error) throw error
}

export async function fetchFeatureFlags(): Promise<FeatureFlagRow[]> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('id, key, enabled, description, updated_by, updated_at')
    .order('key', { ascending: true })

  if (error) throw error
  return (data ?? []) as FeatureFlagRow[]
}

export async function upsertFeatureFlag(params: {
  key: string
  enabled: boolean
  description?: string
  updatedBy?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('feature_flags')
    .upsert({
      key: params.key,
      enabled: params.enabled,
      description: params.description ?? null,
      updated_by: params.updatedBy ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  if (error) throw error
}

export async function fetchRateLimitMonitoring(limit = 100) {
  const { data, error } = await supabase
    .from('edge_rate_limits')
    .select('identifier, action, window_start, request_count, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function fetchServiceHealthStatus(): Promise<ServiceHealthStatus[]> {
  const status: ServiceHealthStatus[] = []

  try {
    const { error } = await supabase.from('profiles').select('id').limit(1)
    status.push({
      service: 'supabase',
      status: error ? 'degraded' : 'healthy',
      details: error ? error.message : 'Database responding',
    })
  } catch (err) {
    status.push({ service: 'supabase', status: 'down', details: err instanceof Error ? err.message : 'Unknown error' })
  }

  try {
    const { data, error } = await supabase
      .from('stripe_webhook_events')
      .select('status, received_at')
      .order('received_at', { ascending: false })
      .limit(30)

    if (error) {
      status.push({ service: 'stripe', status: 'degraded', details: error.message })
    } else {
      const failures = (data ?? []).filter((row) => row.status === 'failed').length
      const ratio = (data?.length ?? 0) > 0 ? failures / (data?.length ?? 1) : 0
      status.push({
        service: 'stripe',
        status: ratio > 0.5 ? 'degraded' : 'healthy',
        details: `${failures}/${data?.length ?? 0} falhas recentes de webhook`,
      })
    }
  } catch (err) {
    status.push({ service: 'stripe', status: 'down', details: err instanceof Error ? err.message : 'Unknown error' })
  }

  try {
    const since = new Date()
    since.setHours(since.getHours() - 24)

    const [totalRes, failedRes] = await Promise.all([
      supabase
        .from('generations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since.toISOString()),
      supabase
        .from('generations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since.toISOString())
        .eq('status', 'failed'),
    ])

    if (totalRes.error || failedRes.error) {
      const details = totalRes.error?.message || failedRes.error?.message || 'Unknown error'
      status.push({ service: 'ai_api', status: 'degraded', details })
    } else {
      const total = totalRes.count ?? 0
      const failed = failedRes.count ?? 0
      const ratio = total > 0 ? failed / total : 0
      status.push({
        service: 'ai_api',
        status: ratio > 0.4 ? 'degraded' : 'healthy',
        details: `${failed}/${total} gerações falharam nas últimas 24h`,
      })
    }
  } catch (err) {
    status.push({ service: 'ai_api', status: 'down', details: err instanceof Error ? err.message : 'Unknown error' })
  }

  return status
}

export async function fetchSupportTickets(
  page = 0,
  pageSize = 20,
  status: 'all' | 'open' | 'in_progress' | 'resolved' | 'closed' = 'all'
): Promise<{ tickets: SupportTicketRow[]; total: number }> {
  let query = supabase
    .from('support_tickets')
    .select('id, user_id, subject, status, priority, assigned_admin_id, created_at, updated_at, profile:profiles!support_tickets_user_id_fkey(display_name, email)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query
  if (error) throw error

  const tickets = (data ?? []).map((row: any) => ({
    ...row,
    profile: Array.isArray(row.profile) ? row.profile[0] ?? null : row.profile,
  })) as SupportTicketRow[]

  return { tickets, total: count ?? 0 }
}

export async function fetchMySupportTickets(
  page = 0,
  pageSize = 20,
  status: 'all' | 'open' | 'in_progress' | 'resolved' | 'closed' = 'all'
): Promise<{ tickets: SupportTicketRow[]; total: number }> {
  let query = supabase
    .from('support_tickets')
    .select('id, user_id, subject, status, priority, assigned_admin_id, created_at, updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query
  if (error) throw error

  return {
    tickets: (data ?? []).map((row) => ({ ...row, profile: null })) as SupportTicketRow[],
    total: count ?? 0,
  }
}

export async function updateSupportTicket(params: {
  ticketId: string
  status?: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  assignedAdminId?: string | null
}): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (params.status) payload.status = params.status
  if (params.priority) payload.priority = params.priority
  if (params.assignedAdminId !== undefined) payload.assigned_admin_id = params.assignedAdminId

  const { error } = await supabase
    .from('support_tickets')
    .update(payload)
    .eq('id', params.ticketId)

  if (error) throw error
}

export async function createSupportTicketByAdmin(params: {
  userId: string
  subject: string
  message: string
  adminUserId?: string | null
}): Promise<{ ticketId: string }> {
  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: params.userId,
      subject: params.subject,
      status: 'open',
      priority: 'normal',
      created_by_admin: true,
      assigned_admin_id: params.adminUserId ?? null,
    })
    .select('id')
    .single()

  if (error) throw error

  const { error: messageError } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: ticket.id,
      sender_user_id: params.adminUserId ?? null,
      sender_role: 'admin',
      message: params.message,
    })

  if (messageError) throw messageError
  return { ticketId: ticket.id }
}

export async function createSupportTicketByUser(params: {
  userId: string
  subject: string
  message: string
}): Promise<{ ticketId: string }> {
  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: params.userId,
      subject: params.subject,
      status: 'open',
      priority: 'normal',
      created_by_admin: false,
      assigned_admin_id: null,
    })
    .select('id')
    .single()

  if (error) throw error

  const { error: messageError } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: ticket.id,
      sender_user_id: params.userId,
      sender_role: 'user',
      message: params.message,
    })

  if (messageError) throw messageError
  return { ticketId: ticket.id }
}

export async function fetchSupportMessages(ticketId: string): Promise<SupportMessageRow[]> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, ticket_id, sender_user_id, sender_role, message, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as SupportMessageRow[]
}

export async function sendSupportMessage(params: {
  ticketId: string
  message: string
  senderRole: 'admin' | 'system' | 'user'
  senderUserId?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: params.ticketId,
      sender_user_id: params.senderUserId ?? null,
      sender_role: params.senderRole,
      message: params.message,
    })

  if (error) throw error

  await supabase
    .from('support_tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', params.ticketId)
}

export async function fetchUserInternalNotes(userId: string): Promise<UserInternalNoteRow[]> {
  const { data, error } = await supabase
    .from('user_internal_notes')
    .select('id, user_id, admin_user_id, note, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as UserInternalNoteRow[]
}

export async function addUserInternalNote(params: {
  userId: string
  note: string
  adminUserId?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('user_internal_notes')
    .insert({
      user_id: params.userId,
      admin_user_id: params.adminUserId ?? null,
      note: params.note,
    })

  if (error) throw error
}

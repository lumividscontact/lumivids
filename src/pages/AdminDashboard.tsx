import { useEffect, useState, useCallback } from 'react'
import {
  Users,
  CreditCard,
  Zap,
  BarChart3,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  RefreshCw,
  Plus,
  Minus,
  Loader2,
  UserCog,
  UserX,
  KeyRound,
  LogOut,
  Clock3,
  Video,
  Ban,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Image as ImageIcon,
  Play,
  Download,
  Wallet,
  BadgePercent,
  Bell,
  Settings,
  LifeBuoy,
  MessageSquare,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/i18n'
import {
  fetchAdminStats,
  fetchAdminUsers,
  adjustUserCredits,
  updateUserPlan,
  setUserSuspended,
  updateUserRole,
  sendPasswordResetEmail,
  forceUserLogout,
  fetchUserActivityHistory,
  fetchAdminGenerations,
  updateGenerationStatus,
  moderateGenerationContent,
  retryFailedGeneration,
  fetchGenerationAnalytics,
  fetchAdminReportsData,
  fetchStripeWebhookEvents,
  fetchAdminSubscriptions,
  createStripeRefund,
  createDiscountCoupon,
  grantBulkCredits,
  sendBulkNotification,
  fetchRecentNotifications,
  sendScheduledMaintenanceNotification,
  sendHighUsageAlerts,
  fetchContentFlags,
  updateContentFlagStatus,
  createContentFlag,
  fetchPromptBlacklist,
  addPromptBlacklistEntry,
  setPromptBlacklistEntryActive,
  deletePromptBlacklistEntry,
  fetchAiModelSettings,
  upsertAiModelSetting,
  fetchPlanLimits,
  upsertPlanLimit,
  getMaintenanceMode,
  setMaintenanceMode,
  fetchFeatureFlags,
  upsertFeatureFlag,
  fetchRateLimitMonitoring,
  fetchServiceHealthStatus,
  fetchSupportTickets,
  updateSupportTicket,
  createSupportTicketByAdmin,
  fetchSupportMessages,
  sendSupportMessage,
  fetchUserInternalNotes,
  addUserInternalNote,
} from '@/services/admin'
import type {
  AdminStats,
  AdminUserWithDetails,
  UserActivityHistory,
  AdminGenerationRow,
  AdminGenerationAnalytics,
  AdminReportsData,
  StripeWebhookEventRow,
  AdminSubscriptionRow,
  ContentFlagRow,
  PromptBlacklistRow,
  AiModelSettingRow,
  PlanLimitRow,
  FeatureFlagRow,
  ServiceHealthStatus,
  SupportTicketRow,
  SupportMessageRow,
  UserInternalNoteRow,
} from '@/services/admin'
import type { AdminTargetPlan, GenerationStatus, GenerationType, PlanType, UserRole } from '@/lib/database.types'

const PAGE_SIZE = 15
const GENERATIONS_PAGE_SIZE = 12
type AdminTab = 'users' | 'generations' | 'finance' | 'moderation' | 'system' | 'support'

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Users; label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-dark-800/60 border border-dark-700 rounded-2xl p-5 flex items-start gap-4 hover:border-dark-600 transition-colors">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-dark-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      </div>
    </div>
  )
}

function BarChartCard({
  title,
  data,
  color,
  valueSuffix = '',
}: {
  title: string
  data: Array<{ label: string; value: number }>
  color: string
  valueSuffix?: string
}) {
  const max = Math.max(1, ...data.map((point) => point.value))

  return (
    <div className="rounded-2xl border border-dark-700 bg-dark-900/50 p-4">
      <h4 className="text-sm font-semibold text-white mb-3">{title}</h4>
      <div className="h-36 flex items-end gap-1.5">
        {data.map((point) => (
          <div key={point.label} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div
              className={`w-full rounded-t ${color}`}
              style={{ height: `${Math.max(6, (point.value / max) * 100)}%` }}
              title={`${point.label}: ${point.value.toLocaleString()}${valueSuffix}`}
            />
            <span className="text-[10px] text-dark-500 truncate max-w-full">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function UserActivityModal({
  activity,
  user,
  onClose,
  t,
}: {
  activity: UserActivityHistory | null
  user: AdminUserWithDetails | null
  onClose: () => void
  t: any
}) {
  if (!user) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-dark-900 border border-dark-700 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white">{t.admin.activity.title}</h3>
            <p className="text-sm text-dark-400">{user.display_name || user.email}</p>
          </div>
          <button onClick={onClose} className="btn-secondary text-sm px-3 py-2">
            {t.common.close}
          </button>
        </div>

        {!activity ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">{t.admin.activity.recentGenerations}</h4>
              <div className="bg-dark-800/60 border border-dark-700 rounded-xl overflow-hidden">
                {activity.recentGenerations.length === 0 ? (
                  <p className="text-sm text-dark-500 p-4">{t.admin.activity.noData}</p>
                ) : (
                  <div className="divide-y divide-dark-700">
                    {activity.recentGenerations.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-white">{item.type}</p>
                          <p className="text-xs text-dark-400">{item.model_name || '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-dark-400">{item.status}</p>
                          <p className="text-xs text-dark-500">{new Date(item.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-2">{t.admin.activity.usageStats}</h4>
              <div className="bg-dark-800/60 border border-dark-700 rounded-xl overflow-hidden">
                {activity.usageStats.length === 0 ? (
                  <p className="text-sm text-dark-500 p-4">{t.admin.activity.noData}</p>
                ) : (
                  <div className="divide-y divide-dark-700">
                    {activity.usageStats.slice(0, 10).map((item) => (
                      <div key={`${item.date}-${item.generation_type}`} className="p-3 flex items-center justify-between gap-3">
                        <p className="text-sm text-white">{item.generation_type}</p>
                        <p className="text-xs text-dark-400">{item.date} · {item.generation_count} · {item.credits_used} cr</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-2">{t.admin.activity.creditTransactions}</h4>
              <div className="bg-dark-800/60 border border-dark-700 rounded-xl overflow-hidden">
                {activity.creditTransactions.length === 0 ? (
                  <p className="text-sm text-dark-500 p-4">{t.admin.activity.noData}</p>
                ) : (
                  <div className="divide-y divide-dark-700">
                    {activity.creditTransactions.slice(0, 12).map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                        <p className="text-sm text-white">{item.type}</p>
                        <p className="text-xs text-dark-400">{item.amount > 0 ? '+' : ''}{item.amount} · {item.balance_after}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function UserRow({
  user,
  t,
  onAdjustCredits,
  onPlanChange,
  onToggleSuspended,
  onToggleRole,
  onSendPasswordReset,
  onForceLogout,
  onOpenActivity,
}: {
  user: AdminUserWithDetails
  t: any
  onAdjustCredits: (userId: string, delta: number) => Promise<void>
  onPlanChange: (userId: string, plan: PlanType) => Promise<void>
  onToggleSuspended: (userId: string, nextSuspended: boolean) => Promise<void>
  onToggleRole: (userId: string, role: UserRole) => Promise<void>
  onSendPasswordReset: (email: string) => Promise<void>
  onForceLogout: (userId: string) => Promise<void>
  onOpenActivity: (user: AdminUserWithDetails) => void
}) {
  const [adjusting, setAdjusting] = useState(false)
  const [amount, setAmount] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const handleAdjust = async (delta: number) => {
    if (!delta) return
    setAdjusting(true)
    await onAdjustCredits(user.user_id, delta)
    setAmount('')
    setAdjusting(false)
  }

  const runAction = async (key: string, cb: () => Promise<void>) => {
    setBusyAction(key)
    try {
      await cb()
    } finally {
      setBusyAction(null)
    }
  }

  const planBadgeColor = (() => {
    switch (user.plan) {
      case 'director': return 'bg-yellow-500/20 text-yellow-400'
      case 'studio': return 'bg-purple-500/20 text-purple-400'
      case 'creator': return 'bg-blue-500/20 text-blue-400'
      default: return 'bg-dark-700 text-dark-400'
    }
  })()

  const statusColor = user.subscriptionStatus === 'active'
    ? 'text-green-400'
    : user.subscriptionStatus === 'canceled'
    ? 'text-red-400'
    : 'text-dark-500'

  return (
    <tr className="border-t border-dark-800 hover:bg-dark-800/30 transition-colors align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-semibold">
              {(user.display_name || user.email || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.display_name || '—'}</p>
            <p className="text-xs text-dark-400 truncate">{user.email}</p>
            {user.is_suspended && (
              <p className="text-xs text-red-400 mt-1">{user.suspended_reason || t.admin.users.suspended}</p>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="space-y-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block ${planBadgeColor}`}>
            {user.plan || 'free'}
          </span>
          <select
            className="w-full min-w-[120px] bg-dark-900 border border-dark-700 rounded-lg px-2 py-1 text-xs text-white"
            value={user.plan ?? ''}
            onChange={(e) => {
              const nextPlan = e.target.value === '' ? null : (e.target.value as Exclude<PlanType, null>)
              runAction('plan', () => onPlanChange(user.user_id, nextPlan))
            }}
            disabled={busyAction === 'plan'}
          >
            <option value="">free</option>
            <option value="creator">creator</option>
            <option value="studio">studio</option>
            <option value="director">director</option>
          </select>
        </div>
      </td>

      <td className={`px-4 py-3 text-sm ${statusColor}`}>
        <p>{user.subscriptionStatus || '—'}</p>
        <button
          onClick={() => runAction('suspend', () => onToggleSuspended(user.user_id, !user.is_suspended))}
          className={`mt-2 text-xs px-2 py-1 rounded-lg border ${user.is_suspended ? 'text-green-400 border-green-500/40' : 'text-red-400 border-red-500/40'} disabled:opacity-40`}
          disabled={busyAction === 'suspend'}
        >
          {busyAction === 'suspend' ? t.common.loading : user.is_suspended ? t.admin.users.unsuspend : t.admin.users.suspend}
        </button>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary-400" />
          <span className="text-sm font-semibold text-white">{user.credits.toLocaleString()}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-20 px-2 py-1 rounded-lg bg-dark-900 border border-dark-700 text-white text-xs focus:border-primary-500 focus:outline-none"
          />
          <button
            onClick={() => handleAdjust(Number(amount) || 0)}
            disabled={adjusting || !amount || Number(amount) === 0}
            className="p-1 rounded-lg hover:bg-green-500/20 text-green-400 disabled:opacity-30 transition-colors"
            title="Add credits"
          >
            {adjusting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleAdjust(-(Number(amount) || 0))}
            disabled={adjusting || !amount || Number(amount) === 0}
            className="p-1 rounded-lg hover:bg-red-500/20 text-red-400 disabled:opacity-30 transition-colors"
            title="Remove credits"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </td>

      <td className="px-4 py-3 text-xs text-dark-400">
        <div className="space-y-2">
          <button
            onClick={() => runAction('role', () => onToggleRole(user.user_id, user.role === 'admin' ? 'user' : 'admin'))}
            className="w-full text-left px-2 py-1 rounded-lg border border-dark-700 hover:border-dark-500 text-xs text-white disabled:opacity-40"
            disabled={busyAction === 'role'}
          >
            {user.role === 'admin' ? t.admin.users.removeAdmin : t.admin.users.makeAdmin}
          </button>
          {user.role === 'admin' && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium inline-flex">admin</span>
          )}
        </div>
      </td>

      <td className="px-4 py-3 text-xs text-dark-500 min-w-[220px]">
        <div className="space-y-2">
          <p>{new Date(user.created_at).toLocaleDateString()}</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onOpenActivity(user)}
              className="px-2 py-1 rounded-lg border border-dark-700 text-dark-200 hover:border-dark-500 inline-flex items-center gap-1"
            >
              <Clock3 className="w-3 h-3" /> {t.admin.users.activity}
            </button>
            <button
              onClick={() => user.email && runAction('reset', () => onSendPasswordReset(user.email!))}
              disabled={!user.email || busyAction === 'reset'}
              className="px-2 py-1 rounded-lg border border-dark-700 text-dark-200 hover:border-dark-500 inline-flex items-center gap-1 disabled:opacity-40"
            >
              <KeyRound className="w-3 h-3" /> {t.admin.users.resetPassword}
            </button>
            <button
              onClick={() => runAction('logout', () => onForceLogout(user.user_id))}
              disabled={busyAction === 'logout'}
              className="px-2 py-1 rounded-lg border border-dark-700 text-dark-200 hover:border-dark-500 inline-flex items-center gap-1 disabled:opacity-40"
            >
              <LogOut className="w-3 h-3" /> {t.admin.users.forceLogout}
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

function GenerationRow({
  generation,
  t,
  onChangeStatus,
  onModerate,
  onRetry,
  onPreview,
  onFlag,
}: {
  generation: AdminGenerationRow
  t: any
  onChangeStatus: (id: string, status: GenerationStatus) => Promise<void>
  onModerate: (id: string) => Promise<void>
  onRetry: (id: string) => Promise<void>
  onPreview: (generation: AdminGenerationRow) => void
  onFlag: (id: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  const statusBadge = generation.status === 'succeeded'
    ? 'bg-green-500/20 text-green-400'
    : generation.status === 'failed'
    ? 'bg-red-500/20 text-red-400'
    : generation.status === 'canceled'
    ? 'bg-orange-500/20 text-orange-400'
    : 'bg-blue-500/20 text-blue-400'

  const changeStatus = async (next: GenerationStatus) => {
    setBusy(true)
    try {
      await onChangeStatus(generation.id, next)
    } finally {
      setBusy(false)
    }
  }

  const runModeration = async () => {
    setBusy(true)
    try {
      await onModerate(generation.id)
    } finally {
      setBusy(false)
    }
  }

  const runRetry = async () => {
    setBusy(true)
    try {
      await onRetry(generation.id)
    } finally {
      setBusy(false)
    }
  }

  const runFlag = async () => {
    setBusy(true)
    try {
      await onFlag(generation.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="border-t border-dark-800 hover:bg-dark-800/30 transition-colors align-top">
      <td className="px-4 py-3">
        <p className="text-sm text-white line-clamp-2 max-w-[320px]">{generation.prompt || '—'}</p>
        <p className="text-xs text-dark-500 mt-1">{generation.model_name || '—'}</p>
      </td>
      <td className="px-4 py-3 text-xs text-dark-300">
        <p>{generation.profile?.display_name || '—'}</p>
        <p className="text-dark-500">{generation.profile?.email || generation.user_id}</p>
      </td>
      <td className="px-4 py-3 text-xs text-dark-300">{generation.type}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge}`}>{generation.status}</span>
      </td>
      <td className="px-4 py-3 text-xs text-dark-300">{generation.credits_used}</td>
      <td className="px-4 py-3 text-xs text-dark-400">{new Date(generation.created_at).toLocaleString()}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {generation.output_url && (
            <button
              onClick={() => onPreview(generation)}
              className="px-2 py-1 rounded-lg border border-dark-700 text-dark-200 hover:border-dark-500 text-xs"
            >
              {t.admin.generations.preview}
            </button>
          )}
          {generation.status === 'processing' || generation.status === 'starting' ? (
            <button
              onClick={() => changeStatus('canceled')}
              disabled={busy}
              className="px-2 py-1 rounded-lg border border-orange-500/40 text-orange-400 text-xs disabled:opacity-40 inline-flex items-center gap-1"
            >
              <Ban className="w-3 h-3" /> {t.admin.generations.cancel}
            </button>
          ) : (
            <button
              onClick={() => changeStatus('failed')}
              disabled={busy}
              className="px-2 py-1 rounded-lg border border-red-500/40 text-red-400 text-xs disabled:opacity-40 inline-flex items-center gap-1"
            >
              <XCircle className="w-3 h-3" /> {t.admin.generations.markFailed}
            </button>
          )}
          <button
            onClick={runModeration}
            disabled={busy}
            className="px-2 py-1 rounded-lg border border-red-500/40 text-red-400 text-xs disabled:opacity-40"
          >
            Moderar
          </button>
          <button
            onClick={runFlag}
            disabled={busy}
            className="px-2 py-1 rounded-lg border border-yellow-500/40 text-yellow-400 text-xs disabled:opacity-40"
          >
            Flag
          </button>
          {generation.status === 'failed' && (
            <button
              onClick={runRetry}
              disabled={busy}
              className="px-2 py-1 rounded-lg border border-blue-500/40 text-blue-400 text-xs disabled:opacity-40 inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reexecutar
            </button>
          )}
          <button
            onClick={() => changeStatus('succeeded')}
            disabled={busy}
            className="px-2 py-1 rounded-lg border border-green-500/40 text-green-400 text-xs disabled:opacity-40 inline-flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3" /> {t.admin.generations.markSucceeded}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function AdminDashboard() {
  const { isAdmin, user } = useAuth()
  const { t } = useLanguage()

  const [tab, setTab] = useState<AdminTab>('users')
  const [stats, setStats] = useState<AdminStats | null>(null)

  const [users, setUsers] = useState<AdminUserWithDetails[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [generations, setGenerations] = useState<AdminGenerationRow[]>([])
  const [totalGenerations, setTotalGenerations] = useState(0)
  const [generationPage, setGenerationPage] = useState(0)
  const [generationSearchInput, setGenerationSearchInput] = useState('')
  const [generationSearch, setGenerationSearch] = useState('')
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | 'all'>('all')
  const [generationType, setGenerationType] = useState<GenerationType | 'all'>('all')
  const [generationModelInput, setGenerationModelInput] = useState('')
  const [generationModel, setGenerationModel] = useState('')
  const [generationDateFrom, setGenerationDateFrom] = useState('')
  const [generationDateTo, setGenerationDateTo] = useState('')
  const [generationAnalytics, setGenerationAnalytics] = useState<AdminGenerationAnalytics | null>(null)
  const [reportsData, setReportsData] = useState<AdminReportsData | null>(null)
  const [previewGeneration, setPreviewGeneration] = useState<AdminGenerationRow | null>(null)

  const [stripeEvents, setStripeEvents] = useState<StripeWebhookEventRow[]>([])
  const [stripeEventsPage, setStripeEventsPage] = useState(0)
  const [stripeEventsTotal, setStripeEventsTotal] = useState(0)
  const [stripeEventsSearch, setStripeEventsSearch] = useState('')
  const [stripeEventsSearchInput, setStripeEventsSearchInput] = useState('')

  const [adminSubscriptions, setAdminSubscriptions] = useState<AdminSubscriptionRow[]>([])
  const [adminSubscriptionsPage, setAdminSubscriptionsPage] = useState(0)
  const [adminSubscriptionsTotal, setAdminSubscriptionsTotal] = useState(0)
  const [adminSubscriptionStatus, setAdminSubscriptionStatus] = useState<'all' | 'active' | 'canceled' | 'past_due'>('all')

  const [refundPaymentIntent, setRefundPaymentIntent] = useState('')
  const [refundChargeId, setRefundChargeId] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundRunning, setRefundRunning] = useState(false)

  const [couponCode, setCouponCode] = useState('')
  const [couponPercent, setCouponPercent] = useState('10')
  const [couponDuration, setCouponDuration] = useState<'once' | 'repeating' | 'forever'>('once')
  const [couponDurationMonths, setCouponDurationMonths] = useState('3')
  const [couponRunning, setCouponRunning] = useState(false)
  const [lastCouponCreated, setLastCouponCreated] = useState<string | null>(null)

  const [bulkCreditsAmount, setBulkCreditsAmount] = useState('50')
  const [bulkCreditsPlan, setBulkCreditsPlan] = useState<AdminTargetPlan>('all')
  const [bulkCreditsSubStatus, setBulkCreditsSubStatus] = useState<'all' | 'active' | 'canceled' | 'past_due'>('all')
  const [bulkCreditsRunning, setBulkCreditsRunning] = useState(false)

  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyType, setNotifyType] = useState<'system' | 'subscription' | 'credits_low'>('system')
  const [notifyPlan, setNotifyPlan] = useState<AdminTargetPlan>('all')
  const [notifyRunning, setNotifyRunning] = useState(false)
  const [recentNotifications, setRecentNotifications] = useState<any[]>([])
  const [maintenanceStartAt, setMaintenanceStartAt] = useState('')
  const [maintenanceEndAt, setMaintenanceEndAt] = useState('')
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [highUsageThreshold, setHighUsageThreshold] = useState('1000')
  const [highUsageDays, setHighUsageDays] = useState('7')

  const [flags, setFlags] = useState<ContentFlagRow[]>([])
  const [flagsPage, setFlagsPage] = useState(0)
  const [flagsTotal, setFlagsTotal] = useState(0)
  const [flagsStatus, setFlagsStatus] = useState<'all' | 'open' | 'reviewing' | 'dismissed' | 'removed'>('all')
  const [newFlagReason, setNewFlagReason] = useState('Conteúdo impróprio')
  const [promptBlacklist, setPromptBlacklist] = useState<PromptBlacklistRow[]>([])
  const [blacklistPattern, setBlacklistPattern] = useState('')
  const [blacklistReason, setBlacklistReason] = useState('')
  const [blacklistRegex, setBlacklistRegex] = useState(false)

  const [aiModelSettings, setAiModelSettings] = useState<AiModelSettingRow[]>([])
  const [planLimits, setPlanLimits] = useState<PlanLimitRow[]>([])
  const [maintenanceMode, setMaintenanceModeState] = useState(false)
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagRow[]>([])
  const [newFeatureFlagKey, setNewFeatureFlagKey] = useState('')
  const [newFeatureFlagDescription, setNewFeatureFlagDescription] = useState('')
  const [rateLimitRows, setRateLimitRows] = useState<any[]>([])
  const [serviceHealth, setServiceHealth] = useState<ServiceHealthStatus[]>([])

  const [supportTickets, setSupportTickets] = useState<SupportTicketRow[]>([])
  const [supportTicketsPage, setSupportTicketsPage] = useState(0)
  const [supportTicketsTotal, setSupportTicketsTotal] = useState(0)
  const [supportTicketsStatus, setSupportTicketsStatus] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all')
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketRow | null>(null)
  const [ticketMessages, setTicketMessages] = useState<SupportMessageRow[]>([])
  const [ticketReply, setTicketReply] = useState('')
  const [adminNewTicketUserId, setAdminNewTicketUserId] = useState('')
  const [adminNewTicketSubject, setAdminNewTicketSubject] = useState('')
  const [adminNewTicketMessage, setAdminNewTicketMessage] = useState('')
  const [internalNotes, setInternalNotes] = useState<UserInternalNoteRow[]>([])
  const [internalNoteInput, setInternalNoteInput] = useState('')

  const [selectedUser, setSelectedUser] = useState<AdminUserWithDetails | null>(null)
  const [userActivity, setUserActivity] = useState<UserActivityHistory | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadUsers = useCallback(async () => {
    const usersData = await fetchAdminUsers(page, PAGE_SIZE, search)
    setUsers(usersData.users)
    setTotalUsers(usersData.total)
  }, [page, search])

  const loadGenerations = useCallback(async () => {
    const result = await fetchAdminGenerations(generationPage, GENERATIONS_PAGE_SIZE, {
      search: generationSearch,
      status: generationStatus,
      type: generationType,
      model: generationModel,
      dateFrom: generationDateFrom,
      dateTo: generationDateTo,
    })
    setGenerations(result.generations)
    setTotalGenerations(result.total)
  }, [generationPage, generationSearch, generationStatus, generationType, generationModel, generationDateFrom, generationDateTo])

  const loadStripeEvents = useCallback(async () => {
    const result = await fetchStripeWebhookEvents(stripeEventsPage, 12, stripeEventsSearch)
    setStripeEvents(Array.isArray(result.events) ? result.events : [])
    setStripeEventsTotal(Number(result.total ?? 0))
  }, [stripeEventsPage, stripeEventsSearch])

  const loadAdminSubscriptions = useCallback(async () => {
    const result = await fetchAdminSubscriptions(adminSubscriptionsPage, 12, adminSubscriptionStatus)
    setAdminSubscriptions(result.subscriptions)
    setAdminSubscriptionsTotal(result.total)
  }, [adminSubscriptionsPage, adminSubscriptionStatus])

  const loadRecentNotifications = useCallback(async () => {
    const notifications = await fetchRecentNotifications(20)
    setRecentNotifications(notifications)
  }, [])

  const loadFlags = useCallback(async () => {
    const result = await fetchContentFlags(flagsPage, 12, flagsStatus)
    setFlags(result.flags)
    setFlagsTotal(result.total)
  }, [flagsPage, flagsStatus])

  const loadPromptBlacklist = useCallback(async () => {
    const entries = await fetchPromptBlacklist()
    setPromptBlacklist(entries)
  }, [])

  const loadSystemConfig = useCallback(async () => {
    const [models, limits, maintenance, flags, rateLimits, health] = await Promise.all([
      fetchAiModelSettings(),
      fetchPlanLimits(),
      getMaintenanceMode(),
      fetchFeatureFlags(),
      fetchRateLimitMonitoring(30),
      fetchServiceHealthStatus(),
    ])

    setAiModelSettings(models)
    setPlanLimits(limits)
    setMaintenanceModeState(maintenance)
    setFeatureFlags(flags)
    setRateLimitRows(rateLimits)
    setServiceHealth(health)
  }, [])

  const loadSupportTickets = useCallback(async () => {
    const result = await fetchSupportTickets(supportTicketsPage, 12, supportTicketsStatus)
    setSupportTickets(result.tickets)
    setSupportTicketsTotal(result.total)
  }, [supportTicketsPage, supportTicketsStatus])

  const loadSelectedTicketMessages = useCallback(async (ticketId: string) => {
    const messages = await fetchSupportMessages(ticketId)
    setTicketMessages(messages)
  }, [])

  const loadInternalNotes = useCallback(async (targetUserId: string) => {
    const notes = await fetchUserInternalNotes(targetUserId)
    setInternalNotes(notes)
  }, [])

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      if (tab === 'users') {
        const [statsData] = await Promise.all([fetchAdminStats(), loadUsers()])
        setStats(statsData)
      } else if (tab === 'generations') {
        const [statsData, generationAnalyticsData, reports] = await Promise.all([
          fetchAdminStats(),
          fetchGenerationAnalytics(),
          fetchAdminReportsData(),
          loadGenerations(),
        ])
        setStats(statsData)
        setGenerationAnalytics(generationAnalyticsData)
        setReportsData(reports)
      } else if (tab === 'finance') {
        await Promise.all([
          loadStripeEvents(),
          loadAdminSubscriptions(),
          loadRecentNotifications(),
        ])
      } else if (tab === 'moderation') {
        await Promise.all([
          loadFlags(),
          loadPromptBlacklist(),
        ])
      } else if (tab === 'system') {
        await loadSystemConfig()
      } else if (tab === 'support') {
        await loadSupportTickets()
      }
    } catch (err) {
      console.error('[Admin] Failed to load data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tab, loadUsers, loadGenerations, loadStripeEvents, loadAdminSubscriptions, loadRecentNotifications, loadFlags, loadPromptBlacklist, loadSystemConfig, loadSupportTickets])

  useEffect(() => {
    if (tab !== 'users') return
    loadData()
  }, [tab, loadData])

  useEffect(() => {
    if (tab !== 'generations') return
    loadData()
  }, [tab, loadData, generationPage, generationSearch, generationStatus, generationType, generationModel, generationDateFrom, generationDateTo])

  useEffect(() => {
    if (tab !== 'finance') return
    loadData()
  }, [tab, loadData, stripeEventsPage, stripeEventsSearch, adminSubscriptionsPage, adminSubscriptionStatus])

  useEffect(() => {
    if (tab !== 'moderation') return
    loadData()
  }, [tab, loadData, flagsPage, flagsStatus])

  useEffect(() => {
    if (tab !== 'system') return
    loadData()
  }, [tab, loadData])

  useEffect(() => {
    if (tab !== 'support') return
    loadData()
  }, [tab, loadData, supportTicketsPage, supportTicketsStatus])

  const refreshUsersAndStats = async () => {
    const [statsData] = await Promise.all([fetchAdminStats(), loadUsers()])
    setStats(statsData)
  }

  const handleSearch = () => {
    setPage(0)
    setSearch(searchInput)
  }

  const handleGenerationSearch = () => {
    setGenerationPage(0)
    setGenerationSearch(generationSearchInput)
    setGenerationModel(generationModelInput)
  }

  const handleAdjustCredits = async (userId: string, delta: number) => {
    try {
      await adjustUserCredits(userId, delta)
      await refreshUsersAndStats()
    } catch (err) {
      console.error('[Admin] Failed to adjust credits:', err)
    }
  }

  const handlePlanChange = async (userId: string, plan: PlanType) => {
    try {
      await updateUserPlan(userId, plan)
      await refreshUsersAndStats()
    } catch (err) {
      console.error('[Admin] Failed to update plan:', err)
    }
  }

  const handleToggleSuspended = async (userId: string, nextSuspended: boolean) => {
    try {
      const reason = nextSuspended ? window.prompt(t.admin.users.suspendReasonPrompt) : null
      await setUserSuspended(userId, nextSuspended, reason)
      await loadUsers()
    } catch (err) {
      console.error('[Admin] Failed to update suspension:', err)
    }
  }

  const handleToggleRole = async (userId: string, role: UserRole) => {
    if (userId === user?.id && role !== 'admin') {
      window.alert('Você não pode remover seu próprio acesso de admin.')
      return
    }

    try {
      await updateUserRole(userId, role)
      await loadUsers()
    } catch (err) {
      console.error('[Admin] Failed to update role:', err)
    }
  }

  const handleSendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(email)
    } catch (err) {
      console.error('[Admin] Failed to send password reset:', err)
    }
  }

  const handleForceLogout = async (userId: string) => {
    try {
      await forceUserLogout(userId)
      await loadUsers()
    } catch (err) {
      console.error('[Admin] Failed to force logout:', err)
    }
  }

  const handleOpenActivity = async (user: AdminUserWithDetails) => {
    setSelectedUser(user)
    setUserActivity(null)
    try {
      const activity = await fetchUserActivityHistory(user.user_id)
      setUserActivity(activity)
    } catch (err) {
      console.error('[Admin] Failed to load activity history:', err)
    }
  }

  const handleUpdateGenerationStatus = async (generationId: string, status: GenerationStatus) => {
    try {
      await updateGenerationStatus(generationId, status)
      await Promise.all([loadGenerations(), fetchAdminStats().then(setStats), fetchGenerationAnalytics().then(setGenerationAnalytics)])
    } catch (err) {
      console.error('[Admin] Failed to update generation status:', err)
    }
  }

  const handleModerateGeneration = async (generationId: string) => {
    try {
      await moderateGenerationContent(generationId)
      await Promise.all([loadGenerations(), fetchAdminStats().then(setStats), fetchGenerationAnalytics().then(setGenerationAnalytics)])
    } catch (err) {
      console.error('[Admin] Failed to moderate generation:', err)
    }
  }

  const handleRetryFailedGeneration = async (generationId: string) => {
    try {
      await retryFailedGeneration(generationId)
      await Promise.all([loadGenerations(), fetchGenerationAnalytics().then(setGenerationAnalytics)])
    } catch (err) {
      console.error('[Admin] Failed to retry generation:', err)
    }
  }

  const handleStripeSearch = () => {
    setStripeEventsPage(0)
    setStripeEventsSearch(stripeEventsSearchInput)
  }

  const handleCreateRefund = async () => {
    if (!refundPaymentIntent && !refundChargeId) return
    setRefundRunning(true)
    try {
      await createStripeRefund({
        paymentIntentId: refundPaymentIntent || undefined,
        chargeId: refundChargeId || undefined,
        amount: refundAmount ? Number(refundAmount) : undefined,
        reason: 'requested_by_customer',
      })
      setRefundPaymentIntent('')
      setRefundChargeId('')
      setRefundAmount('')
      await loadStripeEvents()
      window.alert('Reembolso solicitado com sucesso no Stripe.')
    } catch (err) {
      console.error('[Admin] Failed to create refund:', err)
      window.alert(err instanceof Error ? err.message : 'Falha ao criar reembolso')
    } finally {
      setRefundRunning(false)
    }
  }

  const handleCreateCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponRunning(true)
    try {
      const result = await createDiscountCoupon({
        code: couponCode.trim(),
        percentOff: Number(couponPercent),
        duration: couponDuration,
        durationInMonths: couponDuration === 'repeating' ? Number(couponDurationMonths) : undefined,
      })
      setLastCouponCreated(result.code)
      setCouponCode('')
      window.alert(`Cupom criado: ${result.code}`)
    } catch (err) {
      console.error('[Admin] Failed to create coupon:', err)
      window.alert(err instanceof Error ? err.message : 'Falha ao criar cupom')
    } finally {
      setCouponRunning(false)
    }
  }

  const handleBulkCredits = async () => {
    const amount = Number(bulkCreditsAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    setBulkCreditsRunning(true)
    try {
      const result = await grantBulkCredits({
        amount,
        targetPlan: bulkCreditsPlan,
        subscriptionStatus: bulkCreditsSubStatus,
        description: 'Campanha promocional administrada',
      })
      window.alert(`Créditos concedidos para ${result.updatedUsers} usuários.`)
      await Promise.all([loadUsers(), fetchAdminStats().then(setStats)])
    } catch (err) {
      console.error('[Admin] Failed to grant bulk credits:', err)
      window.alert(err instanceof Error ? err.message : 'Falha ao conceder créditos')
    } finally {
      setBulkCreditsRunning(false)
    }
  }

  const handleSendBulkNotification = async () => {
    if (!notifyTitle.trim() || !notifyMessage.trim()) return
    setNotifyRunning(true)
    try {
      const result = await sendBulkNotification({
        title: notifyTitle,
        message: notifyMessage,
        type: notifyType,
        targetPlan: notifyPlan,
      })
      window.alert(`Notificação enviada para ${result.notifiedUsers} usuários.`)
      setNotifyTitle('')
      setNotifyMessage('')
      await loadRecentNotifications()
    } catch (err) {
      console.error('[Admin] Failed to send notifications:', err)
      window.alert(err instanceof Error ? err.message : 'Falha ao enviar notificações')
    } finally {
      setNotifyRunning(false)
    }
  }

  const handleSendMaintenanceNotification = async () => {
    if (!maintenanceStartAt) return
    try {
      const result = await sendScheduledMaintenanceNotification({
        startsAt: maintenanceStartAt,
        endsAt: maintenanceEndAt || undefined,
        message: maintenanceMessage || undefined,
        targetPlan: notifyPlan,
      })
      window.alert(`Notificação de manutenção enviada para ${result.notifiedUsers} usuários.`)
      setMaintenanceMessage('')
      await loadRecentNotifications()
    } catch (err) {
      console.error('[Admin] Failed maintenance notification:', err)
      window.alert(err instanceof Error ? err.message : 'Falha ao enviar manutenção programada')
    }
  }

  const handleSendHighUsageAlerts = async () => {
    try {
      const result = await sendHighUsageAlerts({
        creditsThreshold: Number(highUsageThreshold),
        days: Number(highUsageDays),
      })
      window.alert(`Alertas de uso excessivo enviados para ${result.notifiedUsers} usuários.`)
      await loadRecentNotifications()
    } catch (err) {
      console.error('[Admin] Failed high usage alerts:', err)
      window.alert(err instanceof Error ? err.message : 'Falha ao enviar alertas de uso excessivo')
    }
  }

  const handleAddFlagFromGeneration = async (generationId: string) => {
    try {
      await createContentFlag({
        generationId,
        reason: newFlagReason,
        reporterUserId: user?.id,
      })
      await loadFlags()
      window.alert('Flag criado para revisão.')
    } catch (err) {
      console.error('[Admin] Failed to create content flag:', err)
      window.alert(err instanceof Error ? err.message : 'Falha ao criar flag')
    }
  }

  const handleFlagStatus = async (flagId: string, status: 'reviewing' | 'dismissed' | 'removed') => {
    try {
      await updateContentFlagStatus(flagId, status, user?.id ?? null)
      await Promise.all([loadFlags(), loadGenerations()])
    } catch (err) {
      console.error('[Admin] Failed to update flag status:', err)
    }
  }

  const handleAddBlacklistEntry = async () => {
    if (!blacklistPattern.trim()) return
    try {
      await addPromptBlacklistEntry({
        pattern: blacklistPattern.trim(),
        reason: blacklistReason.trim() || undefined,
        isRegex: blacklistRegex,
        createdBy: user?.id ?? null,
      })
      setBlacklistPattern('')
      setBlacklistReason('')
      setBlacklistRegex(false)
      await loadPromptBlacklist()
    } catch (err) {
      console.error('[Admin] Failed to add blacklist entry:', err)
      window.alert(err instanceof Error ? err.message : 'Falha ao adicionar item na blacklist')
    }
  }

  const handleToggleBlacklist = async (entryId: string, nextActive: boolean) => {
    try {
      await setPromptBlacklistEntryActive(entryId, nextActive)
      await loadPromptBlacklist()
    } catch (err) {
      console.error('[Admin] Failed to toggle blacklist entry:', err)
    }
  }

  const handleDeleteBlacklistEntry = async (entryId: string) => {
    try {
      await deletePromptBlacklistEntry(entryId)
      await loadPromptBlacklist()
    } catch (err) {
      console.error('[Admin] Failed to delete blacklist entry:', err)
    }
  }

  const handleToggleModelEnabled = async (modelId: string, nextEnabled: boolean, currentOverride: number | null) => {
    try {
      await upsertAiModelSetting({
        modelId,
        isEnabled: nextEnabled,
        creditCostOverride: currentOverride,
        updatedBy: user?.id ?? null,
      })
      await loadSystemConfig()
    } catch (err) {
      console.error('[Admin] Failed to update model setting:', err)
    }
  }

  const handleSetModelCostOverride = async (modelId: string, value: string, isEnabled: boolean) => {
    const parsed = value.trim() ? Number(value) : null
    if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
      window.alert('O custo override deve ser maior que 0.')
      return
    }
    try {
      await upsertAiModelSetting({
        modelId,
        isEnabled,
        creditCostOverride: parsed,
        updatedBy: user?.id ?? null,
      })
      await loadSystemConfig()
    } catch (err) {
      console.error('[Admin] Failed to set model credit override:', err)
    }
  }

  const handleSetPlanLimit = async (plan: string, value: string) => {
    const next = Number(value)
    if (!Number.isFinite(next) || next <= 0) return
    try {
      await upsertPlanLimit({
        plan,
        maxConcurrentGenerations: Math.trunc(next),
        updatedBy: user?.id ?? null,
      })
      await loadSystemConfig()
    } catch (err) {
      console.error('[Admin] Failed to update plan limits:', err)
    }
  }

  const handleToggleMaintenance = async () => {
    try {
      const next = !maintenanceMode
      await setMaintenanceMode(next, user?.id ?? null)
      setMaintenanceModeState(next)
    } catch (err) {
      console.error('[Admin] Failed to toggle maintenance mode:', err)
    }
  }

  const handleToggleFeatureFlag = async (key: string, enabled: boolean, description?: string | null) => {
    try {
      await upsertFeatureFlag({ key, enabled, description: description || undefined, updatedBy: user?.id ?? null })
      await loadSystemConfig()
    } catch (err) {
      console.error('[Admin] Failed to toggle feature flag:', err)
    }
  }

  const handleCreateFeatureFlag = async () => {
    if (!newFeatureFlagKey.trim()) return
    try {
      await upsertFeatureFlag({
        key: newFeatureFlagKey.trim(),
        enabled: false,
        description: newFeatureFlagDescription.trim() || undefined,
        updatedBy: user?.id ?? null,
      })
      setNewFeatureFlagKey('')
      setNewFeatureFlagDescription('')
      await loadSystemConfig()
    } catch (err) {
      console.error('[Admin] Failed to create feature flag:', err)
    }
  }

  const handleOpenTicket = async (ticket: SupportTicketRow) => {
    setSelectedTicket(ticket)
    await Promise.all([loadSelectedTicketMessages(ticket.id), loadInternalNotes(ticket.user_id)])
  }

  const handleUpdateTicketStatus = async (ticketId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed') => {
    try {
      await updateSupportTicket({ ticketId, status, assignedAdminId: user?.id ?? null })
      await loadSupportTickets()
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => prev ? { ...prev, status } : prev)
      }
    } catch (err) {
      console.error('[Admin] Failed to update ticket status:', err)
    }
  }

  const handleReplyTicket = async () => {
    if (!selectedTicket || !ticketReply.trim()) return
    try {
      await sendSupportMessage({
        ticketId: selectedTicket.id,
        message: ticketReply.trim(),
        senderRole: 'admin',
        senderUserId: user?.id ?? null,
      })
      setTicketReply('')
      await loadSelectedTicketMessages(selectedTicket.id)
      await loadSupportTickets()
    } catch (err) {
      console.error('[Admin] Failed to send ticket reply:', err)
    }
  }

  const handleCreateTicket = async () => {
    if (!adminNewTicketUserId.trim() || !adminNewTicketSubject.trim() || !adminNewTicketMessage.trim()) return
    try {
      await createSupportTicketByAdmin({
        userId: adminNewTicketUserId.trim(),
        subject: adminNewTicketSubject.trim(),
        message: adminNewTicketMessage.trim(),
        adminUserId: user?.id ?? null,
      })
      setAdminNewTicketUserId('')
      setAdminNewTicketSubject('')
      setAdminNewTicketMessage('')
      await loadSupportTickets()
    } catch (err) {
      console.error('[Admin] Failed to create support ticket:', err)
    }
  }

  const handleAddInternalNote = async () => {
    if (!selectedTicket || !internalNoteInput.trim()) return
    try {
      await addUserInternalNote({
        userId: selectedTicket.user_id,
        note: internalNoteInput.trim(),
        adminUserId: user?.id ?? null,
      })
      setInternalNoteInput('')
      await loadInternalNotes(selectedTicket.user_id)
    } catch (err) {
      console.error('[Admin] Failed to add internal note:', err)
    }
  }

  const handleExportReportsCsv = () => {
    if (!reportsData) return

    const csvLines: string[] = []
    csvLines.push('section,label,value')

    reportsData.generationsPerDay.forEach((row) => {
      csvLines.push(`generations_per_day,${row.label},${row.value}`)
    })

    reportsData.newUsersPerWeek.forEach((row) => {
      csvLines.push(`new_users_per_week,${row.label},${row.value}`)
    })

    reportsData.monthlyMrr.forEach((row) => {
      csvLines.push(`mrr_monthly,${row.month},${row.value}`)
    })

    csvLines.push(`kpi,current_mrr,${reportsData.currentMrr}`)
    csvLines.push(`kpi,conversion_rate_percent,${reportsData.conversionRate}`)

    reportsData.topModels.forEach((row) => {
      csvLines.push(`top_models,${row.model.replaceAll(',', ' ')},${row.count}`)
    })

    reportsData.topUsersByCredits.forEach((row) => {
      csvLines.push(`top_users_credits,${(row.name || '—').replaceAll(',', ' ')}|${(row.email || '—').replaceAll(',', ' ')},${row.creditsUsed}`)
    })

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `admin-reports-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(totalUsers / PAGE_SIZE)
  const generationTotalPages = Math.ceil(totalGenerations / GENERATIONS_PAGE_SIZE)
  const stripeEventsTotalPages = Math.ceil(stripeEventsTotal / 12)
  const subscriptionsTotalPages = Math.ceil(adminSubscriptionsTotal / 12)
  const flagsTotalPages = Math.ceil(flagsTotal / 12)
  const supportTicketsTotalPages = Math.ceil(supportTicketsTotal / 12)

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{t.admin.accessDenied}</h2>
          <p className="text-dark-400">{t.admin.accessDeniedDescription}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-7 h-7 text-red-400" />
            <h1 className="text-3xl font-bold text-white">{t.admin.title}</h1>
          </div>
          <p className="text-dark-400 text-sm">{t.admin.subtitle}</p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t.admin.refresh}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Users} label={t.admin.stats.totalUsers} value={stats?.totalUsers ?? 0} accent="bg-blue-500" />
            <StatCard icon={CreditCard} label={t.admin.stats.activeSubscriptions} value={stats?.activeSubscriptions ?? 0} accent="bg-green-500" />
            <StatCard icon={Zap} label={t.admin.stats.totalCredits} value={stats?.totalCreditsInCirculation ?? 0} accent="bg-primary-500" />
            <StatCard icon={BarChart3} label={t.admin.stats.totalGenerations} value={stats?.totalGenerations ?? 0} accent="bg-accent-500" />
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setTab('users')}
              className={`px-3 py-2 rounded-xl text-sm inline-flex items-center gap-2 border ${tab === 'users' ? 'bg-primary-500/20 border-primary-500/50 text-primary-300' : 'bg-dark-800 border-dark-700 text-dark-300'}`}
            >
              <UserCog className="w-4 h-4" /> {t.admin.tabs.users}
            </button>
            <button
              onClick={() => setTab('generations')}
              className={`px-3 py-2 rounded-xl text-sm inline-flex items-center gap-2 border ${tab === 'generations' ? 'bg-primary-500/20 border-primary-500/50 text-primary-300' : 'bg-dark-800 border-dark-700 text-dark-300'}`}
            >
              <Video className="w-4 h-4" /> {t.admin.tabs.generations}
            </button>
            <button
              onClick={() => setTab('finance')}
              className={`px-3 py-2 rounded-xl text-sm inline-flex items-center gap-2 border ${tab === 'finance' ? 'bg-primary-500/20 border-primary-500/50 text-primary-300' : 'bg-dark-800 border-dark-700 text-dark-300'}`}
            >
              <Wallet className="w-4 h-4" /> Financeiro
            </button>
            <button
              onClick={() => setTab('moderation')}
              className={`px-3 py-2 rounded-xl text-sm inline-flex items-center gap-2 border ${tab === 'moderation' ? 'bg-primary-500/20 border-primary-500/50 text-primary-300' : 'bg-dark-800 border-dark-700 text-dark-300'}`}
            >
              <Shield className="w-4 h-4" /> Moderação
            </button>
            <button
              onClick={() => setTab('system')}
              className={`px-3 py-2 rounded-xl text-sm inline-flex items-center gap-2 border ${tab === 'system' ? 'bg-primary-500/20 border-primary-500/50 text-primary-300' : 'bg-dark-800 border-dark-700 text-dark-300'}`}
            >
              <Settings className="w-4 h-4" /> Sistema
            </button>
            <button
              onClick={() => setTab('support')}
              className={`px-3 py-2 rounded-xl text-sm inline-flex items-center gap-2 border ${tab === 'support' ? 'bg-primary-500/20 border-primary-500/50 text-primary-300' : 'bg-dark-800 border-dark-700 text-dark-300'}`}
            >
              <LifeBuoy className="w-4 h-4" /> Suporte
            </button>
          </div>

          {tab === 'users' ? (
            <div className="bg-dark-800/40 border border-dark-700 rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-dark-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-400" />
                  {t.admin.users.title}
                  <span className="text-sm text-dark-400 font-normal ml-1">({totalUsers})</span>
                </h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder={t.admin.users.searchPlaceholder}
                      className="pl-9 pr-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm w-full sm:w-64 focus:border-primary-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <button onClick={handleSearch} className="btn-primary text-sm px-4 py-2">
                    {t.common.search}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs text-dark-400 uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium">{t.admin.users.user}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.users.plan}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.users.status}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.users.credits}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.users.adjustCredits}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.users.role}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.users.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <UserRow
                        key={user.user_id}
                        user={user}
                        t={t}
                        onAdjustCredits={handleAdjustCredits}
                        onPlanChange={handlePlanChange}
                        onToggleSuspended={handleToggleSuspended}
                        onToggleRole={handleToggleRole}
                        onSendPasswordReset={handleSendPasswordReset}
                        onForceLogout={handleForceLogout}
                        onOpenActivity={handleOpenActivity}
                      />
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-dark-500">
                          {t.admin.users.noResults}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-dark-700">
                  <p className="text-xs text-dark-400">
                    {t.admin.users.showing} {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalUsers)} {t.common.of} {totalUsers}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-dark-300" />
                    </button>
                    <span className="text-sm text-dark-300">
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-dark-300" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'generations' ? (
            <div className="bg-dark-800/40 border border-dark-700 rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-dark-700 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-primary-400" />
                  {t.admin.generations.title}
                  <span className="text-sm text-dark-400 font-normal ml-1">({totalGenerations})</span>
                </h2>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                  {reportsData && (
                    <button onClick={handleExportReportsCsv} className="btn-secondary text-sm px-4 py-2 inline-flex items-center gap-2">
                      <Download className="w-4 h-4" /> CSV
                    </button>
                  )}

                  <div className="relative min-w-[220px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                    <input
                      type="text"
                      value={generationSearchInput}
                      onChange={(e) => setGenerationSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleGenerationSearch()}
                      placeholder={t.admin.generations.searchPlaceholder}
                      className="pl-9 pr-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm w-full focus:border-primary-500 focus:outline-none"
                    />
                  </div>

                  <input
                    type="text"
                    value={generationModelInput}
                    onChange={(e) => setGenerationModelInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerationSearch()}
                    placeholder="Modelo"
                    className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm min-w-[170px]"
                  />

                  <input
                    type="date"
                    value={generationDateFrom}
                    onChange={(e) => {
                      setGenerationPage(0)
                      setGenerationDateFrom(e.target.value)
                    }}
                    className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm"
                  />

                  <input
                    type="date"
                    value={generationDateTo}
                    onChange={(e) => {
                      setGenerationPage(0)
                      setGenerationDateTo(e.target.value)
                    }}
                    className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm"
                  />

                  <select
                    value={generationType}
                    onChange={(e) => {
                      setGenerationPage(0)
                      setGenerationType(e.target.value as GenerationType | 'all')
                    }}
                    className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm"
                  >
                    <option value="all">{t.common.all}</option>
                    <option value="text-to-video">text-to-video</option>
                    <option value="image-to-video">image-to-video</option>
                    <option value="text-to-image">text-to-image</option>
                    <option value="image-to-image">image-to-image</option>
                  </select>

                  <select
                    value={generationStatus}
                    onChange={(e) => {
                      setGenerationPage(0)
                      setGenerationStatus(e.target.value as GenerationStatus | 'all')
                    }}
                    className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm"
                  >
                    <option value="all">{t.common.all}</option>
                    <option value="starting">starting</option>
                    <option value="processing">processing</option>
                    <option value="succeeded">succeeded</option>
                    <option value="failed">failed</option>
                    <option value="canceled">canceled</option>
                  </select>

                  <button onClick={handleGenerationSearch} className="btn-primary text-sm px-4 py-2">
                    {t.common.search}
                  </button>
                </div>
              </div>

              {reportsData && (
                <div className="px-4 sm:px-5 py-4 border-b border-dark-700">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="text-base font-semibold text-white">Analytics & Relatórios</h3>
                    <div className="flex items-center gap-2 text-xs text-dark-400">
                      <span>MRR atual:</span>
                      <span className="text-green-400 font-semibold">R$ {reportsData.currentMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      <span className="mx-1">•</span>
                      <span>Conversão free → pago:</span>
                      <span className="text-primary-300 font-semibold">{reportsData.conversionRate.toFixed(2)}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <BarChartCard
                      title="Gerações por dia (30d)"
                      data={reportsData.generationsPerDay.slice(-14)}
                      color="bg-primary-500/80"
                    />
                    <BarChartCard
                      title="Novos usuários por semana"
                      data={reportsData.newUsersPerWeek}
                      color="bg-green-500/80"
                    />
                    <BarChartCard
                      title="MRR mensal (Stripe)"
                      data={reportsData.monthlyMrr.map((row) => ({ label: row.month.slice(5), value: row.value }))}
                      color="bg-accent-500/80"
                      valueSuffix=" R$"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <div className="rounded-2xl border border-dark-700 bg-dark-900/50 p-4">
                      <h4 className="text-sm font-semibold text-white mb-3">Modelos mais usados</h4>
                      <div className="space-y-2">
                        {reportsData.topModels.slice(0, 8).map((item) => (
                          <div key={item.model} className="flex items-center justify-between text-sm">
                            <span className="text-dark-200 truncate mr-3">{item.model}</span>
                            <span className="text-primary-300 font-medium">{item.count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-dark-700 bg-dark-900/50 p-4">
                      <h4 className="text-sm font-semibold text-white mb-3">Top usuários por consumo de créditos (30d)</h4>
                      <div className="space-y-2">
                        {reportsData.topUsersByCredits.slice(0, 8).map((item) => (
                          <div key={item.userId} className="flex items-center justify-between text-sm gap-3">
                            <div className="min-w-0">
                              <p className="text-dark-200 truncate">{item.name || '—'}</p>
                              <p className="text-dark-500 text-xs truncate">{item.email || '—'}</p>
                            </div>
                            <span className="text-yellow-400 font-medium whitespace-nowrap">{item.creditsUsed.toLocaleString()} cr</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {generationAnalytics && (
                <div className="px-4 sm:px-5 pb-4 border-b border-dark-700">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-1">
                    <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-3">
                      <p className="text-xs text-dark-400">Total</p>
                      <p className="text-lg font-semibold text-white">{generationAnalytics.total.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-3">
                      <p className="text-xs text-dark-400">Sucesso / Falha</p>
                      <p className="text-lg font-semibold text-white">{generationAnalytics.succeeded.toLocaleString()} / {generationAnalytics.failed.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-3">
                      <p className="text-xs text-dark-400">Em andamento / Canceladas</p>
                      <p className="text-lg font-semibold text-white">{generationAnalytics.processing.toLocaleString()} / {generationAnalytics.canceled.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-3">
                      <p className="text-xs text-dark-400">Últimos 7 dias</p>
                      <p className="text-lg font-semibold text-white">{generationAnalytics.last7Days.toLocaleString()} ({generationAnalytics.creditsLast7Days.toLocaleString()} cr)</p>
                    </div>
                  </div>
                  {generationAnalytics.topModels.length > 0 && (
                    <div className="mt-3 rounded-xl border border-dark-700 bg-dark-900/60 p-3">
                      <p className="text-xs text-dark-400 mb-2">Top modelos (recentes)</p>
                      <div className="flex flex-wrap gap-2">
                        {generationAnalytics.topModels.map((item) => (
                          <span key={item.model} className="px-2 py-1 rounded-lg bg-dark-800 text-xs text-dark-200 border border-dark-700">
                            {item.model} · {item.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs text-dark-400 uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium">{t.admin.generations.prompt}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.generations.user}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.generations.type}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.generations.status}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.generations.credits}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.generations.createdAt}</th>
                      <th className="px-4 py-3 font-medium">{t.admin.generations.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generations.map((generation) => (
                      <GenerationRow
                        key={generation.id}
                        generation={generation}
                        t={t}
                        onChangeStatus={handleUpdateGenerationStatus}
                        onModerate={handleModerateGeneration}
                        onRetry={handleRetryFailedGeneration}
                        onPreview={setPreviewGeneration}
                        onFlag={handleAddFlagFromGeneration}
                      />
                    ))}
                    {generations.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-dark-500">
                          {t.admin.generations.noResults}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {generationTotalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-dark-700">
                  <p className="text-xs text-dark-400">
                    {t.admin.users.showing} {generationPage * GENERATIONS_PAGE_SIZE + 1}–{Math.min((generationPage + 1) * GENERATIONS_PAGE_SIZE, totalGenerations)} {t.common.of} {totalGenerations}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGenerationPage((p) => Math.max(0, p - 1))}
                      disabled={generationPage === 0}
                      className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-dark-300" />
                    </button>
                    <span className="text-sm text-dark-300">
                      {generationPage + 1} / {generationTotalPages}
                    </span>
                    <button
                      onClick={() => setGenerationPage((p) => Math.min(generationTotalPages - 1, p + 1))}
                      disabled={generationPage >= generationTotalPages - 1}
                      className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-dark-300" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'finance' ? (
            <div className="space-y-4">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-dark-700 flex items-center justify-between gap-2">
                    <h3 className="text-white font-semibold inline-flex items-center gap-2"><Wallet className="w-4 h-4 text-primary-400" /> Transações / Pagamentos Stripe</h3>
                    <div className="flex items-center gap-2">
                      <input
                        value={stripeEventsSearchInput}
                        onChange={(e) => setStripeEventsSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStripeSearch()}
                        placeholder="Evento ou ID"
                        className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm"
                      />
                      <button onClick={handleStripeSearch} className="btn-secondary text-sm px-3 py-2">Buscar</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs text-dark-400 uppercase tracking-wider">
                          <th className="px-4 py-3">Evento</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Erro</th>
                          <th className="px-4 py-3">Recebido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stripeEvents.map((event) => (
                          <tr key={event.event_id} className="border-t border-dark-800">
                            <td className="px-4 py-3 text-xs text-white">{event.event_type}<p className="text-dark-500 mt-1">{event.event_id}</p></td>
                            <td className="px-4 py-3 text-xs text-dark-200">{event.status}</td>
                            <td className="px-4 py-3 text-xs text-red-400 max-w-[220px] truncate">{event.last_error || '—'}</td>
                            <td className="px-4 py-3 text-xs text-dark-400">{new Date(event.received_at).toLocaleString()}</td>
                          </tr>
                        ))}
                        {stripeEvents.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-dark-500">Sem eventos Stripe</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {stripeEventsTotalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-dark-700">
                      <span className="text-xs text-dark-400">{stripeEventsTotal} eventos</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setStripeEventsPage((p) => Math.max(0, p - 1))} disabled={stripeEventsPage === 0} className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-dark-300" /></button>
                        <span className="text-sm text-dark-300">{stripeEventsPage + 1} / {stripeEventsTotalPages}</span>
                        <button onClick={() => setStripeEventsPage((p) => Math.min(stripeEventsTotalPages - 1, p + 1))} disabled={stripeEventsPage >= stripeEventsTotalPages - 1} className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30"><ChevronRight className="w-4 h-4 text-dark-300" /></button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-dark-700 flex items-center justify-between gap-2">
                    <h3 className="text-white font-semibold">Assinaturas</h3>
                    <select
                      value={adminSubscriptionStatus}
                      onChange={(e) => {
                        setAdminSubscriptionsPage(0)
                        setAdminSubscriptionStatus(e.target.value as 'all' | 'active' | 'canceled' | 'past_due')
                      }}
                      className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm"
                    >
                      <option value="all">Todas</option>
                      <option value="active">Ativas</option>
                      <option value="canceled">Canceladas</option>
                      <option value="past_due">Inadimplentes</option>
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs text-dark-400 uppercase tracking-wider">
                          <th className="px-4 py-3">Usuário</th>
                          <th className="px-4 py-3">Plano</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Período</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminSubscriptions.map((subscription) => (
                          <tr key={subscription.id} className="border-t border-dark-800">
                            <td className="px-4 py-3 text-xs text-white">{subscription.profile?.display_name || '—'}<p className="text-dark-500 mt-1">{subscription.profile?.email || subscription.user_id}</p></td>
                            <td className="px-4 py-3 text-xs text-dark-200">{subscription.plan || 'free'}</td>
                            <td className="px-4 py-3 text-xs text-dark-200">{subscription.status || '—'}</td>
                            <td className="px-4 py-3 text-xs text-dark-400">{subscription.current_period_start ? new Date(subscription.current_period_start).toLocaleDateString() : '—'} → {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                        {adminSubscriptions.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-dark-500">Sem assinaturas</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {subscriptionsTotalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-dark-700">
                      <span className="text-xs text-dark-400">{adminSubscriptionsTotal} assinaturas</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setAdminSubscriptionsPage((p) => Math.max(0, p - 1))} disabled={adminSubscriptionsPage === 0} className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-dark-300" /></button>
                        <span className="text-sm text-dark-300">{adminSubscriptionsPage + 1} / {subscriptionsTotalPages}</span>
                        <button onClick={() => setAdminSubscriptionsPage((p) => Math.min(subscriptionsTotalPages - 1, p + 1))} disabled={adminSubscriptionsPage >= subscriptionsTotalPages - 1} className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30"><ChevronRight className="w-4 h-4 text-dark-300" /></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3">Gerenciar reembolsos (Stripe)</h3>
                  <div className="space-y-2">
                    <input value={refundPaymentIntent} onChange={(e) => setRefundPaymentIntent(e.target.value)} placeholder="payment_intent (opcional)" className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <input value={refundChargeId} onChange={(e) => setRefundChargeId(e.target.value)} placeholder="charge_id (opcional)" className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="valor em centavos (opcional)" className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <button onClick={handleCreateRefund} disabled={refundRunning || (!refundPaymentIntent && !refundChargeId)} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">{refundRunning ? 'Processando...' : 'Criar reembolso'}</button>
                  </div>
                </div>

                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3 inline-flex items-center gap-2"><BadgePercent className="w-4 h-4 text-primary-400" /> Criar cupom de desconto</h3>
                  <div className="space-y-2">
                    <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Código (ex.: LUMI20)" className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      <input value={couponPercent} onChange={(e) => setCouponPercent(e.target.value)} placeholder="%" className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                      <select value={couponDuration} onChange={(e) => setCouponDuration(e.target.value as 'once' | 'repeating' | 'forever')} className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm">
                        <option value="once">once</option>
                        <option value="repeating">repeating</option>
                        <option value="forever">forever</option>
                      </select>
                      <input value={couponDurationMonths} onChange={(e) => setCouponDurationMonths(e.target.value)} placeholder="meses" disabled={couponDuration !== 'repeating'} className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm disabled:opacity-40" />
                    </div>
                    <button onClick={handleCreateCoupon} disabled={couponRunning || !couponCode.trim()} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">{couponRunning ? 'Criando...' : 'Criar cupom'}</button>
                    {lastCouponCreated && <p className="text-xs text-green-400">Último cupom criado: {lastCouponCreated}</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3">Conceder créditos em massa</h3>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input value={bulkCreditsAmount} onChange={(e) => setBulkCreditsAmount(e.target.value)} placeholder="Créditos" className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <select value={bulkCreditsPlan} onChange={(e) => setBulkCreditsPlan(e.target.value as AdminTargetPlan)} className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm">
                      <option value="all">Todos planos</option>
                      <option value="free">Free</option>
                      <option value="creator">Creator</option>
                      <option value="studio">Studio</option>
                      <option value="director">Director</option>
                    </select>
                    <select value={bulkCreditsSubStatus} onChange={(e) => setBulkCreditsSubStatus(e.target.value as 'all' | 'active' | 'canceled' | 'past_due')} className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm">
                      <option value="all">Todos status</option>
                      <option value="active">Ativas</option>
                      <option value="canceled">Canceladas</option>
                      <option value="past_due">Inadimplentes</option>
                    </select>
                  </div>
                  <button onClick={handleBulkCredits} disabled={bulkCreditsRunning} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">{bulkCreditsRunning ? 'Aplicando...' : 'Aplicar promoção'}</button>
                </div>

                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3 inline-flex items-center gap-2"><Bell className="w-4 h-4 text-primary-400" /> Sistema de notificações</h3>
                  <div className="space-y-2">
                    <input value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} placeholder="Título" className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <textarea value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} placeholder="Mensagem" rows={3} className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={notifyType} onChange={(e) => setNotifyType(e.target.value as 'system' | 'subscription' | 'credits_low')} className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm">
                        <option value="system">system</option>
                        <option value="subscription">subscription</option>
                        <option value="credits_low">credits_low</option>
                      </select>
                      <select value={notifyPlan} onChange={(e) => setNotifyPlan(e.target.value as AdminTargetPlan)} className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm">
                        <option value="all">Todos planos</option>
                        <option value="free">Free</option>
                        <option value="creator">Creator</option>
                        <option value="studio">Studio</option>
                        <option value="director">Director</option>
                      </select>
                    </div>
                    <button onClick={handleSendBulkNotification} disabled={notifyRunning || !notifyTitle.trim() || !notifyMessage.trim()} className="btn-primary text-sm px-4 py-2 disabled:opacity-40">{notifyRunning ? 'Enviando...' : 'Enviar notificação'}</button>
                  </div>
                </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="bg-dark-800/40 border border-dark-700 rounded-2xl p-4">
                      <h3 className="text-white font-semibold mb-3">Notificações de manutenção programada</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input type="datetime-local" value={maintenanceStartAt} onChange={(e) => setMaintenanceStartAt(e.target.value)} className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                        <input type="datetime-local" value={maintenanceEndAt} onChange={(e) => setMaintenanceEndAt(e.target.value)} className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                      </div>
                      <textarea value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} rows={2} placeholder="Mensagem opcional" className="w-full mt-2 px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                      <button onClick={handleSendMaintenanceNotification} disabled={!maintenanceStartAt} className="mt-2 btn-primary text-sm px-4 py-2 disabled:opacity-40">Enviar manutenção</button>
                    </div>

                    <div className="bg-dark-800/40 border border-dark-700 rounded-2xl p-4">
                      <h3 className="text-white font-semibold mb-3">Alertas de uso excessivo</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={highUsageThreshold} onChange={(e) => setHighUsageThreshold(e.target.value)} placeholder="Threshold de créditos" className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                        <input value={highUsageDays} onChange={(e) => setHighUsageDays(e.target.value)} placeholder="Janela em dias" className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                      </div>
                      <button onClick={handleSendHighUsageAlerts} className="mt-2 btn-primary text-sm px-4 py-2">Disparar alertas</button>
                    </div>
                  </div>
              </div>

              <div className="bg-dark-800/40 border border-dark-700 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-dark-700">
                  <h3 className="text-white font-semibold">Notificações recentes</h3>
                </div>
                <div className="divide-y divide-dark-800">
                  {recentNotifications.slice(0, 15).map((notification) => (
                    <div key={notification.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{notification.title}</p>
                        <p className="text-xs text-dark-400 truncate">{notification.profile?.display_name || '—'} · {notification.profile?.email || notification.user_id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-dark-300">{notification.type}</p>
                        <p className="text-xs text-dark-500">{new Date(notification.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  {recentNotifications.length === 0 && <p className="px-4 py-8 text-center text-dark-500">Sem notificações recentes</p>}
                </div>
              </div>
            </div>
          ) : tab === 'system' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3">Configuração do sistema</h3>
                  <div className="flex items-center justify-between rounded-xl border border-dark-700 bg-dark-900/60 p-3 mb-3">
                    <div>
                      <p className="text-sm text-white">Modo de manutenção</p>
                      <p className="text-xs text-dark-500">Liga/desliga acesso normal de geração</p>
                    </div>
                    <button onClick={handleToggleMaintenance} className={`px-3 py-1.5 rounded-lg border text-xs ${maintenanceMode ? 'border-red-500/40 text-red-400' : 'border-green-500/40 text-green-400'}`}>
                      {maintenanceMode ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <h4 className="text-sm text-white mb-2">Feature Flags</h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {featureFlags.map((flag) => (
                      <div key={flag.id} className="flex items-center justify-between rounded-lg border border-dark-700 bg-dark-900/60 p-2">
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{flag.key}</p>
                          <p className="text-xs text-dark-500 truncate">{flag.description || '—'}</p>
                        </div>
                        <button onClick={() => handleToggleFeatureFlag(flag.key, !flag.enabled, flag.description)} className={`px-2 py-1 rounded-lg border text-xs ${flag.enabled ? 'border-green-500/40 text-green-400' : 'border-dark-700 text-dark-300'}`}>
                          {flag.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    ))}
                    {featureFlags.length === 0 && <p className="text-xs text-dark-500">Nenhuma feature flag cadastrada.</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                    <input value={newFeatureFlagKey} onChange={(e) => setNewFeatureFlagKey(e.target.value)} placeholder="flag_key" className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <input value={newFeatureFlagDescription} onChange={(e) => setNewFeatureFlagDescription(e.target.value)} placeholder="Descrição" className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm sm:col-span-2" />
                  </div>
                  <button onClick={handleCreateFeatureFlag} className="mt-2 btn-primary text-sm px-4 py-2" disabled={!newFeatureFlagKey.trim()}>Criar feature flag</button>
                </div>

                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3">Status de serviços externos</h3>
                  <div className="space-y-2">
                    {serviceHealth.map((item) => (
                      <div key={item.service} className="rounded-lg border border-dark-700 bg-dark-900/60 p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-white">{item.service}</p>
                          <p className="text-xs text-dark-500">{item.details}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-lg border ${item.status === 'healthy' ? 'border-green-500/40 text-green-400' : item.status === 'degraded' ? 'border-yellow-500/40 text-yellow-400' : 'border-red-500/40 text-red-400'}`}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                    {serviceHealth.length === 0 && <p className="text-xs text-dark-500">Sem dados de saúde dos serviços.</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3">Ativar/desativar modelos + custo por modelo</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {aiModelSettings.map((model) => (
                      <div key={model.id} className="rounded-lg border border-dark-700 bg-dark-900/60 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-white truncate">{model.model_id}</p>
                          <button onClick={() => handleToggleModelEnabled(model.model_id, !model.is_enabled, model.credit_cost_override)} className={`px-2 py-1 rounded-lg border text-xs ${model.is_enabled ? 'border-green-500/40 text-green-400' : 'border-red-500/40 text-red-400'}`}>
                            {model.is_enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            defaultValue={model.credit_cost_override ?? ''}
                            placeholder="Override de custo"
                            className="px-3 py-1.5 rounded-lg bg-dark-900 border border-dark-700 text-white text-xs"
                            onBlur={(e) => handleSetModelCostOverride(model.model_id, e.target.value, model.is_enabled)}
                          />
                          <span className="text-xs text-dark-500">deixe vazio para usar padrão</span>
                        </div>
                      </div>
                    ))}
                    {aiModelSettings.length === 0 && <p className="text-xs text-dark-500">Sem configurações de modelos. Elas serão criadas ao editar.</p>}
                  </div>
                </div>

                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl p-4">
                  <h3 className="text-white font-semibold mb-3">Limites de gerações simultâneas por plano</h3>
                  <div className="space-y-2">
                    {planLimits.map((limit) => (
                      <div key={limit.id} className="rounded-lg border border-dark-700 bg-dark-900/60 p-3 flex items-center justify-between gap-2">
                        <p className="text-sm text-white">{limit.plan}</p>
                        <input
                          defaultValue={limit.max_concurrent_generations}
                          className="w-24 px-3 py-1.5 rounded-lg bg-dark-900 border border-dark-700 text-white text-xs"
                          onBlur={(e) => handleSetPlanLimit(limit.plan, e.target.value)}
                        />
                      </div>
                    ))}
                    {planLimits.length === 0 && (
                      <p className="text-xs text-dark-500">Sem limites no banco. Cadastre creator/studio/director/free.</p>
                    )}
                  </div>

                  <h4 className="text-sm text-white mt-4 mb-2">Logs & Monitoramento</h4>
                  <div className="rounded-xl border border-dark-700 bg-dark-900/60 overflow-hidden">
                    <div className="max-h-48 overflow-y-auto divide-y divide-dark-800">
                      {rateLimitRows.map((row, idx) => (
                        <div key={`${row.identifier}-${row.window_start}-${idx}`} className="p-2 text-xs text-dark-200">
                          <p>{row.action} · {row.request_count} req</p>
                          <p className="text-dark-500">{row.identifier} · {new Date(row.updated_at).toLocaleString()}</p>
                        </div>
                      ))}
                      {rateLimitRows.length === 0 && <p className="p-3 text-xs text-dark-500">Sem logs de rate limit</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : tab === 'support' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl p-4 xl:col-span-1">
                  <h3 className="text-white font-semibold mb-3">Criar ticket (admin)</h3>
                  <div className="space-y-2">
                    <input value={adminNewTicketUserId} onChange={(e) => setAdminNewTicketUserId(e.target.value)} placeholder="user_id" className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <input value={adminNewTicketSubject} onChange={(e) => setAdminNewTicketSubject(e.target.value)} placeholder="Assunto" className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <textarea value={adminNewTicketMessage} onChange={(e) => setAdminNewTicketMessage(e.target.value)} rows={3} placeholder="Mensagem inicial" className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <button onClick={handleCreateTicket} className="btn-primary text-sm px-4 py-2" disabled={!adminNewTicketUserId.trim() || !adminNewTicketSubject.trim() || !adminNewTicketMessage.trim()}>Criar ticket</button>
                  </div>
                </div>

                <div className="bg-dark-800/40 border border-dark-700 rounded-2xl overflow-hidden xl:col-span-2">
                  <div className="p-4 border-b border-dark-700 flex items-center justify-between gap-2">
                    <h3 className="text-white font-semibold">Tickets / Suporte integrado</h3>
                    <select
                      value={supportTicketsStatus}
                      onChange={(e) => {
                        setSupportTicketsPage(0)
                        setSupportTicketsStatus(e.target.value as 'all' | 'open' | 'in_progress' | 'resolved' | 'closed')
                      }}
                      className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm"
                    >
                      <option value="all">Todos</option>
                      <option value="open">Abertos</option>
                      <option value="in_progress">Em andamento</option>
                      <option value="resolved">Resolvidos</option>
                      <option value="closed">Fechados</option>
                    </select>
                  </div>
                  <div className="divide-y divide-dark-800 max-h-80 overflow-y-auto">
                    {supportTickets.map((ticket) => (
                      <button key={ticket.id} onClick={() => handleOpenTicket(ticket)} className="w-full text-left p-3 hover:bg-dark-800/40 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-white truncate">{ticket.subject}</p>
                          <span className="text-xs text-dark-300">{ticket.status}</span>
                        </div>
                        <p className="text-xs text-dark-500 truncate">{ticket.profile?.display_name || '—'} · {ticket.profile?.email || ticket.user_id}</p>
                      </button>
                    ))}
                    {supportTickets.length === 0 && <p className="p-4 text-center text-dark-500 text-sm">Sem tickets</p>}
                  </div>
                  {supportTicketsTotalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t border-dark-700">
                      <span className="text-xs text-dark-400">{supportTicketsTotal} tickets</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSupportTicketsPage((p) => Math.max(0, p - 1))} disabled={supportTicketsPage === 0} className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-dark-300" /></button>
                        <span className="text-sm text-dark-300">{supportTicketsPage + 1} / {supportTicketsTotalPages}</span>
                        <button onClick={() => setSupportTicketsPage((p) => Math.min(supportTicketsTotalPages - 1, p + 1))} disabled={supportTicketsPage >= supportTicketsTotalPages - 1} className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30"><ChevronRight className="w-4 h-4 text-dark-300" /></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedTicket && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="bg-dark-800/40 border border-dark-700 rounded-2xl overflow-hidden xl:col-span-2">
                    <div className="p-4 border-b border-dark-700 flex items-center justify-between gap-2">
                      <h3 className="text-white font-semibold inline-flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Chat com usuário</h3>
                      <div className="flex items-center gap-2">
                        <select value={selectedTicket.status} onChange={(e) => handleUpdateTicketStatus(selectedTicket.id, e.target.value as 'open' | 'in_progress' | 'resolved' | 'closed')} className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm">
                          <option value="open">open</option>
                          <option value="in_progress">in_progress</option>
                          <option value="resolved">resolved</option>
                          <option value="closed">closed</option>
                        </select>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-dark-800">
                      {ticketMessages.map((msg) => (
                        <div key={msg.id} className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-dark-400">{msg.sender_role}</span>
                            <span className="text-xs text-dark-500">{new Date(msg.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-white mt-1 whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      ))}
                      {ticketMessages.length === 0 && <p className="p-4 text-dark-500 text-sm">Sem mensagens</p>}
                    </div>
                    <div className="p-3 border-t border-dark-700 flex items-center gap-2">
                      <input value={ticketReply} onChange={(e) => setTicketReply(e.target.value)} placeholder="Responder ticket..." className="flex-1 px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                      <button onClick={handleReplyTicket} className="btn-primary text-sm px-4 py-2" disabled={!ticketReply.trim()}>Enviar</button>
                    </div>
                  </div>

                  <div className="bg-dark-800/40 border border-dark-700 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-dark-700">
                      <h3 className="text-white font-semibold">Notas internas por usuário</h3>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-dark-800">
                      {internalNotes.map((note) => (
                        <div key={note.id} className="p-3">
                          <p className="text-sm text-white whitespace-pre-wrap">{note.note}</p>
                          <p className="text-xs text-dark-500 mt-1">{new Date(note.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                      {internalNotes.length === 0 && <p className="p-3 text-dark-500 text-sm">Sem notas internas</p>}
                    </div>
                    <div className="p-3 border-t border-dark-700 space-y-2">
                      <textarea value={internalNoteInput} onChange={(e) => setInternalNoteInput(e.target.value)} rows={3} placeholder="Adicionar nota interna" className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                      <button onClick={handleAddInternalNote} className="btn-secondary text-sm px-4 py-2" disabled={!internalNoteInput.trim()}>Salvar nota</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-dark-800/40 border border-dark-700 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-dark-700 flex items-center justify-between gap-2">
                  <h3 className="text-white font-semibold">Fila de revisão de conteúdo gerado</h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={flagsStatus}
                      onChange={(e) => {
                        setFlagsPage(0)
                        setFlagsStatus(e.target.value as 'all' | 'open' | 'reviewing' | 'dismissed' | 'removed')
                      }}
                      className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm"
                    >
                      <option value="all">Todas</option>
                      <option value="open">Abertas</option>
                      <option value="reviewing">Em revisão</option>
                      <option value="dismissed">Descartadas</option>
                      <option value="removed">Removidas</option>
                    </select>
                    <input
                      value={newFlagReason}
                      onChange={(e) => setNewFlagReason(e.target.value)}
                      placeholder="Motivo padrão do flag"
                      className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs text-dark-400 uppercase tracking-wider">
                        <th className="px-4 py-3">Conteúdo</th>
                        <th className="px-4 py-3">Motivo</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flags.map((flag) => (
                        <tr key={flag.id} className="border-t border-dark-800 align-top">
                          <td className="px-4 py-3 text-xs text-dark-200">
                            <p className="text-white line-clamp-2">{flag.generation?.prompt || '—'}</p>
                            <p className="text-dark-500 mt-1">{flag.generation?.model_name || '—'}</p>
                            <p className="text-dark-500 mt-1">{new Date(flag.created_at).toLocaleString()}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-dark-300">
                            <p>{flag.reason}</p>
                            {flag.details && <p className="text-dark-500 mt-1">{flag.details}</p>}
                            <p className="text-dark-500 mt-1">{flag.reporter?.email || flag.reporter_user_id || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-dark-200">{flag.status}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              <button onClick={() => handleFlagStatus(flag.id, 'reviewing')} className="px-2 py-1 rounded-lg border border-blue-500/40 text-blue-400 text-xs">Revisando</button>
                              <button onClick={() => handleFlagStatus(flag.id, 'dismissed')} className="px-2 py-1 rounded-lg border border-dark-700 text-dark-200 text-xs">Descartar</button>
                              <button
                                onClick={async () => {
                                  if (flag.generation_id) {
                                    await handleModerateGeneration(flag.generation_id)
                                  }
                                  await handleFlagStatus(flag.id, 'removed')
                                }}
                                className="px-2 py-1 rounded-lg border border-red-500/40 text-red-400 text-xs"
                              >
                                Remover conteúdo
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {flags.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-10 text-center text-dark-500">Sem itens na fila de revisão</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {flagsTotalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-dark-700">
                    <span className="text-xs text-dark-400">{flagsTotal} flags</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setFlagsPage((p) => Math.max(0, p - 1))} disabled={flagsPage === 0} className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-dark-300" /></button>
                      <span className="text-sm text-dark-300">{flagsPage + 1} / {flagsTotalPages}</span>
                      <button onClick={() => setFlagsPage((p) => Math.min(flagsTotalPages - 1, p + 1))} disabled={flagsPage >= flagsTotalPages - 1} className="p-2 rounded-lg hover:bg-dark-700 disabled:opacity-30"><ChevronRight className="w-4 h-4 text-dark-300" /></button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-dark-800/40 border border-dark-700 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-dark-700">
                  <h3 className="text-white font-semibold">Blacklist de prompts proibidos</h3>
                </div>
                <div className="p-4 border-b border-dark-700">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input value={blacklistPattern} onChange={(e) => setBlacklistPattern(e.target.value)} placeholder="Palavra/expressão" className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm md:col-span-2" />
                    <input value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)} placeholder="Motivo" className="px-3 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-sm" />
                    <label className="inline-flex items-center gap-2 text-sm text-dark-300 px-3 py-2 rounded-xl bg-dark-900 border border-dark-700">
                      <input type="checkbox" checked={blacklistRegex} onChange={(e) => setBlacklistRegex(e.target.checked)} /> regex
                    </label>
                  </div>
                  <button onClick={handleAddBlacklistEntry} className="mt-2 btn-primary text-sm px-4 py-2 disabled:opacity-40" disabled={!blacklistPattern.trim()}>Adicionar à blacklist</button>
                </div>

                <div className="divide-y divide-dark-800">
                  {promptBlacklist.map((entry) => (
                    <div key={entry.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{entry.pattern}</p>
                        <p className="text-xs text-dark-500 truncate">{entry.reason || '—'} {entry.is_regex ? '· regex' : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleToggleBlacklist(entry.id, !entry.is_active)} className={`px-2 py-1 rounded-lg border text-xs ${entry.is_active ? 'border-green-500/40 text-green-400' : 'border-dark-700 text-dark-300'}`}>
                          {entry.is_active ? 'Ativo' : 'Inativo'}
                        </button>
                        <button onClick={() => handleDeleteBlacklistEntry(entry.id)} className="px-2 py-1 rounded-lg border border-red-500/40 text-red-400 text-xs">Excluir</button>
                      </div>
                    </div>
                  ))}
                  {promptBlacklist.length === 0 && <p className="px-4 py-8 text-center text-dark-500">Sem regras na blacklist</p>}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {previewGeneration && previewGeneration.output_url && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-dark-900 border border-dark-700 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm sm:text-base text-white font-semibold inline-flex items-center gap-2">
                {previewGeneration.type.includes('video') ? <Play className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                Preview
              </h3>
              <button onClick={() => setPreviewGeneration(null)} className="btn-secondary text-sm px-3 py-2">
                {t.common.close}
              </button>
            </div>
            {previewGeneration.type.includes('video') ? (
              <video src={previewGeneration.output_url} controls className="w-full max-h-[70vh] rounded-xl bg-black" />
            ) : (
              <img src={previewGeneration.output_url} alt="Preview" className="w-full max-h-[70vh] object-contain rounded-xl bg-black/40" />
            )}
          </div>
        </div>
      )}

      {selectedUser && (
        <UserActivityModal
          user={selectedUser}
          activity={userActivity}
          onClose={() => {
            setSelectedUser(null)
            setUserActivity(null)
          }}
          t={t}
        />
      )}
    </div>
  )
}

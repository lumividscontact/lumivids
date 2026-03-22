import { AlertTriangle, ChevronRight, Loader2 } from 'lucide-react'

interface BillingCardProps {
  title: string
  subtitle: string
  paymentMethodButtonLabel: string
  invoiceHistoryButtonLabel: string
  manageSubscriptionLoadingLabel: string
  cancelSubscriptionLabel: string
  reactivateSubscriptionLabel: string
  loadingCancel: boolean
  subscriptionCancelAtPeriodEnd: boolean
  showManageSubscriptionAction: boolean
  onOpenPortal: () => void
  onOpenInvoiceHistory: () => void
}

export function BillingCard({
  title,
  subtitle,
  paymentMethodButtonLabel,
  invoiceHistoryButtonLabel,
  manageSubscriptionLoadingLabel,
  cancelSubscriptionLabel,
  reactivateSubscriptionLabel,
  loadingCancel,
  subscriptionCancelAtPeriodEnd,
  showManageSubscriptionAction,
  onOpenPortal,
  onOpenInvoiceHistory,
}: BillingCardProps) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
      <p className="text-sm text-dark-400 mb-4">{subtitle}</p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onOpenPortal}
          disabled={loadingCancel}
          className="btn-secondary flex items-center justify-center gap-2"
        >
          {loadingCancel && <Loader2 className="w-4 h-4 animate-spin" />}
          {loadingCancel ? manageSubscriptionLoadingLabel : paymentMethodButtonLabel}
        </button>
        <button onClick={onOpenInvoiceHistory} className="btn-primary flex items-center justify-center gap-2">
          {invoiceHistoryButtonLabel}
        </button>
      </div>

      {showManageSubscriptionAction && (
        <button
          onClick={onOpenPortal}
          disabled={loadingCancel}
          className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors border border-transparent mt-3 ${
            subscriptionCancelAtPeriodEnd
              ? 'hover:bg-green-500/10 hover:border-green-500/30'
              : 'hover:bg-red-500/10 hover:border-red-500/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${subscriptionCancelAtPeriodEnd ? 'text-green-400' : 'text-red-400'}`} />
            <span className={subscriptionCancelAtPeriodEnd ? 'text-green-300' : 'text-red-300'}>
              {loadingCancel
                ? manageSubscriptionLoadingLabel
                : subscriptionCancelAtPeriodEnd
                  ? reactivateSubscriptionLabel
                  : cancelSubscriptionLabel
              }
            </span>
          </div>
          {loadingCancel ? (
            <Loader2 className={`w-5 h-5 animate-spin ${subscriptionCancelAtPeriodEnd ? 'text-green-400' : 'text-red-400'}`} />
          ) : (
            <ChevronRight className={`w-5 h-5 ${subscriptionCancelAtPeriodEnd ? 'text-green-400' : 'text-red-400'}`} />
          )}
        </button>
      )}
    </div>
  )
}
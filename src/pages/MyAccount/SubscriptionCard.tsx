interface SubscriptionCardProps {
  title: string
  currentPlanLabel: string
  currentPlanName: string
  statusLabel: string
  statusValue: string
  renewalDateLabel: string
  renewalDateValue: string
  nextBillingLabel: string
  nextBillingValue: string
  processingLabel: string
  changePlanLabel: string
  subscriptionLoading: boolean
  subscriptionCancelAtPeriodEnd: boolean
  cancelAtPeriodEndLabel: string
  onChangePlan: () => void
}

export function SubscriptionCard({
  title,
  currentPlanLabel,
  currentPlanName,
  statusLabel,
  statusValue,
  renewalDateLabel,
  renewalDateValue,
  nextBillingLabel,
  nextBillingValue,
  processingLabel,
  changePlanLabel,
  subscriptionLoading,
  subscriptionCancelAtPeriodEnd,
  cancelAtPeriodEndLabel,
  onChangePlan,
}: SubscriptionCardProps) {
  return (
    <div id="plans-section" className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-4">
          <p className="text-xs uppercase text-dark-400 tracking-wide">{currentPlanLabel}</p>
          <p className="text-lg font-semibold text-white capitalize">{currentPlanName}</p>
        </div>
        <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-4">
          <p className="text-xs uppercase text-dark-400 tracking-wide">{statusLabel}</p>
          <p className="text-lg font-semibold text-white">{subscriptionLoading ? processingLabel : statusValue}</p>
          {subscriptionCancelAtPeriodEnd && (
            <p className="text-xs text-yellow-400 mt-1">{cancelAtPeriodEndLabel}</p>
          )}
        </div>
        <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-4">
          <p className="text-xs uppercase text-dark-400 tracking-wide">{renewalDateLabel}</p>
          <p className="text-lg font-semibold text-white">{subscriptionLoading ? processingLabel : renewalDateValue}</p>
        </div>
        <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-4">
          <p className="text-xs uppercase text-dark-400 tracking-wide">{nextBillingLabel}</p>
          <p className="text-lg font-semibold text-white">{subscriptionLoading ? processingLabel : nextBillingValue}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        <button onClick={onChangePlan} className="btn-primary flex items-center justify-center gap-2">
          {changePlanLabel}
        </button>
      </div>
    </div>
  )
}
import { AlertTriangle, Clock, XCircle, CreditCard } from 'lucide-react'
import { useCredits } from '@/contexts/CreditsContext'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { SUBSCRIPTION_WARNING_DAYS } from '@/config/constants'
import { useLanguage } from '@/i18n'

interface SubscriptionAlertProps {
  className?: string
}

export function SubscriptionAlert({ className = '' }: SubscriptionAlertProps) {
  const { t } = useLanguage()
  const { subscription, plan } = useCredits()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  // No subscription info or no active plan
  if (!subscription || !plan || dismissed) {
    return null
  }

  const { isExpired, isPastDue, isCanceling, daysUntilExpiration } = subscription

  // Subscription expired
  if (isExpired) {
    return (
      <div className={`bg-red-500/10 border border-red-500/50 rounded-xl p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-400">{t.subscriptionAlert.expiredTitle}</h4>
            <p className="text-sm text-dark-300 mt-1">
              {t.subscriptionAlert.expiredMessage}
            </p>
            <button
              onClick={() => navigate('/pricing')}
              className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {t.subscriptionAlert.renewSubscription}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Payment failed
  if (isPastDue) {
    return (
      <div className={`bg-amber-500/10 border border-amber-500/50 rounded-xl p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-amber-400">{t.subscriptionAlert.paymentPendingTitle}</h4>
            <p className="text-sm text-dark-300 mt-1">
              {t.subscriptionAlert.paymentPendingMessage}
            </p>
            <button
              onClick={() => navigate('/my-account')}
              className="mt-3 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {t.subscriptionAlert.updatePayment}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Subscription will be canceled at period end
  if (isCanceling && daysUntilExpiration !== null) {
    return (
      <div className={`bg-blue-500/10 border border-blue-500/50 rounded-xl p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-400">{t.subscriptionAlert.cancellationScheduledTitle}</h4>
            <p className="text-sm text-dark-300 mt-1">
              {t.subscriptionAlert.cancellationScheduledMessage
                .replace('{days}', String(daysUntilExpiration))
                .replace('{suffix}', daysUntilExpiration !== 1 ? 's' : '')}
            </p>
            <button
              onClick={() => navigate('/my-account')}
              className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {t.subscriptionAlert.manageSubscription}
            </button>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-dark-400 hover:text-dark-200 transition-colors"
            title={t.subscriptionAlert.close}
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Warning when subscription is about to expire (SUBSCRIPTION_WARNING_DAYS days or less)
  if (daysUntilExpiration !== null && daysUntilExpiration <= SUBSCRIPTION_WARNING_DAYS && daysUntilExpiration > 0) {
    return (
      <div className={`bg-amber-500/10 border border-amber-500/50 rounded-xl p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-amber-400">{t.subscriptionAlert.renewalSoonTitle}</h4>
            <p className="text-sm text-dark-300 mt-1">
              {t.subscriptionAlert.renewalSoonMessage
                .replace('{days}', String(daysUntilExpiration))
                .replace('{suffix}', daysUntilExpiration !== 1 ? 's' : '')}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-dark-400 hover:text-dark-200 transition-colors"
            title={t.subscriptionAlert.close}
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return null
}

/**
 * Compact inline alert for generation pages
 */
export function SubscriptionInlineAlert({ className = '' }: SubscriptionAlertProps) {
  const { t } = useLanguage()
  const { subscription, plan } = useCredits()
  const navigate = useNavigate()

  if (!subscription || !plan) {
    return null
  }

  const { isExpired, isPastDue } = subscription

  if (isExpired) {
    return (
      <div className={`flex items-center gap-2 text-red-400 text-sm ${className}`}>
        <XCircle className="w-4 h-4" />
        <span>{t.subscriptionAlert.inlineExpired}</span>
        <button
          onClick={() => navigate('/pricing')}
          className="underline hover:text-red-300 transition-colors"
        >
          {t.subscriptionAlert.inlineRenew}
        </button>
      </div>
    )
  }

  if (isPastDue) {
    return (
      <div className={`flex items-center gap-2 text-amber-400 text-sm ${className}`}>
        <AlertTriangle className="w-4 h-4" />
        <span>{t.subscriptionAlert.inlinePending}</span>
        <button
          onClick={() => navigate('/my-account')}
          className="underline hover:text-amber-300 transition-colors"
        >
          {t.subscriptionAlert.inlineUpdate}
        </button>
      </div>
    )
  }

  return null
}

import { useEffect, useMemo, useState } from 'react'
import { Bell, Settings, Shield, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/Toast'
import { LOW_CREDITS_THRESHOLD_PERCENT } from '@/config/constants'
import { FREE_PLAN, PLANS } from '@/contexts/CreditsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription, useSEO, SEO_PAGES } from '@/hooks'
import { useLanguage } from '@/i18n'
import { redirectToPortal } from '@/services/billing'
import { BillingCard } from './MyAccount/BillingCard'
import { CreditsCard } from './MyAccount/CreditsCard'
import { EditProfileModal } from './MyAccount/EditProfileModal'
import { ProfileCard } from './MyAccount/ProfileCard'
import { QuickSettingsCard } from './MyAccount/QuickSettingsCard'
import { SubscriptionCard } from './MyAccount/SubscriptionCard'

export default function MyAccountPage() {
  const navigate = useNavigate()
  const { user, updateProfile } = useAuth()
  const { t, language } = useLanguage()
  const toast = useToast()

  useSEO(SEO_PAGES.account)

  const [loadingCancel, setLoadingCancel] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileAvatar, setProfileAvatar] = useState('')
  const [hasAvatarError, setHasAvatarError] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)

  const {
    subscriptionStatus,
    subscriptionRenewal,
    subscriptionCancelAtPeriodEnd,
    subscriptionLoading,
  } = useSubscription({
    userId: user?.id,
    userPlan: user?.plan,
  })

  const currentPlan = [...PLANS, FREE_PLAN].find((plan) => plan.id === user?.plan) || FREE_PLAN
  const isProfileLoading = !user
  const maxCredits = currentPlan.credits
  const currentCredits = user?.credits || 0
  const creditsRemainingLabel = t.myAccount.credits.remaining
    .replace('{current}', String(currentCredits))
    .replace('{max}', String(maxCredits))
  const creditsPercentage = maxCredits > 0 ? (currentCredits / maxCredits) * 100 : 0
  const isLowCredits = creditsPercentage < LOW_CREDITS_THRESHOLD_PERCENT && creditsPercentage > 0

  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US'

  const memberSinceRaw = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    : '—'
  const memberSince = memberSinceRaw !== '—'
    ? memberSinceRaw.charAt(0).toUpperCase() + memberSinceRaw.slice(1)
    : memberSinceRaw

  const subscriptionStatusLabel = subscriptionStatus
    ? {
        active: t.myAccount.subscription.statusActive,
        past_due: t.myAccount.subscription.statusPastDue,
        canceled: t.myAccount.subscription.statusCanceled,
        trialing: t.myAccount.subscription.statusTrialing,
        incomplete: t.myAccount.subscription.statusIncomplete,
      }[subscriptionStatus]
    : '—'

  const renewalDateLabel = subscriptionRenewal
    ? new Date(subscriptionRenewal).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  const nextBillingAmount = currentPlan.price > 0 ? `$${currentPlan.price.toFixed(2)}` : '—'

  const quickSettingsItems = useMemo(
    () => [
      { icon: Settings, label: t.myAccount.settings.preferences, href: '/settings/preferences' },
      { icon: Bell, label: t.myAccount.settings.notifications, href: '/settings/notifications' },
      { icon: Shield, label: t.myAccount.settings.security, href: '/settings/security' },
    ],
    [t]
  )

  useEffect(() => {
    if (isEditingProfile) {
      setProfileName(user?.name || '')
      setProfileAvatar(user?.avatar || '')
      setProfileError(null)
    }
  }, [isEditingProfile, user])

  useEffect(() => {
    setHasAvatarError(false)
  }, [user?.avatar])

  const handleOpenBillingPortal = async () => {
    setLoadingCancel(true)
    try {
      await redirectToPortal()
    } catch (error) {
      console.error('Portal error:', error)
      toast.error(t.common.error)
    } finally {
      setLoadingCancel(false)
    }
  }

  const handleCloseProfileEdit = () => {
    if (!profileSaving) {
      setIsEditingProfile(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) {
      return
    }

    const trimmedName = profileName.trim()
    if (!trimmedName) {
      setProfileError(t.myAccount.editProfile.invalidName)
      return
    }

    setProfileSaving(true)
    setProfileError(null)
    try {
      await updateProfile({
        name: trimmedName,
        avatar: profileAvatar.trim() || undefined,
      })
      toast.success(t.toast.profileUpdated)
      setIsEditingProfile(false)
    } catch (error) {
      console.error('Profile update error:', error)
      setProfileError(t.myAccount.editProfile.saveError)
      toast.error(t.myAccount.editProfile.saveError)
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <User className="w-8 h-8 text-primary-400" />
          {t.myAccount.title}
        </h1>
        <p className="text-dark-400">{t.myAccount.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ProfileCard
            title={t.myAccount.sections.profile}
            isProfileLoading={isProfileLoading}
            avatar={user?.avatar}
            userName={user?.name}
            userEmail={user?.email}
            memberSinceLabel={t.myAccount.memberSince}
            memberSince={memberSince}
            editButtonLabel={t.myAccount.editProfile.button}
            hasAvatarError={hasAvatarError}
            onAvatarError={() => setHasAvatarError(true)}
            onEdit={() => setIsEditingProfile(true)}
          />

          <SubscriptionCard
            title={t.myAccount.sections.subscription}
            currentPlanLabel={t.myAccount.subscription.currentPlan}
            currentPlanName={currentPlan.name}
            statusLabel={t.myAccount.subscription.status}
            statusValue={subscriptionStatusLabel}
            renewalDateLabel={t.myAccount.subscription.renewalDate}
            renewalDateValue={renewalDateLabel}
            nextBillingLabel={t.myAccount.subscription.nextBilling}
            nextBillingValue={nextBillingAmount}
            processingLabel={t.myAccount.processing}
            changePlanLabel={t.myAccount.subscription.changePlan}
            subscriptionLoading={subscriptionLoading}
            subscriptionCancelAtPeriodEnd={subscriptionCancelAtPeriodEnd}
            cancelAtPeriodEndLabel={t.myAccount.subscription.cancelAtPeriodEnd}
            onChangePlan={() => navigate('/pricing')}
          />

          <BillingCard
            title={t.myAccount.sections.billing}
            subtitle={t.myAccount.billing.subtitle}
            paymentMethodButtonLabel={t.myAccount.billing.paymentMethodButton}
            invoiceHistoryButtonLabel={t.myAccount.billing.invoiceHistoryButton}
            manageSubscriptionLoadingLabel={t.myAccount.manageSubscriptionLoading}
            cancelSubscriptionLabel={t.myAccount.subscription.cancelSubscription}
            reactivateSubscriptionLabel={t.myAccount.subscription.reactivateSubscription}
            loadingCancel={loadingCancel}
            subscriptionCancelAtPeriodEnd={subscriptionCancelAtPeriodEnd}
            showManageSubscriptionAction={!!user?.plan && subscriptionStatus !== 'canceled'}
            onOpenPortal={handleOpenBillingPortal}
            onOpenInvoiceHistory={handleOpenBillingPortal}
          />
        </div>

        <div className="space-y-6">
          <CreditsCard
            title={t.myAccount.credits.title}
            currentCredits={currentCredits}
            creditsRemainingLabel={creditsRemainingLabel}
            isLowCredits={isLowCredits}
            lowCreditsWarning={t.myAccount.credits.lowCreditsWarning}
            creditsPercentage={creditsPercentage}
            buyMoreLabel={t.myAccount.credits.buyMore}
            onBuyMore={() => navigate('/pricing')}
          />

          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-2">{t.myAccount.usage.title}</h2>
            <p className="text-sm text-dark-400 mb-4">{t.myAccount.usage.emptySubtitle}</p>
            <button
              onClick={() => navigate('/usage-history')}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {t.myAccount.usage.viewAll}
            </button>
          </div>

          <QuickSettingsCard
            title={t.myAccount.settings.title}
            items={quickSettingsItems}
            onNavigate={(href) => navigate(href)}
          />
        </div>
      </div>

      <EditProfileModal
        isOpen={isEditingProfile}
        title={t.myAccount.editProfile.title}
        closeAriaLabel={t.common.close}
        nameLabel={t.myAccount.editProfile.nameLabel}
        namePlaceholder={t.myAccount.editProfile.namePlaceholder}
        avatarLabel={t.myAccount.editProfile.avatarLabel}
        avatarPlaceholder={t.myAccount.editProfile.avatarPlaceholder}
        profileName={profileName}
        profileAvatar={profileAvatar}
        profileError={profileError}
        profileSaving={profileSaving}
        cancelLabel={t.common.cancel}
        saveLabel={t.common.save}
        savingLabel={t.myAccount.editProfile.saving}
        onNameChange={setProfileName}
        onAvatarChange={setProfileAvatar}
        onClose={handleCloseProfileEdit}
        onSave={handleSaveProfile}
      />
    </div>
  )
}

import { useState } from 'react'
import { Shield, KeyRound, AlertTriangle, LogOut, Trash2 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/i18n'
import { deleteAccount } from '@/services/account'

export default function SecurityPage() {
  const { t } = useLanguage()
  const { user, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleUpdatePassword = async () => {
    setError(null)
    setSuccess(null)

    if (!currentPassword || currentPassword.length < 1) {
      setError(t.settings?.security?.errorCurrentPasswordRequired ?? 'Current password is required')
      return
    }

    if (!password || password.length < 8) {
      setError(t.settings.security.errorInvalidPassword)
      return
    }

    if (password !== confirmPassword) {
      setError(t.settings.security.errorMismatch)
      return
    }

    if (!isSupabaseConfigured) {
      setError(t.settings.security.errorSupabasePassword)
      return
    }

    setSaving(true)
    try {
      // Re-authenticate with current password to verify identity
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email ?? '',
        password: currentPassword,
      })
      if (signInError) {
        setError(t.settings?.security?.errorCurrentPasswordWrong ?? 'Current password is incorrect')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        throw updateError
      }
      setCurrentPassword('')
      setPassword('')
      setConfirmPassword('')
      setSuccess(t.settings.security.successPassword)
    } catch (err) {
      console.error('Password update error:', err)
      setError(t.settings.security.errorUpdateFailed)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOutAll = async () => {
    if (!isSupabaseConfigured) {
      setError(t.settings.security.errorSupabaseSessions)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await supabase.auth.signOut({ scope: 'global' })
      await logout()
    } catch (err) {
      console.error('Global sign out error:', err)
      setError(t.settings.security.errorSignOutAll)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteError(null)

    if (!user) {
      setDeleteError(t.settings.security.deleteNoUser)
      return
    }

    if (deletePhrase.trim().toLowerCase() !== t.settings.security.deleteConfirmation.toLowerCase()) {
      setDeleteError(t.settings.security.deleteMismatch)
      return
    }

    if (!deletePassword || deletePassword.length < 1) {
      setDeleteError(t.settings?.security?.deletePasswordRequired ?? 'Password is required to confirm account deletion')
      return
    }

    if (!isSupabaseConfigured) {
      setDeleteError(t.settings.security.deleteSupabaseRequired)
      return
    }

    setDeleting(true)
    try {
      // Re-authenticate to verify identity before destructive action
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email ?? '',
        password: deletePassword,
      })
      if (signInError) {
        setDeleteError(t.settings?.security?.deletePasswordWrong ?? 'Incorrect password')
        return
      }

      await deleteAccount()
    } catch (err) {
      console.error('Delete account error:', err)
      setDeleteError(t.settings.security.deleteFailed)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary-400" />
          {t.settings.security.title}
        </h1>
        <p className="text-dark-400">
          {t.settings.security.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary-400" />
              {t.settings.security.passwordTitle}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dark-300 mb-2">{t.settings?.security?.currentPasswordLabel ?? 'Current Password'}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="input-field w-full"
                  placeholder={t.settings?.security?.currentPasswordPlaceholder ?? 'Enter your current password'}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-300 mb-2">{t.settings.security.newPasswordLabel}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input-field w-full"
                  placeholder={t.settings.security.newPasswordPlaceholder}
                />
              </div>
              <div>
                <label className="block text-sm text-dark-300 mb-2">{t.settings.security.confirmPasswordLabel}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="input-field w-full"
                />
              </div>
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
              {success && (
                <p className="text-sm text-green-400">{success}</p>
              )}
              <button
                onClick={handleUpdatePassword}
                disabled={saving || !user}
                className="btn-primary"
              >
                {saving ? t.settings.security.saving : t.settings.security.updatePassword}
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <LogOut className="w-5 h-5 text-primary-400" />
              {t.settings.security.sessionsTitle}
            </h2>
            <p className="text-sm text-dark-400 mb-4">
              {t.settings.security.sessionsSubtitle}
            </p>
            <button
              onClick={handleSignOutAll}
              disabled={saving || !user}
              className="btn-secondary"
            >
              {t.settings.security.signOutAll}
            </button>
          </div>

          <div className="card border border-red-500/40 bg-red-500/10">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              {t.settings.security.deleteTitle}
            </h2>
            <p className="text-sm text-dark-300 mb-4">
              {t.settings.security.deleteSubtitle}
            </p>
            <div className="space-y-3">
              <label className="block text-xs text-dark-400">
                {t.settings.security.deleteInstruction.replace('{phrase}', t.settings.security.deleteConfirmation)}
              </label>
              <input
                type="text"
                value={deletePhrase}
                onChange={(event) => setDeletePhrase(event.target.value)}
                className="input-field w-full"
                placeholder={t.settings.security.deletePlaceholder}
              />
              <div>
                <label className="block text-xs text-dark-400 mb-1">
                  {t.settings?.security?.deletePasswordLabel ?? 'Confirm your password'}
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  className="input-field w-full"
                  placeholder={t.settings?.security?.deletePasswordPlaceholder ?? 'Enter your password'}
                />
              </div>
              {deleteError && (
                <p className="text-sm text-red-400">{deleteError}</p>
              )}
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || !user}
                className="btn-secondary w-full border border-red-500/50 text-red-200 hover:bg-red-500/20"
              >
                {deleting ? t.settings.security.deleteProcessing : t.settings.security.deleteButton}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card bg-gradient-to-br from-primary-500/10 to-accent-500/10 border-primary-500/30">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-accent-400" />
              <h3 className="font-semibold text-white">{t.settings.security.tipTitle}</h3>
            </div>
            <p className="text-sm text-dark-300">
              {t.settings.security.tipText}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

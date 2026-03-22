import { Calendar, Mail } from 'lucide-react'

interface ProfileCardProps {
  title: string
  isProfileLoading: boolean
  avatar?: string | null
  userName?: string | null
  userEmail?: string | null
  memberSinceLabel: string
  memberSince: string
  editButtonLabel: string
  hasAvatarError: boolean
  onAvatarError: () => void
  onEdit: () => void
}

export function ProfileCard({
  title,
  isProfileLoading,
  avatar,
  userName,
  userEmail,
  memberSinceLabel,
  memberSince,
  editButtonLabel,
  hasAvatarError,
  onAvatarError,
  onEdit,
}: ProfileCardProps) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        {isProfileLoading ? (
          <>
            <div className="w-20 h-20 rounded-2xl bg-dark-800 animate-pulse" />
            <div className="w-full flex-1 space-y-2">
              <div className="h-6 w-44 rounded bg-dark-800 animate-pulse" />
              <div className="h-4 w-56 rounded bg-dark-800 animate-pulse" />
              <div className="h-4 w-40 rounded bg-dark-800 animate-pulse" />
            </div>
            <div className="h-10 w-full sm:w-28 rounded-xl bg-dark-800 animate-pulse" />
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              {avatar && !hasAvatarError ? (
                <img
                  src={avatar}
                  alt={userName || 'User'}
                  className="w-full h-full object-cover rounded-2xl"
                  onError={onAvatarError}
                />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {userName?.charAt(0) || 'U'}
                </span>
              )}
            </div>
            <div className="w-full flex-1">
              <h3 className="text-xl font-semibold text-white">{userName || '—'}</h3>
              <p className="text-dark-400 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {userEmail || '—'}
              </p>
              <p className="text-sm text-dark-400 flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" />
                {memberSinceLabel} {memberSince}
              </p>
            </div>
            <button onClick={onEdit} className="btn-secondary w-full sm:w-auto">
              {editButtonLabel}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
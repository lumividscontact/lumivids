import { useEffect } from 'react'

interface EditProfileModalProps {
  isOpen: boolean
  title: string
  closeAriaLabel: string
  nameLabel: string
  namePlaceholder: string
  avatarLabel: string
  avatarPlaceholder: string
  profileName: string
  profileAvatar: string
  profileError: string | null
  profileSaving: boolean
  cancelLabel: string
  saveLabel: string
  savingLabel: string
  onNameChange: (value: string) => void
  onAvatarChange: (value: string) => void
  onClose: () => void
  onSave: () => Promise<void>
}

export function EditProfileModal({
  isOpen,
  title,
  closeAriaLabel,
  nameLabel,
  namePlaceholder,
  avatarLabel,
  avatarPlaceholder,
  profileName,
  profileAvatar,
  profileError,
  profileSaving,
  cancelLabel,
  saveLabel,
  savingLabel,
  onNameChange,
  onAvatarChange,
  onClose,
  onSave,
}: EditProfileModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-dark-700 bg-dark-900 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-dark-400 hover:text-white" aria-label={closeAriaLabel}>
            ✕
          </button>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void onSave()
          }}
        >
          <div>
            <label className="block text-sm text-dark-300 mb-2">{nameLabel}</label>
            <input
              type="text"
              value={profileName}
              onChange={(event) => onNameChange(event.target.value)}
              className="input-field w-full"
              placeholder={namePlaceholder}
            />
          </div>
          <div>
            <label className="block text-sm text-dark-300 mb-2">{avatarLabel}</label>
            <input
              type="text"
              value={profileAvatar}
              onChange={(event) => onAvatarChange(event.target.value)}
              className="input-field w-full"
              placeholder={avatarPlaceholder}
            />
          </div>
          {profileError && <p className="text-sm text-red-400">{profileError}</p>}
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} disabled={profileSaving} className="btn-secondary w-full">
              {cancelLabel}
            </button>
            <button type="submit" disabled={profileSaving || !profileName.trim()} className="btn-primary w-full">
              {profileSaving ? savingLabel : saveLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
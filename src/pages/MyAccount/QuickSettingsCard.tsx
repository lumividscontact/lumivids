import { ChevronRight, type LucideIcon } from 'lucide-react'

interface QuickSettingItem {
  icon: LucideIcon
  label: string
  href: string
}

interface QuickSettingsCardProps {
  title: string
  items: QuickSettingItem[]
  onNavigate: (href: string) => void
}

export function QuickSettingsCard({ title, items, onNavigate }: QuickSettingsCardProps) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate(item.href)}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-dark-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-dark-400" />
              <span className="text-white">{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-dark-400" />
          </button>
        ))}
      </div>
    </div>
  )
}
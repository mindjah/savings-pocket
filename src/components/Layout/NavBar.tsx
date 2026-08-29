import type { ReactNode } from 'react'
import { BitcoinIcon } from '../common/BitcoinIcon'
import { SavingsNavIcon } from '../common/SavingsNavIcon'
import { CalendarNavIcon } from '../common/CalendarNavIcon'
import { SettingsNavIcon } from '../common/SettingsNavIcon'
import { useTranslation } from '../../hooks/useTranslation'

export type Tab = 'savings' | 'crypto' | 'spending' | 'settings'

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'savings', label: 'Savings', icon: <SavingsNavIcon size={20} /> },
  { key: 'crypto', label: 'Crypto', icon: <BitcoinIcon size={20} /> },
  { key: 'spending', label: 'Spending', icon: <CalendarNavIcon size={20} /> },
  { key: 'settings', label: 'Settings', icon: <SettingsNavIcon size={20} /> },
]

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

export function NavBar({ active, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <nav className="nav-bottom">
      <span className="nav-brand">Savings Pocket</span>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`nav-item${active === tab.key ? ' active' : ''}`}
          onClick={() => onChange(tab.key)}
          type="button"
        >
          <span className="nav-icon">{tab.icon}</span>
          <span>{t(tab.label)}</span>
        </button>
      ))}
    </nav>
  )
}

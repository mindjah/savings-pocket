import type { ReactNode } from 'react'
import { useTranslation } from '../../hooks/useTranslation'

export type Tab = 'savings' | 'crypto' | 'spending' | 'settings'

// Font Awesome 6 Free (Solid) — Boucoup's own icon system (see
// src/design-system/ README: tab bar glyphs are real FA icons, never
// emoji or hand-drawn substitutes).
const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'savings', label: 'Savings', icon: <i className="fa-solid fa-piggy-bank" aria-hidden="true" /> },
  { key: 'crypto', label: 'Crypto', icon: <i className="fa-solid fa-coins" aria-hidden="true" /> },
  { key: 'spending', label: 'Spending', icon: <i className="fa-solid fa-calendar-days" aria-hidden="true" /> },
  { key: 'settings', label: 'Settings', icon: <i className="fa-solid fa-gear" aria-hidden="true" /> },
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

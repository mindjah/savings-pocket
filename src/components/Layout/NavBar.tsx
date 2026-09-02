import type { ReactNode } from 'react'
import { useTranslation } from '../../hooks/useTranslation'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { SandboxIcon } from '../common/SandboxIcon'
import { BudgetIcon } from '../common/BudgetIcon'
import { AnalyticsIcon } from '../common/AnalyticsIcon'

export type Tab = 'savings' | 'crypto' | 'spending' | 'planning' | 'budget' | 'analytics' | 'settings'

// Font Awesome 6 Free (Solid) — Boucoup's own icon system (see
// src/design-system/ README: tab bar glyphs are real FA icons, never
// emoji or hand-drawn substitutes).
const TABS: { key: Tab; label: string; icon: ReactNode; desktopOnly?: boolean }[] = [
  { key: 'savings', label: 'Savings', icon: <i className="fa-solid fa-piggy-bank" aria-hidden="true" /> },
  { key: 'crypto', label: 'Crypto', icon: <i className="fa-solid fa-coins" aria-hidden="true" /> },
  { key: 'spending', label: 'Spending', icon: <i className="fa-solid fa-calendar-days" aria-hidden="true" /> },
  // Desktop-only: on mobile these three stay reachable through Spending's
  // own Manage menu, as bottom sheets — a 7-item bottom bar doesn't fit a
  // phone screen. A laptop's sidebar has the room, so they get their own
  // full-page tabs there instead, same as Savings/Crypto/Spending/Settings.
  { key: 'planning', label: 'Planning sandbox', icon: <SandboxIcon size={20} />, desktopOnly: true },
  { key: 'budget', label: 'Manage budget', icon: <BudgetIcon size={20} />, desktopOnly: true },
  { key: 'analytics', label: 'Analytics', icon: <AnalyticsIcon size={20} />, desktopOnly: true },
  { key: 'settings', label: 'Settings', icon: <i className="fa-solid fa-gear" aria-hidden="true" /> },
]

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

export function NavBar({ active, onChange }: Props) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()
  const visibleTabs = TABS.filter((tab) => !tab.desktopOnly || isDesktop)
  return (
    <nav className="nav-bottom">
      <span className="nav-brand">Savings Pocket</span>
      {visibleTabs.map((tab) => (
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

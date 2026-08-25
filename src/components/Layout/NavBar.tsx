export type Tab = 'savings' | 'crypto' | 'spending' | 'settings'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'savings', label: 'Savings', icon: '💰' },
  { key: 'crypto', label: 'Crypto', icon: '🪙' },
  { key: 'spending', label: 'Spending', icon: '📅' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
]

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

export function NavBar({ active, onChange }: Props) {
  return (
    <nav className="nav-bottom">
      <span className="nav-brand">Savings Pocket</span>
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`nav-item${active === t.key ? ' active' : ''}`}
          onClick={() => onChange(t.key)}
          type="button"
        >
          <span className="nav-icon">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

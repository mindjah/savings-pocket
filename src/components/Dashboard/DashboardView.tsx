import { useEffect, useState } from 'react'
import type { Tab } from '../Layout/NavBar'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { NetWorthSummaryCard } from './NetWorthSummaryCard'
import { SavingsSummaryCard } from './SavingsSummaryCard'
import { BalanceSummaryCard } from './BalanceSummaryCard'
import { CryptoSummaryCard } from './CryptoSummaryCard'
import { SpendingSummaryCard } from './SpendingSummaryCard'
import { BudgetStatusDashboardCard } from './BudgetStatusDashboardCard'
import { AnalyticsDashboardCard } from './AnalyticsDashboardCard'

interface Props {
  onNavigate: (tab: Tab) => void
}

// Desktop-only overview (see NavBar's desktopOnly flag) collecting the
// visual/summary part of every other screen in one place — no mobile form
// at all, unlike Planning/Budget/Analytics, so this has no bottom-sheet
// counterpart to share code with.
export function DashboardView({ onNavigate }: Props) {
  // Same local-override-of-a-persisted-default pattern SavingsView uses for
  // its own NetWorthCard — only Settings' own toggle writes the persisted
  // setting; the eye button here only shows/hides for the current visit.
  const [blurBalancesDefault] = useMetaSetting<boolean>('blurBalances', false)
  const [blurBalances, setBlurBalances] = useState(blurBalancesDefault)
  useEffect(() => {
    setBlurBalances(blurBalancesDefault)
  }, [blurBalancesDefault])

  return (
    <div className={`view boucoup-scope dashboard-view${blurBalances ? ' balances-blurred' : ''}`}>
      {/* Standard-size cards, evenly tiled regardless of count — each one's
          own height still grows/shrinks with its own content (see
          .dashboard-card's min/max-height in index.css). */}
      <div className="dashboard-standard-row">
        <NetWorthSummaryCard blurBalances={blurBalances} onToggleBlur={() => setBlurBalances((b) => !b)} />
        <SavingsSummaryCard onNavigate={() => onNavigate('savings')} />
        <BalanceSummaryCard onNavigate={() => onNavigate('savings')} />
        <CryptoSummaryCard onNavigate={() => onNavigate('crypto')} />
        <SpendingSummaryCard onNavigate={() => onNavigate('spending')} />
      </div>

      {/* The two data-rich cards — roughly 2 standard cards wide, capped at
          2 standard cards tall with internal scrolling beyond that. */}
      <div className="dashboard-medium-row">
        <BudgetStatusDashboardCard onNavigate={() => onNavigate('spending')} />
        <AnalyticsDashboardCard onNavigate={() => onNavigate('analytics')} />
      </div>
    </div>
  )
}

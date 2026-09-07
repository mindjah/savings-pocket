import { useEffect, useState, type ReactNode } from 'react'
import type { Tab } from '../Layout/NavBar'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useDragReorder, sanitizeOrder } from '../../hooks/useDragReorder'
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

const STANDARD_KEYS = ['networth', 'savings', 'balance', 'crypto', 'spending'] as const
type StandardKey = (typeof STANDARD_KEYS)[number]

const MEDIUM_KEYS = ['budget', 'analytics'] as const
type MediumKey = (typeof MEDIUM_KEYS)[number]

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

  const [budgetEnabled] = useMetaSetting<boolean>('budgetEnabled', false)

  const [standardOrderRaw, setStandardOrder] = useMetaSetting<StandardKey[]>('dashboardStandardOrder', [...STANDARD_KEYS])
  const standardOrder = sanitizeOrder(standardOrderRaw, STANDARD_KEYS)
  const standardDrag = useDragReorder(standardOrder, setStandardOrder)

  const [mediumOrderRaw, setMediumOrder] = useMetaSetting<MediumKey[]>('dashboardMediumOrder', [...MEDIUM_KEYS])
  const mediumOrder = sanitizeOrder(mediumOrderRaw, MEDIUM_KEYS)
  const mediumDrag = useDragReorder(mediumOrder, setMediumOrder)

  const standardCards: Record<StandardKey, ReactNode> = {
    networth: <NetWorthSummaryCard blurBalances={blurBalances} onToggleBlur={() => setBlurBalances((b) => !b)} />,
    savings: <SavingsSummaryCard onNavigate={() => onNavigate('savings')} />,
    balance: <BalanceSummaryCard onNavigate={() => onNavigate('savings')} />,
    crypto: <CryptoSummaryCard onNavigate={() => onNavigate('crypto')} />,
    spending: <SpendingSummaryCard onNavigate={() => onNavigate('spending')} />,
  }
  const mediumCards: Record<MediumKey, ReactNode> = {
    budget: <BudgetStatusDashboardCard onNavigate={() => onNavigate('spending')} />,
    analytics: <AnalyticsDashboardCard onNavigate={() => onNavigate('analytics')} />,
  }

  return (
    <div className={`view boucoup-scope dashboard-view${blurBalances ? ' balances-blurred' : ''}`}>
      {/* Standard-size cards, evenly tiled regardless of count — each one's
          own height still grows/shrinks with its own content (see
          .dashboard-card's min/max-height in index.css). Drag any card onto
          another to swap its position; order is remembered per device. */}
      <div className="dashboard-standard-row">
        {standardOrder.map((key) => (
          <div
            key={key}
            className={`dashboard-draggable${standardDrag.draggingKey === key ? ' dragging' : ''}`}
            draggable
            onDragStart={standardDrag.onDragStart(key)}
            onDragEnd={standardDrag.onDragEnd}
            onDragOver={standardDrag.onDragOver}
            onDrop={standardDrag.onDrop(key)}
          >
            {standardCards[key]}
          </div>
        ))}
      </div>

      {/* The two data-rich cards — roughly 2 standard cards wide, capped at
          2 standard cards tall with internal scrolling beyond that. */}
      <div className="dashboard-medium-row">
        {mediumOrder
          .filter((key) => key !== 'budget' || budgetEnabled)
          .map((key) => (
            <div
              key={key}
              className={`dashboard-draggable${mediumDrag.draggingKey === key ? ' dragging' : ''}`}
              draggable
              onDragStart={mediumDrag.onDragStart(key)}
              onDragEnd={mediumDrag.onDragEnd}
              onDragOver={mediumDrag.onDragOver}
              onDrop={mediumDrag.onDrop(key)}
            >
              {mediumCards[key]}
            </div>
          ))}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Tab } from '../Layout/NavBar'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useDragReorder, sanitizeOrder } from '../../hooks/useDragReorder'
import { useDashboardCellSize } from '../../hooks/useDashboardCellSize'
import { DashboardCell } from './DashboardCell'
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

const GAP = 16
const COLUMNS = 4

const CARD_KEYS = ['networth', 'savings', 'balance', 'crypto', 'spending', 'budget', 'analytics'] as const
type CardKey = (typeof CARD_KEYS)[number]

// Each card's own size — standard cards are 1x1, auto-promoting to 1x2 if
// their own content doesn't fit (see DashboardCell); Budget status and
// Analytics are a fixed 2x2 in code and never auto-resize. One combined
// order (rather than a separate list per tier) so any card can be dragged
// onto any other regardless of size — dropping a 2x2 onto a 1x1's spot (or
// vice versa) reorders the whole sequence and the grid reflows around it,
// instead of only accepting drops within the same tier.
const CARD_TIER: Record<CardKey, { widthUnits: 1 | 2; heightUnits: 1 | 2; autoPromote?: boolean }> = {
  networth: { widthUnits: 1, heightUnits: 1, autoPromote: true },
  savings: { widthUnits: 1, heightUnits: 1, autoPromote: true },
  balance: { widthUnits: 1, heightUnits: 1, autoPromote: true },
  crypto: { widthUnits: 1, heightUnits: 1, autoPromote: true },
  spending: { widthUnits: 1, heightUnits: 1, autoPromote: true },
  budget: { widthUnits: 2, heightUnits: 2 },
  analytics: { widthUnits: 2, heightUnits: 2 },
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

  const [budgetEnabled] = useMetaSetting<boolean>('budgetEnabled', false)

  const [orderRaw, setOrder] = useMetaSetting<CardKey[]>('dashboardCardOrder', [...CARD_KEYS])
  const order = sanitizeOrder(orderRaw, CARD_KEYS)
  const drag = useDragReorder(order, setOrder)

  const gridRef = useRef<HTMLDivElement>(null)
  const cellSize = useDashboardCellSize(gridRef, COLUMNS, GAP)

  const cards: Record<CardKey, ReactNode> = {
    networth: <NetWorthSummaryCard blurBalances={blurBalances} onToggleBlur={() => setBlurBalances((b) => !b)} />,
    savings: <SavingsSummaryCard onNavigate={() => onNavigate('savings')} />,
    balance: <BalanceSummaryCard onNavigate={() => onNavigate('savings')} />,
    crypto: <CryptoSummaryCard onNavigate={() => onNavigate('crypto')} />,
    spending: <SpendingSummaryCard onNavigate={() => onNavigate('spending')} />,
    budget: <BudgetStatusDashboardCard />,
    analytics: <AnalyticsDashboardCard onNavigate={() => onNavigate('analytics')} />,
  }

  return (
    <div className={`view boucoup-scope dashboard-view${blurBalances ? ' balances-blurred' : ''}`}>
      {/* One grid for every card — a card's own tier (see CARD_TIER above)
          decides its size; drag any card onto any other to reorder. Fixed
          columns + grid-auto-rows matched to that same width (cellSize) +
          dense packing means the browser itself fills gaps around
          whatever's dragged where, including stacking two 1x1s in one
          column next to a wider/taller card — no manual placement logic
          needed on this end. Order is remembered per device. */}
      <div
        className="dashboard-grid"
        ref={gridRef}
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`, gridAutoRows: cellSize > 0 ? `${cellSize}px` : undefined }}
      >
        {order
          .filter((key) => key !== 'budget' || budgetEnabled)
          .map((key) => (
            <DashboardCell
              key={key}
              {...CARD_TIER[key]}
              dragging={drag.draggingKey === key}
              draggable
              onDragStart={drag.onDragStart(key)}
              onDragEnd={drag.onDragEnd}
              onDragOver={drag.onDragOver}
              onDrop={drag.onDrop(key)}
            >
              {cards[key]}
            </DashboardCell>
          ))}
      </div>
    </div>
  )
}

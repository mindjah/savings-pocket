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
const MIN_COLUMN_WIDTH = 220

// Standard cards — 1x1 by default, auto-promoting to 1x2 if their own
// content doesn't fit (see DashboardCell). Order is user-reorderable and
// persisted per device.
const STANDARD_KEYS = ['networth', 'savings', 'balance', 'crypto', 'spending'] as const
type StandardKey = (typeof STANDARD_KEYS)[number]

// Data-rich cards — a fixed 2x2 set in code (not auto-expanding); still
// reorderable amongst each other.
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

  const gridRef = useRef<HTMLDivElement>(null)
  const cellSize = useDashboardCellSize(gridRef, MIN_COLUMN_WIDTH, GAP)

  const standardCards: Record<StandardKey, ReactNode> = {
    networth: <NetWorthSummaryCard blurBalances={blurBalances} onToggleBlur={() => setBlurBalances((b) => !b)} />,
    savings: <SavingsSummaryCard onNavigate={() => onNavigate('savings')} />,
    balance: <BalanceSummaryCard onNavigate={() => onNavigate('savings')} />,
    crypto: <CryptoSummaryCard onNavigate={() => onNavigate('crypto')} />,
    spending: <SpendingSummaryCard onNavigate={() => onNavigate('spending')} />,
  }
  const mediumCards: Record<MediumKey, ReactNode> = {
    budget: <BudgetStatusDashboardCard />,
    analytics: <AnalyticsDashboardCard onNavigate={() => onNavigate('analytics')} />,
  }

  return (
    <div className={`view boucoup-scope dashboard-view${blurBalances ? ' balances-blurred' : ''}`}>
      {/* One grid for every card — a card's own tier (see DashboardCell)
          decides its size; drag any card onto another of the same kind to
          swap its position, remembered per device. */}
      <div className="dashboard-grid" ref={gridRef}>
        {standardOrder.map((key) => (
          <DashboardCell
            key={key}
            cellSize={cellSize}
            gap={GAP}
            widthUnits={1}
            heightUnits={1}
            autoPromote
            dragging={standardDrag.draggingKey === key}
            draggable
            onDragStart={standardDrag.onDragStart(key)}
            onDragEnd={standardDrag.onDragEnd}
            onDragOver={standardDrag.onDragOver}
            onDrop={standardDrag.onDrop(key)}
          >
            {standardCards[key]}
          </DashboardCell>
        ))}

        {mediumOrder
          .filter((key) => key !== 'budget' || budgetEnabled)
          .map((key) => (
            <DashboardCell
              key={key}
              cellSize={cellSize}
              gap={GAP}
              widthUnits={2}
              heightUnits={2}
              dragging={mediumDrag.draggingKey === key}
              draggable
              onDragStart={mediumDrag.onDragStart(key)}
              onDragEnd={mediumDrag.onDragEnd}
              onDragOver={mediumDrag.onDragOver}
              onDrop={mediumDrag.onDrop(key)}
            >
              {mediumCards[key]}
            </DashboardCell>
          ))}
      </div>
    </div>
  )
}

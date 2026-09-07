import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Tab } from '../Layout/NavBar'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { useDashboardDrag, sanitizeOrder } from '../../hooks/useDashboardDrag'
import { useDashboardCellSize } from '../../hooks/useDashboardCellSize'
import { DashboardCell } from './DashboardCell'
import { NetWorthSummaryCard } from './NetWorthSummaryCard'
import { SavingsSummaryCard } from './SavingsSummaryCard'
import { BalanceSummaryCard } from './BalanceSummaryCard'
import { InvestSummaryCard } from './InvestSummaryCard'
import { SpendingSummaryCard } from './SpendingSummaryCard'
import { BudgetStatusDashboardCard } from './BudgetStatusDashboardCard'
import { AnalyticsDashboardCard } from './AnalyticsDashboardCard'
import { ThemeQuickToggle } from './ThemeQuickToggle'
import { CurrencyRatesButton } from './CurrencyRatesButton'
import { SyncStatusBadge } from '../common/SyncStatusBadge'
import { HeaderPortal, HeaderTitlePortal } from '../common/HeaderPortal'
import { BLURRABLE_SELECTOR } from '../../lib/blur'

interface Props {
  onNavigate: (tab: Tab) => void
}

const GAP = 16
const COLUMNS = 4

const CARD_KEYS = ['networth', 'savings', 'balance', 'invest', 'spending', 'budget', 'analytics'] as const
type CardKey = (typeof CARD_KEYS)[number]

// Each card's own size — standard cards are 1x1, auto-promoting to 1x2 if
// their own content doesn't fit (see DashboardCell); Budget status and
// Analytics are a fixed 2x2 in code and never auto-resize. One combined
// order (rather than a separate list per tier) so any card can be dragged
// onto any other regardless of size — dropping a 2x2 onto a 1x1's spot (or
// vice versa) reorders the whole sequence and the grid reflows around it,
// instead of only accepting drops within the same tier. On mobile these
// tiers only affect drag-reorder bookkeeping — every card renders as a
// plain full-width stacked block there (see DashboardCell's 'stack' mode).
const CARD_TIER: Record<CardKey, { widthUnits: 1 | 2; heightUnits: 1 | 2; autoPromote?: boolean }> = {
  networth: { widthUnits: 1, heightUnits: 1, autoPromote: true },
  savings: { widthUnits: 1, heightUnits: 1, autoPromote: true },
  balance: { widthUnits: 1, heightUnits: 1, autoPromote: true },
  invest: { widthUnits: 1, heightUnits: 1, autoPromote: true },
  spending: { widthUnits: 1, heightUnits: 1, autoPromote: true },
  budget: { widthUnits: 2, heightUnits: 2 },
  analytics: { widthUnits: 2, heightUnits: 2 },
}

// Every screen's own visual/summary part in one place — a real mobile form
// (a single stacked column, full-width cards, like every other mobile
// screen) alongside the desktop grid.
export function DashboardView({ onNavigate }: Props) {
  const isDesktop = useIsDesktop()

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
  const drag = useDashboardDrag(order, setOrder)

  const gridRef = useRef<HTMLDivElement>(null)
  const cellSize = useDashboardCellSize(gridRef, COLUMNS, GAP)

  const cards: Record<CardKey, ReactNode> = {
    networth: <NetWorthSummaryCard blurBalances={blurBalances} onToggleBlur={() => setBlurBalances((b) => !b)} />,
    savings: <SavingsSummaryCard onNavigate={() => onNavigate('savings')} />,
    balance: <BalanceSummaryCard onNavigate={() => onNavigate('savings')} />,
    invest: <InvestSummaryCard onNavigate={() => onNavigate('invest')} />,
    spending: <SpendingSummaryCard onNavigate={() => onNavigate('spending')} />,
    budget: <BudgetStatusDashboardCard />,
    analytics: <AnalyticsDashboardCard onNavigate={() => onNavigate('analytics')} />,
  }

  const visibleOrder = order.filter((key) => key !== 'budget' || budgetEnabled)

  return (
    <div
      ref={gridRef}
      className={`view boucoup-scope dashboard-view${blurBalances ? ' balances-blurred' : ''}`}
      onClick={(e) => {
        if (blurBalances && (e.target as HTMLElement).closest(BLURRABLE_SELECTOR)) setBlurBalances(false)
      }}
    >
      {/* Mobile: the real app header (see App.tsx excluding 'dashboard' from
          its own generic title portal) — sync status where the title would
          otherwise go, exchange rates where every other mobile screen's own
          action button goes. Desktop hides that header entirely and shows
          its own in-body row instead: theme toggle (duplicating Settings'
          own control) + the same exchange rates button. */}
      <HeaderTitlePortal>
        <SyncStatusBadge variant="header" />
      </HeaderTitlePortal>
      <HeaderPortal>
        <CurrencyRatesButton />
      </HeaderPortal>

      {isDesktop && (
        <div className="dashboard-top-row">
          <ThemeQuickToggle />
          <CurrencyRatesButton />
        </div>
      )}

      {/* Desktop: one grid for every card — a card's own tier (see
          CARD_TIER above) decides its size; drag any card onto any other to
          reorder. Fixed columns + grid-auto-rows matched to that same width
          (cellSize) + dense packing means the browser itself fills gaps
          around whatever's dragged where, including stacking two 1x1s in
          one column next to a wider/taller card — no manual placement
          logic needed on this end. Mobile: every card is a plain full-width
          stacked block instead, same as every other mobile screen. Order
          (not layout) is remembered per device either way. */}
      <div
        className={isDesktop ? 'dashboard-grid' : 'dashboard-stack'}
        style={
          isDesktop
            ? { gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`, gridAutoRows: cellSize > 0 ? `${cellSize}px` : undefined }
            : undefined
        }
      >
        {visibleOrder.map((key) => (
          <DashboardCell
            key={key}
            cardKey={key}
            layout={isDesktop ? 'grid' : 'stack'}
            {...CARD_TIER[key]}
            dragging={drag.draggingKey === key}
            dragOver={drag.overKey === key}
            onHandlePointerDown={drag.onHandlePointerDown(key)}
            onHandlePointerMove={drag.onHandlePointerMove}
            onHandlePointerUp={drag.onHandlePointerUp}
          >
            {cards[key]}
          </DashboardCell>
        ))}
      </div>
    </div>
  )
}

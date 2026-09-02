import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { CategoryBudget, SpendingEntry, TotalBudget } from '../../db/types'
import { monthOf } from '../../lib/analytics'
import { todayIso } from '../../lib/format'
import { Modal } from '../common/Modal'
import { useTranslation } from '../../hooks/useTranslation'
import { CompareTab } from './analytics/CompareTab'
import { YearTab } from './analytics/YearTab'
import { HabitsTab } from './analytics/HabitsTab'

interface Props {
  onClose: () => void
}

type AnalyticsTab = 'compare' | 'year' | 'habits'

function groupByMonth<T extends { date?: string; month?: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  rows.forEach((row) => {
    const key = row.month ?? monthOf(row.date!)
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  })
  return map
}

// Shared by both entry points below — a bottom sheet on mobile (opened from
// Spending's Manage menu) and a full desktop-sidebar page (see NavBar's
// desktopOnly tabs). Same data, same tabs; only the surrounding chrome
// (Modal vs. a plain .view page) differs.
function AnalyticsBody() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<AnalyticsTab>('compare')

  const entriesRaw = useLiveQuery(() => db.spendingEntries.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const categoryBudgets = useLiveQuery(() => db.categoryBudgets.toArray(), []) ?? []
  const totalBudgets = useLiveQuery(() => db.totalBudgets.toArray(), []) ?? []

  // Every Analytics number is meant to reflect what's actually happened —
  // a future-dated entry hasn't been spent yet any more than a recurring
  // expense that hasn't materialized has (see materializeRecurringExpenses
  // and the identical filter in SpendingView/BudgetStatusModal). Filtering
  // once here means every tab's totals/budget/category breakdown gets this
  // for free, with no per-tab filtering to keep in sync.
  const entries = useMemo(() => entriesRaw.filter((e) => e.date <= todayIso()), [entriesRaw])
  const entriesByMonth = useMemo(() => groupByMonth<SpendingEntry>(entries), [entries])
  const categoryBudgetsByMonth = useMemo(() => groupByMonth<CategoryBudget>(categoryBudgets), [categoryBudgets])
  const totalBudgetsByMonth = useMemo(() => groupByMonth<TotalBudget>(totalBudgets), [totalBudgets])

  return (
    <>
      <div className="segmented">
        <button type="button" className={tab === 'compare' ? 'active' : ''} onClick={() => setTab('compare')}>
          {t('Compare months')}
        </button>
        <button type="button" className={tab === 'year' ? 'active' : ''} onClick={() => setTab('year')}>
          {t('Year breakdown')}
        </button>
        <button type="button" className={tab === 'habits' ? 'active' : ''} onClick={() => setTab('habits')}>
          {t('Spending habits')}
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        {tab === 'compare' && (
          <CompareTab
            entriesByMonth={entriesByMonth}
            categoryBudgetsByMonth={categoryBudgetsByMonth}
            totalBudgetsByMonth={totalBudgetsByMonth}
            categories={categories}
          />
        )}
        {tab === 'year' && (
          <YearTab
            entriesByMonth={entriesByMonth}
            categoryBudgetsByMonth={categoryBudgetsByMonth}
            totalBudgetsByMonth={totalBudgetsByMonth}
            categories={categories}
          />
        )}
        {tab === 'habits' && (
          <HabitsTab entriesByMonth={entriesByMonth} categoryBudgetsByMonth={categoryBudgetsByMonth} categories={categories} />
        )}
      </div>
    </>
  )
}

export function AnalyticsModal({ onClose }: Props) {
  const { t } = useTranslation()
  return (
    <Modal wide title={t('Analytics')} onClose={onClose}>
      <AnalyticsBody />
    </Modal>
  )
}

// Desktop-only full page (see NavBar) — same content as AnalyticsModal,
// laid out like Spending/Savings/Settings instead of as a bottom sheet.
export function AnalyticsScreen() {
  return (
    <div className="view boucoup-scope">
      <AnalyticsBody />
    </div>
  )
}

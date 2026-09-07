import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { CategoryBudget, SpendingEntry } from '../../db/types'
import { todayIso } from '../../lib/format'
import { useTranslation } from '../../hooks/useTranslation'
import { AnalyticsIcon } from '../common/AnalyticsIcon'
import { groupByMonth } from '../Spending/AnalyticsModal'
import { HabitsTab } from '../Spending/analytics/HabitsTab'

interface Props {
  onNavigate: () => void
}

// Only Analytics' "Spending habits" tab — the other two (Compare/Year) pick
// a month range interactively, which doesn't fit a glanceable dashboard card
// the way habits' own fixed "last 6 months" view does. Fetches the same
// data AnalyticsBody does, filtered to entries that have actually happened
// (see AnalyticsBody's own comment on this).
export function AnalyticsDashboardCard({ onNavigate }: Props) {
  const { t } = useTranslation()

  const entriesRaw = useLiveQuery(() => db.spendingEntries.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const categoryBudgets = useLiveQuery(() => db.categoryBudgets.toArray(), []) ?? []

  const entries = useMemo(() => entriesRaw.filter((e) => e.date <= todayIso()), [entriesRaw])
  const entriesByMonth = useMemo(() => groupByMonth<SpendingEntry>(entries), [entries])
  const categoryBudgetsByMonth = useMemo(() => groupByMonth<CategoryBudget>(categoryBudgets), [categoryBudgets])

  return (
    <div className="card dashboard-card">
      <div className="dashboard-card-header">
        <span className="pocket-type-icon tint-indigo" aria-hidden="true">
          <AnalyticsIcon size={20} />
        </span>
        <h3>{t('Spending habits')}</h3>
      </div>
      <div className="dashboard-card-body">
        <HabitsTab entriesByMonth={entriesByMonth} categoryBudgetsByMonth={categoryBudgetsByMonth} categories={categories} />
      </div>
      <button className="btn btn-ghost dashboard-card-link" onClick={onNavigate} type="button">
        {t('Go to Analytics')} →
      </button>
    </div>
  )
}

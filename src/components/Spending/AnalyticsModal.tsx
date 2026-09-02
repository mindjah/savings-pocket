import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { CategoryBudget, SpendingEntry, TotalBudget } from '../../db/types'
import { monthOf } from '../../lib/analytics'
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

export function AnalyticsModal({ onClose }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<AnalyticsTab>('compare')

  const entries = useLiveQuery(() => db.spendingEntries.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const categoryBudgets = useLiveQuery(() => db.categoryBudgets.toArray(), []) ?? []
  const totalBudgets = useLiveQuery(() => db.totalBudgets.toArray(), []) ?? []

  const entriesByMonth = useMemo(() => groupByMonth<SpendingEntry>(entries), [entries])
  const categoryBudgetsByMonth = useMemo(() => groupByMonth<CategoryBudget>(categoryBudgets), [categoryBudgets])
  const totalBudgetsByMonth = useMemo(() => groupByMonth<TotalBudget>(totalBudgets), [totalBudgets])

  return (
    <Modal title={t('Analytics')} onClose={onClose}>
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
          <YearTab entriesByMonth={entriesByMonth} totalBudgetsByMonth={totalBudgetsByMonth} categories={categories} />
        )}
        {tab === 'habits' && (
          <HabitsTab entriesByMonth={entriesByMonth} categoryBudgetsByMonth={categoryBudgetsByMonth} categories={categories} />
        )}
      </div>
    </Modal>
  )
}

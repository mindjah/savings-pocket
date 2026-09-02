import { useMemo, useState } from 'react'
import type { Category, CategoryBudget, Currency, SpendingEntry } from '../../../db/types'
import { pad2, formatMoney } from '../../../lib/format'
import { categoryRanking, spendingHabits } from '../../../lib/analytics'
import { useTranslation } from '../../../hooks/useTranslation'
import { tHabitOver, tHabitUnder, tTotalLastMonths } from '../../../i18n/translations'
import { CategoryBar } from './CategoryBar'
import { CategoryExpensesModal } from '../CategoryExpensesModal'

interface Props {
  entriesByMonth: Map<string, SpendingEntry[]>
  categoryBudgetsByMonth: Map<string, CategoryBudget[]>
  categories: Category[]
}

function lastSixMonths(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
  }
  return months
}

export function HabitsTab({ entriesByMonth, categoryBudgetsByMonth, categories }: Props) {
  const { t, lang } = useTranslation()
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const recentMonths = useMemo(() => lastSixMonths(), [])
  const [categoryModalFor, setCategoryModalFor] = useState<{ categoryId: number; currency: Currency } | null>(null)

  const recentEntriesByMonth = useMemo(() => {
    const map = new Map<string, SpendingEntry[]>()
    recentMonths.forEach((m) => map.set(m, entriesByMonth.get(m) ?? []))
    return map
  }, [entriesByMonth, recentMonths])

  const recentBudgetsByMonth = useMemo(() => {
    const map = new Map<string, CategoryBudget[]>()
    recentMonths.forEach((m) => map.set(m, categoryBudgetsByMonth.get(m) ?? []))
    return map
  }, [categoryBudgetsByMonth, recentMonths])

  const ranking = useMemo(() => categoryRanking(recentEntriesByMonth).slice(0, 8), [recentEntriesByMonth])
  const maxAvg = ranking[0]?.avgMonthly ?? 0

  const insights = useMemo(() => spendingHabits(recentEntriesByMonth, recentBudgetsByMonth), [recentEntriesByMonth, recentBudgetsByMonth])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="section-title">
        <h2>{t('Where you spend most (last 6 months)')}</h2>
      </div>
      {ranking.length === 0 ? (
        <div className="empty-state">
          <span className="icon">📊</span>
          {t('Not enough spending history yet.')}
        </div>
      ) : (
        <div className="category-breakdown">
          {ranking.map((row) => (
            <CategoryBar
              key={`${row.categoryId}:${row.currency}`}
              category={categoryMap.get(row.categoryId)}
              currency={row.currency}
              amount={row.avgMonthly}
              maxAmount={maxAvg}
              onClick={() => setCategoryModalFor({ categoryId: row.categoryId, currency: row.currency })}
            />
          ))}
        </div>
      )}

      <div className="section-title" style={{ marginTop: 14 }}>
        <h2>{t('Recommendations')}</h2>
      </div>
      {insights.length === 0 ? (
        <div className="empty-state">
          <span className="icon">💡</span>
          {t('No consistent over/under-budget pattern found yet — check back after a few more budgeted months.')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {insights.map((insight) => {
            const category = categoryMap.get(insight.categoryId)
            const name = category?.name ?? '—'
            const text =
              insight.direction === 'over'
                ? tHabitOver(lang, name, insight.monthsOver, insight.monthsBudgeted)
                : tHabitUnder(lang, name, insight.monthsUnder, insight.monthsBudgeted)
            return (
              <button
                className="card budget-summary-card"
                type="button"
                key={`${insight.categoryId}:${insight.currency}`}
                onClick={() => setCategoryModalFor({ categoryId: insight.categoryId, currency: insight.currency })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="swatch" style={{ background: category?.color ?? '#888' }} />
                  <strong>{name}</strong>
                </div>
                <div>{text}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {t('Avg actual')}: {formatMoney(insight.avgActual, insight.currency)} · {t('Avg budget')}: {formatMoney(insight.avgBudget, insight.currency)}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {categoryModalFor && (
        <CategoryExpensesModal
          categoryId={categoryModalFor.categoryId}
          currency={categoryModalFor.currency}
          categoryName={categoryMap.get(categoryModalFor.categoryId)?.name ?? t('Unknown')}
          categoryColor={categoryMap.get(categoryModalFor.categoryId)?.color ?? '#888'}
          monthPrefix={recentMonths}
          readOnly
          totalLabel={tTotalLastMonths(lang, recentMonths.length)}
          onClose={() => setCategoryModalFor(null)}
        />
      )}
    </div>
  )
}

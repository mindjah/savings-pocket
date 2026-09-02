import { useMemo, useState } from 'react'
import type { Category, CategoryBudget, Currency, SpendingEntry, TotalBudget } from '../../../db/types'
import { MONTH_NAMES } from '../../../lib/constants'
import { formatDate, formatMoneyCompact, pad2, todayIso } from '../../../lib/format'
import { categoryTotals, mergeCategoryCurrencies, monthlyTotalsForYear } from '../../../lib/analytics'
import { budgetCardLevel, computeBudgetStatus, monthProgress, type BudgetCardLevel } from '../../../lib/planning'
import { useFiatRates } from '../../../hooks/useFiatRates'
import { useTranslation } from '../../../hooks/useTranslation'
import { CategoryBar } from './CategoryBar'
import { CategoryExpensesModal } from '../CategoryExpensesModal'
import { tDataAsOf, tTotalInYear } from '../../../i18n/translations'

interface Props {
  entriesByMonth: Map<string, SpendingEntry[]>
  categoryBudgetsByMonth: Map<string, CategoryBudget[]>
  totalBudgetsByMonth: Map<string, TotalBudget[]>
  categories: Category[]
}

export function YearTab({ entriesByMonth, categoryBudgetsByMonth, totalBudgetsByMonth, categories }: Props) {
  const { t, lang } = useTranslation()
  const [year, setYear] = useState(new Date().getFullYear())
  const [categoryModalFor, setCategoryModalFor] = useState<{ categoryId: number } | null>(null)
  const { rates: fx } = useFiatRates()
  const now = new Date()
  const realMonthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const yearMonthPrefixes = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`),
    [year],
  )

  const yearEntries = useMemo(() => {
    const list: SpendingEntry[] = []
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`
      list.push(...(entriesByMonth.get(key) ?? []))
    }
    return list
  }, [entriesByMonth, year])

  const monthlyTotals = useMemo(() => monthlyTotalsForYear(yearEntries, year), [yearEntries, year])
  const currencies = Object.keys(monthlyTotals) as Currency[]

  const yearCategoryTotals = useMemo(() => mergeCategoryCurrencies(categoryTotals(yearEntries), fx), [yearEntries, fx])
  const maxByCurrency = useMemo(() => {
    const map = new Map<Currency, number>()
    yearCategoryTotals.forEach((row) => map.set(row.currency, Math.max(map.get(row.currency) ?? 0, row.amount)))
    return map
  }, [yearCategoryTotals])

  // Exact same computeBudgetStatus + budgetCardLevel the Compare tab's
  // budget cards use — not a separate over/under heuristic that can (and
  // did) disagree with them for the same month.
  const adherence = useMemo(() => {
    const result: (BudgetCardLevel | 'none')[] = []
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`
      const totalBudgetRows = totalBudgetsByMonth.get(key) ?? []
      const categoryBudgetRows = categoryBudgetsByMonth.get(key) ?? []
      if (totalBudgetRows.length === 0 && categoryBudgetRows.length === 0) {
        result.push('none')
        continue
      }
      const totalBudgetLimit: Partial<Record<Currency, number>> = {}
      totalBudgetRows.forEach((b) => {
        totalBudgetLimit[b.currency] = (totalBudgetLimit[b.currency] ?? 0) + b.amount
      })
      const { dayOfMonth, daysInMonth } = monthProgress(key, realMonthPrefix, now)
      const status = computeBudgetStatus(categoryBudgetRows, totalBudgetLimit, entriesByMonth.get(key) ?? [], dayOfMonth, daysInMonth, fx)
      result.push(status ? budgetCardLevel(status) : 'none')
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesByMonth, categoryBudgetsByMonth, totalBudgetsByMonth, year, fx])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="calendar-header">
        <button className="btn btn-ghost btn-icon calendar-nav-btn" onClick={() => setYear((y) => y - 1)} aria-label={t('Previous year')} type="button">
          ‹
        </button>
        <span className="month-label">{year}</span>
        <button className="btn btn-ghost btn-icon calendar-nav-btn" onClick={() => setYear((y) => y + 1)} aria-label={t('Next year')} type="button">
          ›
        </button>
      </div>

      {year === new Date().getFullYear() && (
        <div className="muted" style={{ fontSize: '0.78rem' }}>
          {tDataAsOf(lang, formatDate(todayIso(), lang))}
        </div>
      )}

      {currencies.length === 0 ? (
        <div className="empty-state">
          <span className="icon">📊</span>
          {t('No spending logged this year.')}
        </div>
      ) : (
        <>
          {currencies.map((currency) => {
            const months = monthlyTotals[currency] ?? []
            const max = Math.max(...months, 1)
            return (
              <div key={currency}>
                <div className="muted" style={{ marginBottom: 6 }}>{currency}</div>
                <div className="year-bar-chart">
                  {months.map((amount, i) => (
                    <div className="year-bar-col" key={i}>
                      <span className="year-bar-value">{amount > 0 ? formatMoneyCompact(amount, currency) : ''}</span>
                      <div className="year-bar" style={{ height: `${(amount / max) * 100}%` }} />
                      <span className="year-bar-label">{t(MONTH_NAMES[i]).slice(0, 3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <div className="section-title" style={{ marginTop: 14 }}>
            <h2>{t('Budget adherence')}</h2>
          </div>
          <div className="year-adherence-strip">
            {adherence.map((status, i) => (
              <span
                key={i}
                className={`year-adherence-dot ${status}`}
                title={`${t(MONTH_NAMES[i])} ${year}`}
              />
            ))}
          </div>

          <div className="section-title" style={{ marginTop: 14 }}>
            <h2>{t('By category')}</h2>
          </div>
          <div className="category-breakdown">
            {yearCategoryTotals
              .sort((a, b) => b.amount - a.amount)
              .map((row) => (
                <CategoryBar
                  key={`${row.categoryId}:${row.currency}`}
                  category={categoryMap.get(row.categoryId)}
                  currency={row.currency}
                  amount={row.amount}
                  maxAmount={maxByCurrency.get(row.currency) ?? 0}
                  onClick={() => setCategoryModalFor({ categoryId: row.categoryId })}
                />
              ))}
          </div>
        </>
      )}

      {categoryModalFor && (
        <CategoryExpensesModal
          categoryId={categoryModalFor.categoryId}
          categoryName={categoryMap.get(categoryModalFor.categoryId)?.name ?? t('Unknown')}
          categoryColor={categoryMap.get(categoryModalFor.categoryId)?.color ?? '#888'}
          monthPrefix={yearMonthPrefixes}
          readOnly
          totalLabel={tTotalInYear(lang, year)}
          onClose={() => setCategoryModalFor(null)}
        />
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import type { Category, CategoryBudget, Currency, SpendingEntry, TotalBudget } from '../../../db/types'
import { MONTH_NAMES } from '../../../lib/constants'
import { formatMoney, pad2 } from '../../../lib/format'
import { budgetComparisonForMonth, categoryTotals, compareCategoryTotals, currencyTotals } from '../../../lib/analytics'
import { useTranslation } from '../../../hooks/useTranslation'
import { CategoryCompareBar } from './CategoryBar'

interface Props {
  entriesByMonth: Map<string, SpendingEntry[]>
  categoryBudgetsByMonth: Map<string, CategoryBudget[]>
  totalBudgetsByMonth: Map<string, TotalBudget[]>
  categories: Category[]
}

function defaultMonths(): [string, string] {
  const now = new Date()
  const current = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previous = `${prevDate.getFullYear()}-${pad2(prevDate.getMonth() + 1)}`
  return [previous, current]
}

export function CompareTab({ entriesByMonth, categoryBudgetsByMonth, totalBudgetsByMonth, categories }: Props) {
  const { t } = useTranslation()
  const [defaultA, defaultB] = useMemo(() => defaultMonths(), [])
  const [monthA, setMonthA] = useState(defaultA)
  const [monthB, setMonthB] = useState(defaultB)

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  function monthLabel(month: string): string {
    const [y, m] = month.split('-')
    return `${t(MONTH_NAMES[Number(m) - 1])} ${y}`
  }

  // Short form for the narrow per-row bar labels — the full "Month Year"
  // header line above already states each month unambiguously.
  function monthLabelShort(month: string): string {
    const [, m] = month.split('-')
    return t(MONTH_NAMES[Number(m) - 1]).slice(0, 3)
  }

  const entriesA = entriesByMonth.get(monthA) ?? []
  const entriesB = entriesByMonth.get(monthB) ?? []
  const totalsA = currencyTotals(entriesA)
  const totalsB = currencyTotals(entriesB)
  const currencies = Array.from(new Set([...Object.keys(totalsA), ...Object.keys(totalsB)])) as Currency[]

  const compareRows = useMemo(
    () => compareCategoryTotals(categoryTotals(entriesA), categoryTotals(entriesB)).sort((r1, r2) => r2.a + r2.b - (r1.a + r1.b)),
    [entriesA, entriesB],
  )
  const maxByCurrency = useMemo(() => {
    const map = new Map<Currency, number>()
    compareRows.forEach((r) => map.set(r.currency, Math.max(map.get(r.currency) ?? 0, r.a, r.b)))
    return map
  }, [compareRows])

  const budgetA = budgetComparisonForMonth(categoryBudgetsByMonth.get(monthA) ?? [], totalBudgetsByMonth.get(monthA) ?? [], entriesA)
  const budgetB = budgetComparisonForMonth(categoryBudgetsByMonth.get(monthB) ?? [], totalBudgetsByMonth.get(monthB) ?? [], entriesB)

  function renderBudgetSection(label: string, budget: ReturnType<typeof budgetComparisonForMonth>) {
    if (!budget.hasBudget) return null
    const overCategories = budget.categories.filter((c) => c.over)
    return (
      <div className="card" style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
        {Object.entries(budget.totalBudget).map(([currency, amount]) => {
          const actual = budget.totalActual[currency as Currency] ?? 0
          const over = actual > (amount ?? 0)
          return (
            <div key={currency} className="muted" style={{ color: over ? 'var(--danger-strong)' : undefined }}>
              {formatMoney(actual, currency as Currency)} / {formatMoney(amount ?? 0, currency as Currency)}
              {over ? ` — ${t('over budget')}` : ''}
            </div>
          )
        })}
        {overCategories.length > 0 && (
          <div className="muted" style={{ marginTop: 6, color: 'var(--danger-strong)' }}>
            {t('Over budget in:')} {overCategories.map((c) => categoryMap.get(c.categoryId)?.name ?? '—').join(', ')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="compareMonthA">{t('First month')}</label>
          <input id="compareMonthA" type="month" value={monthA} onChange={(e) => setMonthA(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="compareMonthB">{t('Second month')}</label>
          <input id="compareMonthB" type="month" value={monthB} onChange={(e) => setMonthB(e.target.value)} />
        </div>
      </div>

      {currencies.length === 0 ? (
        <div className="empty-state">
          <span className="icon">📊</span>
          {t('No spending logged in either month.')}
        </div>
      ) : (
        <>
          <div className="form-row compare-totals-row">
            <div className="total-chip compare-chip-a">
              {currencies.map((c) => (
                <div className="chip-currency-row" key={c}>
                  <div className="muted">{c}</div>
                  <div className="amount">{formatMoney(totalsA[c] ?? 0, c)}</div>
                </div>
              ))}
            </div>
            <div className="total-chip compare-chip-b">
              {currencies.map((c) => (
                <div className="chip-currency-row" key={c}>
                  <div className="muted">{c}</div>
                  <div className="amount">{formatMoney(totalsB[c] ?? 0, c)}</div>
                </div>
              ))}
            </div>
          </div>

          {(budgetA.hasBudget || budgetB.hasBudget) && (
            <>
              <div className="section-title" style={{ marginTop: 14 }}>
                <h2>{t('Budget')}</h2>
              </div>
              <div className={budgetA.hasBudget && budgetB.hasBudget ? 'form-row' : undefined}>
                {renderBudgetSection(monthLabel(monthA), budgetA)}
                {renderBudgetSection(monthLabel(monthB), budgetB)}
              </div>
            </>
          )}

          <div className="section-title" style={{ marginTop: 14 }}>
            <h2>{t('By category')}</h2>
          </div>
          <div className="category-breakdown">
            {compareRows.map((row) => (
              <CategoryCompareBar
                key={`${row.categoryId}:${row.currency}`}
                category={categoryMap.get(row.categoryId)}
                currency={row.currency}
                a={row.a}
                b={row.b}
                maxAmount={maxByCurrency.get(row.currency) ?? 0}
                labelA={monthLabelShort(monthA)}
                labelB={monthLabelShort(monthB)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

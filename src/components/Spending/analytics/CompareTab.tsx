import { useMemo, useState } from 'react'
import type { Category, CategoryBudget, Currency, SpendingEntry, TotalBudget } from '../../../db/types'
import { MONTH_NAMES } from '../../../lib/constants'
import { formatDate, formatMoney, pad2, todayIso } from '../../../lib/format'
import { budgetComparisonForMonth, categoryTotals, compareCategoryTotals, currencyTotals, mergeCategoryCurrencies } from '../../../lib/analytics'
import { budgetCardLevel, computeBudgetStatus, monthProgress } from '../../../lib/planning'
import { useFiatRates } from '../../../hooks/useFiatRates'
import { useTranslation } from '../../../hooks/useTranslation'
import { CategoryCompareBar } from './CategoryBar'
import { BudgetStatusModal } from '../BudgetStatusModal'
import { CategoryExpensesModal } from '../CategoryExpensesModal'
import { tDataAsOf, tTotalInMonth } from '../../../i18n/translations'

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
  const { t, lang } = useTranslation()
  const [defaultA, defaultB] = useMemo(() => defaultMonths(), [])
  const [monthA, setMonthA] = useState(defaultA)
  const [monthB, setMonthB] = useState(defaultB)
  const [budgetStatusMonth, setBudgetStatusMonth] = useState<string | null>(null)
  const [categoryModalFor, setCategoryModalFor] = useState<{ categoryId: number; month: string } | null>(null)
  const { rates: fx } = useFiatRates()

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

  const compareRows = useMemo(() => {
    const mergedA = mergeCategoryCurrencies(categoryTotals(entriesA), fx)
    const mergedB = mergeCategoryCurrencies(categoryTotals(entriesB), fx)
    return compareCategoryTotals(mergedA, mergedB).sort((r1, r2) => r2.a + r2.b - (r1.a + r1.b))
  }, [entriesA, entriesB, fx])
  // Each period's bars scale against that period's own max — the two
  // periods can land on different currencies for the same category (see
  // CategoryCompareBar), so there's no single shared max that stays fair.
  const maxAByCurrency = useMemo(() => {
    const map = new Map<Currency, number>()
    compareRows.forEach((r) => map.set(r.currencyA, Math.max(map.get(r.currencyA) ?? 0, r.a)))
    return map
  }, [compareRows])
  const maxBByCurrency = useMemo(() => {
    const map = new Map<Currency, number>()
    compareRows.forEach((r) => map.set(r.currencyB, Math.max(map.get(r.currencyB) ?? 0, r.b)))
    return map
  }, [compareRows])

  const budgetA = budgetComparisonForMonth(categoryBudgetsByMonth.get(monthA) ?? [], totalBudgetsByMonth.get(monthA) ?? [], entriesA)
  const budgetB = budgetComparisonForMonth(categoryBudgetsByMonth.get(monthB) ?? [], totalBudgetsByMonth.get(monthB) ?? [], entriesB)

  // Card color uses the exact same computeBudgetStatus + budgetCardLevel
  // SpendingView's own budget-status button uses — not a separate
  // heuristic — so the two surfaces can't show different colors for what's
  // really the same status.
  const now = new Date()
  const realMonthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  // entriesA/entriesB (from entriesByMonth) are already filtered to what's
  // actually happened by AnalyticsModal, so no extra date filter needed here.
  const levelA = useMemo(() => {
    if (!budgetA.hasBudget) return null
    const { dayOfMonth, daysInMonth: total } = monthProgress(monthA, realMonthPrefix, now)
    const status = computeBudgetStatus(categoryBudgetsByMonth.get(monthA) ?? [], budgetA.totalBudget, entriesA, dayOfMonth, total, fx)
    return status ? budgetCardLevel(status) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetA, monthA, categoryBudgetsByMonth, entriesA, fx])
  const levelB = useMemo(() => {
    if (!budgetB.hasBudget) return null
    const { dayOfMonth, daysInMonth: total } = monthProgress(monthB, realMonthPrefix, now)
    const status = computeBudgetStatus(categoryBudgetsByMonth.get(monthB) ?? [], budgetB.totalBudget, entriesB, dayOfMonth, total, fx)
    return status ? budgetCardLevel(status) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetB, monthB, categoryBudgetsByMonth, entriesB, fx])

  function renderBudgetSection(
    label: string,
    month: string,
    budget: ReturnType<typeof budgetComparisonForMonth>,
    level: ReturnType<typeof budgetCardLevel> | null,
  ) {
    if (!budget.hasBudget) return null
    const overCategories = budget.categories.filter((c) => c.over)
    return (
      <button
        className={`card budget-summary-card${level ? ` budget-level-${level}` : ''}`}
        type="button"
        style={{ marginTop: 8 }}
        onClick={() => setBudgetStatusMonth(month)}
      >
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
      </button>
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

      {(monthA === realMonthPrefix || monthB === realMonthPrefix) && (
        <div className="muted" style={{ fontSize: '0.78rem' }}>
          {tDataAsOf(lang, formatDate(todayIso(), lang))}
        </div>
      )}

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
                {renderBudgetSection(monthLabel(monthA), monthA, budgetA, levelA)}
                {renderBudgetSection(monthLabel(monthB), monthB, budgetB, levelB)}
              </div>
            </>
          )}

          <div className="section-title" style={{ marginTop: 14 }}>
            <h2>{t('By category')}</h2>
          </div>
          <div className="category-breakdown">
            {compareRows.map((row) => (
              <CategoryCompareBar
                key={row.categoryId}
                category={categoryMap.get(row.categoryId)}
                currencyA={row.currencyA}
                currencyB={row.currencyB}
                a={row.a}
                b={row.b}
                maxAmountA={maxAByCurrency.get(row.currencyA) ?? 0}
                maxAmountB={maxBByCurrency.get(row.currencyB) ?? 0}
                labelA={monthLabelShort(monthA)}
                labelB={monthLabelShort(monthB)}
                onClickA={() => setCategoryModalFor({ categoryId: row.categoryId, month: monthA })}
                onClickB={() => setCategoryModalFor({ categoryId: row.categoryId, month: monthB })}
              />
            ))}
          </div>
        </>
      )}

      {budgetStatusMonth && <BudgetStatusModal monthPrefix={budgetStatusMonth} onClose={() => setBudgetStatusMonth(null)} />}

      {categoryModalFor && (
        <CategoryExpensesModal
          categoryId={categoryModalFor.categoryId}
          categoryName={categoryMap.get(categoryModalFor.categoryId)?.name ?? t('Unknown')}
          categoryColor={categoryMap.get(categoryModalFor.categoryId)?.color ?? '#888'}
          monthPrefix={categoryModalFor.month}
          readOnly
          totalLabel={tTotalInMonth(lang, monthLabel(categoryModalFor.month))}
          onClose={() => setCategoryModalFor(null)}
        />
      )}
    </div>
  )
}

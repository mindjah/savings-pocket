import type { CategoryBudget, Currency, SpendingEntry, TotalBudget } from '../db/types'
import type { CategoryAmount } from './planning'
import { convertFiat, type FxRates } from './fxRates'

// yyyy-mm from a yyyy-mm-dd date string.
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function categoryTotals(entries: SpendingEntry[]): CategoryAmount[] {
  const map = new Map<string, CategoryAmount>()
  entries.forEach((e) => {
    const key = `${e.categoryId}:${e.currency}`
    const existing = map.get(key)
    if (existing) existing.amount += e.amount
    else map.set(key, { categoryId: e.categoryId, currency: e.currency, amount: e.amount })
  })
  return Array.from(map.values())
}

export function currencyTotals(entries: SpendingEntry[]): Partial<Record<Currency, number>> {
  const totals: Partial<Record<Currency, number>> = {}
  entries.forEach((e) => {
    totals[e.currency] = (totals[e.currency] ?? 0) + e.amount
  })
  return totals
}

// Merges a category's spend across multiple currencies into one, converting
// into whichever currency it was actually spent most in (by real converted
// value) — the same "pick the currency with the larger converted amount"
// rule computeBudgetStatus (planning.ts) already uses for a category
// budgeted in more than one currency. Falls back to leaving currencies
// separate if fx rates aren't loaded yet, matching that same function's
// "can't compare fairly yet, so don't guess" precedent. A category with
// only one currency passes through unchanged either way.
export function mergeCategoryCurrencies(rows: CategoryAmount[], fx: FxRates | null): CategoryAmount[] {
  const byCategory = new Map<number, CategoryAmount[]>()
  rows.forEach((row) => {
    const list = byCategory.get(row.categoryId) ?? []
    list.push(row)
    byCategory.set(row.categoryId, list)
  })
  const result: CategoryAmount[] = []
  byCategory.forEach((list, categoryId) => {
    if (list.length === 1 || !fx) {
      list.forEach((row) => result.push(row))
      return
    }
    const refCurrency = list.reduce((best, cur) =>
      convertFiat(cur.amount, cur.currency, 'USD', fx) > convertFiat(best.amount, best.currency, 'USD', fx) ? cur : best,
    ).currency
    const amount = list.reduce(
      (sum, row) => sum + (row.currency === refCurrency ? row.amount : convertFiat(row.amount, row.currency, refCurrency, fx)),
      0,
    )
    result.push({ categoryId, currency: refCurrency, amount })
  })
  return result
}

export interface CategoryComparisonRow {
  categoryId: number
  currencyA: Currency
  currencyB: Currency
  a: number
  b: number
}

// Outer join by categoryId only — callers pass currency-merged totals (see
// mergeCategoryCurrencies), so each side has at most one row per category.
// The two sides can still land on different ref currencies for the same
// category (e.g. mostly-EUR in August, mostly-RUB in September), so the
// currency is tracked per side rather than assumed shared. A category spent
// in only one of the two periods still shows up, zero-filled on the other
// side, rather than silently dropping out.
export function compareCategoryTotals(a: CategoryAmount[], b: CategoryAmount[]): CategoryComparisonRow[] {
  const map = new Map<number, CategoryComparisonRow>()
  a.forEach((row) => {
    map.set(row.categoryId, { categoryId: row.categoryId, currencyA: row.currency, currencyB: row.currency, a: row.amount, b: 0 })
  })
  b.forEach((row) => {
    const existing = map.get(row.categoryId)
    if (existing) {
      existing.b = row.amount
      existing.currencyB = row.currency
    } else {
      map.set(row.categoryId, { categoryId: row.categoryId, currencyA: row.currency, currencyB: row.currency, a: 0, b: row.amount })
    }
  })
  return Array.from(map.values())
}

// 12-length arrays (index 0 = January) of that currency's total for each
// month of the given year. Caller passes only entries already known to
// belong to that year (cheap client-side filter, same as everywhere else in
// this app that filters a full-table toArray() by date prefix).
export function monthlyTotalsForYear(entries: SpendingEntry[], year: number): Partial<Record<Currency, number[]>> {
  const totals: Partial<Record<Currency, number[]>> = {}
  entries.forEach((e) => {
    if (!e.date.startsWith(String(year))) return
    const monthIndex = Number(e.date.slice(5, 7)) - 1
    if (monthIndex < 0 || monthIndex > 11) return
    const arr = totals[e.currency] ?? new Array(12).fill(0)
    arr[monthIndex] += e.amount
    totals[e.currency] = arr
  })
  return totals
}

// Same per-category-currency grouping computeBudgetStatus (planning.ts) uses
// internally, pulled out standalone since analytics needs it without the
// rest of that function's pace/elapsed-fraction machinery.
function groupByCategoryCurrency(rows: { categoryId: number; currency: Currency; amount: number }[]): Map<number, Map<Currency, number>> {
  const map = new Map<number, Map<Currency, number>>()
  rows.forEach((row) => {
    const byCurrency = map.get(row.categoryId) ?? new Map<Currency, number>()
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + row.amount)
    map.set(row.categoryId, byCurrency)
  })
  return map
}

export interface CategoryBudgetComparison {
  categoryId: number
  currency: Currency
  budget: number
  actual: number
  over: boolean
}

export interface MonthBudgetComparison {
  hasBudget: boolean
  totalBudget: Partial<Record<Currency, number>>
  totalActual: Partial<Record<Currency, number>>
  categories: CategoryBudgetComparison[]
}

// A month with no budgets set at all (common — budgets are opt-in per
// month) reports hasBudget: false so the UI can skip the section entirely
// rather than showing an all-zero budget comparison.
export function budgetComparisonForMonth(
  categoryBudgets: CategoryBudget[],
  totalBudgets: TotalBudget[],
  entries: SpendingEntry[],
): MonthBudgetComparison {
  if (categoryBudgets.length === 0 && totalBudgets.length === 0) {
    return { hasBudget: false, totalBudget: {}, totalActual: {}, categories: [] }
  }
  const totalBudget: Partial<Record<Currency, number>> = {}
  totalBudgets.forEach((b) => {
    totalBudget[b.currency] = (totalBudget[b.currency] ?? 0) + b.amount
  })
  const totalActual = currencyTotals(entries)

  const budgetByCategory = groupByCategoryCurrency(categoryBudgets)
  const actualByCategory = groupByCategoryCurrency(categoryTotals(entries))
  const categories: CategoryBudgetComparison[] = []
  budgetByCategory.forEach((byCurrency, categoryId) => {
    byCurrency.forEach((budget, currency) => {
      const actual = actualByCategory.get(categoryId)?.get(currency) ?? 0
      categories.push({ categoryId, currency, budget, actual, over: budget > 0 && actual > budget })
    })
  })

  return { hasBudget: true, totalBudget, totalActual, categories }
}

// The card's status color now comes from computeBudgetStatus + the shared
// budgetCardLevel (planning.ts) — the exact same computation SpendingView's
// own budget-status button uses — rather than a separate ratio-based
// heuristic living here, so the two surfaces can't drift apart.

export interface HabitInsight {
  categoryId: number
  currency: Currency
  avgActual: number
  avgBudget: number
  monthsOver: number
  monthsUnder: number
  monthsBudgeted: number
  direction: 'over' | 'under'
}

// A category+currency is flagged once it's at least 15% off its budget (the
// same threshold categoryPaceLevel already uses for its yellow warning) in
// at least 60% of the months it actually had a budget set — "consistently"
// off, not just one bad month.
const CONSISTENCY_THRESHOLD = 0.15
const CONSISTENCY_FRACTION = 0.6
const MIN_BUDGETED_MONTHS = 3

export function spendingHabits(
  entriesByMonth: Map<string, SpendingEntry[]>,
  categoryBudgetsByMonth: Map<string, CategoryBudget[]>,
): HabitInsight[] {
  // categoryId:currency -> per-month { actual, budget? }
  const perKey = new Map<string, { actual: number; budget: number }[]>()
  entriesByMonth.forEach((entries, month) => {
    const actualByCat = groupByCategoryCurrency(categoryTotals(entries))
    const budgetByCat = groupByCategoryCurrency(categoryBudgetsByMonth.get(month) ?? [])
    // Union of categories that either spent or had a budget this month.
    const categoryIds = new Set([...actualByCat.keys(), ...budgetByCat.keys()])
    categoryIds.forEach((categoryId) => {
      const currencies = new Set([...(actualByCat.get(categoryId)?.keys() ?? []), ...(budgetByCat.get(categoryId)?.keys() ?? [])])
      currencies.forEach((currency) => {
        const key = `${categoryId}:${currency}`
        const list = perKey.get(key) ?? []
        list.push({
          actual: actualByCat.get(categoryId)?.get(currency) ?? 0,
          budget: budgetByCat.get(categoryId)?.get(currency) ?? 0,
        })
        perKey.set(key, list)
      })
    })
  })

  const insights: HabitInsight[] = []
  perKey.forEach((months, key) => {
    const [categoryIdStr, currency] = key.split(':')
    const categoryId = Number(categoryIdStr)
    const budgetedMonths = months.filter((m) => m.budget > 0)
    if (budgetedMonths.length < MIN_BUDGETED_MONTHS) return

    let monthsOver = 0
    let monthsUnder = 0
    budgetedMonths.forEach((m) => {
      const ratio = m.actual / m.budget
      if (ratio > 1 + CONSISTENCY_THRESHOLD) monthsOver++
      else if (ratio < 1 - CONSISTENCY_THRESHOLD) monthsUnder++
    })

    const avgActual = budgetedMonths.reduce((sum, m) => sum + m.actual, 0) / budgetedMonths.length
    const avgBudget = budgetedMonths.reduce((sum, m) => sum + m.budget, 0) / budgetedMonths.length

    const direction: 'over' | 'under' | null =
      monthsOver / budgetedMonths.length >= CONSISTENCY_FRACTION
        ? 'over'
        : monthsUnder / budgetedMonths.length >= CONSISTENCY_FRACTION
          ? 'under'
          : null
    if (!direction) return

    insights.push({
      categoryId,
      currency: currency as Currency,
      avgActual,
      avgBudget,
      monthsOver,
      monthsUnder,
      monthsBudgeted: budgetedMonths.length,
      direction,
    })
  })

  return insights.sort((a, b) => Math.abs(b.avgActual - b.avgBudget) - Math.abs(a.avgActual - a.avgBudget))
}

export interface CategoryRankingRow {
  categoryId: number
  currency: Currency
  avgMonthly: number
  // Real (fx-converted) USD value of avgMonthly — rows can land on
  // different ref currencies (see mergeCategoryCurrencies), so a UI
  // comparing two rows' relative size (e.g. a bar chart's width) needs
  // this, not the raw avgMonthly, or a small EUR row looks nearly empty
  // next to a big RUB one it's actually a meaningful fraction of. Falls
  // back to raw avgMonthly if fx isn't loaded yet (matches the sort
  // below's own fallback — still wrong across currencies, but no worse
  // than before, and self-corrects once rates load).
  avgMonthlyUsd: number
}

// Highest-to-lowest average monthly spend per category — a category spent
// in more than one currency over the window is merged the same way the
// compare/year breakdowns are (see mergeCategoryCurrencies), converting
// into whichever currency it was spent most in, since this is a pure
// "where does the money go" ranking, not a per-currency budget check.
export function categoryRanking(entriesByMonth: Map<string, SpendingEntry[]>, fx: FxRates | null): CategoryRankingRow[] {
  const perKey = new Map<string, number[]>()
  entriesByMonth.forEach((entries) => {
    categoryTotals(entries).forEach((row) => {
      const key = `${row.categoryId}:${row.currency}`
      const list = perKey.get(key) ?? []
      list.push(row.amount)
      perKey.set(key, list)
    })
  })
  const totals: CategoryAmount[] = []
  perKey.forEach((amounts, key) => {
    const [categoryIdStr, currency] = key.split(':')
    totals.push({ categoryId: Number(categoryIdStr), currency: currency as Currency, amount: amounts.reduce((sum, a) => sum + a, 0) })
  })
  const merged = mergeCategoryCurrencies(totals, fx)
  return merged
    .map((row) => {
      const avgMonthly = row.amount / entriesByMonth.size
      return {
        categoryId: row.categoryId,
        currency: row.currency,
        avgMonthly,
        avgMonthlyUsd: fx ? convertFiat(avgMonthly, row.currency, 'USD', fx) : avgMonthly,
      }
    })
    .sort((a, b) => b.avgMonthlyUsd - a.avgMonthlyUsd)
}

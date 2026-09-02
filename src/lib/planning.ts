import type { CategoryBudget, Currency, PlannedExpense, RecurringExpense, SpendingEntry } from '../db/types'
import { convertFiat, type FxRates } from './fxRates'

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

// Pace (spent-so-far vs. calendar-elapsed-so-far) only means anything for
// the month actually in progress. Anywhere a budget status gets computed
// for an arbitrary (not necessarily current) month — Analytics' Compare
// and Year tabs, BudgetStatusModal opened from a browsed month — needs
// this same generalization: a fully past month is simply over or under
// (elapsed 1, no partial-pace yellow), a not-yet-started future one hasn't
// spent anything against it yet (elapsed 0), and the real current month
// uses its own real day-of-month pace. Centralized here so every caller
// agrees on what "in progress" means for a given month.
export function monthProgress(monthPrefix: string, realMonthPrefix: string, today: Date): { dayOfMonth: number; daysInMonth: number } {
  const [y, m] = monthPrefix.split('-').map(Number)
  const total = daysInMonth(y, m - 1)
  if (monthPrefix < realMonthPrefix) return { dayOfMonth: total, daysInMonth: total }
  if (monthPrefix > realMonthPrefix) return { dayOfMonth: 0, daysInMonth: total }
  return { dayOfMonth: today.getDate(), daysInMonth: total }
}

// Active recurring expenses that belong to the given month (yyyy-mm prefix)
// — the "fixed expenses" for that month. Computed on the fly, never
// duplicated into their own table.
//
// A recurring expense's `nextDate` only ever points at its next NOT-YET-fired
// occurrence — once that date arrives, materializeRecurringExpenses() creates
// the real spending entry and advances `nextDate` straight past this month.
// So relying on `nextDate` alone would drop any recurring expense that has
// already fired this month. `spendingThisMonth` (this month's real spending
// entries) recovers those: any entry with a `recurringExpenseId` marks that
// recurring expense as already accounted for this month too.
export function fixedExpensesForMonth(
  recurring: RecurringExpense[],
  monthPrefix: string,
  spendingThisMonth: SpendingEntry[] = [],
): RecurringExpense[] {
  const materializedIds = new Set(
    spendingThisMonth.filter((e) => e.recurringExpenseId != null).map((e) => e.recurringExpenseId as number),
  )
  return recurring.filter((r) => r.active && (r.nextDate.startsWith(monthPrefix) || materializedIds.has(r.id!)))
}

export interface CategoryAmount {
  categoryId: number
  currency: Currency
  amount: number
}

// A plan's per-category planned total — fixed (this month's recurring) plus
// the plan's own one-off planned expenses, combined. Shared by the plan
// editor (for its "Per category" breakdown) and by "fill budget from a
// plan," so both read the exact same numbers.
export function planCategoryTotals(plannedExpenses: PlannedExpense[], fixedExpenses: RecurringExpense[]): CategoryAmount[] {
  const map = new Map<string, CategoryAmount>()
  const add = (categoryId: number, currency: Currency, amount: number) => {
    const key = `${categoryId}:${currency}`
    const existing = map.get(key)
    if (existing) existing.amount += amount
    else map.set(key, { categoryId, currency, amount })
  }
  plannedExpenses.forEach((e) => add(e.categoryId, e.currency, e.amount))
  fixedExpenses.forEach((r) => add(r.categoryId, r.currency, r.amount))
  return Array.from(map.values())
}

export type BudgetStatusLevel = 'green' | 'yellow' | 'red'

// Compares "fraction of a budget already spent" against "fraction of the
// month already elapsed": spending noticeably faster than the calendar is
// moving is the yellow warning sign, before it tips over into red at 100%.
export function categoryPaceLevel(actual: number, budget: number, elapsedFraction: number): BudgetStatusLevel {
  if (budget <= 0) return 'green'
  const usedFraction = actual / budget
  if (usedFraction > 1) return 'red'
  if (usedFraction > elapsedFraction + 0.15) return 'yellow'
  return 'green'
}

export interface BudgetStatusResult {
  level: BudgetStatusLevel
  // How many individually-budgeted categories are already over their own
  // amount, out of how many categories have a budget at all. Used both to
  // surface "limits exceeded in N categories" and, once at least half of
  // the budgeted categories are blown, to escalate the overall level to red
  // even if the total budget itself hasn't been exceeded yet.
  overBudgetCategoryCount: number
  budgetedCategoryCount: number
}

export type BudgetCardLevel = 'green' | 'yellow' | 'orange' | 'red'

// The 4-way color SpendingView's own budget-status button already shows
// (its 3-way BudgetStatusLevel plus an "orange" reading for "total is fine
// but at least one category individually isn't") — pulled out here so any
// other surface showing budget status (Analytics' budget cards) reads the
// exact same color for the exact same status, not just a similar one.
export function budgetCardLevel(status: BudgetStatusResult): BudgetCardLevel {
  const isOrange = status.level !== 'red' && status.overBudgetCategoryCount > 0
  if (status.level === 'red') return 'red'
  if (isOrange) return 'orange'
  if (status.level === 'yellow') return 'yellow'
  return 'green'
}

// The headline status compares ALL real spending this month (every category,
// budgeted or not) against the per-currency total budget cap — that's the
// number the user actually can't go over. overBudgetCategoryCount is a
// secondary signal surfaced alongside it: even while under the total, an
// individual category can already have blown past its own line item — and
// once that's true for half or more of the budgeted categories, the overall
// level escalates to red regardless of the total-budget pace.
export function computeBudgetStatus(
  budgets: CategoryBudget[],
  totalBudgets: Partial<Record<Currency, number>>,
  spendingThisMonth: SpendingEntry[],
  dayOfMonth: number,
  daysInMonth: number,
  fx: FxRates | null,
): BudgetStatusResult | null {
  const totalEntries = Object.entries(totalBudgets).filter(([, amount]) => (amount ?? 0) > 0) as [Currency, number][]
  if (totalEntries.length === 0) return null

  const elapsedFraction = dayOfMonth / daysInMonth

  const actualAllByCurrency = new Map<Currency, number>()
  spendingThisMonth.forEach((e) => {
    actualAllByCurrency.set(e.currency, (actualAllByCurrency.get(e.currency) ?? 0) + e.amount)
  })

  // Overall pace: every total-budget currency is converted into whichever
  // one has the largest REAL (converted) amount and pooled together, then
  // compared against ALL spending this month (any currency) converted the
  // same way — total budgets in different currencies are one combined pool
  // for this headline check, even though the donuts below keep showing each
  // currency's own distribution fully separately.
  let level: BudgetStatusLevel = 'green'
  if (fx) {
    const refCurrency = totalEntries.reduce((best, cur) =>
      convertFiat(cur[1], cur[0], 'USD', fx) > convertFiat(best[1], best[0], 'USD', fx) ? cur : best,
    )[0]
    const totalBudgetConverted = totalEntries.reduce(
      (sum, [currency, amount]) => sum + (currency === refCurrency ? amount : convertFiat(amount, currency, refCurrency, fx)),
      0,
    )
    const totalActualConverted = Array.from(actualAllByCurrency.entries()).reduce(
      (sum, [currency, amount]) => sum + (currency === refCurrency ? amount : convertFiat(amount, currency, refCurrency, fx)),
      0,
    )
    level = categoryPaceLevel(totalActualConverted, totalBudgetConverted, elapsedFraction)
  } else {
    // Exchange rates not loaded yet — fall back to judging each currency's
    // own total independently rather than guessing at a combined figure.
    for (const [currency, budgetAmount] of totalEntries) {
      const lvl = categoryPaceLevel(actualAllByCurrency.get(currency) ?? 0, budgetAmount, elapsedFraction)
      if (lvl === 'red') {
        level = 'red'
        break
      }
      if (lvl === 'yellow') level = 'yellow'
    }
  }

  // Grouped per category (not per category+currency) — a category budgeted
  // in more than one currency is judged as a whole, converting everything
  // into one of its own currencies, rather than flagging it "over budget"
  // just because ONE of its currencies individually ran over while the
  // category as a whole is still fine.
  const budgetByCategoryCurrency = new Map<number, Map<Currency, number>>()
  budgets.forEach((b) => {
    const byCurrency = budgetByCategoryCurrency.get(b.categoryId) ?? new Map<Currency, number>()
    byCurrency.set(b.currency, (byCurrency.get(b.currency) ?? 0) + b.amount)
    budgetByCategoryCurrency.set(b.categoryId, byCurrency)
  })
  const actualByCategoryCurrency = new Map<number, Map<Currency, number>>()
  spendingThisMonth.forEach((e) => {
    const byCurrency = budgetByCategoryCurrency.get(e.categoryId)
    if (!byCurrency || !byCurrency.has(e.currency)) return
    const actualByCurrency = actualByCategoryCurrency.get(e.categoryId) ?? new Map<Currency, number>()
    actualByCurrency.set(e.currency, (actualByCurrency.get(e.currency) ?? 0) + e.amount)
    actualByCategoryCurrency.set(e.categoryId, actualByCurrency)
  })

  let overBudgetCategoryCount = 0
  budgetByCategoryCurrency.forEach((byCurrency, categoryId) => {
    const actualByCurrency = actualByCategoryCurrency.get(categoryId)
    const currencies = Array.from(byCurrency.keys())
    if (currencies.length === 1) {
      let over = false
      byCurrency.forEach((budgetAmount, currency) => {
        const actual = actualByCurrency?.get(currency) ?? 0
        if (budgetAmount > 0 && actual / budgetAmount > 1) over = true
      })
      if (over) overBudgetCategoryCount++
      return
    }
    // Genuinely budgeted in multiple currencies but exchange rates haven't
    // loaded yet — can't compare fairly yet, so don't flag it rather than
    // falling back to judging each currency independently (that's exactly
    // the false positive this whole check exists to avoid).
    if (!fx) return
    // Whichever of this category's own currencies actually had the larger
    // planned amount once converted (not raw digits).
    const refCurrency = currencies.reduce((best, cur) =>
      convertFiat(byCurrency.get(cur) ?? 0, cur, 'USD', fx) > convertFiat(byCurrency.get(best) ?? 0, best, 'USD', fx) ? cur : best,
    )
    let totalBudget = 0
    let totalActual = 0
    byCurrency.forEach((budgetAmount, currency) => {
      totalBudget += currency === refCurrency ? budgetAmount : convertFiat(budgetAmount, currency, refCurrency, fx)
    })
    actualByCurrency?.forEach((actualAmount, currency) => {
      totalActual += currency === refCurrency ? actualAmount : convertFiat(actualAmount, currency, refCurrency, fx)
    })
    if (totalBudget > 0 && totalActual / totalBudget > 1) overBudgetCategoryCount++
  })
  const budgetedCategoryCount = budgetByCategoryCurrency.size

  if (budgetedCategoryCount > 0 && overBudgetCategoryCount / budgetedCategoryCount >= 0.5) {
    level = 'red'
  }

  return { level, overBudgetCategoryCount, budgetedCategoryCount }
}

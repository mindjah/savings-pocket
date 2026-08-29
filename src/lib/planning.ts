import type { CategoryBudget, Currency, PlannedExpense, RecurringExpense, SpendingEntry } from '../db/types'

// Active recurring expenses whose next occurrence falls within the given
// month (yyyy-mm prefix) — the "fixed expenses" for that month. Computed on
// the fly, never duplicated into their own table.
export function fixedExpensesForMonth(recurring: RecurringExpense[], monthPrefix: string): RecurringExpense[] {
  return recurring.filter((r) => r.active && r.nextDate.startsWith(monthPrefix))
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

// A category only counts against the budget total once it has a budget set
// for it — spending in an un-budgeted category doesn't affect the status.
// Status compares "fraction of budget already spent" against "fraction of
// the month already elapsed": spending noticeably faster than the calendar
// is moving is the yellow warning sign, before it tips over into red.
export function computeBudgetStatus(
  budgets: CategoryBudget[],
  spendingThisMonth: SpendingEntry[],
  dayOfMonth: number,
  daysInMonth: number,
): BudgetStatusLevel | null {
  if (budgets.length === 0) return null

  const totalsByCurrency = new Map<Currency, { budget: number; actual: number }>()
  const ensure = (c: Currency) => totalsByCurrency.get(c) ?? totalsByCurrency.set(c, { budget: 0, actual: 0 }).get(c)!
  const budgetedKeys = new Set(budgets.map((b) => `${b.categoryId}:${b.currency}`))
  budgets.forEach((b) => {
    ensure(b.currency).budget += b.amount
  })
  spendingThisMonth.forEach((e) => {
    if (!budgetedKeys.has(`${e.categoryId}:${e.currency}`)) return
    ensure(e.currency).actual += e.amount
  })

  const elapsedFraction = dayOfMonth / daysInMonth
  let worst: BudgetStatusLevel = 'green'
  for (const { budget, actual } of totalsByCurrency.values()) {
    if (budget <= 0) continue
    const usedFraction = actual / budget
    if (usedFraction > 1) return 'red'
    if (usedFraction > elapsedFraction + 0.15) worst = 'yellow'
  }
  return worst
}

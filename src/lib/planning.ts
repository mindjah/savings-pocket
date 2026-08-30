import type { CategoryBudget, Currency, PlannedExpense, RecurringExpense, SpendingEntry } from '../db/types'

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
  // True when the overall total-budget level isn't red, but at least one
  // individually-budgeted category is already over its own amount.
  someCategoryOverBudget: boolean
}

// The headline status compares ALL real spending this month (every category,
// budgeted or not) against the per-currency total budget cap — that's the
// number the user actually can't go over. `someCategoryOverBudget` is a
// secondary signal surfaced alongside it: even while under the total, an
// individual category can already have blown past its own line item.
export function computeBudgetStatus(
  budgets: CategoryBudget[],
  totalBudgets: Partial<Record<Currency, number>>,
  spendingThisMonth: SpendingEntry[],
  dayOfMonth: number,
  daysInMonth: number,
): BudgetStatusResult | null {
  const totalEntries = Object.entries(totalBudgets).filter(([, amount]) => (amount ?? 0) > 0) as [Currency, number][]
  if (totalEntries.length === 0) return null

  const elapsedFraction = dayOfMonth / daysInMonth

  const actualAllByCurrency = new Map<Currency, number>()
  spendingThisMonth.forEach((e) => {
    actualAllByCurrency.set(e.currency, (actualAllByCurrency.get(e.currency) ?? 0) + e.amount)
  })
  let level: BudgetStatusLevel = 'green'
  for (const [currency, budgetAmount] of totalEntries) {
    const lvl = categoryPaceLevel(actualAllByCurrency.get(currency) ?? 0, budgetAmount, elapsedFraction)
    if (lvl === 'red') {
      level = 'red'
      break
    }
    if (lvl === 'yellow') level = 'yellow'
  }

  const categoryBudgetByKey = new Map<string, number>()
  budgets.forEach((b) => {
    const key = `${b.categoryId}:${b.currency}`
    categoryBudgetByKey.set(key, (categoryBudgetByKey.get(key) ?? 0) + b.amount)
  })
  const categoryActualByKey = new Map<string, number>()
  spendingThisMonth.forEach((e) => {
    const key = `${e.categoryId}:${e.currency}`
    if (!categoryBudgetByKey.has(key)) return
    categoryActualByKey.set(key, (categoryActualByKey.get(key) ?? 0) + e.amount)
  })
  let someCategoryOverBudget = false
  for (const [key, budgetAmount] of categoryBudgetByKey) {
    if (budgetAmount > 0 && (categoryActualByKey.get(key) ?? 0) / budgetAmount > 1) {
      someCategoryOverBudget = true
      break
    }
  }

  return { level, someCategoryOverBudget }
}

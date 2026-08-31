export type Currency = 'EUR' | 'USD' | 'RUB' | 'JPY' | 'CNY'
export type MoneyType = 'cash' | 'card'
export type PocketKind = 'pocket' | 'credit'
export type PocketPurpose = 'savings' | 'spending'

export interface SavingsEntry {
  id?: number
  currency: Currency
  type: MoneyType
  location: string
  amount: number
  note: string
  createdAt: string
  updatedAt: string
  kind: PocketKind
  // Only meaningful for kind: 'pocket' — credits are excluded from net worth
  // by default and don't need a savings/spending split.
  purpose?: PocketPurpose
}

export interface SavingsHistory {
  id?: number
  entryId: number
  previousAmount: number
  newAmount: number
  date: string
  comment: string
  source: 'manual' | 'spending'
  spendingEntryId?: number
  // Set once the spending entry that caused this debit gets deleted — the
  // pocket balance is corrected (see reverseAutoDebit), but the record stays
  // so the history keeps a full trail rather than making the deletion
  // invisible. Shown struck through rather than removed from the list.
  reversed?: boolean
}

export interface CryptoEntry {
  id?: number
  coinId: string
  symbol: string
  name: string
  amount: number
  note: string
  createdAt: string
  updatedAt: string
  // USD price captured at creation or the last amount edit — the trend arrow compares
  // the live price against this baseline, not against the previous rate refresh.
  baselinePriceUsd?: number
  baselineSetAt?: string
  pinned?: boolean
}

export interface CryptoHistory {
  id?: number
  entryId: number
  previousAmount: number
  newAmount: number
  date: string
  comment: string
}

export interface LoanEntry {
  id?: number
  borrowerName: string
  currency: Currency
  amount: number
  note: string
  createdAt: string
  updatedAt: string
}

export interface LoanHistory {
  id?: number
  entryId: number
  previousAmount: number
  newAmount: number
  date: string
  comment: string
}

export interface Category {
  id?: number
  name: string
  color: string
  archived: boolean
  createdAt: string
}

export interface SpendingEntry {
  id?: number
  categoryId: number
  date: string // yyyy-mm-dd
  amount: number
  currency: Currency
  note: string
  createdAt: string
  debitedFromPocketId?: number
  recurringExpenseId?: number
}

export type RecurrenceType = 'monthly' | 'annually' | 'custom'

export interface RecurringExpense {
  id?: number
  categoryId: number
  amount: number
  currency: Currency
  note: string
  recurrenceType: RecurrenceType
  intervalDays?: number // only meaningful when recurrenceType === 'custom'
  nextDate: string // yyyy-mm-dd — next date an occurrence should be generated
  active: boolean
  debitedFromPocketId?: number
  createdAt: string
}

// Planning sandbox — forward-looking "can I afford this" scratchpads, fully
// decoupled from real pocket balances and the spending calendar. Never
// written to by anything except the planning screens themselves. Multiple
// named plans can exist; each owns its own income/expense line items.
export interface Plan {
  id?: number
  name: string
  createdAt: string
  updatedAt: string
  // yyyy-mm — which real calendar month this plan's fixed expenses and
  // "actual so far" figures are compared against. Optional since plans
  // created before this field existed don't have it; treat missing as
  // defaulting to the current real month.
  appliesMonth?: string
}

export interface PlannedIncome {
  id?: number
  planId: number
  source: string
  amount: number
  currency: Currency
  createdAt: string
}

export interface PlannedExpense {
  id?: number
  planId: number
  categoryId: number
  amount: number
  currency: Currency
  note: string
  createdAt: string
}

// A standing monthly spending target per category, scoped to one specific
// calendar month (so past months' budgets stay around for comparison —
// e.g. future analytics — rather than being overwritten). Multiple entries
// per category are allowed (e.g. a couple of line items that together make
// up that category's budget) — same shape as planned expenses. Purely a
// tracking/comparison layer: never written to spendingEntries,
// savingsEntries, or the calendar.
export interface CategoryBudget {
  id?: number
  categoryId: number
  amount: number
  currency: Currency
  note: string
  month: string // yyyy-mm
  createdAt: string
  updatedAt: string
}

// One total-budget cap per currency, scoped to one specific calendar month —
// the month-scoped counterpart of CategoryBudget above.
export interface TotalBudget {
  id?: number
  month: string // yyyy-mm
  currency: Currency
  amount: number
  createdAt: string
  updatedAt: string
}

export type SavingsTrackingMode = 'manual' | 'auto'

export type Language = 'en' | 'ru'

export interface MetaRecord {
  key: string
  value: unknown
}

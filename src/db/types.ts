export type Currency = 'EUR' | 'USD' | 'RUB' | 'JPY' | 'CNY'
export type MoneyType = 'cash' | 'card'

export interface SavingsEntry {
  id?: number
  currency: Currency
  type: MoneyType
  location: string
  amount: number
  note: string
  createdAt: string
  updatedAt: string
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

export type SavingsTrackingMode = 'manual' | 'auto'

export type Language = 'en' | 'ru'

export interface MetaRecord {
  key: string
  value: unknown
}

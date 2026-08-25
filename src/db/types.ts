export type Currency = 'EUR' | 'USD' | 'RUB'
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
}

export interface CryptoHistory {
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
  note: string
  createdAt: string
}

export interface MetaRecord {
  key: string
  value: unknown
}

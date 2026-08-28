import Dexie, { type Table } from 'dexie'
import type {
  Category,
  CryptoEntry,
  CryptoHistory,
  LoanEntry,
  LoanHistory,
  MetaRecord,
  RecurringExpense,
  SavingsEntry,
  SavingsHistory,
  SpendingEntry,
} from './types'

class AppDB extends Dexie {
  savingsEntries!: Table<SavingsEntry, number>
  savingsHistory!: Table<SavingsHistory, number>
  cryptoEntries!: Table<CryptoEntry, number>
  cryptoHistory!: Table<CryptoHistory, number>
  loanEntries!: Table<LoanEntry, number>
  loanHistory!: Table<LoanHistory, number>
  categories!: Table<Category, number>
  spendingEntries!: Table<SpendingEntry, number>
  recurringExpenses!: Table<RecurringExpense, number>
  meta!: Table<MetaRecord, string>

  constructor() {
    super('savings-pocket')
    this.version(1).stores({
      savingsEntries: '++id, currency, type, location',
      savingsHistory: '++id, entryId, date',
      cryptoEntries: '++id, coinId',
      cryptoHistory: '++id, entryId, date',
      categories: '++id, archived',
      spendingEntries: '++id, categoryId, date',
      meta: 'key',
    })

    this.version(2)
      .stores({
        loanEntries: '++id, currency, borrowerName',
        loanHistory: '++id, entryId, date',
      })
      .upgrade(async (tx) => {
        // Toncoin's CoinGecko id was never "toncoin" (that id resolves to nothing) —
        // fix any holdings added under the wrong id, and pick up its GRAM rebrand.
        await tx
          .table('cryptoEntries')
          .where('coinId')
          .equals('toncoin')
          .modify({ coinId: 'the-open-network', symbol: 'GRAM', name: 'Gram' })
        // Spending entries predate per-entry currency — default them to EUR.
        await tx
          .table('spendingEntries')
          .toCollection()
          .modify((entry) => {
            if (!entry.currency) entry.currency = 'EUR'
          })
      })

    this.version(3)
      .stores({
        savingsHistory: '++id, entryId, date, spendingEntryId',
      })
      .upgrade(async (tx) => {
        // History predates the manual/auto-spending split — everything so far was manual.
        await tx
          .table('savingsHistory')
          .toCollection()
          .modify((h) => {
            if (!h.source) h.source = 'manual'
          })
      })

    this.version(4).stores({
      recurringExpenses: '++id, nextDate',
    })

    this.version(5)
      .stores({
        savingsEntries: '++id, currency, type, location, kind',
      })
      .upgrade(async (tx) => {
        // Predates Credits and the savings/spending purpose split — everything
        // so far is a regular savings pocket.
        await tx
          .table('savingsEntries')
          .toCollection()
          .modify((entry) => {
            if (!entry.kind) entry.kind = 'pocket'
            if (!entry.purpose) entry.purpose = 'savings'
          })
      })
  }
}

export const db = new AppDB()

export const BACKUP_TABLES = [
  'savingsEntries',
  'savingsHistory',
  'cryptoEntries',
  'cryptoHistory',
  'loanEntries',
  'loanHistory',
  'categories',
  'spendingEntries',
  'recurringExpenses',
  'meta',
] as const

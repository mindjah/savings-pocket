import Dexie, { type Table } from 'dexie'
import type {
  Category,
  CryptoEntry,
  CryptoHistory,
  MetaRecord,
  SavingsEntry,
  SavingsHistory,
  SpendingEntry,
} from './types'

class AppDB extends Dexie {
  savingsEntries!: Table<SavingsEntry, number>
  savingsHistory!: Table<SavingsHistory, number>
  cryptoEntries!: Table<CryptoEntry, number>
  cryptoHistory!: Table<CryptoHistory, number>
  categories!: Table<Category, number>
  spendingEntries!: Table<SpendingEntry, number>
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
  }
}

export const db = new AppDB()

export const BACKUP_TABLES = [
  'savingsEntries',
  'savingsHistory',
  'cryptoEntries',
  'cryptoHistory',
  'categories',
  'spendingEntries',
  'meta',
] as const

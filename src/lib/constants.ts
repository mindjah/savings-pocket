import type { Currency } from '../db/types'

export const CURRENCIES: { code: Currency; symbol: string; label: string }[] = [
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'RUB', symbol: '₽', label: 'Russian Rouble' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'CNY', symbol: 'CN¥', label: 'Chinese Yuan' },
]

export const DEFAULT_SAVINGS_CURRENCIES: Currency[] = ['EUR', 'USD', 'RUB']
export const DEFAULT_CRYPTO_CURRENCIES: Currency[] = ['EUR', 'USD', 'RUB']
export const DEFAULT_SPENDING_CURRENCIES: Currency[] = ['EUR']

export const POPULAR_COINS: { coinId: string; symbol: string; name: string }[] = [
  { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { coinId: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { coinId: 'tether', symbol: 'USDT', name: 'Tether' },
  { coinId: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  { coinId: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { coinId: 'solana', symbol: 'SOL', name: 'Solana' },
  { coinId: 'ripple', symbol: 'XRP', name: 'XRP' },
  { coinId: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { coinId: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { coinId: 'the-open-network', symbol: 'GRAM', name: 'Gram' },
  { coinId: 'tron', symbol: 'TRX', name: 'Tron' },
  { coinId: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
]

export const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7',
  '#ec4899', '#78716c',
]

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

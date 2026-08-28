import type { Currency, Language } from '../db/types'
import { CURRENCIES } from './constants'

export function currencySymbol(code: Currency): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

// Some iOS keyboards (locale-dependent) present a comma as the decimal key on
// a plain text input, and <input type="number"> inconsistently rejects it
// across iOS versions — so amount fields are text inputs and parse through here.
export function parseAmount(raw: string): number {
  return Number(raw.trim().replace(/,/g, '.'))
}

// JPY has no minor unit in everyday use (¥1000, not ¥1000.00).
const NO_DECIMAL_CURRENCIES: Currency[] = ['JPY']

function fiatDecimals(code: Currency): number {
  return NO_DECIMAL_CURRENCIES.includes(code) ? 0 : 2
}

// Rounds a fiat amount to its currency's minor unit (2 decimals, 0 for JPY)
// at the point it's stored or combined with another amount — not just when
// displayed — so repeated arithmetic (auto-debits, balance adjustments)
// can't drift into more than 2 decimal digits of floating-point noise.
// Never apply this to crypto amounts, which keep their full precision.
export function roundFiat(amount: number, code: Currency): number {
  const factor = 10 ** fiatDecimals(code)
  return Math.round(amount * factor) / factor
}

export function formatMoney(amount: number, code: Currency): string {
  if (!Number.isFinite(amount)) return '—'
  const sign = amount < 0 ? '-' : ''
  const decimals = fiatDecimals(code)
  const number = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(amount))
  const symbol = currencySymbol(code)
  // RUB's symbol conventionally trails the amount; the rest lead with theirs.
  return code === 'RUB' ? `${sign}${number} ${symbol}` : `${sign}${symbol}${number}`
}

// Compact form for tight spaces (calendar day cells) — no decimals, K/M suffix for large sums.
export function formatMoneyCompact(amount: number, code: Currency): string {
  const symbol = currencySymbol(code)
  const number = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
  return code === 'RUB' ? `${number}${symbol}` : `${symbol}${number}`
}

export function formatUsdEur(amount: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: amount < 1 ? 4 : 2 }).format(amount)
}

export function formatDate(iso: string, lang: Language = 'en'): string {
  const d = new Date(iso)
  const locale = lang === 'ru' ? 'ru-RU' : 'en-GB'
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string, lang: Language = 'en'): string {
  const d = new Date(iso)
  const locale = lang === 'ru' ? 'ru-RU' : 'en-GB'
  return d.toLocaleString(locale, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function formatTime(iso: string, lang: Language = 'en'): string {
  const d = new Date(iso)
  const locale = lang === 'ru' ? 'ru-RU' : 'en-GB'
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

// Shows just the time for something that happened today, the full date otherwise.
export function formatDateOrTime(iso: string, lang: Language = 'en'): string {
  return isToday(iso) ? formatTime(iso, lang) : formatDate(iso, lang)
}

export function todayIso(): string {
  const d = new Date()
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10)
}

export function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

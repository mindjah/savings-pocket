import type { Currency } from '../db/types'
import { CURRENCIES } from './constants'

export function currencySymbol(code: Currency): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

export function formatMoney(amount: number, code: Currency): string {
  const sign = amount < 0 ? '-' : ''
  const number = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  const symbol = currencySymbol(code)
  // RUB's symbol conventionally trails the amount; EUR/USD lead with theirs.
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

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
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

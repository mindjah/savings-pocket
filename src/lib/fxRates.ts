import { db } from '../db/db'
import type { Currency } from '../db/types'

// Rates are all relative to 1 USD, e.g. rates.EUR = how many EUR per 1 USD.
export type FxRates = Record<Currency, number>

interface CachedFx {
  rates: FxRates
  fetchedAt: string
}

const CACHE_KEY = 'fiatRates'
const MAX_AGE_MS = 60 * 60 * 1000 // fiat pairs move slowly — an hour is plenty fresh

async function readCache(): Promise<CachedFx | null> {
  const rec = await db.meta.get(CACHE_KEY)
  return (rec?.value as CachedFx) ?? null
}

async function writeCache(rates: FxRates): Promise<CachedFx> {
  const cached: CachedFx = { rates, fetchedAt: new Date().toISOString() }
  await db.meta.put({ key: CACHE_KEY, value: cached })
  return cached
}

async function fetchLive(): Promise<FxRates> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD')
  if (!res.ok) throw new Error(`Exchange rate request failed: ${res.status}`)
  const json = await res.json()
  if (json.result !== 'success') throw new Error('Exchange rate provider returned an error')
  return { USD: 1, EUR: json.rates.EUR, RUB: json.rates.RUB }
}

export interface FxResult {
  rates: FxRates | null
  fetchedAt: string | null
  stale: boolean
  error: string | null
}

export async function getFiatRates(): Promise<FxResult> {
  const cached = await readCache()
  const cacheFresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < MAX_AGE_MS

  if (cacheFresh) {
    return { rates: cached!.rates, fetchedAt: cached!.fetchedAt, stale: false, error: null }
  }

  try {
    const live = await fetchLive()
    const saved = await writeCache(live)
    return { rates: saved.rates, fetchedAt: saved.fetchedAt, stale: false, error: null }
  } catch (err) {
    if (cached) {
      return {
        rates: cached.rates,
        fetchedAt: cached.fetchedAt,
        stale: true,
        error: err instanceof Error ? err.message : 'Failed to refresh exchange rates',
      }
    }
    return { rates: null, fetchedAt: null, stale: true, error: err instanceof Error ? err.message : 'Failed to fetch exchange rates' }
  }
}

export function convertFiat(amount: number, from: Currency, to: Currency, rates: FxRates): number {
  if (from === to) return amount
  const amountUsd = amount / rates[from]
  return amountUsd * rates[to]
}

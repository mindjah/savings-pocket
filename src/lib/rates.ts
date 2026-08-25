import { db } from '../db/db'

export interface CoinPrice {
  usd: number
  eur: number
  rub: number
}

export type PriceMap = Record<string, CoinPrice>

interface CachedRates {
  prices: PriceMap
  fetchedAt: string
}

const CACHE_KEY = 'cryptoRates'
const MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes before we consider it worth refreshing

async function readCache(): Promise<CachedRates | null> {
  const rec = await db.meta.get(CACHE_KEY)
  return (rec?.value as CachedRates) ?? null
}

async function writeCache(prices: PriceMap): Promise<CachedRates> {
  const cached: CachedRates = { prices, fetchedAt: new Date().toISOString() }
  await db.meta.put({ key: CACHE_KEY, value: cached })
  return cached
}

async function fetchLive(coinIds: string[]): Promise<PriceMap> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    coinIds.join(','),
  )}&vs_currencies=usd,eur,rub`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko request failed: ${res.status}`)
  return (await res.json()) as PriceMap
}

export interface RatesResult {
  prices: PriceMap
  fetchedAt: string | null
  stale: boolean
  error: string | null
}

/**
 * Fetches live USD/EUR prices for the given CoinGecko coin ids, merging into
 * whatever was already cached (so coins missing from a partial failure keep
 * their last known price) and falling back to cache entirely when offline.
 */
export async function getCryptoPrices(coinIds: string[]): Promise<RatesResult> {
  const cached = await readCache()
  if (coinIds.length === 0) {
    return { prices: cached?.prices ?? {}, fetchedAt: cached?.fetchedAt ?? null, stale: false, error: null }
  }

  const cacheFresh =
    cached &&
    Date.now() - new Date(cached.fetchedAt).getTime() < MAX_AGE_MS &&
    coinIds.every((id) => id in cached.prices)

  if (cacheFresh) {
    return { prices: cached!.prices, fetchedAt: cached!.fetchedAt, stale: false, error: null }
  }

  try {
    const live = await fetchLive(coinIds)
    const merged = { ...(cached?.prices ?? {}), ...live }
    const saved = await writeCache(merged)
    return { prices: saved.prices, fetchedAt: saved.fetchedAt, stale: false, error: null }
  } catch (err) {
    if (cached) {
      return {
        prices: cached.prices,
        fetchedAt: cached.fetchedAt,
        stale: true,
        error: err instanceof Error ? err.message : 'Failed to refresh rates',
      }
    }
    return { prices: {}, fetchedAt: null, stale: true, error: err instanceof Error ? err.message : 'Failed to fetch rates' }
  }
}

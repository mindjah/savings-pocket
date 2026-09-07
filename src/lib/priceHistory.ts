import { db } from '../db/db'

export interface PricePoint {
  t: number
  usd: number
}

interface CachedHistory {
  points: PricePoint[]
  fetchedAt: string
}

// A day-old point in a 30-day history barely moves, so this can be cached
// far longer than the live simple/price cache (see getCryptoPrices) without
// going stale in a way anyone would notice.
const HISTORY_MAX_AGE_MS = 6 * 60 * 60 * 1000

function cacheKey(coinId: string): string {
  return `cryptoHistory30d:${coinId}`
}

async function fetchMarketChart(coinId: string): Promise<PricePoint[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=30&interval=daily`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko market_chart request failed: ${res.status}`)
  const data = (await res.json()) as { prices: [number, number][] }
  return data.prices.map(([t, usd]) => ({ t, usd }))
}

/**
 * Daily USD prices for one coin over the last 30 days, cached per-coin in
 * db.meta (mirrors getCryptoPrices' cache-then-fetch-then-fall-back-to-cache
 * shape) — returns null only when there's neither a fresh fetch nor any
 * previously cached history to fall back to.
 */
export async function getCoinPriceHistory30d(coinId: string, opts: { force?: boolean } = {}): Promise<PricePoint[] | null> {
  const key = cacheKey(coinId)
  const rec = await db.meta.get(key)
  const cached = rec?.value as CachedHistory | undefined
  const fresh = !opts.force && !!cached && Date.now() - new Date(cached.fetchedAt).getTime() < HISTORY_MAX_AGE_MS

  if (fresh) return cached!.points

  try {
    const points = await fetchMarketChart(coinId)
    const saved: CachedHistory = { points, fetchedAt: new Date().toISOString() }
    await db.meta.put({ key, value: saved })
    return points
  } catch {
    return cached?.points ?? null
  }
}

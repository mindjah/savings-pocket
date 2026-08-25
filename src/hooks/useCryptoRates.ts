import { useCallback, useEffect, useRef, useState } from 'react'
import { getCryptoPrices, type PriceMap } from '../lib/rates'

export function useCryptoRates(coinIds: string[]) {
  const [prices, setPrices] = useState<PriceMap>({})
  const [previousPrices, setPreviousPrices] = useState<PriceMap>({})
  const pricesRef = useRef<PriceMap>({})
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const key = coinIds.slice().sort().join(',')

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    if (coinIds.length === 0) return
    setLoading(true)
    const result = await getCryptoPrices(coinIds, opts)
    setPreviousPrices(pricesRef.current)
    setPrices(result.prices)
    pricesRef.current = result.prices
    setFetchedAt(result.fetchedAt)
    setStale(result.stale)
    setError(result.error)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { prices, previousPrices, fetchedAt, loading, stale, error, refresh }
}

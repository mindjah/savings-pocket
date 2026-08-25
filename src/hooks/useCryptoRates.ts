import { useCallback, useEffect, useState } from 'react'
import { getCryptoPrices, type PriceMap } from '../lib/rates'

export function useCryptoRates(coinIds: string[]) {
  const [prices, setPrices] = useState<PriceMap>({})
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const key = coinIds.slice().sort().join(',')

  const refresh = useCallback(async () => {
    if (coinIds.length === 0) return
    setLoading(true)
    const result = await getCryptoPrices(coinIds)
    setPrices(result.prices)
    setFetchedAt(result.fetchedAt)
    setStale(result.stale)
    setError(result.error)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { prices, fetchedAt, loading, stale, error, refresh }
}

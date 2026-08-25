import { useCallback, useEffect, useState } from 'react'
import { getFiatRates, type FxRates } from '../lib/fxRates'

export function useFiatRates() {
  const [rates, setRates] = useState<FxRates | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await getFiatRates()
    setRates(result.rates)
    setFetchedAt(result.fetchedAt)
    setStale(result.stale)
    setError(result.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { rates, fetchedAt, loading, stale, error, refresh }
}

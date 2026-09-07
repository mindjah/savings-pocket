import { useEffect, useState } from 'react'
import { getCoinPriceHistory30d, type PricePoint } from '../lib/priceHistory'

export function useCryptoPriceHistory30d(coinIds: string[]) {
  const [histories, setHistories] = useState<Record<string, PricePoint[]>>({})
  const key = coinIds.slice().sort().join(',')

  useEffect(() => {
    let cancelled = false
    if (coinIds.length === 0) {
      setHistories({})
      return
    }
    Promise.all(coinIds.map(async (id) => [id, await getCoinPriceHistory30d(id)] as const)).then((entries) => {
      if (cancelled) return
      const map: Record<string, PricePoint[]> = {}
      entries.forEach(([id, points]) => {
        if (points) map[id] = points
      })
      setHistories(map)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return histories
}

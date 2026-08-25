import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Currency } from '../db/types'
import { useCryptoRates } from './useCryptoRates'
import { useFiatRates } from './useFiatRates'
import { convertFiat } from '../lib/fxRates'

export function useNetWorth(displayCurrency: Currency) {
  const savings = useLiveQuery(() => db.savingsEntries.toArray(), []) ?? []
  const loans = useLiveQuery(() => db.loanEntries.toArray(), []) ?? []
  const cryptoEntries = useLiveQuery(() => db.cryptoEntries.toArray(), []) ?? []

  const coinIds = useMemo(() => Array.from(new Set(cryptoEntries.map((e) => e.coinId))), [cryptoEntries])
  const { prices, loading: cryptoLoading, stale: cryptoStale } = useCryptoRates(coinIds)
  const { rates: fx, loading: fxLoading, stale: fxStale, error: fxError, fetchedAt } = useFiatRates()

  const breakdown = useMemo(() => {
    if (!fx) return null
    const savingsTotal = savings.reduce(
      (sum, e) => sum + convertFiat(e.amount, e.currency, displayCurrency, fx),
      0,
    )
    const loansTotal = loans.reduce(
      (sum, e) => sum + convertFiat(e.amount, e.currency, displayCurrency, fx),
      0,
    )
    const priceKey = displayCurrency.toLowerCase() as 'usd' | 'eur' | 'rub'
    const cryptoTotal = cryptoEntries.reduce((sum, e) => {
      const price = prices[e.coinId]
      return sum + (price ? e.amount * price[priceKey] : 0)
    }, 0)
    return {
      savingsTotal,
      loansTotal,
      cryptoTotal,
      grandTotal: savingsTotal + loansTotal + cryptoTotal,
    }
  }, [fx, savings, loans, cryptoEntries, prices, displayCurrency])

  return {
    breakdown,
    loading: fxLoading || cryptoLoading,
    stale: fxStale || cryptoStale,
    error: fxError,
    fetchedAt,
  }
}

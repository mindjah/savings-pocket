import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Currency } from '../db/types'
import { useCryptoRates } from './useCryptoRates'
import { useFiatRates } from './useFiatRates'
import { convertFiat } from '../lib/fxRates'
import { priceIn } from '../lib/rates'

export function useNetWorth(displayCurrency: Currency, includeCreditsInNetWorth: boolean) {
  const savings = useLiveQuery(() => db.savingsEntries.toArray(), []) ?? []
  const loans = useLiveQuery(() => db.loanEntries.toArray(), []) ?? []
  const cryptoEntries = useLiveQuery(() => db.cryptoEntries.toArray(), []) ?? []

  const coinIds = useMemo(() => Array.from(new Set(cryptoEntries.map((e) => e.coinId))), [cryptoEntries])
  const { prices, loading: cryptoLoading, stale: cryptoStale } = useCryptoRates(coinIds)
  const { rates: fx, loading: fxLoading, stale: fxStale, error: fxError, fetchedAt } = useFiatRates()

  const breakdown = useMemo(() => {
    if (!fx) return null
    const sumIn = (entries: { amount: number; currency: Currency }[]) =>
      entries.reduce((sum, e) => sum + convertFiat(e.amount, e.currency, displayCurrency, fx), 0)
    const pockets = savings.filter((e) => e.kind !== 'credit')
    const savingsTotal = sumIn(pockets.filter((e) => (e.purpose ?? 'savings') === 'savings'))
    const spendingTotal = sumIn(pockets.filter((e) => e.purpose === 'spending'))
    const creditsTotal = sumIn(savings.filter((e) => e.kind === 'credit'))
    const loansTotal = sumIn(loans)
    const cryptoTotal = cryptoEntries.reduce(
      (sum, e) => sum + e.amount * priceIn(prices[e.coinId], displayCurrency),
      0,
    )
    return {
      savingsTotal,
      spendingTotal,
      creditsTotal,
      loansTotal,
      cryptoTotal,
      grandTotal:
        savingsTotal + spendingTotal + loansTotal + cryptoTotal + (includeCreditsInNetWorth ? creditsTotal : 0),
    }
  }, [fx, savings, loans, cryptoEntries, prices, displayCurrency, includeCreditsInNetWorth])

  return {
    breakdown,
    loading: fxLoading || cryptoLoading,
    stale: fxStale || cryptoStale,
    error: fxError,
    fetchedAt,
  }
}

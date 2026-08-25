import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Currency } from '../../db/types'
import { CURRENCIES, DEFAULT_CRYPTO_CURRENCIES, DEFAULT_SAVINGS_CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useNetWorth } from '../../hooks/useNetWorth'

export function NetWorthCard({ headerAction }: { headerAction?: ReactNode }) {
  const [savingsCurrencies] = useMetaSetting<Currency[]>('enabledSavingsCurrencies', DEFAULT_SAVINGS_CURRENCIES)
  const [cryptoCurrencies] = useMetaSetting<Currency[]>('enabledCryptoCurrencies', DEFAULT_CRYPTO_CURRENCIES)
  const [displayCurrency, setDisplayCurrency] = useMetaSetting<Currency>('netWorthCurrency', 'EUR')

  const options = useMemo(
    () => CURRENCIES.filter((c) => savingsCurrencies.includes(c.code) || cryptoCurrencies.includes(c.code)),
    [savingsCurrencies, cryptoCurrencies],
  )

  // If the saved display currency was disabled in Settings, fall back to the first available one.
  useEffect(() => {
    if (options.length > 0 && !options.some((c) => c.code === displayCurrency)) {
      setDisplayCurrency(options[0].code)
    }
  }, [options, displayCurrency, setDisplayCurrency])

  const { breakdown, loading, stale, error } = useNetWorth(displayCurrency)

  return (
    <div className="card">
      <div className="section-title">
        <h2>Total net worth</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {headerAction}
          <select value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value as Currency)}>
            {options.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!breakdown ? (
        <div className="muted">{loading ? 'Calculating…' : 'Exchange rates unavailable.'}</div>
      ) : (
        <>
          <div className="amount" style={{ fontSize: '1.7rem', marginTop: 4 }}>
            {formatMoney(breakdown.grandTotal, displayCurrency)}
          </div>
          <div className="muted" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span>Savings: {formatMoney(breakdown.savingsTotal, displayCurrency)}</span>
            <span>Crypto: {formatMoney(breakdown.cryptoTotal, displayCurrency)}</span>
            <span>Lent out: {formatMoney(breakdown.loansTotal, displayCurrency)}</span>
          </div>
          {stale && (
            <div className="muted" style={{ marginTop: 8 }}>
              {error ? `Using last known rates — ${error}` : 'Using last known exchange rates (offline).'}
            </div>
          )}
        </>
      )}
    </div>
  )
}

import type { Currency } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useNetWorth } from '../../hooks/useNetWorth'

export function NetWorthCard() {
  const [displayCurrency, setDisplayCurrency] = useMetaSetting<Currency>('netWorthCurrency', 'EUR')
  const { breakdown, loading, stale, error } = useNetWorth(displayCurrency)

  return (
    <div className="card">
      <div className="section-title">
        <h2>Total net worth</h2>
        <select value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value as Currency)}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.symbol} {c.code}
            </option>
          ))}
        </select>
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

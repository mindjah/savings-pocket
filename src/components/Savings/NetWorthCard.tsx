import type { Currency } from '../../db/types'
import { formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useNetWorth } from '../../hooks/useNetWorth'

export function NetWorthCard() {
  const [displayCurrency] = useMetaSetting<Currency>('netWorthCurrency', 'EUR')
  const { breakdown, loading, stale, error } = useNetWorth(displayCurrency)

  return (
    <div className="card">
      <div className="section-title">
        <h2>Total net worth</h2>
        {breakdown && (
          <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>
            {formatMoney(breakdown.grandTotal, displayCurrency)}
          </span>
        )}
      </div>

      {!breakdown ? (
        <div className="muted">{loading ? 'Calculating…' : 'Exchange rates unavailable.'}</div>
      ) : (
        <>
          <div className="muted" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
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

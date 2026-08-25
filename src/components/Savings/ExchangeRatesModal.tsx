import { CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { useFiatRates } from '../../hooks/useFiatRates'
import { Modal } from '../common/Modal'

export function ExchangeRatesModal({ onClose }: { onClose: () => void }) {
  const { rates, fetchedAt, stale, error, loading, refresh } = useFiatRates()

  return (
    <Modal title="Exchange rates" onClose={onClose}>
      <div className="section-title">
        <span className="muted">Currency exchange rates</span>
        <button
          className="btn btn-ghost"
          onClick={() => refresh({ force: true })}
          disabled={loading}
          type="button"
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {!rates ? (
        <div className="muted">{loading ? 'Loading…' : 'Exchange rates unavailable.'}</div>
      ) : (
        <div className="history-list">
          {CURRENCIES.map((c) => (
            <div className="history-item" key={c.code}>
              <div className="entry-top">
                <span>
                  {c.symbol} {c.code}
                </span>
                <strong>1 USD = {formatMoney(rates[c.code], c.code)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
      {fetchedAt && (
        <div className="muted">
          {stale ? 'Using last known rates (offline)' : 'Updated'} {new Date(fetchedAt).toLocaleString()}
          {error ? ` — ${error}` : ''}
        </div>
      )}
    </Modal>
  )
}

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { CryptoEntry } from '../../db/types'
import { useCryptoRates } from '../../hooks/useCryptoRates'
import { formatMoney, formatUsdEur } from '../../lib/format'
import { CryptoEntryForm } from './CryptoEntryForm'
import { HistoryModal } from '../common/HistoryModal'

export function CryptoView() {
  const entries = useLiveQuery(() => db.cryptoEntries.toArray(), [])
  const [editing, setEditing] = useState<CryptoEntry | null | 'new'>(null)
  const [historyFor, setHistoryFor] = useState<CryptoEntry | null>(null)

  const coinIds = useMemo(() => Array.from(new Set((entries ?? []).map((e) => e.coinId))), [entries])
  const { prices, loading, stale, error, refresh, fetchedAt } = useCryptoRates(coinIds)

  const totalUsd = (entries ?? []).reduce((sum, e) => sum + e.amount * (prices[e.coinId]?.usd ?? 0), 0)
  const totalEur = (entries ?? []).reduce((sum, e) => sum + e.amount * (prices[e.coinId]?.eur ?? 0), 0)

  return (
    <div className="view">
      <div className="totals-row">
        <div className="total-chip">
          <div className="muted">Total (USD)</div>
          <div className="amount">{formatMoney(totalUsd, 'USD')}</div>
        </div>
        <div className="total-chip">
          <div className="muted">Total (EUR)</div>
          <div className="amount">{formatMoney(totalEur, 'EUR')}</div>
        </div>
      </div>

      <div className="section-title">
        <h2>Crypto</h2>
        <button className="btn btn-ghost" onClick={() => refresh()} disabled={loading} type="button">
          {loading ? 'Refreshing…' : '↻ Refresh rates'}
        </button>
      </div>

      {fetchedAt && (
        <div className="muted">
          Rates {stale ? '(offline, last known)' : 'updated'} {new Date(fetchedAt).toLocaleTimeString()}
          {error ? ` — ${error}` : ''}
        </div>
      )}

      {!entries || entries.length === 0 ? (
        <div className="empty-state">
          <span className="icon">🪙</span>
          No crypto holdings yet. Tap + to add one.
        </div>
      ) : (
        <div className="entry-list">
          {entries
            .slice()
            .sort((a, b) => a.symbol.localeCompare(b.symbol))
            .map((entry) => {
              const price = prices[entry.coinId]
              return (
                <button className="entry-card" key={entry.id} onClick={() => setEditing(entry)}>
                  <div className="entry-top">
                    <span className="entry-amount">
                      {entry.amount} {entry.symbol}
                    </span>
                    <span className="badge">{entry.name}</span>
                  </div>
                  <div className="entry-sub">
                    {price
                      ? `≈ $${formatUsdEur(entry.amount * price.usd)} · €${formatUsdEur(entry.amount * price.eur)}`
                      : 'Price unavailable'}
                  </div>
                  {entry.note && <div className="entry-note">{entry.note}</div>}
                  <div
                    role="link"
                    tabIndex={0}
                    className="muted"
                    style={{ textDecoration: 'underline', width: 'fit-content' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setHistoryFor(entry)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation()
                        setHistoryFor(entry)
                      }
                    }}
                  >
                    View history
                  </div>
                </button>
              )
            })}
        </div>
      )}

      <button className="fab" aria-label="Add crypto holding" onClick={() => setEditing('new')}>
        +
      </button>

      {editing && <CryptoEntryForm entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      {historyFor?.id != null && (
        <HistoryModal
          table="cryptoHistory"
          entryId={historyFor.id}
          formatAmount={(n) => `${n} ${historyFor.symbol}`}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  )
}

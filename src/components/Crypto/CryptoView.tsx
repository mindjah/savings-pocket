import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { CryptoEntry, Currency } from '../../db/types'
import { useCryptoRates } from '../../hooks/useCryptoRates'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { CURRENCIES, DEFAULT_CRYPTO_CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { priceIn } from '../../lib/rates'
import { CryptoEntryForm } from './CryptoEntryForm'
import { HistoryModal } from '../common/HistoryModal'
import { BitcoinIcon } from '../common/BitcoinIcon'
import { NoteViewModal } from '../common/NoteViewModal'

export function CryptoView() {
  const entries = useLiveQuery(() => db.cryptoEntries.toArray(), [])
  const [editing, setEditing] = useState<CryptoEntry | null | 'new'>(null)
  const [historyFor, setHistoryFor] = useState<CryptoEntry | null>(null)
  const [viewingNote, setViewingNote] = useState<string | null>(null)
  const [cryptoCurrencies] = useMetaSetting<Currency[]>('enabledCryptoCurrencies', DEFAULT_CRYPTO_CURRENCIES)

  const coinIds = useMemo(() => Array.from(new Set((entries ?? []).map((e) => e.coinId))), [entries])
  const { prices, loading, stale, error, refresh, fetchedAt } = useCryptoRates(coinIds)

  // Capture each entry's baseline price the first time a live price arrives after
  // creation, and again after any amount edit (updatedAt moves forward) — the trend
  // arrow compares against this persisted baseline, not the previous rate refresh.
  useEffect(() => {
    if (!entries) return
    for (const entry of entries) {
      const price = prices[entry.coinId]
      if (!price || entry.id == null) continue
      const needsCapture =
        !entry.baselineSetAt || new Date(entry.baselineSetAt).getTime() < new Date(entry.updatedAt).getTime()
      if (needsCapture) {
        db.cryptoEntries.update(entry.id, { baselinePriceUsd: price.usd, baselineSetAt: new Date().toISOString() })
      }
    }
  }, [entries, prices])

  const visibleCurrencies = CURRENCIES.filter((c) => cryptoCurrencies.includes(c.code))
  const totals: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
  entries?.forEach((e) => {
    const price = prices[e.coinId]
    visibleCurrencies.forEach((c) => {
      totals[c.code] += e.amount * priceIn(price, c.code)
    })
  })

  return (
    <div className="view">
      <div className="totals-row">
        {visibleCurrencies.map((c) => (
          <div className="total-chip" key={c.code}>
            <div className="muted">Total ({c.code})</div>
            <div className="amount">{formatMoney(totals[c.code], c.code)}</div>
          </div>
        ))}
      </div>

      <div className="section-title">
        <h2>Crypto</h2>
        <button className="btn btn-ghost" onClick={() => refresh({ force: true })} disabled={loading} type="button">
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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <BitcoinIcon size={32} />
          </div>
          No crypto holdings yet. Tap + to add one.
        </div>
      ) : (
        <div className="entry-list">
          {entries
            .slice()
            .sort((a, b) => a.symbol.localeCompare(b.symbol))
            .map((entry) => {
              const price = prices[entry.coinId]
              const trend =
                price && entry.baselinePriceUsd != null
                  ? price.usd > entry.baselinePriceUsd
                    ? 'up'
                    : price.usd < entry.baselinePriceUsd
                      ? 'down'
                      : null
                  : null
              return (
                <button className="entry-card" key={entry.id} onClick={() => setEditing(entry)}>
                  <div className="entry-top">
                    <span className="entry-amount">
                      {entry.amount} {entry.symbol}
                      {trend === 'up' && (
                        <span className="price-trend price-trend-up" aria-label="Worth up since last edit">
                          {' '}
                          ▲
                        </span>
                      )}
                      {trend === 'down' && (
                        <span className="price-trend price-trend-down" aria-label="Worth down since last edit">
                          {' '}
                          ▼
                        </span>
                      )}
                    </span>
                    <span className="badge">{entry.name}</span>
                  </div>
                  <div className="entry-sub">
                    {price
                      ? `≈ ${visibleCurrencies
                          .map((c) => formatMoney(entry.amount * priceIn(price, c.code), c.code))
                          .join(' · ')}`
                      : 'Price unavailable'}
                  </div>
                  {entry.note && (
                    <span
                      className="note-indicator"
                      title="Has a note"
                      aria-label="Has a note"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingNote(entry.note)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation()
                          setViewingNote(entry.note)
                        }
                      }}
                    >
                      📝
                    </span>
                  )}
                  <div
                    role="link"
                    tabIndex={0}
                    className="pocket-link-text"
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

      {viewingNote != null && <NoteViewModal note={viewingNote} onClose={() => setViewingNote(null)} />}
    </div>
  )
}

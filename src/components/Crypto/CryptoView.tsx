import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useTranslation } from '../../hooks/useTranslation'
import { PinIcon } from '../common/PinIcon'
import { EntryActionMenu } from '../common/EntryActionMenu'

interface Props {
  resetKey: number
}

export function CryptoView({ resetKey }: Props) {
  const { t } = useTranslation()
  const entries = useLiveQuery(() => db.cryptoEntries.toArray(), [])
  const [editing, setEditing] = useState<CryptoEntry | null | 'new'>(null)
  const [historyFor, setHistoryFor] = useState<CryptoEntry | null>(null)
  const [viewingNote, setViewingNote] = useState<string | null>(null)
  const [cryptoCurrencies] = useMetaSetting<Currency[]>('enabledCryptoCurrencies', DEFAULT_CRYPTO_CURRENCIES)

  // resetKey bumps when the user re-taps the already-active Crypto nav tab —
  // close any open popup, skipping the very first render (that's not a re-tap).
  const isFirstResetRef = useRef(true)
  useEffect(() => {
    if (isFirstResetRef.current) {
      isFirstResetRef.current = false
      return
    }
    setEditing(null)
    setHistoryFor(null)
    setViewingNote(null)
  }, [resetKey])

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

  // Pinned holdings float to the top; within each group, biggest $ value first.
  const valueUsd = useMemo(() => {
    const map = new Map<number, number>()
    for (const e of entries ?? []) {
      if (e.id == null) continue
      map.set(e.id, e.amount * priceIn(prices[e.coinId], 'USD'))
    }
    return map
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
    <div className="view boucoup-scope">
      <div className="totals-row">
        {visibleCurrencies.map((c) => (
          <div className="total-chip" key={c.code}>
            <div className="muted">{t('Total')} ({c.code})</div>
            <div className="amount">{formatMoney(totals[c.code], c.code)}</div>
          </div>
        ))}
      </div>

      <div className="section-title">
        <h2>{t('Crypto')}</h2>
        <button className="btn btn-ghost" onClick={() => refresh({ force: true })} disabled={loading} type="button">
          {loading ? t('Refreshing…') : t('↻ Refresh rates')}
        </button>
      </div>

      {fetchedAt && (
        <div className="muted">
          {t('Rates')} {t(stale ? '(offline, last known)' : 'updated')} {new Date(fetchedAt).toLocaleTimeString()}
          {error ? ` — ${error}` : ''}
        </div>
      )}

      {!entries ? null : entries.length === 0 ? (
        <div className="empty-state">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <BitcoinIcon size={32} />
          </div>
          {t('No crypto holdings yet. Tap + to add one.')}
        </div>
      ) : (
        <div className="entry-list">
          {entries
            .slice()
            .sort((a, b) => {
              if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
              return (valueUsd.get(b.id ?? -1) ?? 0) - (valueUsd.get(a.id ?? -1) ?? 0)
            })
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
                <div className="entry-card" key={entry.id}>
                  <div className="entry-top">
                    <span className="entry-top-left">
                      <span className="pocket-type-icon tint-indigo" aria-hidden="true">
                        <i className="fa-solid fa-coins" />
                      </span>
                      <span className="entry-amount">
                        {entry.amount} {entry.symbol}
                        {trend === 'up' && (
                          <span className="price-trend price-trend-up" aria-label={t('Worth up since last edit')}>
                            {' '}
                            ▲
                          </span>
                        )}
                        {trend === 'down' && (
                          <span className="price-trend price-trend-down" aria-label={t('Worth down since last edit')}>
                            {' '}
                            ▼
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="badge">{entry.name}</span>
                  </div>
                  <div className="entry-sub">
                    {price
                      ? `≈ ${visibleCurrencies
                          .map((c) => formatMoney(entry.amount * priceIn(price, c.code), c.code))
                          .join(' · ')}`
                      : t('Price unavailable')}
                  </div>
                  <EntryActionMenu
                    onEdit={() => setEditing(entry)}
                    onViewHistory={() => setHistoryFor(entry)}
                    onSeeNote={entry.note ? () => setViewingNote(entry.note) : undefined}
                  />
                  {entry.pinned && (
                    <span className="entry-pin-badge" aria-label={t('Pinned')} title={t('Pinned')}>
                      <PinIcon size={14} />
                    </span>
                  )}
                </div>
              )
            })}
        </div>
      )}

      <button className="fab" aria-label={t('Add crypto holding')} onClick={() => setEditing('new')}>
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

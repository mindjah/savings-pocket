import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { AssetEntry, CryptoEntry, Currency } from '../../db/types'
import { useCryptoRates } from '../../hooks/useCryptoRates'
import { useCryptoPriceHistory30d } from '../../hooks/useCryptoPriceHistory30d'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { CURRENCIES, DEFAULT_CRYPTO_CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { priceIn } from '../../lib/rates'
import { CryptoEntryForm } from './CryptoEntryForm'
import { AssetEntryForm } from './AssetEntryForm'
import { HistoryModal } from '../common/HistoryModal'
import { BitcoinIcon } from '../common/BitcoinIcon'
import { NoteViewModal } from '../common/NoteViewModal'
import { useTranslation } from '../../hooks/useTranslation'
import { PinIcon } from '../common/PinIcon'
import { EntryActionMenu } from '../common/EntryActionMenu'
import { Sparkline } from '../common/Sparkline'

interface Props {
  resetKey: number
}

type SubTab = 'crypto' | 'assets'

export function InvestView({ resetKey }: Props) {
  const { t } = useTranslation()
  const [subTab, setSubTab] = useState<SubTab>('crypto')
  const entries = useLiveQuery(() => db.cryptoEntries.toArray(), [])
  const assetEntries = useLiveQuery(() => db.assetEntries.toArray(), [])
  const [editing, setEditing] = useState<CryptoEntry | null | 'new'>(null)
  const [editingAsset, setEditingAsset] = useState<AssetEntry | null | 'new'>(null)
  const [historyFor, setHistoryFor] = useState<CryptoEntry | null>(null)
  const [viewingNote, setViewingNote] = useState<string | null>(null)
  const [investCurrencies] = useMetaSetting<Currency[]>('enabledCryptoCurrencies', DEFAULT_CRYPTO_CURRENCIES)

  // resetKey bumps when the user re-taps the already-active Invest nav tab —
  // jump back to Crypto and close any open popup, skipping the very first
  // render (that's not a re-tap).
  const isFirstResetRef = useRef(true)
  useEffect(() => {
    if (isFirstResetRef.current) {
      isFirstResetRef.current = false
      return
    }
    setSubTab('crypto')
    setEditing(null)
    setEditingAsset(null)
    setHistoryFor(null)
    setViewingNote(null)
  }, [resetKey])

  const coinIds = useMemo(() => Array.from(new Set((entries ?? []).map((e) => e.coinId))), [entries])
  const { prices, loading, stale, error, refresh, fetchedAt } = useCryptoRates(coinIds)
  const priceHistories = useCryptoPriceHistory30d(coinIds)

  // Same 30-day portfolio trend as the Dashboard's own Invest card (see
  // InvestSummaryCard) — each held coin's real daily price history weighted
  // by its CURRENT holding amount, today's holdings treated as constant
  // across the window since amount-history isn't tracked day-by-day.
  const portfolioTrend = useMemo(() => {
    if (!entries || entries.length === 0) return null
    const validHistories = Object.fromEntries(Object.entries(priceHistories).filter(([, points]) => points.length > 1))
    const lengths = Object.values(validHistories).map((h) => h.length)
    if (lengths.length === 0) return null
    const minLen = Math.min(...lengths)
    if (minLen < 2) return null

    const values: number[] = []
    for (let i = 0; i < minLen; i++) {
      let total = 0
      for (const e of entries) {
        const hist = validHistories[e.coinId]
        if (!hist) continue
        total += e.amount * hist[hist.length - minLen + i].usd
      }
      values.push(total)
    }
    if (values[0] === 0) return null
    return { values, pct: ((values[values.length - 1] - values[0]) / values[0]) * 100 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, priceHistories])

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

  const visibleCurrencies = CURRENCIES.filter((c) => investCurrencies.includes(c.code))
  const cryptoTotals: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
  entries?.forEach((e) => {
    const price = prices[e.coinId]
    visibleCurrencies.forEach((c) => {
      cryptoTotals[c.code] += e.amount * priceIn(price, c.code)
    })
  })

  const assetTotals: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
  assetEntries?.forEach((e) => {
    assetTotals[e.currency] += e.amount
  })

  const totals = subTab === 'crypto' ? cryptoTotals : assetTotals

  return (
    <div className="view boucoup-scope">
      <div className="segmented">
        <button type="button" className={subTab === 'crypto' ? 'active' : ''} onClick={() => setSubTab('crypto')}>
          {t('Crypto')}
        </button>
        <button type="button" className={subTab === 'assets' ? 'active' : ''} onClick={() => setSubTab('assets')}>
          {t('Assets')}
        </button>
      </div>

      <div className="totals-row">
        {visibleCurrencies.map((c) => (
          <div className="total-chip" key={c.code}>
            <div className="muted">{t('Total')} ({c.code})</div>
            <div className="amount">{formatMoney(totals[c.code], c.code)}</div>
          </div>
        ))}
      </div>

      {subTab === 'crypto' && portfolioTrend && (
        <div className="dashboard-card-trend">
          <Sparkline points={portfolioTrend.values} color={portfolioTrend.pct >= 0 ? 'var(--accent)' : 'var(--danger)'} />
          <span className={`dashboard-trend-badge${portfolioTrend.pct >= 0 ? ' dashboard-trend-up' : ' dashboard-trend-down'}`}>
            {portfolioTrend.pct >= 0 ? '↑' : '↓'} {Math.abs(portfolioTrend.pct).toFixed(1)}% {t('over 30 days')}
          </span>
        </div>
      )}

      {subTab === 'crypto' && (
        <>
          <div className="section-title">
            <button
              className="btn btn-ghost"
              style={{ marginLeft: 'auto' }}
              onClick={() => refresh({ force: true })}
              disabled={loading}
              type="button"
            >
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
        </>
      )}

      {subTab === 'assets' && (
        <>
          {!assetEntries ? null : assetEntries.length === 0 ? (
            <div className="empty-state">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <i className="fa-solid fa-vault" style={{ fontSize: 32 }} />
              </div>
              {t('No assets tracked yet. Tap + to add one.')}
            </div>
          ) : (
            <div className="entry-list">
              {assetEntries
                .slice()
                .sort((a, b) => b.amount - a.amount)
                .map((entry) => (
                  <div className="entry-card" key={entry.id}>
                    <div className="entry-top">
                      <span className="entry-top-left">
                        <span className="pocket-type-icon tint-indigo" aria-hidden="true">
                          <i className="fa-solid fa-vault" />
                        </span>
                        <span className="entry-amount">{formatMoney(entry.amount, entry.currency)}</span>
                      </span>
                      <span className="badge">{entry.name}</span>
                    </div>
                    <EntryActionMenu
                      onEdit={() => setEditingAsset(entry)}
                      onSeeNote={entry.note ? () => setViewingNote(entry.note) : undefined}
                    />
                  </div>
                ))}
            </div>
          )}

          <button className="fab" aria-label={t('Add asset')} onClick={() => setEditingAsset('new')}>
            +
          </button>
        </>
      )}

      {editing && <CryptoEntryForm entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      {editingAsset && (
        <AssetEntryForm
          entry={editingAsset === 'new' ? null : editingAsset}
          defaultCurrency={investCurrencies[0] ?? 'EUR'}
          availableCurrencies={investCurrencies}
          onClose={() => setEditingAsset(null)}
        />
      )}

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

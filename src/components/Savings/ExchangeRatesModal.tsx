import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { useFiatRates } from '../../hooks/useFiatRates'
import { useCryptoRates } from '../../hooks/useCryptoRates'
import { priceIn } from '../../lib/rates'
import { Modal } from '../common/Modal'

export function ExchangeRatesModal({ onClose }: { onClose: () => void }) {
  const { rates, fetchedAt: fxFetchedAt, stale: fxStale, error: fxError, loading: fxLoading, refresh: refreshFx } =
    useFiatRates()

  const cryptoEntries = useLiveQuery(() => db.cryptoEntries.toArray(), []) ?? []
  const coins = useMemo(() => {
    const seen = new Map<string, { coinId: string; symbol: string; name: string }>()
    for (const e of cryptoEntries) seen.set(e.coinId, { coinId: e.coinId, symbol: e.symbol, name: e.name })
    return Array.from(seen.values())
  }, [cryptoEntries])
  const coinIds = useMemo(() => coins.map((c) => c.coinId), [coins])
  const {
    prices,
    fetchedAt: cryptoFetchedAt,
    stale: cryptoStale,
    loading: cryptoLoading,
    refresh: refreshCrypto,
  } = useCryptoRates(coinIds)

  function refreshAll() {
    refreshFx()
    refreshCrypto()
  }

  return (
    <Modal title="Exchange rates" onClose={onClose}>
      <div className="section-title">
        <span className="muted">Fiat currencies</span>
        <button className="btn btn-ghost" onClick={refreshAll} disabled={fxLoading || cryptoLoading} type="button">
          {fxLoading || cryptoLoading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {!rates ? (
        <div className="muted">{fxLoading ? 'Loading…' : 'Exchange rates unavailable.'}</div>
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
      {fxFetchedAt && (
        <div className="muted">
          {fxStale ? 'Using last known rates (offline)' : 'Updated'} {new Date(fxFetchedAt).toLocaleString()}
          {fxError ? ` — ${fxError}` : ''}
        </div>
      )}

      {coins.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 8 }}>
            <span className="muted">Crypto holdings</span>
          </div>
          <div className="history-list">
            {coins.map((coin) => {
              const price = prices[coin.coinId]
              return (
                <div className="history-item" key={coin.coinId}>
                  <div className="entry-top">
                    <span>
                      {coin.symbol} — {coin.name}
                    </span>
                  </div>
                  <div className="muted">
                    {price
                      ? CURRENCIES.map((c) => `${formatMoney(priceIn(price, c.code), c.code)}`).join(' · ')
                      : 'Price unavailable'}
                  </div>
                </div>
              )
            })}
          </div>
          {cryptoFetchedAt && (
            <div className="muted">
              {cryptoStale ? 'Using last known prices (offline)' : 'Updated'}{' '}
              {new Date(cryptoFetchedAt).toLocaleString()}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

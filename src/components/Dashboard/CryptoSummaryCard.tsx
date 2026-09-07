import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { CURRENCIES, DEFAULT_CRYPTO_CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { priceIn } from '../../lib/rates'
import { useCryptoRates } from '../../hooks/useCryptoRates'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useTranslation } from '../../hooks/useTranslation'
import { BitcoinIcon } from '../common/BitcoinIcon'

interface Props {
  onNavigate: () => void
}

// Mirrors CryptoView's own totals and pinned-first/biggest-first sort —
// the reference dashboard's "Invest" card.
export function CryptoSummaryCard({ onNavigate }: Props) {
  const { t } = useTranslation()
  const entries = useLiveQuery(() => db.cryptoEntries.toArray(), [])
  const [cryptoCurrencies] = useMetaSetting<Currency[]>('enabledCryptoCurrencies', DEFAULT_CRYPTO_CURRENCIES)
  const coinIds = useMemo(() => Array.from(new Set((entries ?? []).map((e) => e.coinId))), [entries])
  const { prices } = useCryptoRates(coinIds)

  const visibleCurrencies = CURRENCIES.filter((c) => cryptoCurrencies.includes(c.code))
  const totals = useMemo(() => {
    const t: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
    ;(entries ?? []).forEach((e) => {
      const price = prices[e.coinId]
      visibleCurrencies.forEach((c) => {
        t[c.code] += e.amount * priceIn(price, c.code)
      })
    })
    return t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, prices, cryptoCurrencies])

  const valueUsd = useMemo(() => {
    const map = new Map<number, number>()
    for (const e of entries ?? []) {
      if (e.id == null) continue
      map.set(e.id, e.amount * priceIn(prices[e.coinId], 'USD'))
    }
    return map
  }, [entries, prices])

  const topHoldings = useMemo(
    () =>
      (entries ?? [])
        .slice()
        .sort((a, b) => {
          if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
          return (valueUsd.get(b.id ?? -1) ?? 0) - (valueUsd.get(a.id ?? -1) ?? 0)
        })
        .slice(0, 4),
    [entries, valueUsd],
  )

  return (
    <div className="card dashboard-card">
      <div className="dashboard-card-header">
        <span className="pocket-type-icon tint-indigo" aria-hidden="true">
          <BitcoinIcon size={20} />
        </span>
        <h3>{t('Invest')}</h3>
      </div>

      {entries == null ? null : (
        <div className="dashboard-card-totals">
          {visibleCurrencies.map((c) => (
            <strong key={c.code} className="dashboard-card-total">
              {formatMoney(totals[c.code], c.code)}
            </strong>
          ))}
        </div>
      )}

      {entries != null && (
        <div className="dashboard-card-list">
          {entries.length === 0 ? (
            <div className="muted">{t('No crypto holdings yet. Tap + to add one.')}</div>
          ) : (
            topHoldings.map((e) => (
              <div className="dashboard-card-list-row" key={e.id}>
                <span className="muted">
                  {e.amount} {e.symbol}
                </span>
                <span>{formatMoney(e.amount * priceIn(prices[e.coinId], 'USD'), 'USD')}</span>
              </div>
            ))
          )}
        </div>
      )}

      <button className="btn btn-ghost dashboard-card-link" onClick={onNavigate} type="button">
        {t('Go to Crypto')} →
      </button>
    </div>
  )
}

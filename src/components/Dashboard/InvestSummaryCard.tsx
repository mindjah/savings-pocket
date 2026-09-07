import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { CURRENCIES, DEFAULT_CRYPTO_CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { priceIn } from '../../lib/rates'
import { useCryptoRates } from '../../hooks/useCryptoRates'
import { useCryptoPriceHistory30d } from '../../hooks/useCryptoPriceHistory30d'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useTranslation } from '../../hooks/useTranslation'
import { BitcoinIcon } from '../common/BitcoinIcon'
import { Sparkline } from '../common/Sparkline'

interface Props {
  onNavigate: () => void
}

// Mirrors InvestView's own totals and pinned-first/biggest-first sort — the
// total shown up top is Crypto + Assets combined (see useNetWorth's own
// investTotal), with the two kinds of holding listed separately below,
// split by a divider.
export function InvestSummaryCard({ onNavigate }: Props) {
  const { t } = useTranslation()
  const entries = useLiveQuery(() => db.cryptoEntries.toArray(), [])
  const assetEntries = useLiveQuery(() => db.assetEntries.toArray(), [])
  const [investCurrencies] = useMetaSetting<Currency[]>('enabledCryptoCurrencies', DEFAULT_CRYPTO_CURRENCIES)
  const coinIds = useMemo(() => Array.from(new Set((entries ?? []).map((e) => e.coinId))), [entries])
  const { prices } = useCryptoRates(coinIds)
  const priceHistories = useCryptoPriceHistory30d(coinIds)

  // Combined portfolio value over the last 30 days — each held coin's real
  // daily price history (see priceHistory.ts) weighted by its CURRENT
  // holding amount (30 days of amount-history isn't tracked, so today's
  // holdings are treated as constant across the window, same simplification
  // most portfolio trackers make without full transaction history).
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

  const visibleCurrencies = CURRENCIES.filter((c) => investCurrencies.includes(c.code))

  const cryptoTotals = useMemo(() => {
    const t: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
    ;(entries ?? []).forEach((e) => {
      const price = prices[e.coinId]
      visibleCurrencies.forEach((c) => {
        t[c.code] += e.amount * priceIn(price, c.code)
      })
    })
    return t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, prices, investCurrencies])

  const assetTotals = useMemo(() => {
    const t: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
    ;(assetEntries ?? []).forEach((e) => {
      t[e.currency] += e.amount
    })
    return t
  }, [assetEntries])

  const combinedTotals = useMemo(() => {
    const t: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
    visibleCurrencies.forEach((c) => {
      t[c.code] = cryptoTotals[c.code] + assetTotals[c.code]
    })
    return t
  }, [cryptoTotals, assetTotals, visibleCurrencies])

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

  const topAssets = useMemo(() => (assetEntries ?? []).slice().sort((a, b) => b.amount - a.amount).slice(0, 4), [assetEntries])

  return (
    <div className="card dashboard-card">
      <div className="dashboard-card-header">
        <span className="pocket-type-icon tint-indigo" aria-hidden="true">
          <BitcoinIcon size={20} />
        </span>
        <h3>{t('Invest')}</h3>
      </div>

      <div className="dashboard-card-body">
        {entries == null ? null : (
          <div className="dashboard-card-totals">
            {visibleCurrencies.map((c) => (
              <strong key={c.code} className="dashboard-card-total">
                {formatMoney(combinedTotals[c.code], c.code)}
              </strong>
            ))}
          </div>
        )}

        {portfolioTrend && (
          <div className="dashboard-card-trend dashboard-card-divider">
            <Sparkline points={portfolioTrend.values} color={portfolioTrend.pct >= 0 ? 'var(--accent)' : 'var(--danger)'} />
            <span className={`dashboard-trend-badge${portfolioTrend.pct >= 0 ? ' dashboard-trend-up' : ' dashboard-trend-down'}`}>
              {portfolioTrend.pct >= 0 ? '↑' : '↓'} {Math.abs(portfolioTrend.pct).toFixed(1)}% {t('over 30 days')}
            </span>
          </div>
        )}

        {entries != null && (
          <div className="dashboard-card-list" style={{ marginTop: portfolioTrend ? 14 : undefined }}>
            {entries.length === 0 ? (
              <div className="muted">{t('No crypto holdings yet. Tap + to add one.')}</div>
            ) : (
              topHoldings.map((e) => (
                <div className="dashboard-card-list-row" key={e.id}>
                  <span className="muted dashboard-amount">
                    {e.amount} {e.symbol}
                  </span>
                  <span className="dashboard-amount">{formatMoney(e.amount * priceIn(prices[e.coinId], 'USD'), 'USD')}</span>
                </div>
              ))
            )}
          </div>
        )}

        {assetEntries != null && assetEntries.length > 0 && (
          <div className="dashboard-card-list dashboard-card-divider">
            {topAssets.map((e) => (
              <div className="dashboard-card-list-row" key={e.id}>
                <span className="muted">{e.name}</span>
                <span className="dashboard-amount">{formatMoney(e.amount, e.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-ghost dashboard-card-link" onClick={onNavigate} type="button">
        {t('Go to Invest')} →
      </button>
    </div>
  )
}

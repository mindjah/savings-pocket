import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { CURRENCIES, DEFAULT_SAVINGS_CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { convertFiat } from '../../lib/fxRates'
import { useFiatRates } from '../../hooks/useFiatRates'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useTranslation } from '../../hooks/useTranslation'
import { CardIcon } from '../common/CardIcon'

interface Props {
  onNavigate: () => void
}

// Mirrors SavingsView's own "My money" totals/sort for purpose: 'spending'
// pockets specifically — the reference dashboard's "Balance" card
// (available-to-spend money, as opposed to money set aside in Savings).
export function BalanceSummaryCard({ onNavigate }: Props) {
  const { t } = useTranslation()
  const [savingsCurrencies] = useMetaSetting<Currency[]>('enabledSavingsCurrencies', DEFAULT_SAVINGS_CURRENCIES)
  const { rates: fxRates } = useFiatRates()
  const allEntries = useLiveQuery(() => db.savingsEntries.toArray(), [])

  const pockets = useMemo(
    () => (allEntries ?? []).filter((e) => e.kind !== 'credit' && e.purpose === 'spending'),
    [allEntries],
  )

  const totals = useMemo(() => {
    const t: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
    pockets.forEach((e) => {
      t[e.currency] += e.amount
    })
    return t
  }, [pockets])
  const visibleCurrencies = CURRENCIES.filter((c) => savingsCurrencies.includes(c.code) && totals[c.code] !== 0)

  function comparableValue(entry: { amount: number; currency: Currency }): number {
    return fxRates ? convertFiat(entry.amount, entry.currency, 'USD', fxRates) : entry.amount
  }
  const topPockets = useMemo(
    () => pockets.slice().sort((a, b) => comparableValue(b) - comparableValue(a)).slice(0, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pockets, fxRates],
  )

  return (
    <div className="card dashboard-card">
      <div className="dashboard-card-header">
        <span className="pocket-type-icon tint-orange" aria-hidden="true">
          <CardIcon size={20} />
        </span>
        <h3>{t('Balance')}</h3>
      </div>

      {allEntries == null ? null : visibleCurrencies.length === 0 ? (
        <div className="muted">{formatMoney(0, savingsCurrencies[0] ?? 'EUR')}</div>
      ) : (
        <div className="dashboard-card-totals">
          {visibleCurrencies.map((c) => (
            <strong key={c.code} className="dashboard-card-total">
              {formatMoney(totals[c.code], c.code)}
            </strong>
          ))}
        </div>
      )}

      {allEntries != null && (
        <div className="dashboard-card-list">
          {pockets.length === 0 ? (
            <div className="muted">{t('No savings tracked yet. Tap + to add your first entry.')}</div>
          ) : (
            topPockets.map((p) => (
              <div className="dashboard-card-list-row" key={p.id}>
                <span className="muted">{p.location}</span>
                <span>{formatMoney(p.amount, p.currency)}</span>
              </div>
            ))
          )}
        </div>
      )}

      <button className="btn btn-ghost dashboard-card-link" onClick={onNavigate} type="button">
        {t('Go to Savings')} →
      </button>
    </div>
  )
}

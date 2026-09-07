import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { CURRENCIES, DEFAULT_SAVINGS_CURRENCIES } from '../../lib/constants'
import { formatMoney, pad2, todayIso } from '../../lib/format'
import { convertFiat } from '../../lib/fxRates'
import { useFiatRates } from '../../hooks/useFiatRates'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useTranslation } from '../../hooks/useTranslation'
import { CardIcon } from '../common/CardIcon'

interface Props {
  onNavigate: () => void
}

// Mirrors SavingsView's own "My money" totals/sort for purpose: 'spending'
// pockets, plus its "Credits" total — the reference dashboard's "Balance"
// card (available-to-spend money, as opposed to money set aside in
// Savings). Also shows this month's total-budget gauge (same real numbers
// as Monthly Expenses/Budget status) when the budget feature is on.
export function BalanceSummaryCard({ onNavigate }: Props) {
  const { t } = useTranslation()
  const [savingsCurrencies] = useMetaSetting<Currency[]>('enabledSavingsCurrencies', DEFAULT_SAVINGS_CURRENCIES)
  const [budgetEnabled] = useMetaSetting<boolean>('budgetEnabled', false)
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

  const credits = useMemo(() => (allEntries ?? []).filter((e) => e.kind === 'credit'), [allEntries])

  function comparableValue(entry: { amount: number; currency: Currency }): number {
    return fxRates ? convertFiat(entry.amount, entry.currency, 'USD', fxRates) : entry.amount
  }
  const topPockets = useMemo(
    () => pockets.slice().sort((a, b) => comparableValue(b) - comparableValue(a)).slice(0, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pockets, fxRates],
  )
  const topCredits = useMemo(
    () => credits.slice().sort((a, b) => comparableValue(b) - comparableValue(a)).slice(0, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [credits, fxRates],
  )

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  const spendingEntriesRaw = useLiveQuery(() => db.spendingEntries.where('date').startsWith(monthPrefix).toArray(), [monthPrefix])
  const spentTotals = useMemo(() => {
    const t: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
    ;(spendingEntriesRaw ?? [])
      .filter((e) => e.date <= todayIso())
      .forEach((e) => {
        t[e.currency] += e.amount
      })
    return t
  }, [spendingEntriesRaw])
  const totalBudgetRows = useLiveQuery(() => db.totalBudgets.where('month').equals(monthPrefix).toArray(), [monthPrefix]) ?? []
  const visibleBudgetCurrencies = totalBudgetRows.filter((r) => r.amount > 0)

  return (
    <div className="card dashboard-card">
      <div className="dashboard-card-header">
        <span className="pocket-type-icon tint-orange" aria-hidden="true">
          <CardIcon size={20} />
        </span>
        <h3>{t('Balance')}</h3>
      </div>

      <div className="dashboard-card-body">
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

        {budgetEnabled && visibleBudgetCurrencies.length > 0 && (
          <div className="dashboard-budget-gauge">
            <div className="muted dashboard-budget-gauge-label">{t('Available until end of month')}</div>
            {visibleBudgetCurrencies.map((row) => {
              const spent = spentTotals[row.currency] ?? 0
              const available = row.amount - spent
              const pct = row.amount > 0 ? Math.min(100, Math.max(0, (spent / row.amount) * 100)) : 0
              return (
                <div key={row.currency} className="dashboard-budget-gauge-row">
                  <strong className="dashboard-card-total">{formatMoney(available, row.currency)}</strong>
                  <div className="dashboard-gauge-track">
                    <div className="dashboard-gauge-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="dashboard-budget-gauge-footer muted">
                    <span>
                      {t('From budget')} {formatMoney(row.amount, row.currency)}
                    </span>
                    <span>{formatMoney(spent, row.currency)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {allEntries != null && (
          <div className={`dashboard-card-list${budgetEnabled && visibleBudgetCurrencies.length > 0 ? ' dashboard-card-divider' : ''}`}>
            {pockets.length === 0 ? (
              <div className="muted">{t('No savings tracked yet. Tap + to add your first entry.')}</div>
            ) : (
              topPockets.map((p) => (
                <div className="dashboard-card-list-row" key={p.id}>
                  <span className="muted">
                    {p.location} {t(p.type === 'cash' ? 'Cash' : 'Card')}
                  </span>
                  <span className="dashboard-amount">{formatMoney(p.amount, p.currency)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {topCredits.length > 0 && (
          <div className="dashboard-card-list dashboard-card-divider">
            {topCredits.map((entry) => (
              <div className="dashboard-card-list-row" key={entry.id}>
                <span className="muted">
                  {entry.location} {t(entry.type === 'cash' ? 'Cash' : 'Card')}
                </span>
                <span className="dashboard-amount">{formatMoney(entry.amount, entry.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-ghost dashboard-card-link" onClick={onNavigate} type="button">
        {t('Go to Savings')} →
      </button>
    </div>
  )
}

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { CURRENCIES, DEFAULT_SPENDING_CURRENCIES } from '../../lib/constants'
import { formatMoney, pad2, todayIso } from '../../lib/format'
import { useFiatRates } from '../../hooks/useFiatRates'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useTranslation } from '../../hooks/useTranslation'
import { budgetCardLevel, computeBudgetStatus } from '../../lib/planning'
import { tBudgetStatusExplanation, tLimitsExceededInCategories } from '../../i18n/translations'
import { BudgetIcon } from '../common/BudgetIcon'

interface Props {
  onNavigate: () => void
}

// Mirrors SpendingView's own "Total spent" totals and headline budget
// status (computeBudgetStatus/budgetCardLevel) for the REAL current month
// only — the reference dashboard's "Monthly Expenses" card. Reuses the
// same .budget-summary-card/.budget-level-* treatment Analytics' own
// budget card already uses (src/index.css), so a red/yellow/orange month
// reads the same way here as it does there.
export function SpendingSummaryCard({ onNavigate }: Props) {
  const { t, lang } = useTranslation()
  const [spendingCurrencies] = useMetaSetting<Currency[]>('enabledSpendingCurrencies', DEFAULT_SPENDING_CURRENCIES)
  const [budgetEnabled] = useMetaSetting<boolean>('budgetEnabled', false)

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  const entriesRaw = useLiveQuery(() => db.spendingEntries.where('date').startsWith(monthPrefix).toArray(), [monthPrefix])
  const entries = useMemo(() => (entriesRaw ?? []).filter((e) => e.date <= todayIso()), [entriesRaw])

  const visibleCurrencies = CURRENCIES.filter((c) => spendingCurrencies.includes(c.code))
  const spentTotals = useMemo(() => {
    const t: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
    entries.forEach((e) => {
      t[e.currency] += e.amount
    })
    return t
  }, [entries])

  const categoryBudgets = useLiveQuery(() => db.categoryBudgets.where('month').equals(monthPrefix).toArray(), [monthPrefix]) ?? []
  const totalBudgetRows = useLiveQuery(() => db.totalBudgets.where('month').equals(monthPrefix).toArray(), [monthPrefix]) ?? []
  const totalBudgetLimit = useMemo(() => {
    const result: Partial<Record<Currency, number>> = {}
    totalBudgetRows.forEach((r) => {
      result[r.currency] = r.amount
    })
    return result
  }, [totalBudgetRows])
  const { rates: fx } = useFiatRates()

  const budgetStatus = useMemo(
    () => (budgetEnabled ? computeBudgetStatus(categoryBudgets, totalBudgetLimit, entries, now.getDate(), daysInMonth(now), fx) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budgetEnabled, categoryBudgets, totalBudgetLimit, entries, fx],
  )
  const level = budgetStatus ? budgetCardLevel(budgetStatus) : null

  return (
    <button
      className={`card dashboard-card budget-summary-card${level ? ` budget-level-${level}` : ''}`}
      type="button"
      onClick={onNavigate}
    >
      <div className="dashboard-card-header">
        <span className="pocket-type-icon tint-orange" aria-hidden="true">
          <BudgetIcon size={20} />
        </span>
        <h3>{t('Monthly Expenses')}</h3>
      </div>

      <div className="dashboard-card-body">
        {entriesRaw == null ? null : (
          <div className="dashboard-card-totals">
            {visibleCurrencies.map((c) => (
              <strong key={c.code} className="dashboard-card-total">
                {formatMoney(spentTotals[c.code], c.code)}
              </strong>
            ))}
          </div>
        )}

        {level && budgetStatus && (
          <div className="muted" style={{ marginTop: 6 }}>
            {level === 'orange'
              ? tLimitsExceededInCategories(lang, budgetStatus.overBudgetCategoryCount)
              : tBudgetStatusExplanation(lang, level, budgetStatus.overBudgetCategoryCount)}
          </div>
        )}
      </div>

      <div className="dashboard-card-link" style={{ marginTop: 12, textAlign: 'left', color: 'var(--accent)' }}>
        {t('Go to Spending')} →
      </div>
    </button>
  )
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

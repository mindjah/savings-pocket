import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useTranslation } from '../../hooks/useTranslation'
import { BudgetIcon } from '../common/BudgetIcon'
import { BudgetStatusBody } from '../Spending/BudgetStatusModal'

interface Props {
  onNavigate: () => void
}

// Embeds the exact same donuts/explanation/category list SpendingView's own
// status button opens as a bottom sheet (BudgetStatusBody, extracted from
// BudgetStatusModal the same way AnalyticsModal already splits into
// AnalyticsBody) — not just a number, the actual visualization. Hidden
// entirely when the Settings > budget feature itself is off, same as it
// already is everywhere else that budget status appears.
export function BudgetStatusDashboardCard({ onNavigate }: Props) {
  const { t } = useTranslation()
  const [budgetEnabled] = useMetaSetting<boolean>('budgetEnabled', false)
  if (!budgetEnabled) return null

  return (
    <div className="card dashboard-card">
      <div className="dashboard-card-header">
        <span className="pocket-type-icon tint-orange" aria-hidden="true">
          <BudgetIcon size={20} />
        </span>
        <h3>{t('Budget status')}</h3>
      </div>
      <BudgetStatusBody />
      <button className="btn btn-ghost dashboard-card-link" onClick={onNavigate} type="button">
        {t('Go to Spending')} →
      </button>
    </div>
  )
}

import { useTranslation } from '../../hooks/useTranslation'
import { AnalyticsIcon } from '../common/AnalyticsIcon'
import { AnalyticsBody } from '../Spending/AnalyticsModal'

interface Props {
  onNavigate: () => void
}

// Embeds the full Compare/Year/Habits tabs (AnalyticsBody, exported from
// AnalyticsModal — the same split BudgetStatusModal now also uses) directly
// on the Dashboard, charts included, not just a link out to Analytics.
export function AnalyticsDashboardCard({ onNavigate }: Props) {
  const { t } = useTranslation()

  return (
    <div className="card dashboard-card dashboard-card-wide">
      <div className="dashboard-card-header">
        <span className="pocket-type-icon tint-indigo" aria-hidden="true">
          <AnalyticsIcon size={20} />
        </span>
        <h3>{t('Analytics')}</h3>
      </div>
      <AnalyticsBody />
      <button className="btn btn-ghost dashboard-card-link" onClick={onNavigate} type="button">
        {t('Go to Analytics')} →
      </button>
    </div>
  )
}

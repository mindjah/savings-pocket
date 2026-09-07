import { useState } from 'react'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { useTranslation } from '../../hooks/useTranslation'
import { BudgetIcon } from '../common/BudgetIcon'
import { BudgetStatusBody, BudgetStatusModal } from '../Spending/BudgetStatusModal'

// Embeds a trimmed BudgetStatusBody — the "Spent X of X" headline, the
// donuts, and the status text, but no category breakdown (compact) — so
// this card never needs to scroll, on mobile or desktop. Only desktop's
// own 2x2 cell has room to spare for bigger donuts (largeDonuts); mobile's
// stay the same size as the real Budget status view, like everywhere else
// on mobile. The button opens the real, full BudgetStatusModal (donuts +
// full category list) rather than navigating away to the Spending tab.
// Hidden entirely when the Settings > budget feature itself is off, same
// as it already is everywhere else budget status appears.
export function BudgetStatusDashboardCard() {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()
  const [budgetEnabled] = useMetaSetting<boolean>('budgetEnabled', false)
  const [showFull, setShowFull] = useState(false)
  if (!budgetEnabled) return null

  return (
    <div className="card dashboard-card">
      <div className="dashboard-card-header">
        <span className="pocket-type-icon tint-orange" aria-hidden="true">
          <BudgetIcon size={20} />
        </span>
        <h3>{t('Budget status')}</h3>
      </div>
      <div className="dashboard-card-body no-scroll">
        <BudgetStatusBody compact largeDonuts={isDesktop} />
      </div>
      <button className="btn btn-ghost dashboard-card-link" onClick={() => setShowFull(true)} type="button">
        {t('View details')} →
      </button>
      {showFull && <BudgetStatusModal onClose={() => setShowFull(false)} />}
    </div>
  )
}

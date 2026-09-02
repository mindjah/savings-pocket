import { Modal } from '../common/Modal'
import { useTranslation } from '../../hooks/useTranslation'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { CategoriesIcon } from '../common/CategoriesIcon'
import { RecurringIcon } from '../common/RecurringIcon'
import { SandboxIcon } from '../common/SandboxIcon'
import { BudgetIcon } from '../common/BudgetIcon'
import { AnalyticsIcon } from '../common/AnalyticsIcon'

interface Props {
  onClose: () => void
  onCategories: () => void
  onRecurring: () => void
  onAnalytics: () => void
  onPlanning: () => void
  onBudget: () => void
}

export function ManageMenuModal({ onClose, onCategories, onRecurring, onAnalytics, onPlanning, onBudget }: Props) {
  const { t } = useTranslation()
  // Planning sandbox, Manage budget and Analytics moved to their own
  // sidebar tabs on desktop (see NavBar) — keeping them here too would just
  // be a second, redundant way to reach the exact same full page. Mobile
  // has no sidebar for them, so this stays their only entry point there.
  const isDesktop = useIsDesktop()
  return (
    <Modal title={t('Manage')} onClose={onClose}>
      <div className="category-list">
        <button className="menu-row" type="button" onClick={onCategories}>
          <CategoriesIcon size={18} />
          <span style={{ flex: 1 }}>{t('Manage Categories')}</span>
          <span className="muted">›</span>
        </button>
        <button className="menu-row" type="button" onClick={onRecurring}>
          <RecurringIcon size={18} />
          <span style={{ flex: 1 }}>{t('Manage Recurring Expenses')}</span>
          <span className="muted">›</span>
        </button>
        {!isDesktop && (
          <>
            <button className="menu-row" type="button" onClick={onPlanning}>
              <SandboxIcon size={18} />
              <span style={{ flex: 1 }}>{t('Planning sandbox')}</span>
              <span className="muted">›</span>
            </button>
            <button className="menu-row" type="button" onClick={onBudget}>
              <BudgetIcon size={18} />
              <span style={{ flex: 1 }}>{t('Manage budget')}</span>
              <span className="muted">›</span>
            </button>
            <button className="menu-row" type="button" onClick={onAnalytics}>
              <AnalyticsIcon size={18} />
              <span style={{ flex: 1 }}>{t('Analytics')}</span>
              <span className="muted">›</span>
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

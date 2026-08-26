import { Modal } from '../common/Modal'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  onClose: () => void
  onCategories: () => void
  onRecurring: () => void
  onAnalytics: () => void
}

export function ManageMenuModal({ onClose, onCategories, onRecurring, onAnalytics }: Props) {
  const { t } = useTranslation()
  return (
    <Modal title={t('Manage')} onClose={onClose}>
      <div className="category-list">
        <button className="menu-row" type="button" onClick={onCategories}>
          <span style={{ flex: 1 }}>{t('Manage Categories')}</span>
          <span className="muted">›</span>
        </button>
        <button className="menu-row" type="button" onClick={onRecurring}>
          <span style={{ flex: 1 }}>{t('Manage Recurring Expenses')}</span>
          <span className="muted">›</span>
        </button>
        <button className="menu-row" type="button" onClick={onAnalytics}>
          <span style={{ flex: 1 }}>{t('Analytics')}</span>
          <span className="muted">›</span>
        </button>
      </div>
    </Modal>
  )
}

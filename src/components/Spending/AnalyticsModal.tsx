import { Modal } from '../common/Modal'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  onClose: () => void
}

export function AnalyticsModal({ onClose }: Props) {
  const { t } = useTranslation()
  return (
    <Modal title={t('Analytics')} onClose={onClose}>
      <div className="empty-state">
        <span className="icon">📊</span>
        {t('Analytics is in progress — check back soon.')}
      </div>
    </Modal>
  )
}

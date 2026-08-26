import { Modal } from '../common/Modal'

interface Props {
  onClose: () => void
}

export function AnalyticsModal({ onClose }: Props) {
  return (
    <Modal title="Analytics" onClose={onClose}>
      <div className="empty-state">
        <span className="icon">📊</span>
        Analytics is in progress — check back soon.
      </div>
    </Modal>
  )
}

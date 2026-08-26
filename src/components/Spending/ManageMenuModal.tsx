import { Modal } from '../common/Modal'

interface Props {
  onClose: () => void
  onCategories: () => void
  onRecurring: () => void
  onAnalytics: () => void
}

export function ManageMenuModal({ onClose, onCategories, onRecurring, onAnalytics }: Props) {
  return (
    <Modal title="Manage" onClose={onClose}>
      <div className="category-list">
        <button className="menu-row" type="button" onClick={onCategories}>
          <span style={{ flex: 1 }}>Manage Categories</span>
          <span className="muted">›</span>
        </button>
        <button className="menu-row" type="button" onClick={onRecurring}>
          <span style={{ flex: 1 }}>Manage Recurring Expenses</span>
          <span className="muted">›</span>
        </button>
        <button className="menu-row" type="button" onClick={onAnalytics}>
          <span style={{ flex: 1 }}>Analytics</span>
          <span className="muted">›</span>
        </button>
      </div>
    </Modal>
  )
}

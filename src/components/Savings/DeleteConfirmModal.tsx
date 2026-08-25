import { useState } from 'react'
import { Modal } from '../common/Modal'

interface Props {
  itemLabel: string
  onConfirmed: () => void
  onClose: () => void
}

export function DeleteConfirmModal({ itemLabel, onConfirmed, onClose }: Props) {
  const [text, setText] = useState('')
  const valid = text === 'DELETE'

  return (
    <Modal title="Confirm deletion" onClose={onClose}>
      <p className="muted">
        This will permanently delete {itemLabel} and its full history. Type <strong>DELETE</strong> to
        continue.
      </p>
      <div className="form-group">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="DELETE"
        />
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose} type="button">
          Cancel
        </button>
        <button
          className="btn btn-danger"
          disabled={!valid}
          onClick={() => {
            onConfirmed()
            onClose()
          }}
          type="button"
        >
          Continue
        </button>
      </div>
    </Modal>
  )
}

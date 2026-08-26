import { useState } from 'react'
import { Modal } from '../common/Modal'
import { useTranslation } from '../../hooks/useTranslation'
import { tDeleteConfirmBody } from '../../i18n/translations'

interface Props {
  itemLabel: string
  onConfirmed: () => void
  onClose: () => void
}

export function DeleteConfirmModal({ itemLabel, onConfirmed, onClose }: Props) {
  const { t, lang } = useTranslation()
  const [text, setText] = useState('')
  const valid = text === 'DELETE'

  return (
    <Modal title={t('Confirm deletion')} onClose={onClose}>
      <p className="muted">{tDeleteConfirmBody(lang, itemLabel)}</p>
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
          {t('Cancel')}
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
          {t('Continue')}
        </button>
      </div>
    </Modal>
  )
}

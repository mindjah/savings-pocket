import { Modal } from './Modal'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  note: string
  onClose: () => void
}

export function NoteViewModal({ note, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <Modal title={t('Note')} onClose={onClose}>
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{note}</p>
    </Modal>
  )
}

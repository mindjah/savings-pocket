import { Modal } from './Modal'

interface Props {
  note: string
  onClose: () => void
}

export function NoteViewModal({ note, onClose }: Props) {
  return (
    <Modal title="Note" onClose={onClose}>
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{note}</p>
    </Modal>
  )
}

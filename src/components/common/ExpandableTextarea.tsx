import { useState } from 'react'
import { Modal } from './Modal'

interface Props {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export function ExpandableTextarea({ id, label, value, onChange, placeholder, rows = 2 }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="form-group">
      <div className="form-group-header">
        <label htmlFor={id}>{label}</label>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setExpanded(true)} aria-label={`Expand ${label}`}>
          ⤢
        </button>
      </div>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ resize: 'vertical' }}
      />

      {expanded && (
        <Modal title={label} onClose={() => setExpanded(false)}>
          <textarea
            autoFocus
            rows={14}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{ resize: 'vertical', minHeight: '40vh' }}
          />
          <button type="button" className="btn btn-primary btn-block" onClick={() => setExpanded(false)}>
            Done
          </button>
        </Modal>
      )}
    </div>
  )
}

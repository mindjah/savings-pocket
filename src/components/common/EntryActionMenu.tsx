import { useState } from 'react'
import { useTranslation } from '../../hooks/useTranslation'
import { ChevronDownIcon } from './ChevronDownIcon'

interface Props {
  onEdit: () => void
  onViewHistory: () => void
  onSeeNote?: () => void
}

// Expands/collapses in place from the bottom of an entry card, the same way
// NetWorthCard's own breakdown does — not a floating dropdown. Picking any
// option both fires it and collapses the menu.
export function EntryActionMenu({ onEdit, onViewHistory, onSeeNote }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  function choose(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <>
      {open && (
        <div className="entry-menu-options">
          <button type="button" className="entry-menu-option" onClick={() => choose(onEdit)}>
            {t('Edit')}
          </button>
          {onSeeNote && (
            <button type="button" className="entry-menu-option" onClick={() => choose(onSeeNote)}>
              {t('See note')}
            </button>
          )}
          <button type="button" className="entry-menu-option" onClick={() => choose(onViewHistory)}>
            {t('View history')}
          </button>
        </div>
      )}
      <button
        type="button"
        className={`card-expand-toggle${open ? ' open' : ''}`}
        aria-label={t(open ? 'Hide details' : 'Show details')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDownIcon size={20} />
      </button>
    </>
  )
}

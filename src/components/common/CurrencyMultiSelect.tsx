import { useEffect, useRef, useState } from 'react'
import type { Currency } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  selected: Currency[]
  onChange: (next: Currency[]) => void
  // Restricts which currencies are offered as choices (e.g. Assets'
  // currency picker only offers currencies actually used by an existing
  // asset — see SettingsView). Defaults to every app currency.
  options?: Currency[]
}

export function CurrencyMultiSelect({ selected, onChange, options }: Props) {
  const { t } = useTranslation()
  const choices = options ? CURRENCIES.filter((c) => options.includes(c.code)) : CURRENCIES
  function toggle(code: Currency) {
    if (selected.includes(code)) {
      if (selected.length === 1) return // always keep at least one enabled
      onChange(selected.filter((c) => c !== code))
    } else {
      onChange([...selected, code])
    }
  }

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const summary = CURRENCIES.filter((c) => selected.includes(c.code))
    .map((c) => c.code)
    .join(', ')

  return (
    <div className="currency-dropdown" ref={rootRef}>
      <button
        type="button"
        className="currency-dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{summary || t('Select currencies')}</span>
        <span className="chevron">▾</span>
      </button>
      {open && (
        <div className="currency-dropdown-panel" role="listbox">
          {choices.map((c) => {
            const checked = selected.includes(c.code)
            return (
              <label key={c.code} className="currency-dropdown-option">
                <input type="checkbox" checked={checked} onChange={() => toggle(c.code)} />
                <span>
                  {c.symbol} {c.code} — {c.label}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Currency } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'

interface Props {
  selected: Currency[]
  onChange: (next: Currency[]) => void
}

export function CurrencyMultiSelect({ selected, onChange }: Props) {
  function toggle(code: Currency) {
    if (selected.includes(code)) {
      if (selected.length === 1) return // always keep at least one enabled
      onChange(selected.filter((c) => c !== code))
    } else {
      onChange([...selected, code])
    }
  }

  function handleNativeChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = Array.from(e.target.selectedOptions).map((o) => o.value as Currency)
    if (next.length === 0) return
    onChange(next)
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
    <>
      {/* Mobile: native multi-select listbox — tap to toggle, no modifier keys needed there. */}
      <select
        multiple
        size={CURRENCIES.length}
        className="currency-multiselect currency-select-mobile"
        value={selected}
        onChange={handleNativeChange}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.symbol} {c.code} — {c.label}
          </option>
        ))}
      </select>

      {/* Desktop: click-to-open checkbox dropdown — no ctrl/cmd+click required. */}
      <div className="currency-select-desktop currency-dropdown" ref={rootRef}>
        <button
          type="button"
          className="currency-dropdown-trigger"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span>{summary || 'Select currencies'}</span>
          <span className="chevron">▾</span>
        </button>
        {open && (
          <div className="currency-dropdown-panel" role="listbox">
            {CURRENCIES.map((c) => {
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
    </>
  )
}

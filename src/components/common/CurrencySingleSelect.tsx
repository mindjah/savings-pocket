import { useEffect, useId, useRef, useState } from 'react'
import type { Currency } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  value: Currency
  options: Currency[]
  onChange: (next: Currency) => void
}

export function CurrencySingleSelect({ value, options, onChange }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const groupName = useId()

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

  const current = CURRENCIES.find((c) => c.code === value)

  return (
    <div className="currency-dropdown" ref={rootRef}>
      <button
        type="button"
        className="currency-dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current ? `${current.symbol} ${current.code}` : t('Select currency')}</span>
        <span className="chevron">▾</span>
      </button>
      {open && (
        <div className="currency-dropdown-panel" role="listbox">
          {CURRENCIES.filter((c) => options.includes(c.code)).map((c) => (
            <label key={c.code} className="currency-dropdown-option">
              <input
                type="radio"
                name={groupName}
                checked={c.code === value}
                onChange={() => {
                  onChange(c.code)
                  setOpen(false)
                }}
              />
              <span>
                {c.symbol} {c.code} — {c.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

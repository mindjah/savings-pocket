import type { ChangeEvent } from 'react'
import type { Currency } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'

interface Props {
  selected: Currency[]
  onChange: (next: Currency[]) => void
}

export function CurrencyMultiSelect({ selected, onChange }: Props) {
  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = Array.from(e.target.selectedOptions).map((o) => o.value as Currency)
    if (next.length === 0) return // always keep at least one enabled
    onChange(next)
  }

  return (
    <select
      multiple
      size={CURRENCIES.length}
      className="currency-multiselect"
      value={selected}
      onChange={handleChange}
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.symbol} {c.code} — {c.label}
        </option>
      ))}
    </select>
  )
}

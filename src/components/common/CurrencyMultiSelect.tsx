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

  return (
    <div className="currency-checkbox-group">
      {CURRENCIES.map((c) => {
        const checked = selected.includes(c.code)
        return (
          <label key={c.code} className={`currency-checkbox${checked ? ' checked' : ''}`}>
            <input type="checkbox" checked={checked} onChange={() => toggle(c.code)} />
            <span>
              {c.symbol} {c.code}
            </span>
          </label>
        )
      })}
    </div>
  )
}

import type { Category, Currency } from '../../../db/types'
import { formatMoney } from '../../../lib/format'

interface SingleProps {
  category: Category | undefined
  currency: Currency
  amount: number
  maxAmount: number
  onClick?: () => void
  // Overrides the plain formatMoney(amount, currency) text — used by the
  // habits ranking to spell out "Avg .../mo", since that amount is a
  // 6-month average, not the total you see once you tap into the category.
  displayAmount?: string
}

// One category's total this period — same visual language (and, via
// onClick, the same tap-to-see-expenses behavior) as SpendingView's own
// "By category" row, reused here for the year tab's full-year breakdown.
export function CategoryBar({ category, currency, amount, maxAmount, onClick, displayAmount }: SingleProps) {
  const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0
  return (
    <button className="category-breakdown-row" type="button" onClick={onClick}>
      <span className="swatch" style={{ background: category?.color ?? '#888' }} />
      <span style={{ width: 96, flexShrink: 0 }}>{category?.name ?? '—'}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: category?.color ?? '#888' }} />
      </div>
      <strong>{displayAmount ?? formatMoney(amount, currency)}</strong>
    </button>
  )
}

interface CompareProps {
  category: Category | undefined
  currencyA: Currency
  currencyB: Currency
  a: number
  b: number
  maxAmountA: number
  maxAmountB: number
  labelA: string
  labelB: string
  onClickA?: () => void
  onClickB?: () => void
}

// Same category, two periods — one bar per period stacked under a shared
// swatch+name header, so the two amounts are directly comparable at a
// glance rather than needing to scan two separate lists. Each period's own
// line is independently tappable (its own month's expenses), not the row
// as a whole. The two periods can land on different currencies (a category
// merged to whichever currency it was spent most in, per period — see
// mergeCategoryCurrencies), so each bar scales against its own period's max
// rather than a single shared one that would silently mix currencies.
export function CategoryCompareBar({
  category,
  currencyA,
  currencyB,
  a,
  b,
  maxAmountA,
  maxAmountB,
  labelA,
  labelB,
  onClickA,
  onClickB,
}: CompareProps) {
  const pctA = maxAmountA > 0 ? (a / maxAmountA) * 100 : 0
  const pctB = maxAmountB > 0 ? (b / maxAmountB) * 100 : 0
  const color = category?.color ?? '#888'
  return (
    <div className="category-compare-row">
      <div className="compare-header">
        <span className="swatch" style={{ background: color }} />
        <span>{category?.name ?? '—'}</span>
      </div>
      <button className="compare-line" type="button" onClick={onClickA}>
        <span className="compare-label compare-label-a">{labelA}</span>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pctA}%`, background: color }} />
        </div>
        <strong>{formatMoney(a, currencyA)}</strong>
      </button>
      <button className="compare-line" type="button" onClick={onClickB}>
        <span className="compare-label compare-label-b">{labelB}</span>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pctB}%`, background: color, opacity: 0.55 }} />
        </div>
        <strong>{formatMoney(b, currencyB)}</strong>
      </button>
    </div>
  )
}

import type { Category, Currency } from '../../../db/types'
import { formatMoney } from '../../../lib/format'

interface SingleProps {
  category: Category | undefined
  currency: Currency
  amount: number
  maxAmount: number
}

// One category's total this period — same visual language as SpendingView's
// own "By category" row (swatch + name + bar + amount), reused here for the
// year tab's full-year breakdown.
export function CategoryBar({ category, currency, amount, maxAmount }: SingleProps) {
  const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0
  return (
    <div className="category-breakdown-row">
      <span className="swatch" style={{ background: category?.color ?? '#888' }} />
      <span style={{ width: 96, flexShrink: 0 }}>{category?.name ?? '—'}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: category?.color ?? '#888' }} />
      </div>
      <strong>{formatMoney(amount, currency)}</strong>
    </div>
  )
}

interface CompareProps {
  category: Category | undefined
  currency: Currency
  a: number
  b: number
  maxAmount: number
  labelA: string
  labelB: string
}

// Same category, two periods — one bar per period stacked under a shared
// swatch+name header, so the two amounts are directly comparable at a
// glance rather than needing to scan two separate lists.
export function CategoryCompareBar({ category, currency, a, b, maxAmount, labelA, labelB }: CompareProps) {
  const pctA = maxAmount > 0 ? (a / maxAmount) * 100 : 0
  const pctB = maxAmount > 0 ? (b / maxAmount) * 100 : 0
  const color = category?.color ?? '#888'
  return (
    <div className="category-compare-row">
      <div className="compare-header">
        <span className="swatch" style={{ background: color }} />
        <span>{category?.name ?? '—'}</span>
      </div>
      <div className="compare-line">
        <span className="compare-label compare-label-a">{labelA}</span>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pctA}%`, background: color }} />
        </div>
        <strong>{formatMoney(a, currency)}</strong>
      </div>
      <div className="compare-line">
        <span className="compare-label compare-label-b">{labelB}</span>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pctB}%`, background: color, opacity: 0.55 }} />
        </div>
        <strong>{formatMoney(b, currency)}</strong>
      </div>
    </div>
  )
}

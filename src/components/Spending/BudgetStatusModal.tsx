import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { formatMoney, pad2, todayIso } from '../../lib/format'
import { categoryPaceLevel } from '../../lib/planning'
import type { BudgetStatusLevel } from '../../lib/planning'
import { Modal } from '../common/Modal'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  onClose: () => void
}

const LEVEL_COLOR: Record<BudgetStatusLevel, string> = {
  green: 'var(--accent)',
  yellow: 'var(--warning)',
  red: 'var(--danger-strong)',
}

interface DonutSegment {
  categoryId: number
  amount: number
  color: string
}

interface CurrencyTotal {
  currency: Currency
  spent: number
  budget: number
}

function BudgetDonut({
  percentage,
  segments,
  scaleBase,
  currencyTotals,
}: {
  percentage: number
  segments: DonutSegment[]
  scaleBase: number
  currencyTotals: CurrencyTotal[]
}) {
  const { t } = useTranslation()
  const size = 200
  const strokeWidth = 26
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const arcs = segments
    .filter((s) => s.amount > 0)
    .reduce<(DonutSegment & { len: number; offset: number })[]>((acc, s) => {
      const len = scaleBase > 0 ? (s.amount / scaleBase) * circumference : 0
      const cumulative = acc.reduce((sum, a) => sum + a.len, 0)
      acc.push({ ...s, len, offset: -cumulative })
      return acc
    }, [])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 16px' }}>
        <div style={{ position: 'relative', width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
            {arcs.map((a) => (
              <circle
                key={a.categoryId}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={a.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${a.len} ${circumference - a.len}`}
                strokeDashoffset={a.offset}
              />
            ))}
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '0 12px',
            }}
          >
            <div className="muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {t('Spent')}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.25 }}>{Math.round(percentage)}%</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 20px', marginBottom: 20 }}>
        {currencyTotals.map(({ currency, spent, budget }) => (
          <div key={currency} style={{ fontSize: '0.85rem' }}>
            <strong>{formatMoney(spent, currency)}</strong> <span className="muted">{t('of')} {formatMoney(budget, currency)}</span>
          </div>
        ))}
      </div>
    </>
  )
}

export function BudgetStatusModal({ onClose }: Props) {
  const { t } = useTranslation()
  const budgets = useLiveQuery(() => db.categoryBudgets.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const [totalBudgetLimit] = useMetaSetting<Partial<Record<Currency, number>>>('totalBudgetLimit', {})

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const elapsedFraction = now.getDate() / daysInMonth
  const spendingThisMonthRaw =
    useLiveQuery(() => db.spendingEntries.where('date').startsWith(monthPrefix).toArray(), [monthPrefix]) ?? []
  // A future-dated entry hasn't actually happened yet — it shouldn't count
  // as "already spent" any more than a recurring expense that hasn't
  // materialized yet does.
  const spendingThisMonth = useMemo(
    () => spendingThisMonthRaw.filter((e) => e.date <= todayIso()),
    [spendingThisMonthRaw],
  )

  // One combined diagram rather than one per currency: the ring shows the
  // category breakdown for whichever currency is furthest along its own
  // budget (same "worst wins" logic as the overall status color), and its
  // fraction drives the center percentage — currencies can't be summed
  // together without a conversion rate, so each one's absolute total is
  // listed separately underneath instead.
  const budgetSummary = useMemo(() => {
    const spentByCurrency = new Map<Currency, number>()
    const segmentsByCurrency = new Map<Currency, Map<number, number>>()
    spendingThisMonth.forEach((e) => {
      spentByCurrency.set(e.currency, (spentByCurrency.get(e.currency) ?? 0) + e.amount)
      const segMap = segmentsByCurrency.get(e.currency) ?? new Map<number, number>()
      segMap.set(e.categoryId, (segMap.get(e.categoryId) ?? 0) + e.amount)
      segmentsByCurrency.set(e.currency, segMap)
    })
    const currencyBudgets = Object.entries(totalBudgetLimit).filter(([, amt]) => (amt ?? 0) > 0) as [Currency, number][]
    if (currencyBudgets.length === 0) return null

    const currencyTotals: CurrencyTotal[] = currencyBudgets.map(([currency, budget]) => ({
      currency,
      budget,
      spent: spentByCurrency.get(currency) ?? 0,
    }))

    const primary = currencyTotals.reduce((worst, cur) =>
      cur.spent / cur.budget > worst.spent / worst.budget ? cur : worst,
    )
    const percentage = primary.budget > 0 ? (primary.spent / primary.budget) * 100 : 0

    const segMap = segmentsByCurrency.get(primary.currency) ?? new Map<number, number>()
    const segments = Array.from(segMap.entries())
      .map(([categoryId, amount]) => ({ categoryId, amount, color: categoryMap.get(categoryId)?.color ?? '#888' }))
      .sort((a, b) => b.amount - a.amount)

    return {
      percentage,
      scaleBase: Math.max(primary.budget, primary.spent),
      segments,
      currencyTotals,
    }
  }, [spendingThisMonth, totalBudgetLimit, categoryMap])

  const { budgetedRows, otherRows } = useMemo(() => {
    const actualByKey = new Map<string, number>()
    spendingThisMonth.forEach((e) => {
      const key = `${e.categoryId}:${e.currency}`
      actualByKey.set(key, (actualByKey.get(key) ?? 0) + e.amount)
    })
    // Multiple budget entries can exist per category (e.g. several line items
    // making up its budget) — sum them so each category shows as one row.
    const budgetByKey = new Map<string, { categoryId: number; currency: Currency; budget: number }>()
    budgets.forEach((b) => {
      const key = `${b.categoryId}:${b.currency}`
      const existing = budgetByKey.get(key)
      if (existing) {
        existing.budget += b.amount
      } else {
        budgetByKey.set(key, { categoryId: b.categoryId, currency: b.currency, budget: b.amount })
      }
    })
    const budgetedRows = Array.from(budgetByKey.entries())
      .map(([key, v]) => ({ ...v, actual: actualByKey.get(key) ?? 0, level: categoryPaceLevel(actualByKey.get(key) ?? 0, v.budget, elapsedFraction) }))
      // Worst first (red, then yellow, then green), most-over as a tiebreak.
      .sort((a, b) => {
        const order: Record<BudgetStatusLevel, number> = { red: 0, yellow: 1, green: 2 }
        if (order[a.level] !== order[b.level]) return order[a.level] - order[b.level]
        return b.actual - b.budget - (a.actual - a.budget)
      })

    // Spending in categories that have no budget of their own — still real
    // money spent, so shown below the budgeted rows rather than hidden.
    const otherRows = Array.from(actualByKey.entries())
      .filter(([key]) => !budgetByKey.has(key))
      .map(([key, actual]) => {
        const [categoryId, currency] = key.split(':')
        return { categoryId: Number(categoryId), currency: currency as Currency, actual }
      })
      .sort((a, b) => b.actual - a.actual)

    return { budgetedRows, otherRows }
  }, [budgets, spendingThisMonth, elapsedFraction])

  const hasAnything = budgetedRows.length > 0 || otherRows.length > 0

  return (
    <Modal title={t('Budget status')} onClose={onClose}>
      {budgetSummary && (
        <BudgetDonut
          percentage={budgetSummary.percentage}
          segments={budgetSummary.segments}
          scaleBase={budgetSummary.scaleBase}
          currencyTotals={budgetSummary.currencyTotals}
        />
      )}

      {!hasAnything ? (
        <div className="empty-state">
          <span className="icon">📊</span>
          {t('No budget set yet. Set one up in Manage budget.')}
        </div>
      ) : (
        <>
          {budgetedRows.length > 0 && (
            <div className="list-frame">
              {budgetedRows.map((r) => {
                const cat = categoryMap.get(r.categoryId)
                const left = r.budget - r.actual
                return (
                  <div className="list-frame-row" key={`${r.categoryId}:${r.currency}`}>
                    <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                    <div style={{ flex: 1 }}>
                      <div>{cat?.name ?? t('Unknown')}</div>
                      <div className="muted" style={{ fontSize: '0.82rem' }}>
                        {t('Budget')}: {formatMoney(r.budget, r.currency)} · {t('Spent')}: {formatMoney(r.actual, r.currency)}
                      </div>
                    </div>
                    <strong style={{ color: LEVEL_COLOR[r.level] }}>{formatMoney(left, r.currency)}</strong>
                  </div>
                )
              })}
            </div>
          )}

          {otherRows.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: budgetedRows.length > 0 ? 16 : 0 }}>
                <h2>{t('Categories not in budget')}</h2>
              </div>
              <div className="list-frame">
                {otherRows.map((r) => {
                  const cat = categoryMap.get(r.categoryId)
                  return (
                    <div className="list-frame-row" key={`${r.categoryId}:${r.currency}`}>
                      <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                      <div style={{ flex: 1 }}>{cat?.name ?? t('Unknown')}</div>
                      <strong>{formatMoney(r.actual, r.currency)}</strong>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

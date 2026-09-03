import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { formatMoney, pad2, todayIso } from '../../lib/format'
import { MONTH_NAMES } from '../../lib/constants'
import { categoryPaceLevel, monthProgress } from '../../lib/planning'
import type { BudgetStatusLevel } from '../../lib/planning'
import { convertFiat } from '../../lib/fxRates'
import { useFiatRates } from '../../hooks/useFiatRates'
import { Modal } from '../common/Modal'
import { useTranslation } from '../../hooks/useTranslation'
import { tSpentConvertedFrom, tOverspentButOverallFine } from '../../i18n/translations'
import { BudgetIcon } from '../common/BudgetIcon'
import { CategoryExpensesModal } from './CategoryExpensesModal'

interface Props {
  onClose: () => void
  // Defaults to the real current month (the live Spending screen's own
  // usage) — Analytics passes a specific browsed month instead, to show
  // this same view for a month that isn't necessarily the current one.
  monthPrefix?: string
}

const LEVEL_COLOR: Record<BudgetStatusLevel, string> = {
  green: 'var(--accent)',
  yellow: 'var(--warning)',
  red: 'var(--danger-strong)',
}

const UNBUDGETED_PATTERN_ID = 'budget-donut-unbudgeted-stripes'

interface DonutSegment {
  key: string
  amount: number
  color: string
}

interface CurrencySummary {
  currency: Currency
  budget: number
  segments: DonutSegment[]
  unbudgetedTotal: number
  scaleBase: number
  percentage: number
  totalSpent: number
}

function BudgetDonut({
  currency,
  budget,
  segments,
  unbudgetedTotal,
  scaleBase,
  percentage,
  totalSpent,
  size,
  onUnbudgetedInfoClick,
  unbudgetedInfoLabel,
  overallOver,
}: CurrencySummary & { size: number; onUnbudgetedInfoClick: () => void; unbudgetedInfoLabel: string; overallOver: boolean | null }) {
  const { t, lang } = useTranslation()
  const strokeWidth = size * 0.13
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const allSegments = useMemo(() => {
    const withUnbudgeted = unbudgetedTotal > 0 ? [...segments, { key: 'unbudgeted', amount: unbudgetedTotal, color: `url(#${UNBUDGETED_PATTERN_ID})` }] : segments
    return withUnbudgeted.filter((s) => s.amount > 0)
  }, [segments, unbudgetedTotal])

  const arcs = allSegments.reduce<(DonutSegment & { len: number; offset: number })[]>((acc, s) => {
    const len = scaleBase > 0 ? (s.amount / scaleBase) * circumference : 0
    const cumulative = acc.reduce((sum, a) => sum + a.len, 0)
    acc.push({ ...s, len, offset: -cumulative })
    return acc
  }, [])

  // Hangs the red info marker just outside the ring, centered on the
  // angular midpoint of the striped "not in budget" arc. The SVG itself is
  // rotated -90deg (so 0 path-length sits at 12 o'clock); this reproduces
  // that same rotation for a point positioned in the *unrotated* wrapper div.
  const unbudgetedArc = arcs.find((a) => a.key === 'unbudgeted')
  let unbudgetedMarker: { x: number; y: number } | null = null
  if (unbudgetedArc && unbudgetedArc.len > 0) {
    const cumulativeBefore = -unbudgetedArc.offset
    const midpointFraction = (cumulativeBefore + unbudgetedArc.len / 2) / circumference
    const theta = midpointFraction * 2 * Math.PI
    const markerRadius = radius + strokeWidth / 2 + 12
    const center = size / 2
    unbudgetedMarker = {
      x: center + markerRadius * Math.sin(theta),
      y: center - markerRadius * Math.cos(theta),
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <pattern id={UNBUDGETED_PATTERN_ID} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="#ffffff" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="#000000" strokeWidth="4" />
            </pattern>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
          {arcs.map((a) => (
            <circle
              key={a.key}
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
        {unbudgetedMarker && (
          <button
            className="btn btn-ghost btn-icon"
            onClick={onUnbudgetedInfoClick}
            aria-label={unbudgetedInfoLabel}
            type="button"
            style={{
              position: 'absolute',
              left: unbudgetedMarker.x,
              top: unbudgetedMarker.y,
              transform: 'translate(-50%, -50%)',
              color: 'var(--danger-strong)',
              background: 'transparent',
              border: 'none',
              padding: 2,
              lineHeight: 1,
              fontSize: '0.8rem',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            ⓘ
          </button>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 8px',
          }}
        >
          <div className="muted" style={{ fontSize: size > 160 ? '0.72rem' : '0.62rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            {t('Spent')}
          </div>
          <div style={{ fontSize: size > 160 ? '1.6rem' : '1.15rem', fontWeight: 800, lineHeight: 1.25 }}>{Math.round(percentage)}%</div>
        </div>
      </div>
      <div style={{ fontSize: '0.85rem', marginTop: 8, width: '100%', textAlign: 'center' }}>
        <strong>{formatMoney(segments.reduce((sum, s) => sum + s.amount, 0) + unbudgetedTotal, currency)}</strong>{' '}
        <span className="muted">
          {t('of')} {formatMoney(budget, currency)}
        </span>
      </div>
      {totalSpent > budget && overallOver === false && (
        <div className="muted" style={{ fontSize: '0.75rem', marginTop: 2, width: '100%', textAlign: 'center' }}>
          {tOverspentButOverallFine(lang, currency)}
        </div>
      )}
    </div>
  )
}

export function BudgetStatusModal({ onClose, monthPrefix: monthPrefixProp }: Props) {
  const { t, lang } = useTranslation()
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const { rates: fx } = useFiatRates()
  const [unbudgetedInfoOpen, setUnbudgetedInfoOpen] = useState(false)
  const [categoryModalFor, setCategoryModalFor] = useState<number | null>(null)

  // Budgets are scoped by exact calendar month (see BudgetModal) — defaults
  // to the real current month, but Analytics passes a specific browsed one.
  const now = new Date()
  const realCurrentMonthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  const monthPrefix = monthPrefixProp ?? realCurrentMonthPrefix
  const [monthYear, monthNum] = monthPrefix.split('-').map(Number)
  // Pace (how much of the budget "should" be used by now) only means
  // anything for the month actually in progress — a fully past month is
  // simply over or under its budget (elapsed 1, no partial-pace yellow), and
  // a not-yet-started future month hasn't spent anything against it yet
  // (elapsed 0). Same generalization CompareTab/YearTab/SpendingView use.
  const { dayOfMonth, daysInMonth } = monthProgress(monthPrefix, realCurrentMonthPrefix, now)
  const elapsedFraction = dayOfMonth / daysInMonth
  const budgets = useLiveQuery(() => db.categoryBudgets.where('month').equals(monthPrefix).toArray(), [monthPrefix]) ?? []
  const totalBudgetRows = useLiveQuery(() => db.totalBudgets.where('month').equals(monthPrefix).toArray(), [monthPrefix]) ?? []
  const totalBudgetLimit = useMemo(() => {
    const result: Partial<Record<Currency, number>> = {}
    totalBudgetRows.forEach((r) => {
      result[r.currency] = r.amount
    })
    return result
  }, [totalBudgetRows])
  const spendingThisMonthRaw =
    useLiveQuery(() => db.spendingEntries.where('date').startsWith(monthPrefix).toArray(), [monthPrefix]) ?? []
  // A future-dated entry hasn't actually happened yet — it shouldn't count
  // as "already spent" any more than a recurring expense that hasn't
  // materialized yet does.
  const spendingThisMonth = useMemo(
    () => spendingThisMonthRaw.filter((e) => e.date <= todayIso()),
    [spendingThisMonthRaw],
  )

  // Shared per-category-per-currency base data, used both by the row lists
  // and by the per-currency donut summaries below.
  const { budgetByKey, actualByKey, fixedActualByKey, discretionaryCountByKey } = useMemo(() => {
    const budgetByKey = new Map<string, { categoryId: number; currency: Currency; budget: number }>()
    budgets.forEach((b) => {
      const key = `${b.categoryId}:${b.currency}`
      const existing = budgetByKey.get(key)
      if (existing) existing.budget += b.amount
      else budgetByKey.set(key, { categoryId: b.categoryId, currency: b.currency, budget: b.amount })
    })
    const actualByKey = new Map<string, number>()
    // A recurring-linked entry is a known lump sum, not discretionary
    // spending that trickles in over the month — see categoryPaceLevel.
    const fixedActualByKey = new Map<string, number>()
    const discretionaryCountByKey = new Map<string, number>()
    spendingThisMonth.forEach((e) => {
      const key = `${e.categoryId}:${e.currency}`
      actualByKey.set(key, (actualByKey.get(key) ?? 0) + e.amount)
      if (e.recurringExpenseId != null) {
        fixedActualByKey.set(key, (fixedActualByKey.get(key) ?? 0) + e.amount)
      } else {
        discretionaryCountByKey.set(key, (discretionaryCountByKey.get(key) ?? 0) + 1)
      }
    })
    return { budgetByKey, actualByKey, fixedActualByKey, discretionaryCountByKey }
  }, [budgets, spendingThisMonth])

  // The plan's main currency: whichever total-budget currency has the
  // largest amount. Used to pick which donut absorbs converted spillover,
  // and — as of this fix — as the preferred currency for a multi-currency
  // category's combined "Overall left," so it always follows the plan's own
  // main currency rather than an ad hoc per-category pick.
  const mainCurrency = useMemo(() => {
    const totalCurrencies = Object.entries(totalBudgetLimit).filter(([, amt]) => (amt ?? 0) > 0) as [Currency, number][]
    return totalCurrencies.length > 0 ? totalCurrencies.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0] : undefined
  }, [totalBudgetLimit])

  // Spending in a budgeted category, but paid in some other currency, isn't
  // truly "unbudgeted" — it's folded straight into that category's own row
  // (converted into whichever of its budgeted currencies is the plan's main
  // one, or its only one) instead of appearing as a separate unbudgeted line.
  // Applies regardless of how many total-budget currencies exist — the donut
  // display (below) still keeps a currency that has its own total budget
  // fully separate/native there; this only affects the row-list numbers.
  const spilloverInfo = useMemo(() => {
    const rowKeyByCategory = new Map<number, string>()
    budgetByKey.forEach((v, key) => {
      const existingKey = rowKeyByCategory.get(v.categoryId)
      if (!existingKey || v.currency === mainCurrency) rowKeyByCategory.set(v.categoryId, key)
    })

    const spilloverByRowKey = new Map<string, Map<Currency, number>>()
    actualByKey.forEach((amount, key) => {
      if (budgetByKey.has(key)) return
      const [categoryIdStr, currencyStr] = key.split(':')
      const rowKey = rowKeyByCategory.get(Number(categoryIdStr))
      if (!rowKey) return
      const currency = currencyStr as Currency
      const perCurrency = spilloverByRowKey.get(rowKey) ?? new Map<Currency, number>()
      perCurrency.set(currency, (perCurrency.get(currency) ?? 0) + amount)
      spilloverByRowKey.set(rowKey, perCurrency)
    })

    return { spilloverByRowKey }
  }, [mainCurrency, budgetByKey, actualByKey])

  const { budgetedRows, otherRows } = useMemo(() => {
    const budgetedCategoryIds = new Set(Array.from(budgetByKey.values()).map((v) => v.categoryId))

    // A category may be genuinely budgeted in more than one currency — group
    // its entries so those get merged into one card below, rather than one
    // being judged over budget on its own while the category as a whole
    // (once everything's converted into a common currency) is still fine.
    const entriesByCategory = new Map<number, { key: string; currency: Currency; budget: number }[]>()
    budgetByKey.forEach((v, key) => {
      const list = entriesByCategory.get(v.categoryId) ?? []
      list.push({ key, currency: v.currency, budget: v.budget })
      entriesByCategory.set(v.categoryId, list)
    })

    const budgetedRows = Array.from(entriesByCategory.entries())
      .map(([categoryId, entries]) => {
        const currencies = entries.map((entry) => {
          const nativeActual = actualByKey.get(entry.key) ?? 0
          const spilloverByCurrency = spilloverInfo.spilloverByRowKey.get(entry.key)
          const spilloverLines = spilloverByCurrency
            ? Array.from(spilloverByCurrency.entries()).map(([currency, amount]) => ({ currency, amount }))
            : []
          const spilloverConverted =
            fx && spilloverByCurrency
              ? Array.from(spilloverByCurrency.entries()).reduce((sum, [cur, amt]) => sum + convertFiat(amt, cur, entry.currency, fx), 0)
              : 0
          const actual = nativeActual + spilloverConverted
          return {
            currency: entry.currency,
            budget: entry.budget,
            actual,
            spilloverLines,
            level: categoryPaceLevel(
              actual,
              entry.budget,
              elapsedFraction,
              fixedActualByKey.get(entry.key) ?? 0,
              discretionaryCountByKey.get(entry.key) ?? 0,
            ),
          }
        })

        // Genuinely budgeted in 2+ currencies: also compare the combined
        // (converted) totals — being over budget in one currency alone
        // doesn't mean the category as a whole is over budget. Shown in
        // whichever of this category's own currencies actually had the
        // larger planned amount once converted (not raw digits, and not
        // the plan's overall main currency — this is specific to the
        // category's own two budget lines).
        let overall: { currency: Currency; left: number; over: boolean } | null = null
        if (currencies.length > 1 && fx) {
          const refCurrency = currencies.reduce((best, cur) =>
            convertFiat(cur.budget, cur.currency, 'USD', fx) > convertFiat(best.budget, best.currency, 'USD', fx) ? cur : best,
          ).currency
          const totalBudget = currencies.reduce(
            (sum, c) => sum + (c.currency === refCurrency ? c.budget : convertFiat(c.budget, c.currency, refCurrency, fx)),
            0,
          )
          const totalActual = currencies.reduce(
            (sum, c) => sum + (c.currency === refCurrency ? c.actual : convertFiat(c.actual, c.currency, refCurrency, fx)),
            0,
          )
          overall = { currency: refCurrency, left: totalBudget - totalActual, over: totalBudget > 0 && totalActual > totalBudget }
        }

        // Sorting/escalation follows the combined check when there is one
        // (a multi-currency category "in the red" on just one currency but
        // fine overall shouldn't sort or flag as if it were over budget).
        const sortLevel: BudgetStatusLevel = overall ? (overall.over ? 'red' : 'green') : currencies[0].level
        const sortMetric = overall ? -overall.left : currencies[0].actual - currencies[0].budget

        return { categoryId, currencies, overall, sortLevel, sortMetric }
      })
      // Worst first (red, then yellow, then green), most-over as a tiebreak.
      .sort((a, b) => {
        const order: Record<BudgetStatusLevel, number> = { red: 0, yellow: 1, green: 2 }
        if (order[a.sortLevel] !== order[b.sortLevel]) return order[a.sortLevel] - order[b.sortLevel]
        return b.sortMetric - a.sortMetric
      })

    // Spending in categories that have no budget of their own — still real
    // money spent, so shown below the budgeted rows rather than hidden. A
    // budgeted category's cross-currency spend was already folded into its
    // budgetedRows entry above, so it's excluded here rather than double-counted.
    const otherRows = Array.from(actualByKey.entries())
      .filter(([key]) => {
        if (budgetByKey.has(key)) return false
        const [categoryIdStr] = key.split(':')
        if (budgetedCategoryIds.has(Number(categoryIdStr))) return false
        return true
      })
      .map(([key, actual]) => {
        const [categoryId, currency] = key.split(':')
        return { categoryId: Number(categoryId), currency: currency as Currency, actual }
      })
      .sort((a, b) => b.actual - a.actual)

    return { budgetedRows, otherRows }
  }, [budgetByKey, actualByKey, fixedActualByKey, discretionaryCountByKey, elapsedFraction, spilloverInfo, fx])

  // One donut per currency that has a total budget — each one's own ring,
  // sized down and laid out two-per-row once there's more than one.
  //
  // A category that's budgeted in one currency but also has spending in a
  // DIFFERENT currency ("spillover") isn't truly unbudgeted — it's the same
  // planned category, just paid in another currency:
  //   - if that OTHER currency itself has its own total budget (its own
  //     donut), the spend is shown natively there, merged into the
  //     category's own colored segment — no conversion, it's already "at
  //     home" in that donut.
  //   - if that other currency has no donut of its own, the spend is
  //     converted into the main currency and merged into the category's
  //     segment there instead.
  // (A category genuinely budgeted in two currencies keeps each currency's
  // slice in its own respective donut, unconverted — segments below are
  // already filtered per-donut-currency, so that's unaffected.)
  //
  // Spending in a category with NO budget anywhere: shown in its own
  // currency's striped "not in budget" slice if that currency has a donut,
  // otherwise converted into the main currency's striped slice instead.
  const currencySummaries = useMemo<CurrencySummary[]>(() => {
    const totalCurrencies = Object.entries(totalBudgetLimit).filter(([, amt]) => (amt ?? 0) > 0) as [Currency, number][]
    if (totalCurrencies.length === 0) return []

    const budgetedCurrencySet = new Set(totalCurrencies.map(([c]) => c))
    const mainCurrency = totalCurrencies.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0]
    const budgetedCategoryIds = new Set(Array.from(budgetByKey.values()).map((v) => v.categoryId))

    const nativeUnbudgetedByCurrency = new Map<Currency, number>()
    const nativeSpilloverByCurrency = new Map<Currency, Map<number, number>>()
    const convertedSpilloverByCategory = new Map<number, number>()
    actualByKey.forEach((amount, key) => {
      if (budgetByKey.has(key)) return
      const [categoryIdStr, currencyStr] = key.split(':')
      const categoryId = Number(categoryIdStr)
      const currency = currencyStr as Currency
      if (budgetedCategoryIds.has(categoryId)) {
        if (budgetedCurrencySet.has(currency)) {
          const byCategory = nativeSpilloverByCurrency.get(currency) ?? new Map<number, number>()
          byCategory.set(categoryId, (byCategory.get(categoryId) ?? 0) + amount)
          nativeSpilloverByCurrency.set(currency, byCategory)
        } else if (fx) {
          convertedSpilloverByCategory.set(categoryId, (convertedSpilloverByCategory.get(categoryId) ?? 0) + convertFiat(amount, currency, mainCurrency, fx))
        }
      } else {
        nativeUnbudgetedByCurrency.set(currency, (nativeUnbudgetedByCurrency.get(currency) ?? 0) + amount)
      }
    })

    let orphanConvertedToMain = 0
    if (fx) {
      nativeUnbudgetedByCurrency.forEach((amount, currency) => {
        if (!budgetedCurrencySet.has(currency)) {
          orphanConvertedToMain += convertFiat(amount, currency, mainCurrency, fx)
        }
      })
    }

    return totalCurrencies.map(([currency, budget]) => {
      const segmentByCategory = new Map<number, DonutSegment>()
      Array.from(budgetByKey.entries())
        .filter(([, v]) => v.currency === currency)
        .forEach(([key, v]) => {
          const amount = actualByKey.get(key) ?? 0
          if (amount <= 0) return
          segmentByCategory.set(v.categoryId, { key: `cat-${v.categoryId}`, amount, color: categoryMap.get(v.categoryId)?.color ?? '#888' })
        })

      // Native spillover: a budgeted category paid in exactly this currency,
      // merged straight into its own segment here — no conversion needed.
      nativeSpilloverByCurrency.get(currency)?.forEach((amount, categoryId) => {
        if (amount <= 0) return
        const existing = segmentByCategory.get(categoryId)
        if (existing) existing.amount += amount
        else segmentByCategory.set(categoryId, { key: `cat-${categoryId}`, amount, color: categoryMap.get(categoryId)?.color ?? '#888' })
      })

      // Converted spillover (from a currency with no donut of its own) only
      // ever lands in the main currency's donut.
      if (currency === mainCurrency) {
        convertedSpilloverByCategory.forEach((amount, categoryId) => {
          if (amount <= 0) return
          const existing = segmentByCategory.get(categoryId)
          if (existing) existing.amount += amount
          else segmentByCategory.set(categoryId, { key: `cat-${categoryId}`, amount, color: categoryMap.get(categoryId)?.color ?? '#888' })
        })
      }

      const segments = Array.from(segmentByCategory.values()).sort((a, b) => b.amount - a.amount)
      const budgetedSpent = segments.reduce((sum, s) => sum + s.amount, 0)
      const unbudgetedTotal = (nativeUnbudgetedByCurrency.get(currency) ?? 0) + (currency === mainCurrency ? orphanConvertedToMain : 0)
      const totalSpent = budgetedSpent + unbudgetedTotal
      const percentage = budget > 0 ? (totalSpent / budget) * 100 : 0

      return { currency, budget, segments, unbudgetedTotal, scaleBase: Math.max(budget, totalSpent), percentage, totalSpent }
    })
  }, [totalBudgetLimit, budgetByKey, actualByKey, categoryMap, fx])

  // Whether the plan AS A WHOLE is over budget, once every total-budget
  // currency's amount and every currency's actual spending is converted into
  // one common currency and pooled — mirrors the same check that drives the
  // status pill on the Spending screen. Used only to decide whether to show
  // the "overspent in X, but fine overall" note under an individually
  // over-budget currency; the donuts themselves stay fully separate.
  const overallStatus = useMemo(() => {
    if (currencySummaries.length === 0 || !fx) return null
    const refCurrency = currencySummaries.reduce((best, cur) =>
      convertFiat(cur.budget, cur.currency, 'USD', fx) > convertFiat(best.budget, best.currency, 'USD', fx) ? cur : best,
    ).currency
    const totalBudget = currencySummaries.reduce(
      (sum, s) => sum + (s.currency === refCurrency ? s.budget : convertFiat(s.budget, s.currency, refCurrency, fx)),
      0,
    )
    const totalSpentConverted = currencySummaries.reduce(
      (sum, s) => sum + (s.currency === refCurrency ? s.totalSpent : convertFiat(s.totalSpent, s.currency, refCurrency, fx)),
      0,
    )
    return { over: totalSpentConverted > totalBudget }
  }, [currencySummaries, fx])

  // Header total next to "Categories not in budget": one converted+combined
  // figure if there's a single budgeted currency, one figure per currency
  // (no cross-currency conversion between them) if there are several, or —
  // with no total budget configured at all — just each currency's own raw
  // unbudgeted total, since there's no "main" currency to convert into.
  const unbudgetedHeaderTotals = useMemo(() => {
    if (currencySummaries.length > 0) {
      return currencySummaries.filter((s) => s.unbudgetedTotal > 0).map((s) => ({ currency: s.currency, amount: s.unbudgetedTotal }))
    }
    const byCurrency = new Map<Currency, number>()
    otherRows.forEach((r) => byCurrency.set(r.currency, (byCurrency.get(r.currency) ?? 0) + r.actual))
    return Array.from(byCurrency.entries()).map(([currency, amount]) => ({ currency, amount }))
  }, [currencySummaries, otherRows])

  const hasAnything = budgetedRows.length > 0 || otherRows.length > 0
  const donutSize = currencySummaries.length > 1 ? 148 : 200

  return (
    <>
    <Modal
      wide
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <BudgetIcon size={20} />
          {t('Budget status')}
          {monthPrefixProp && (
            <span className="muted" style={{ fontWeight: 400, fontSize: '0.85rem' }}>
              — {t(MONTH_NAMES[monthNum - 1])} {monthYear}
            </span>
          )}
        </span>
      }
      onClose={onClose}
    >
      {currencySummaries.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px 12px', margin: '4px 0 20px' }}>
          {currencySummaries.map((s) => (
            <div key={s.currency} style={{ flex: currencySummaries.length > 1 ? '0 1 calc(50% - 6px)' : '0 1 100%', minWidth: 0 }}>
              <BudgetDonut
                {...s}
                size={donutSize}
                onUnbudgetedInfoClick={() => setUnbudgetedInfoOpen((o) => !o)}
                unbudgetedInfoLabel={t('This spending is not budgeted.')}
                overallOver={overallStatus?.over ?? null}
              />
            </div>
          ))}
        </div>
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
                return (
                  <button
                    className="list-frame-row as-button"
                    key={r.categoryId}
                    type="button"
                    onClick={() => setCategoryModalFor(r.categoryId)}
                  >
                    <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                    <div style={{ flex: 1 }}>
                      <div>{cat?.name ?? t('Unknown')}</div>
                      {r.currencies.map((c) => (
                        <div key={c.currency}>
                          <div className="muted" style={{ fontSize: '0.82rem' }}>
                            {t('Budget')}: {formatMoney(c.budget, c.currency)} · {t('Spent')}: {formatMoney(c.actual, c.currency)}
                          </div>
                          {c.spilloverLines.map((line) => (
                            <div className="muted" style={{ fontSize: '0.78rem' }} key={line.currency}>
                              {tSpentConvertedFrom(lang, `${formatMoney(line.amount, line.currency)} ${line.currency}`)}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="muted" style={{ fontSize: '0.68rem' }}>
                        {t('Left')}
                      </div>
                      {r.currencies.map((c) => (
                        <strong key={c.currency} style={{ display: 'block', color: LEVEL_COLOR[c.level] }}>
                          {formatMoney(c.budget - c.actual, c.currency)}
                        </strong>
                      ))}
                      {r.overall && (
                        <>
                          <div className="muted" style={{ fontSize: '0.68rem', marginTop: 4 }}>
                            {t('Overall left')}
                          </div>
                          <strong style={{ color: r.overall.over ? 'var(--danger-strong)' : 'var(--accent)' }}>
                            {formatMoney(r.overall.left, r.overall.currency)}
                          </strong>
                        </>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {otherRows.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: budgetedRows.length > 0 ? 16 : 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <h2>{t('Categories not in budget')}</h2>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => setUnbudgetedInfoOpen((o) => !o)}
                    aria-label={t('This spending is not budgeted.')}
                    type="button"
                    style={{ color: 'var(--danger-strong)' }}
                  >
                    ⓘ
                  </button>
                </span>
                {unbudgetedHeaderTotals.length > 0 && (
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {unbudgetedHeaderTotals.map((h) => formatMoney(h.amount, h.currency)).join(' · ')}
                  </span>
                )}
              </div>
              {unbudgetedInfoOpen && (
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: -8 }}>
                  {t('This spending is not budgeted.')}
                </p>
              )}
              <div className="list-frame">
                {otherRows.map((r) => {
                  const cat = categoryMap.get(r.categoryId)
                  return (
                    <button
                      className="list-frame-row as-button"
                      key={`${r.categoryId}:${r.currency}`}
                      type="button"
                      onClick={() => setCategoryModalFor(r.categoryId)}
                    >
                      <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                      <div style={{ flex: 1 }}>{cat?.name ?? t('Unknown')}</div>
                      <strong>{formatMoney(r.actual, r.currency)}</strong>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </Modal>

    {categoryModalFor != null && (
      <CategoryExpensesModal
        categoryId={categoryModalFor}
        categoryName={categoryMap.get(categoryModalFor)?.name ?? t('Unknown')}
        categoryColor={categoryMap.get(categoryModalFor)?.color ?? '#888'}
        monthPrefix={monthPrefix}
        readOnly
        onClose={() => setCategoryModalFor(null)}
      />
    )}
    </>
  )
}

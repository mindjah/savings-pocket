import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { CURRENCIES, MONTH_NAMES, WEEKDAY_LABELS } from '../../lib/constants'
import { formatMoney, formatMoneyCompact, pad2, todayIso, ymd } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { DayEntriesModal } from './DayEntriesModal'
import { CategoryManagerModal } from './CategoryManagerModal'

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

// Monday-first weekday index (0 = Monday .. 6 = Sunday)
function mondayIndex(year: number, month: number, day: number) {
  const jsDay = new Date(year, month, day).getDay() // 0 = Sunday
  return (jsDay + 6) % 7
}

export function SpendingView() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [managingCategories, setManagingCategories] = useState(false)
  const [spendingCurrency] = useMetaSetting<Currency>('spendingCurrency', 'EUR')

  const monthPrefix = `${year}-${pad2(month + 1)}`
  const entries = useLiveQuery(
    () => db.spendingEntries.where('date').startsWith(monthPrefix).toArray(),
    [monthPrefix],
  )
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const categoryMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])

  // date -> currency -> total
  const totalsByDay = useMemo(() => {
    const map = new Map<string, Map<Currency, number>>()
    for (const e of entries ?? []) {
      const dayMap = map.get(e.date) ?? new Map<Currency, number>()
      dayMap.set(e.currency, (dayMap.get(e.currency) ?? 0) + e.amount)
      map.set(e.date, dayMap)
    }
    return map
  }, [entries])

  const monthTotals: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0 }
  entries?.forEach((e) => {
    monthTotals[e.currency] += e.amount
  })

  // (categoryId, currency) breakdown, bar width normalized per-currency so amounts
  // in different currencies never get visually compared against each other.
  const breakdown = useMemo(() => {
    const map = new Map<string, { categoryId: number; currency: Currency; total: number }>()
    for (const e of entries ?? []) {
      const key = `${e.categoryId}:${e.currency}`
      const existing = map.get(key)
      map.set(key, { categoryId: e.categoryId, currency: e.currency, total: (existing?.total ?? 0) + e.amount })
    }
    const maxByCurrency = new Map<Currency, number>()
    for (const row of map.values()) {
      maxByCurrency.set(row.currency, Math.max(maxByCurrency.get(row.currency) ?? 0, row.total))
    }
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        category: categoryMap.get(row.categoryId),
        barPct: ((row.total / (maxByCurrency.get(row.currency) ?? 1)) * 100),
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency) || b.total - a.total)
  }, [entries, categoryMap])

  const numDays = daysInMonth(year, month)
  const leadingBlanks = mondayIndex(year, month, 1)
  const cells: { day: number | null; date: string | null }[] = []
  for (let i = 0; i < leadingBlanks; i++) cells.push({ day: null, date: null })
  for (let d = 1; d <= numDays; d++) cells.push({ day: d, date: ymd(year, month, d) })

  function goPrevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function goNextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const todayStr = todayIso()

  return (
    <div className="view">
      <div className="section-title">
        <h2>
          Total spent — {MONTH_NAMES[month]} {year}
        </h2>
      </div>
      <div className="totals-row">
        {CURRENCIES.map((c) => (
          <div className="total-chip" key={c.code}>
            <div className="muted">{c.code}</div>
            <div className="amount">{formatMoney(monthTotals[c.code], c.code)}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="calendar-header">
          <button className="btn btn-ghost btn-icon" onClick={goPrevMonth} aria-label="Previous month" type="button">
            ‹
          </button>
          <span className="month-label">
            {MONTH_NAMES[month]} {year}
          </span>
          <button className="btn btn-ghost btn-icon" onClick={goNextMonth} aria-label="Next month" type="button">
            ›
          </button>
        </div>

        <div className="calendar-grid" style={{ marginTop: 12 }}>
          {WEEKDAY_LABELS.map((w) => (
            <div className="weekday-label" key={w}>
              {w}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (cell.day === null) return <div className="calendar-cell pad" key={`pad-${i}`} />
            const dayMap = totalsByDay.get(cell.date!)
            const isToday = isCurrentMonth && cell.date === todayStr
            let primary: [Currency, number] | null = null
            let extraCount = 0
            if (dayMap && dayMap.size > 0) {
              const pairs = Array.from(dayMap.entries())
              primary = dayMap.has(spendingCurrency)
                ? [spendingCurrency, dayMap.get(spendingCurrency)!]
                : pairs.sort((a, b) => b[1] - a[1])[0]
              extraCount = pairs.length - 1
            }
            return (
              <button
                key={cell.date}
                className={`calendar-cell${isToday ? ' today' : ''}${primary ? ' has-spend' : ''}`}
                onClick={() => setOpenDay(cell.date)}
                type="button"
              >
                <span className="day-num">{cell.day}</span>
                {primary && (
                  <span className="day-total">
                    {formatMoneyCompact(primary[1], primary[0])}
                    {extraCount > 0 ? ` +${extraCount}` : ''}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="section-title">
        <h2>By category</h2>
        <button className="btn btn-ghost" onClick={() => setManagingCategories(true)} type="button">
          Manage
        </button>
      </div>

      {breakdown.length === 0 ? (
        <div className="empty-state">
          <span className="icon">📅</span>
          No spending logged this month yet. Tap any day to add an expense.
        </div>
      ) : (
        <div className="category-breakdown">
          {breakdown.map(({ categoryId, currency, total, category, barPct }) => (
            <div className="category-breakdown-row" key={`${categoryId}:${currency}`}>
              <span className="swatch" style={{ background: category?.color ?? '#888' }} />
              <span style={{ width: 96, flexShrink: 0 }}>{category?.name ?? 'Unknown'}</span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${barPct}%`, background: category?.color ?? '#888' }}
                />
              </div>
              <strong>{formatMoney(total, currency)}</strong>
            </div>
          ))}
        </div>
      )}

      {openDay && (
        <DayEntriesModal
          date={openDay}
          onClose={() => setOpenDay(null)}
          onManageCategories={() => {
            setOpenDay(null)
            setManagingCategories(true)
          }}
        />
      )}

      {managingCategories && <CategoryManagerModal onClose={() => setManagingCategories(false)} />}
    </div>
  )
}

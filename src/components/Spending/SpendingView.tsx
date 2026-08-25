import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { MONTH_NAMES, WEEKDAY_LABELS } from '../../lib/constants'
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
  const [spendingCurrency] = useMetaSetting<'EUR' | 'USD' | 'RUB'>('spendingCurrency', 'EUR')

  const monthPrefix = `${year}-${pad2(month + 1)}`
  const entries = useLiveQuery(
    () => db.spendingEntries.where('date').startsWith(monthPrefix).toArray(),
    [monthPrefix],
  )
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const categoryMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])

  const totalsByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries ?? []) {
      map.set(e.date, (map.get(e.date) ?? 0) + e.amount)
    }
    return map
  }, [entries])

  const monthTotal = (entries ?? []).reduce((sum, e) => sum + e.amount, 0)

  const breakdown = useMemo(() => {
    const map = new Map<number, number>()
    for (const e of entries ?? []) {
      map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.amount)
    }
    return Array.from(map.entries())
      .map(([categoryId, total]) => ({ categoryId, total, category: categoryMap.get(categoryId) }))
      .sort((a, b) => b.total - a.total)
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
      <div className="total-chip">
        <div className="muted">
          Total spent — {MONTH_NAMES[month]} {year}
        </div>
        <div className="amount">{formatMoney(monthTotal, spendingCurrency)}</div>
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
            const total = totalsByDay.get(cell.date!) ?? 0
            const isToday = isCurrentMonth && cell.date === todayStr
            return (
              <button
                key={cell.date}
                className={`calendar-cell${isToday ? ' today' : ''}${total > 0 ? ' has-spend' : ''}`}
                onClick={() => setOpenDay(cell.date)}
                type="button"
              >
                <span className="day-num">{cell.day}</span>
                {total > 0 && <span className="day-total">{formatMoneyCompact(total, spendingCurrency)}</span>}
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
          {breakdown.map(({ categoryId, total, category }) => (
            <div className="category-breakdown-row" key={categoryId}>
              <span className="swatch" style={{ background: category?.color ?? '#888' }} />
              <span style={{ width: 96, flexShrink: 0 }}>{category?.name ?? 'Unknown'}</span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${monthTotal > 0 ? (total / monthTotal) * 100 : 0}%`,
                    background: category?.color ?? '#888',
                  }}
                />
              </div>
              <strong>{formatMoney(total, spendingCurrency)}</strong>
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

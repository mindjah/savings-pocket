import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { CURRENCIES, DEFAULT_SPENDING_CURRENCIES, MONTH_NAMES, WEEKDAY_LABELS } from '../../lib/constants'
import { formatMoney, formatMoneyCompact, pad2, todayIso, ymd } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { DayEntriesModal } from './DayEntriesModal'
import { CategoryManagerModal } from './CategoryManagerModal'
import { CategoryExpensesModal } from './CategoryExpensesModal'
import { ManageMenuModal } from './ManageMenuModal'
import { RecurringExpensesModal } from './RecurringExpensesModal'
import { AnalyticsModal } from './AnalyticsModal'
import { PlanningModal } from './PlanningModal'
import { BudgetModal } from './BudgetModal'
import { BudgetStatusModal } from './BudgetStatusModal'
import { HeaderPortal } from '../common/HeaderPortal'
import { ManageIcon } from '../common/ManageIcon'
import { CheckIcon } from '../common/CheckIcon'
import { WarningIcon } from '../common/WarningIcon'
import { XMarkIcon } from '../common/XMarkIcon'
import { useTranslation } from '../../hooks/useTranslation'
import { tLimitsExceededInCategories } from '../../i18n/translations'
import { EntryBadges } from '../common/EntryBadges'
import { recurringPreviewDates } from '../../lib/recurring'
import { computeBudgetStatus } from '../../lib/planning'

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

// Monday-first weekday index (0 = Monday .. 6 = Sunday)
function mondayIndex(year: number, month: number, day: number) {
  const jsDay = new Date(year, month, day).getDay() // 0 = Sunday
  return (jsDay + 6) % 7
}

interface Props {
  resetKey: number
}

export function SpendingView({ resetKey }: Props) {
  const { t, lang } = useTranslation()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [manageMenuOpen, setManageMenuOpen] = useState(false)
  const [managingCategories, setManagingCategories] = useState(false)
  const [managingRecurring, setManagingRecurring] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showPlanning, setShowPlanning] = useState(false)
  const [managingBudget, setManagingBudget] = useState(false)
  const [showBudgetStatus, setShowBudgetStatus] = useState(false)
  const [categoryModalFor, setCategoryModalFor] = useState<{ categoryId: number; currency: Currency } | null>(null)

  // resetKey bumps when the user re-taps the already-active Spending nav tab —
  // jump back to the current month and close any open popup, skipping the
  // very first render (that's not a re-tap).
  const isFirstResetRef = useRef(true)
  useEffect(() => {
    if (isFirstResetRef.current) {
      isFirstResetRef.current = false
      return
    }
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth())
    setOpenDay(null)
    setQuickAddOpen(false)
    setManageMenuOpen(false)
    setManagingCategories(false)
    setManagingRecurring(false)
    setShowAnalytics(false)
    setShowPlanning(false)
    setManagingBudget(false)
    setShowBudgetStatus(false)
    setCategoryModalFor(null)
  }, [resetKey])
  const [spendingCurrencies] = useMetaSetting<Currency[]>('enabledSpendingCurrencies', DEFAULT_SPENDING_CURRENCIES)
  const [budgetEnabled] = useMetaSetting<boolean>('budgetEnabled', false)

  const monthPrefix = `${year}-${pad2(month + 1)}`
  const entries = useLiveQuery(
    () => db.spendingEntries.where('date').startsWith(monthPrefix).toArray(),
    [monthPrefix],
  )
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const categoryMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const recurringExpenses = useLiveQuery(() => db.recurringExpenses.toArray(), []) ?? []
  // Each active recurring expense's next 12 occurrence dates — previewed on
  // the calendar even before they're materialized into real entries (that
  // only happens once a date actually arrives), so paging the calendar
  // forward keeps showing it moving one period at a time, not just once.
  const recurringPreviews = useMemo(
    () => recurringExpenses.filter((r) => r.active).map((r) => ({ r, dates: recurringPreviewDates(r) })),
    [recurringExpenses],
  )

  // date -> currency -> total
  const totalsByDay = useMemo(() => {
    const map = new Map<string, Map<Currency, number>>()
    for (const e of entries ?? []) {
      const dayMap = map.get(e.date) ?? new Map<Currency, number>()
      dayMap.set(e.currency, (dayMap.get(e.currency) ?? 0) + e.amount)
      map.set(e.date, dayMap)
    }
    // Skipped wherever a real entry already exists for that date (that's
    // what materializes a preview into an actual total).
    for (const { r, dates } of recurringPreviews) {
      for (const date of dates) {
        if (map.has(date)) continue
        map.set(date, new Map([[r.currency, r.amount]]))
      }
    }
    return map
  }, [entries, recurringPreviews])

  // date -> whether that day has a recurring-generated entry, or one dated
  // in the future (planned but not yet happened) — drives the tiny corner badges.
  const dayBadgesByDate = useMemo(() => {
    const today = todayIso()
    const map = new Map<string, { recurring: boolean; upcoming: boolean }>()
    for (const e of entries ?? []) {
      const flags = map.get(e.date) ?? { recurring: false, upcoming: false }
      if (e.recurringExpenseId != null) flags.recurring = true
      if (e.date > today) flags.upcoming = true
      map.set(e.date, flags)
    }
    for (const { dates } of recurringPreviews) {
      for (const date of dates) {
        const flags = map.get(date) ?? { recurring: false, upcoming: false }
        flags.recurring = true
        if (date > today) flags.upcoming = true
        map.set(date, flags)
      }
    }
    return map
  }, [entries, recurringPreviews])

  const monthTotals: Record<Currency, number> = { EUR: 0, USD: 0, RUB: 0, JPY: 0, CNY: 0 }
  entries?.forEach((e) => {
    monthTotals[e.currency] += e.amount
  })
  const visibleCurrencies = CURRENCIES.filter((c) => spendingCurrencies.includes(c.code))

  // Budget status always reflects the real current month, never whatever
  // month is being browsed elsewhere on this screen.
  const categoryBudgets = useLiveQuery(() => db.categoryBudgets.toArray(), []) ?? []
  const [totalBudgetLimit] = useMetaSetting<Partial<Record<Currency, number>>>('totalBudgetLimit', {})
  const realMonthPrefix = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`
  const realMonthEntriesRaw =
    useLiveQuery(() => db.spendingEntries.where('date').startsWith(realMonthPrefix).toArray(), [realMonthPrefix]) ?? []
  // A future-dated entry hasn't actually happened yet — it shouldn't count
  // as "already spent" any more than a recurring expense that hasn't
  // materialized yet does.
  const realMonthEntries = useMemo(
    () => realMonthEntriesRaw.filter((e) => e.date <= todayIso()),
    [realMonthEntriesRaw],
  )
  const budgetStatus = useMemo(
    () =>
      budgetEnabled
        ? computeBudgetStatus(
            categoryBudgets,
            totalBudgetLimit,
            realMonthEntries,
            today.getDate(),
            daysInMonth(today.getFullYear(), today.getMonth()),
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budgetEnabled, categoryBudgets, totalBudgetLimit, realMonthEntries],
  )

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
      <HeaderPortal>
        <button className="btn btn-accent-text manage-btn" onClick={() => setManageMenuOpen(true)} type="button">
          {t('Manage')}
          <ManageIcon size={20} />
        </button>
      </HeaderPortal>

      <div className="section-title">
        <h2>
          {t('Total spent')} — {t(MONTH_NAMES[month])} {year}
        </h2>
        <button
          className="btn btn-accent-text header-action-desktop manage-btn"
          onClick={() => setManageMenuOpen(true)}
          type="button"
        >
          {t('Manage')}
          <ManageIcon size={20} />
        </button>
      </div>
      <div className="totals-row">
        {visibleCurrencies.map((c) => (
          <div className="total-chip" key={c.code}>
            <div className="muted">{c.code}</div>
            <div className="amount">{formatMoney(monthTotals[c.code], c.code)}</div>
          </div>
        ))}
      </div>

      {budgetStatus && (() => {
        const hasCategoryIssue = budgetStatus.overBudgetCategoryCount > 0
        const isOrange = budgetStatus.level !== 'red' && hasCategoryIssue
        const color =
          budgetStatus.level === 'red'
            ? 'var(--danger-strong)'
            : isOrange
              ? 'var(--warning-strong)'
              : budgetStatus.level === 'yellow'
                ? 'var(--warning)'
                : 'var(--accent)'
        const text =
          budgetStatus.level === 'red'
            ? t('Spending over the budget')
            : isOrange
              ? tLimitsExceededInCategories(lang, budgetStatus.overBudgetCategoryCount)
              : budgetStatus.level === 'yellow'
                ? t('Spending close to budget')
                : t('Spending according to budget')
        const StatusIcon = budgetStatus.level === 'red' ? XMarkIcon : isOrange || budgetStatus.level === 'yellow' ? WarningIcon : CheckIcon
        return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="btn-ghost budget-status-text"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              width: 'fit-content',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              color,
            }}
            onClick={() => setShowBudgetStatus(true)}
            type="button"
          >
            <StatusIcon size={13} />
            {text}
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowBudgetStatus(true)}
            aria-label={t('Budget status')}
            type="button"
            style={{ padding: 2, fontSize: '0.9rem', flexShrink: 0 }}
          >
            ⓘ
          </button>
        </div>
        )
      })()}

      <div className="card">
        <div className="calendar-header">
          <button className="btn btn-ghost btn-icon" onClick={goPrevMonth} aria-label={t('Previous month')} type="button">
            ‹
          </button>
          <span className="month-label">
            {t(MONTH_NAMES[month])} {year}
          </span>
          <button className="btn btn-ghost btn-icon" onClick={goNextMonth} aria-label={t('Next month')} type="button">
            ›
          </button>
        </div>

        <div className="calendar-grid" style={{ marginTop: 12 }}>
          {WEEKDAY_LABELS.map((w) => (
            <div className="weekday-label" key={w}>
              {t(w)}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (cell.day === null) return <div className="calendar-cell pad" key={`pad-${i}`} />
            const dayMap = totalsByDay.get(cell.date!)
            const isToday = isCurrentMonth && cell.date === todayStr
            const badges = dayBadgesByDate.get(cell.date!)
            let primary: [Currency, number] | null = null
            let extraCount = 0
            if (dayMap && dayMap.size > 0) {
              const pairs = Array.from(dayMap.entries())
              const preferred = spendingCurrencies.find((c) => dayMap.has(c))
              primary = preferred ? [preferred, dayMap.get(preferred)!] : pairs.sort((a, b) => b[1] - a[1])[0]
              extraCount = pairs.length - 1
            }
            return (
              <button
                key={cell.date}
                className={`calendar-cell${isToday ? ' today' : ''}${primary ? ' has-spend' : ''}`}
                onClick={() => setOpenDay(cell.date)}
                type="button"
              >
                <EntryBadges
                  recurring={badges?.recurring}
                  recurringHappened={cell.date! <= todayStr}
                  upcoming={badges?.upcoming}
                  size={16}
                  className="calendar-cell-badges"
                />
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
        <h2>{t('By category')}</h2>
      </div>

      {breakdown.length === 0 ? (
        <div className="empty-state">
          <span className="icon">📅</span>
          {t('No spending logged this month yet. Tap any day to add an expense.')}
        </div>
      ) : (
        <div className="category-breakdown">
          {breakdown.map(({ categoryId, currency, total, category, barPct }) => (
            <button
              className="category-breakdown-row"
              key={`${categoryId}:${currency}`}
              type="button"
              onClick={() => setCategoryModalFor({ categoryId, currency })}
            >
              <span className="swatch" style={{ background: category?.color ?? '#888' }} />
              <span style={{ width: 96, flexShrink: 0 }}>{category?.name ?? t('Unknown')}</span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${barPct}%`, background: category?.color ?? '#888' }}
                />
              </div>
              <strong>{formatMoney(total, currency)}</strong>
            </button>
          ))}
        </div>
      )}

      <button
        className="fab"
        aria-label={t('Add expense')}
        onClick={() => {
          setOpenDay(todayStr)
          setQuickAddOpen(true)
        }}
      >
        +
      </button>

      {openDay && (
        <DayEntriesModal
          initialDate={openDay}
          quickAdd={quickAddOpen}
          onClose={() => {
            setOpenDay(null)
            setQuickAddOpen(false)
          }}
          onManageCategories={() => {
            setOpenDay(null)
            setQuickAddOpen(false)
            setManagingCategories(true)
          }}
        />
      )}

      {manageMenuOpen && (
        <ManageMenuModal
          onClose={() => setManageMenuOpen(false)}
          onCategories={() => {
            setManageMenuOpen(false)
            setManagingCategories(true)
          }}
          onRecurring={() => {
            setManageMenuOpen(false)
            setManagingRecurring(true)
          }}
          onAnalytics={() => {
            setManageMenuOpen(false)
            setShowAnalytics(true)
          }}
          onPlanning={() => {
            setManageMenuOpen(false)
            setShowPlanning(true)
          }}
          onBudget={() => {
            setManageMenuOpen(false)
            setManagingBudget(true)
          }}
        />
      )}

      {managingCategories && <CategoryManagerModal onClose={() => setManagingCategories(false)} />}

      {managingRecurring && <RecurringExpensesModal onClose={() => setManagingRecurring(false)} />}

      {showAnalytics && <AnalyticsModal onClose={() => setShowAnalytics(false)} />}

      {showPlanning && <PlanningModal onClose={() => setShowPlanning(false)} />}

      {managingBudget && <BudgetModal onClose={() => setManagingBudget(false)} />}

      {showBudgetStatus && <BudgetStatusModal onClose={() => setShowBudgetStatus(false)} />}

      {categoryModalFor && (
        <CategoryExpensesModal
          categoryId={categoryModalFor.categoryId}
          currency={categoryModalFor.currency}
          categoryName={categoryMap.get(categoryModalFor.categoryId)?.name ?? t('Unknown')}
          categoryColor={categoryMap.get(categoryModalFor.categoryId)?.color ?? '#888'}
          monthPrefix={monthPrefix}
          onClose={() => setCategoryModalFor(null)}
        />
      )}
    </div>
  )
}

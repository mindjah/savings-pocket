import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { formatMoney, pad2 } from '../../lib/format'
import { categoryPaceLevel } from '../../lib/planning'
import type { BudgetStatusLevel } from '../../lib/planning'
import { Modal } from '../common/Modal'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  onClose: () => void
}

const LEVEL_COLOR: Record<BudgetStatusLevel, string> = {
  green: 'var(--accent)',
  yellow: 'var(--warning)',
  red: 'var(--danger-strong)',
}

export function BudgetStatusModal({ onClose }: Props) {
  const { t } = useTranslation()
  const budgets = useLiveQuery(() => db.categoryBudgets.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const elapsedFraction = now.getDate() / daysInMonth
  const spendingThisMonth =
    useLiveQuery(() => db.spendingEntries.where('date').startsWith(monthPrefix).toArray(), [monthPrefix]) ?? []

  const { budgetedRows, otherRows } = useMemo(() => {
    const actualByKey = new Map<string, number>()
    spendingThisMonth.forEach((e) => {
      const key = `${e.categoryId}:${e.currency}`
      actualByKey.set(key, (actualByKey.get(key) ?? 0) + e.amount)
    })
    // Multiple budget entries can exist per category (e.g. several line items
    // making up its budget) — sum them so each category shows as one row.
    const budgetByKey = new Map<string, { categoryId: number; currency: (typeof budgets)[number]['currency']; budget: number }>()
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
        return { categoryId: Number(categoryId), currency: currency as (typeof budgets)[number]['currency'], actual }
      })
      .sort((a, b) => b.actual - a.actual)

    return { budgetedRows, otherRows }
  }, [budgets, spendingThisMonth, elapsedFraction])

  const hasAnything = budgetedRows.length > 0 || otherRows.length > 0

  return (
    <Modal title={t('Budget status')} onClose={onClose}>
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
                      <div style={{ color: LEVEL_COLOR[r.level], fontWeight: 700 }}>{cat?.name ?? t('Unknown')}</div>
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
                <h2>{t('Other categories')}</h2>
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

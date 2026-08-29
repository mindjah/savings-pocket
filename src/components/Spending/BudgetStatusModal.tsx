import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { formatMoney, pad2 } from '../../lib/format'
import { Modal } from '../common/Modal'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  onClose: () => void
}

export function BudgetStatusModal({ onClose }: Props) {
  const { t } = useTranslation()
  const budgets = useLiveQuery(() => db.categoryBudgets.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  const spendingThisMonth =
    useLiveQuery(() => db.spendingEntries.where('date').startsWith(monthPrefix).toArray(), [monthPrefix]) ?? []

  const rows = useMemo(() => {
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
    return Array.from(budgetByKey.entries())
      .map(([key, v]) => ({ ...v, actual: actualByKey.get(key) ?? 0 }))
      // Most over-budget first, so the categories worth looking at surface immediately.
      .sort((a, b) => b.actual - b.budget - (a.actual - a.budget))
  }, [budgets, spendingThisMonth])

  return (
    <Modal title={t('Budget status')} onClose={onClose}>
      {rows.length === 0 ? (
        <div className="empty-state">
          <span className="icon">📊</span>
          {t('No budget set yet. Set one up in Manage budget.')}
        </div>
      ) : (
        <div className="category-list">
          {rows.map((r) => {
            const cat = categoryMap.get(r.categoryId)
            const left = r.budget - r.actual
            const over = left < 0
            return (
              <div className="category-row" key={`${r.categoryId}:${r.currency}`}>
                <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                <div style={{ flex: 1 }}>
                  <div>{cat?.name ?? t('Unknown')}</div>
                  <div className="muted" style={{ fontSize: '0.82rem' }}>
                    {t('Budget')}: {formatMoney(r.budget, r.currency)} · {t('Spent')}: {formatMoney(r.actual, r.currency)}
                  </div>
                </div>
                <strong style={{ color: over ? 'var(--danger-strong)' : undefined }}>
                  {formatMoney(left, r.currency)}
                </strong>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

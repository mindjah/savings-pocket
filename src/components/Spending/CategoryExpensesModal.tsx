import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { formatDate, formatMoney, todayIso } from '../../lib/format'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { DeleteIcon } from '../common/DeleteIcon'
import { EntryBadges } from '../common/EntryBadges'

interface Props {
  categoryId: number
  currency: Currency
  categoryName: string
  categoryColor: string
  // A single "yyyy-mm" for the live Spending screen's own month-scoped
  // usage, or several for Analytics (a whole year, or the last 6 months).
  monthPrefix: string | string[]
  // Analytics shows historical spending for reference only — no delete
  // (and nothing to edit here to begin with).
  readOnly?: boolean
  totalLabel?: string
  onClose: () => void
}

export function CategoryExpensesModal({
  categoryId,
  currency,
  categoryName,
  categoryColor,
  monthPrefix,
  readOnly = false,
  totalLabel,
  onClose,
}: Props) {
  const { t, lang } = useTranslation()
  const monthPrefixes = Array.isArray(monthPrefix) ? monthPrefix : [monthPrefix]
  const entries = useLiveQuery(
    async () =>
      (await db.spendingEntries.toArray())
        .filter(
          (e) =>
            e.categoryId === categoryId && e.currency === currency && monthPrefixes.some((m) => e.date.startsWith(m)),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [categoryId, currency, monthPrefixes.join(',')],
  )
  const toast = useToast()

  async function handleDelete(id?: number) {
    if (!id) return
    if (!confirm(t('Delete this spending entry?'))) return
    await db.spendingEntries.delete(id)
    toast(t('Spending entry deleted'))
  }

  const total = (entries ?? []).reduce((sum, e) => sum + e.amount, 0)

  return (
    <Modal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="swatch" style={{ background: categoryColor }} />
          {categoryName}
        </span>
      }
      onClose={onClose}
    >
      <div className="section-title">
        <span className="muted">{totalLabel ?? t('Total this month')}</span>
        <span className="entry-amount">{formatMoney(total, currency)}</span>
      </div>

      {!entries || entries.length === 0 ? (
        <div className="empty-state">{t('No expenses in this category yet.')}</div>
      ) : (
        <div className="entry-list">
          {entries.map((e) => (
            <div className="day-entry-row" key={e.id}>
              <div className="info">
                <div className="text">
                  <div className="cat entry-badges">
                    <span>{formatDate(e.date, lang)}</span>
                    <EntryBadges
                      recurring={e.recurringExpenseId != null}
                      recurringHappened={e.date <= todayIso()}
                      upcoming={e.date > todayIso()}
                    />
                  </div>
                  {e.note && (
                    <div className="note" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' }}>
                      {e.note}
                    </div>
                  )}
                </div>
              </div>
              <div className="icon-btn-row" style={{ alignItems: 'center' }}>
                <strong>{formatMoney(e.amount, e.currency)}</strong>
                {!readOnly && (
                  <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(e.id)} type="button">
                    <DeleteIcon />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

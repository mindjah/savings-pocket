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
  monthPrefix: string
  onClose: () => void
}

export function CategoryExpensesModal({ categoryId, currency, categoryName, categoryColor, monthPrefix, onClose }: Props) {
  const { t, lang } = useTranslation()
  const entries = useLiveQuery(
    async () =>
      (await db.spendingEntries.where('date').startsWith(monthPrefix).toArray())
        .filter((e) => e.categoryId === categoryId && e.currency === currency)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [categoryId, currency, monthPrefix],
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
        <span className="muted">{t('Total this month')}</span>
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
                <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(e.id)} type="button">
                  <DeleteIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

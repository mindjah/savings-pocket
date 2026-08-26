import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { formatDate, formatMoney } from '../../lib/format'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { DeleteIcon } from '../common/DeleteIcon'

interface Props {
  categoryId: number
  currency: Currency
  categoryName: string
  monthPrefix: string
  onClose: () => void
}

export function CategoryExpensesModal({ categoryId, currency, categoryName, monthPrefix, onClose }: Props) {
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
    <Modal title={categoryName} onClose={onClose}>
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
                  <div className="cat">{formatDate(e.date, lang)}</div>
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

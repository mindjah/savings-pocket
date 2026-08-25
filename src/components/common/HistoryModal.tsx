import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { formatDateTime } from '../../lib/format'
import { Modal } from './Modal'

interface Props {
  table: 'savingsHistory' | 'cryptoHistory' | 'loanHistory'
  entryId: number
  formatAmount: (n: number) => string
  onClose: () => void
}

export function HistoryModal({ table, entryId, formatAmount, onClose }: Props) {
  const history = useLiveQuery(
    () => db[table].where('entryId').equals(entryId).reverse().sortBy('date'),
    [table, entryId],
  )

  return (
    <Modal title="Amount history" onClose={onClose}>
      {!history || history.length === 0 ? (
        <div className="empty-state">
          <span className="icon">🕓</span>
          No changes logged yet.
        </div>
      ) : (
        <div className="history-list">
          {history.map((h) => {
            const delta = h.newAmount - h.previousAmount
            return (
              <div className="history-item" key={h.id}>
                <div className="entry-top">
                  <span>{formatDateTime(h.date)}</span>
                  <span className={delta >= 0 ? 'delta-pos' : 'delta-neg'}>
                    {delta >= 0 ? '+' : ''}
                    {formatAmount(delta)}
                  </span>
                </div>
                <div className="muted">
                  {formatAmount(h.previousAmount)} → {formatAmount(h.newAmount)}
                </div>
                {h.comment && <div className="entry-note">{h.comment}</div>}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { formatDateTime, formatMoney } from '../../lib/format'
import { currentDebitedAmount } from '../../lib/autoDebit'
import { Modal } from '../common/Modal'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  entryId: number
  currency: Currency
  onClose: () => void
}

type Tab = 'manual' | 'spending'

export function PocketHistoryModal({ entryId, currency, onClose }: Props) {
  const { t, lang } = useTranslation()
  const [tab, setTab] = useState<Tab>('manual')

  const history = useLiveQuery(
    () => db.savingsHistory.where('entryId').equals(entryId).reverse().sortBy('date'),
    [entryId],
  )

  const rows = (history ?? []).filter((h) => (h.source ?? 'manual') === tab)

  return (
    <Modal title={t('History')} onClose={onClose}>
      <div className="segmented">
        <button type="button" className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>
          {t('Manual changes')}
        </button>
        <button type="button" className={tab === 'spending' ? 'active' : ''} onClick={() => setTab('spending')}>
          {t('Spending')}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <span className="icon">🕓</span>
          {t(tab === 'manual' ? 'No manual changes logged yet.' : 'No spending debited from this pocket yet.')}
        </div>
      ) : (
        <div className="history-list">
          {rows.map((h) => {
            // previousAmount is the pocket's real balance just before this
            // row's own operation ever happened — frozen forever (see
            // SavingsHistory's own comment), a stable baseline to measure
            // against regardless of later edits. The "after" side, for a
            // 'spending' row, is recalculated from that same baseline using
            // the expense's CURRENT amount (post-edit) rather than the
            // stored newAmount, which only ever reflects what it was at
            // creation — so the headline always shows what this expense
            // currently does to the pocket, not a stale original. (A
            // 'manual' row is never edited, so this is a no-op for it —
            // newAmount already IS current.)
            const currentAmount = currentDebitedAmount(h)
            const displayedNewAmount = h.previousAmount - currentAmount
            const delta = displayedNewAmount - h.previousAmount
            return (
              <div className={`history-item${h.reversed ? ' history-item-reversed' : ''}`} key={h.id}>
                <div className="entry-top">
                  <span>{formatDateTime(h.date, lang)}</span>
                  <span className={delta >= 0 ? 'delta-pos' : 'delta-neg'}>
                    {delta >= 0 ? '+' : ''}
                    {formatMoney(delta, currency)}
                  </span>
                </div>
                <div className="muted">
                  {formatMoney(h.previousAmount, currency)} → {formatMoney(displayedNewAmount, currency)}
                </div>
                {h.comment && <div className="entry-note">{h.comment}</div>}
                {h.reversed && (
                  <div className="muted history-item-reversed-label">{t('Deleted — this spending no longer counts')}</div>
                )}
                {h.edits && h.edits.length > 0 && (
                  <div className="history-item-edit-trail">
                    {h.edits.map((edit, i) => {
                      const previousComment = i === 0 ? h.comment : h.edits![i - 1].comment
                      return (
                        <div className="history-item-edit" key={i}>
                          <div className="entry-top">
                            <span className="muted">
                              {t('Edited')} · {formatDateTime(edit.date, lang)}
                            </span>
                          </div>
                          <div className="muted">
                            {formatMoney(edit.previousAmount, currency)} → {formatMoney(edit.newAmount, currency)}
                          </div>
                          {edit.comment && edit.comment !== previousComment && <div className="entry-note">{edit.comment}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

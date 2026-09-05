import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency } from '../../db/types'
import { formatDateTime, formatMoney } from '../../lib/format'
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
            const delta = h.newAmount - h.previousAmount
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
                  {formatMoney(h.previousAmount, currency)} → {formatMoney(h.newAmount, currency)}
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

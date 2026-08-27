import { useMemo, useState } from 'react'
import { db } from '../../db/db'
import type { SavingsEntry } from '../../db/types'
import { formatMoney, parseAmount } from '../../lib/format'
import { Modal } from '../common/Modal'
import { ExpandableTextarea } from '../common/ExpandableTextarea'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { AddToPocketIcon } from '../common/AddToPocketIcon'

interface Props {
  entry: SavingsEntry
  onClose: () => void
}

type Direction = 'add' | 'charge'

export function AdjustPocketModal({ entry, onClose }: Props) {
  const { t } = useTranslation()
  const [direction, setDirection] = useState<Direction>('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const toast = useToast()

  const parsedAmount = useMemo(() => parseAmount(amount), [amount])
  const delta = direction === 'add' ? parsedAmount : -parsedAmount
  const newAmount = entry.amount + (Number.isNaN(delta) ? 0 : delta)

  const valid = amount.trim() !== '' && !Number.isNaN(parsedAmount) && parsedAmount > 0 && newAmount >= 0

  async function handleConfirm() {
    if (!valid || entry.id == null) return
    const now = new Date().toISOString()
    await db.transaction('rw', db.savingsEntries, db.savingsHistory, async () => {
      await db.savingsEntries.update(entry.id!, { amount: newAmount, updatedAt: now })
      await db.savingsHistory.add({
        entryId: entry.id!,
        previousAmount: entry.amount,
        newAmount,
        date: now,
        comment: reason.trim() || (direction === 'add' ? 'Manual deposit' : 'Manual withdrawal'),
        source: 'manual',
      })
    })
    toast(t(direction === 'add' ? 'Added to pocket' : 'Charged from pocket'))
    onClose()
  }

  return (
    <Modal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <AddToPocketIcon size={20} />
          {t('Adjust balance')}
        </span>
      }
      onClose={onClose}
    >
      <div className="segmented">
        <button type="button" className={direction === 'add' ? 'active' : ''} onClick={() => setDirection('add')}>
          {t('+ Add')}
        </button>
        <button type="button" className={direction === 'charge' ? 'active' : ''} onClick={() => setDirection('charge')}>
          {t('− Charge')}
        </button>
      </div>

      <div className="form-group">
        <label htmlFor="adjustAmount">{t('Amount')}</label>
        <input
          id="adjustAmount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      {amount.trim() !== '' && !Number.isNaN(parsedAmount) && (
        <div className="muted">
          {formatMoney(entry.amount, entry.currency)} → {formatMoney(newAmount, entry.currency)}
          {newAmount < 0 && <span style={{ color: 'var(--danger-strong)' }}>{t(" — can't go below zero")}</span>}
        </div>
      )}

      <ExpandableTextarea
        id="adjustReason"
        label={t('Reason (saved to history)')}
        value={reason}
        onChange={setReason}
        placeholder={t(direction === 'add' ? 'e.g. Cash deposit' : 'e.g. Withdrew for a trip')}
      />

      <div className="modal-actions">
        <button className="btn btn-primary btn-block" onClick={handleConfirm} disabled={!valid} type="button">
          {t(direction === 'add' ? 'Add to pocket' : 'Charge from pocket')}
        </button>
      </div>
    </Modal>
  )
}

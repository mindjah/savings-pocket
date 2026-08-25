import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency, MoneyType, SavingsEntry } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'

interface Props {
  entry: SavingsEntry | null
  defaultCurrency: Currency
  onClose: () => void
}

export function SavingsEntryForm({ entry, defaultCurrency, onClose }: Props) {
  const isEdit = !!entry
  const [currency, setCurrency] = useState<Currency>(entry?.currency ?? defaultCurrency)
  const [type, setType] = useState<MoneyType>(entry?.type ?? 'cash')
  const [location, setLocation] = useState(entry?.location ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const [reason, setReason] = useState('')
  const toast = useToast()

  const knownLocations = useLiveQuery(async () => {
    const rows = await db.savingsEntries.toArray()
    return Array.from(new Set(rows.map((r) => r.location).filter(Boolean)))
  }, [])

  const parsedAmount = useMemo(() => Number(amount), [amount])
  const amountChanged = isEdit && entry && parsedAmount !== entry.amount
  const valid = location.trim().length > 0 && !Number.isNaN(parsedAmount) && parsedAmount >= 0

  async function handleSubmit() {
    if (!valid) return
    const now = new Date().toISOString()
    if (isEdit && entry?.id != null) {
      if (amountChanged) {
        await db.savingsHistory.add({
          entryId: entry.id,
          previousAmount: entry.amount,
          newAmount: parsedAmount,
          date: now,
          comment: reason.trim(),
        })
      }
      await db.savingsEntries.update(entry.id, {
        currency,
        type,
        location: location.trim(),
        note: note.trim(),
        amount: parsedAmount,
        updatedAt: now,
      })
      toast('Savings entry updated')
    } else {
      await db.savingsEntries.add({
        currency,
        type,
        location: location.trim(),
        note: note.trim(),
        amount: parsedAmount,
        createdAt: now,
        updatedAt: now,
      })
      toast('Savings entry added')
    }
    onClose()
  }

  async function handleDelete() {
    if (!entry?.id) return
    if (!confirm('Delete this entry and all of its history? This cannot be undone.')) return
    await db.transaction('rw', db.savingsEntries, db.savingsHistory, async () => {
      await db.savingsHistory.where('entryId').equals(entry.id!).delete()
      await db.savingsEntries.delete(entry.id!)
    })
    toast('Savings entry deleted')
    onClose()
  }

  return (
    <Modal title={isEdit ? 'Edit savings entry' : 'Add savings entry'} onClose={onClose}>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="currency">Currency</label>
          <select
            id="currency"
            value={currency}
            disabled={isEdit}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Held as</label>
          <div className="segmented">
            <button type="button" className={type === 'cash' ? 'active' : ''} onClick={() => setType('cash')}>
              Cash
            </button>
            <button type="button" className={type === 'card' ? 'active' : ''} onClick={() => setType('card')}>
              Card
            </button>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="amount">Amount</label>
        <input
          id="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="form-group">
        <label htmlFor="location">Location (country / bank / place)</label>
        <input
          id="location"
          list="known-locations"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Spain — BBVA"
        />
        <datalist id="known-locations">
          {knownLocations?.map((loc) => (
            <option key={loc} value={loc} />
          ))}
        </datalist>
      </div>

      <div className="form-group">
        <label htmlFor="note">Note</label>
        <textarea
          id="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Details about this money"
        />
      </div>

      {amountChanged && (
        <div className="form-group">
          <label htmlFor="reason">Reason for change (saved to history)</label>
          <textarea
            id="reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why did this amount change?"
          />
        </div>
      )}

      <div className="modal-actions">
        {isEdit && (
          <button className="btn btn-danger" onClick={handleDelete} type="button">
            Delete
          </button>
        )}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!valid} type="button">
          {isEdit ? 'Save changes' : 'Add entry'}
        </button>
      </div>
    </Modal>
  )
}

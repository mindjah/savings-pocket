import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency, MoneyType, SavingsEntry } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { parseAmount } from '../../lib/format'
import { Modal } from '../common/Modal'
import { ExpandableTextarea } from '../common/ExpandableTextarea'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { AddNewPocketIcon } from '../common/AddNewPocketIcon'

interface Props {
  entry: SavingsEntry | null
  defaultCurrency: Currency
  availableCurrencies: Currency[]
  onClose: () => void
}

export function SavingsEntryForm({ entry, defaultCurrency, availableCurrencies, onClose }: Props) {
  const { t } = useTranslation()
  const isEdit = !!entry
  const [currency, setCurrency] = useState<Currency>(entry?.currency ?? defaultCurrency)
  // Keep the entry's own currency selectable even if it was later disabled in Settings.
  const currencyOptions = CURRENCIES.filter(
    (c) => availableCurrencies.includes(c.code) || c.code === entry?.currency,
  )
  const [type, setType] = useState<MoneyType>(entry?.type ?? 'card')
  const [location, setLocation] = useState(entry?.location ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const [reason, setReason] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const toast = useToast()

  const knownLocations = useLiveQuery(async () => {
    const rows = await db.savingsEntries.toArray()
    return Array.from(new Set(rows.map((r) => r.location).filter(Boolean)))
  }, [])

  const parsedAmount = useMemo(() => parseAmount(amount), [amount])
  const amountChanged = isEdit && entry && parsedAmount !== entry.amount
  const valid =
    location.trim().length > 0 && amount.trim() !== '' && !Number.isNaN(parsedAmount) && parsedAmount >= 0

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
          source: 'manual',
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
      toast(t('Savings entry updated'))
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
      toast(t('Savings entry added'))
    }
    onClose()
  }

  async function handleDelete() {
    if (!entry?.id) return
    if (!confirm(t('Delete this entry and all of its history? This cannot be undone.'))) return
    await db.transaction('rw', db.savingsEntries, db.savingsHistory, async () => {
      await db.savingsHistory.where('entryId').equals(entry.id!).delete()
      await db.savingsEntries.delete(entry.id!)
    })
    toast(t('Savings entry deleted'))
    onClose()
  }

  return (
    <Modal
      title={
        isEdit ? (
          t('Edit savings pocket')
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <AddNewPocketIcon size={20} />
            {t('Add savings pocket')}
          </span>
        )
      }
      onClose={onClose}
    >
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="currency">{t('Currency')}</label>
          <select
            id="currency"
            value={currency}
            disabled={isEdit}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('Held as')}</label>
          <div className="segmented">
            <button type="button" className={type === 'cash' ? 'active' : ''} onClick={() => setType('cash')}>
              {t('Cash')}
            </button>
            <button type="button" className={type === 'card' ? 'active' : ''} onClick={() => setType('card')}>
              {t('Card')}
            </button>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="amount">{t('Amount')}</label>
        <input
          id="amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="form-group">
        <label htmlFor="location">{t('Location (country / bank / place)')}</label>
        <input
          id="location"
          list="known-locations"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t('e.g. Spain — BBVA')}
        />
        <datalist id="known-locations">
          {knownLocations?.map((loc) => (
            <option key={loc} value={loc} />
          ))}
        </datalist>
      </div>

      <ExpandableTextarea
        id="note"
        label={t('Note')}
        value={note}
        onChange={setNote}
        placeholder={t('Details about this money')}
      />

      {amountChanged && (
        <ExpandableTextarea
          id="reason"
          label={t('Reason for change (saved to history)')}
          value={reason}
          onChange={setReason}
          placeholder={t('Why did this amount change?')}
        />
      )}

      <div className="modal-actions">
        {isEdit && (
          <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)} type="button">
            {t('Delete')}
          </button>
        )}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!valid} type="button">
          {t(isEdit ? 'Save changes' : 'Add pocket')}
        </button>
      </div>

      {confirmingDelete && (
        <DeleteConfirmModal
          itemLabel={t('this savings entry')}
          onConfirmed={handleDelete}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </Modal>
  )
}

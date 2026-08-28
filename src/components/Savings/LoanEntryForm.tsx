import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency, LoanEntry } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { parseAmount, roundFiat } from '../../lib/format'
import { Modal } from '../common/Modal'
import { ExpandableTextarea } from '../common/ExpandableTextarea'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  entry: LoanEntry | null
  defaultCurrency: Currency
  availableCurrencies: Currency[]
  onClose: () => void
}

export function LoanEntryForm({ entry, defaultCurrency, availableCurrencies, onClose }: Props) {
  const { t } = useTranslation()
  const isEdit = !!entry
  const [borrowerName, setBorrowerName] = useState(entry?.borrowerName ?? '')
  const [currency, setCurrency] = useState<Currency>(entry?.currency ?? defaultCurrency)
  // Keep the entry's own currency selectable even if it was later disabled in Settings.
  const currencyOptions = CURRENCIES.filter(
    (c) => availableCurrencies.includes(c.code) || c.code === entry?.currency,
  )
  const [note, setNote] = useState(entry?.note ?? '')
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const [reason, setReason] = useState('')
  const toast = useToast()

  const knownNames = useLiveQuery(async () => {
    const rows = await db.loanEntries.toArray()
    return Array.from(new Set(rows.map((r) => r.borrowerName).filter(Boolean)))
  }, [])

  const parsedAmount = useMemo(() => roundFiat(parseAmount(amount), currency), [amount, currency])
  const amountChanged = isEdit && entry && parsedAmount !== entry.amount
  const valid =
    borrowerName.trim().length > 0 && amount.trim() !== '' && !Number.isNaN(parsedAmount) && parsedAmount >= 0

  async function handleSubmit() {
    if (!valid) return
    const now = new Date().toISOString()
    if (isEdit && entry?.id != null) {
      if (amountChanged) {
        await db.loanHistory.add({
          entryId: entry.id,
          previousAmount: entry.amount,
          newAmount: parsedAmount,
          date: now,
          comment: reason.trim(),
        })
      }
      await db.loanEntries.update(entry.id, {
        borrowerName: borrowerName.trim(),
        currency,
        note: note.trim(),
        amount: parsedAmount,
        updatedAt: now,
      })
      toast(t('Loan updated'))
    } else {
      await db.loanEntries.add({
        borrowerName: borrowerName.trim(),
        currency,
        note: note.trim(),
        amount: parsedAmount,
        createdAt: now,
        updatedAt: now,
      })
      toast(t('Loan added'))
    }
    onClose()
  }

  async function handleDelete() {
    if (!entry?.id) return
    if (!confirm(t('Delete this loan and all of its history? This cannot be undone.'))) return
    await db.transaction('rw', db.loanEntries, db.loanHistory, async () => {
      await db.loanHistory.where('entryId').equals(entry.id!).delete()
      await db.loanEntries.delete(entry.id!)
    })
    toast(t('Loan deleted'))
    onClose()
  }

  return (
    <Modal title={t(isEdit ? 'Edit loan' : 'Add loan')} onClose={onClose}>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label htmlFor="borrowerName">{t('Lent to')}</label>
          <input
            id="borrowerName"
            list="known-borrowers"
            value={borrowerName}
            onChange={(e) => setBorrowerName(e.target.value)}
            placeholder={t('e.g. John')}
          />
          <datalist id="known-borrowers">
            {knownNames?.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <div className="form-group">
          <label htmlFor="loanCurrency">{t('Currency')}</label>
          <select
            id="loanCurrency"
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
      </div>

      <div className="form-group">
        <label htmlFor="loanAmount">{t('Amount')}</label>
        <input
          id="loanAmount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <ExpandableTextarea
        id="loanNote"
        label={t('Note')}
        value={note}
        onChange={setNote}
        placeholder={t('Details about this loan')}
      />

      {amountChanged && (
        <ExpandableTextarea
          id="loanReason"
          label={t('Reason for change (saved to history)')}
          value={reason}
          onChange={setReason}
          placeholder={t('Why did this amount change? e.g. partial repayment')}
        />
      )}

      <div className="modal-actions">
        {isEdit && (
          <button className="btn btn-danger" onClick={handleDelete} type="button">
            {t('Delete')}
          </button>
        )}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!valid} type="button">
          {t(isEdit ? 'Save changes' : 'Add loan')}
        </button>
      </div>
    </Modal>
  )
}

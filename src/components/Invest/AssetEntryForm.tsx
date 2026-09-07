import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { AssetEntry, Currency } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { parseAmount, roundFiat } from '../../lib/format'
import { Modal } from '../common/Modal'
import { ExpandableTextarea } from '../common/ExpandableTextarea'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  entry: AssetEntry | null
  defaultCurrency: Currency
  availableCurrencies: Currency[]
  onClose: () => void
}

// Deliberately minimal (see AssetEntry) — no adjust-balance/history, just
// add/edit/delete, same shape as LoanEntryForm without the "reason for
// change" bit.
export function AssetEntryForm({ entry, defaultCurrency, availableCurrencies, onClose }: Props) {
  const { t } = useTranslation()
  const isEdit = !!entry
  const [name, setName] = useState(entry?.name ?? '')
  const [currency, setCurrency] = useState<Currency>(entry?.currency ?? defaultCurrency)
  // Keep the entry's own currency selectable even if it was later disabled in Settings.
  const currencyOptions = CURRENCIES.filter((c) => availableCurrencies.includes(c.code) || c.code === entry?.currency)
  const [note, setNote] = useState(entry?.note ?? '')
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const toast = useToast()

  const knownNames = useLiveQuery(async () => {
    const rows = await db.assetEntries.toArray()
    return Array.from(new Set(rows.map((r) => r.name).filter(Boolean)))
  }, [])

  const parsedAmount = useMemo(() => roundFiat(parseAmount(amount), currency), [amount, currency])
  const valid = name.trim().length > 0 && amount.trim() !== '' && !Number.isNaN(parsedAmount) && parsedAmount >= 0

  const dirty = entry
    ? name !== entry.name || currency !== entry.currency || note !== entry.note || amount !== String(entry.amount)
    : name !== '' || currency !== defaultCurrency || note !== '' || amount !== ''

  async function handleSubmit() {
    if (!valid) return
    const now = new Date().toISOString()
    if (isEdit && entry?.id != null) {
      await db.assetEntries.update(entry.id, {
        name: name.trim(),
        currency,
        note: note.trim(),
        amount: parsedAmount,
        updatedAt: now,
      })
      toast(t('Asset updated'))
    } else {
      await db.assetEntries.add({
        name: name.trim(),
        currency,
        note: note.trim(),
        amount: parsedAmount,
        createdAt: now,
        updatedAt: now,
      })
      toast(t('Asset added'))
    }
    onClose()
  }

  async function handleDelete() {
    if (!entry?.id) return
    if (!confirm(t('Delete this asset? This cannot be undone.'))) return
    await db.assetEntries.delete(entry.id)
    toast(t('Asset deleted'))
    onClose()
  }

  return (
    <Modal title={t(isEdit ? 'Edit asset' : 'Add asset')} onClose={onClose} hasUnsavedChanges={dirty}>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label htmlFor="assetName">{t('Name')}</label>
          <input
            id="assetName"
            list="known-assets"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('e.g. Vintage watch')}
          />
          <datalist id="known-assets">
            {knownNames?.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="form-group">
          <label htmlFor="assetCurrency">{t('Currency')}</label>
          <select
            id="assetCurrency"
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
        <label htmlFor="assetAmount">{t('Amount')}</label>
        <input
          id="assetAmount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <ExpandableTextarea
        id="assetNote"
        label={t('Note')}
        value={note}
        onChange={setNote}
        placeholder={t('Details about this asset')}
      />

      <div className="modal-actions">
        {isEdit && (
          <button className="btn btn-danger" onClick={handleDelete} type="button">
            {t('Delete')}
          </button>
        )}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!valid} type="button">
          {t(isEdit ? 'Save changes' : 'Add asset')}
        </button>
      </div>
    </Modal>
  )
}

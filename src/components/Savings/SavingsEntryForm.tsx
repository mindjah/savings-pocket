import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency, MoneyType, PocketIconKind, PocketKind, PocketPurpose, SavingsEntry } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { formatMoney, parseAmount, roundFiat, todayIso } from '../../lib/format'
import { Modal } from '../common/Modal'
import { ExpandableTextarea } from '../common/ExpandableTextarea'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { LoanCreditIcon } from '../common/LoanCreditIcon'
import { PocketIcon } from '../common/PocketIcon'

const POCKET_ICON_CHOICES: PocketIconKind[] = ['card', 'cash', 'pig', 'safebox']

interface Props {
  entry: SavingsEntry | null
  kind: PocketKind
  defaultCurrency: Currency
  availableCurrencies: Currency[]
  onClose: () => void
}

export function SavingsEntryForm({ entry, kind, defaultCurrency, availableCurrencies, onClose }: Props) {
  const { t } = useTranslation()
  const isEdit = !!entry
  const [currency, setCurrency] = useState<Currency>(entry?.currency ?? defaultCurrency)
  // Keep the entry's own currency selectable even if it was later disabled in Settings.
  const currencyOptions = CURRENCIES.filter(
    (c) => availableCurrencies.includes(c.code) || c.code === entry?.currency,
  )
  const [type, setType] = useState<MoneyType>(entry?.type ?? 'card')
  const [icon, setIcon] = useState<PocketIconKind>(entry?.icon ?? entry?.type ?? 'card')
  const [purpose, setPurpose] = useState<PocketPurpose>(entry?.purpose ?? 'savings')
  const [location, setLocation] = useState(entry?.location ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  // Always the positive magnitude — credits are auto-negated on save (see
  // storedAmount below) so typing a debt never requires a minus sign, which
  // several mobile decimal keypads don't even offer.
  const [amount, setAmount] = useState(entry ? String(Math.abs(entry.amount)) : '')
  const [reason, setReason] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [interestRate, setInterestRate] = useState(entry?.interestRateAER != null ? String(entry.interestRateAER) : '')
  const [interestTaxRate, setInterestTaxRate] = useState(entry?.interestTaxRate != null ? String(entry.interestTaxRate) : '')
  const [interestTaxMode, setInterestTaxMode] = useState<'withheld' | 'tracked'>(entry?.interestTaxMode ?? 'withheld')
  const toast = useToast()

  const knownLocations = useLiveQuery(async () => {
    const rows = await db.savingsEntries.where('kind').equals(kind).toArray()
    return Array.from(new Set(rows.map((r) => r.location).filter(Boolean)))
  }, [kind])

  const parsedMagnitude = useMemo(() => roundFiat(Math.abs(parseAmount(amount)), currency), [amount, currency])
  // Credits are stored as a negative debt; regular pockets stay positive.
  const storedAmount = kind === 'credit' ? -parsedMagnitude : parsedMagnitude
  const amountChanged = isEdit && entry && storedAmount !== entry.amount
  const showInterest = kind === 'pocket' && purpose === 'savings'
  const parsedInterestRate = interestRate.trim() === '' ? undefined : parseAmount(interestRate)
  const parsedInterestTaxRate = interestTaxRate.trim() === '' ? undefined : parseAmount(interestTaxRate)
  const interestEnabled = showInterest && parsedInterestRate != null && !Number.isNaN(parsedInterestRate) && parsedInterestRate > 0
  const valid =
    location.trim().length > 0 &&
    amount.trim() !== '' &&
    !Number.isNaN(parsedMagnitude) &&
    (interestRate.trim() === '' || (parsedInterestRate != null && !Number.isNaN(parsedInterestRate) && parsedInterestRate >= 0)) &&
    (interestTaxRate.trim() === '' || (parsedInterestTaxRate != null && !Number.isNaN(parsedInterestTaxRate) && parsedInterestTaxRate >= 0))

  const dirty = entry
    ? currency !== entry.currency ||
      type !== entry.type ||
      icon !== (entry.icon ?? entry.type) ||
      purpose !== (entry.purpose ?? 'savings') ||
      location !== entry.location ||
      note !== entry.note ||
      amount !== String(Math.abs(entry.amount)) ||
      reason.trim() !== '' ||
      interestRate !== (entry.interestRateAER != null ? String(entry.interestRateAER) : '') ||
      interestTaxRate !== (entry.interestTaxRate != null ? String(entry.interestTaxRate) : '') ||
      interestTaxMode !== (entry.interestTaxMode ?? 'withheld')
    : currency !== defaultCurrency ||
      type !== 'card' ||
      icon !== 'card' ||
      purpose !== 'savings' ||
      location !== '' ||
      note !== '' ||
      amount !== '' ||
      interestRate !== '' ||
      interestTaxRate !== ''

  async function handleSubmit() {
    if (!valid) return
    const now = new Date().toISOString()
    // interestLastAccrued starts the moment interest is first turned on —
    // accrual then begins from tomorrow (see materializeSavingsInterest),
    // never retroactively from whenever the pocket itself was created. An
    // already-enabled pocket keeps its existing cursor even if the rate
    // changes; only unset -> set resets it.
    const wasInterestEnabled = (entry?.interestRateAER ?? 0) > 0
    const interestFields = interestEnabled
      ? {
          interestRateAER: parsedInterestRate,
          interestTaxRate: parsedInterestTaxRate ?? 0,
          interestTaxMode,
          interestLastAccrued: wasInterestEnabled ? entry?.interestLastAccrued : todayIso(),
        }
      : {
          interestRateAER: undefined,
          interestTaxRate: undefined,
          interestTaxMode: undefined,
          interestLastAccrued: undefined,
        }
    if (isEdit && entry?.id != null) {
      if (amountChanged) {
        await db.savingsHistory.add({
          entryId: entry.id,
          previousAmount: entry.amount,
          newAmount: storedAmount,
          date: now,
          comment: reason.trim(),
          source: 'manual',
        })
      }
      await db.savingsEntries.update(entry.id, {
        currency,
        type,
        icon: kind === 'pocket' ? icon : undefined,
        purpose: kind === 'pocket' ? purpose : undefined,
        location: location.trim(),
        note: note.trim(),
        amount: storedAmount,
        updatedAt: now,
        ...interestFields,
      })
      toast(t(kind === 'credit' ? 'Credit updated' : 'Savings entry updated'))
    } else {
      await db.savingsEntries.add({
        currency,
        type,
        kind,
        icon: kind === 'pocket' ? icon : undefined,
        purpose: kind === 'pocket' ? purpose : undefined,
        location: location.trim(),
        note: note.trim(),
        amount: storedAmount,
        createdAt: now,
        updatedAt: now,
        ...interestFields,
      })
      toast(t(kind === 'credit' ? 'Credit added' : 'Savings entry added'))
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
    toast(t(kind === 'credit' ? 'Credit deleted' : 'Savings entry deleted'))
    onClose()
  }

  return (
    <Modal
      title={
        isEdit ? (
          t(kind === 'credit' ? 'Edit credit' : 'Edit savings pocket')
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {t(kind === 'credit' ? 'Add credit' : 'Add savings pocket')}
            {kind === 'credit' ? (
              <LoanCreditIcon size={30} />
            ) : (
              <i className="fa-solid fa-piggy-bank" style={{ fontSize: 20 }} aria-hidden="true" />
            )}
          </span>
        )
      }
      onClose={onClose}
      hasUnsavedChanges={dirty}
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
              {t('Account')}
            </button>
          </div>
        </div>
      </div>

      {kind === 'pocket' && (
        <div className="form-group">
          <label>{t('Purpose')}</label>
          <div className="segmented">
            <button type="button" className={purpose === 'savings' ? 'active' : ''} onClick={() => setPurpose('savings')}>
              {t('Savings')}
            </button>
            <button type="button" className={purpose === 'spending' ? 'active' : ''} onClick={() => setPurpose('spending')}>
              {t('Spending')}
            </button>
          </div>
        </div>
      )}

      {showInterest && (
        <div className="form-group">
          <label htmlFor="interestRate">{t('Interest rate (AER %)')}</label>
          <input
            id="interestRate"
            type="text"
            inputMode="decimal"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder={t('None')}
          />
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            {t('If set, interest is added to this pocket daily and shown in its own History tab.')}
          </p>
        </div>
      )}

      {showInterest && interestEnabled && (
        <>
          <div className="form-group">
            <label htmlFor="interestTaxRate">{t('Tax on interest (%)')}</label>
            <input
              id="interestTaxRate"
              type="text"
              inputMode="decimal"
              value={interestTaxRate}
              onChange={(e) => setInterestTaxRate(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label>{t('Tax handling')}</label>
            <div className="segmented">
              <button
                type="button"
                className={interestTaxMode === 'withheld' ? 'active' : ''}
                onClick={() => setInterestTaxMode('withheld')}
              >
                {t('Withheld daily')}
              </button>
              <button
                type="button"
                className={interestTaxMode === 'tracked' ? 'active' : ''}
                onClick={() => setInterestTaxMode('tracked')}
              >
                {t('Tracked separately')}
              </button>
            </div>
            <p className="muted" style={{ fontSize: '0.8rem' }}>
              {interestTaxMode === 'withheld'
                ? t('Tax is deducted from interest before it reaches this pocket, same as most banks do.')
                : t("The full interest is added to this pocket instead — tax owed is only tracked for your own records, not deducted here.")}
            </p>
            {interestTaxMode === 'tracked' && entry?.interestTaxTracked ? (
              <p className="muted" style={{ fontSize: '0.8rem' }}>
                {t('Tax tracked so far')}: {formatMoney(entry.interestTaxTracked, currency)}
              </p>
            ) : null}
          </div>
        </>
      )}

      {kind === 'pocket' && (
        <div className="form-group">
          <label>{t('Icon')}</label>
          <div className="icon-picker">
            {POCKET_ICON_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                className={`icon-picker-btn${icon === choice ? ' selected' : ''}`}
                onClick={() => setIcon(choice)}
                aria-label={choice}
              >
                <PocketIcon icon={choice} fallbackType={type} size={20} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="amount">{t(kind === 'credit' ? 'Amount owed' : 'Amount')}</label>
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
        <label htmlFor="location">{t('Name')}</label>
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
          {t(isEdit ? 'Save changes' : kind === 'credit' ? 'Add credit' : 'Add pocket')}
        </button>
      </div>

      {confirmingDelete && (
        <DeleteConfirmModal
          itemLabel={t(kind === 'credit' ? 'this credit' : 'this savings entry')}
          onConfirmed={handleDelete}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </Modal>
  )
}

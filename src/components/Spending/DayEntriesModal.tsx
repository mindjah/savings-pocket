import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency, RecurrenceType, SavingsTrackingMode, SpendingEntry } from '../../db/types'
import { CURRENCIES, DEFAULT_SPENDING_CURRENCIES } from '../../lib/constants'
import { formatDate, formatMoney, parseAmount, todayIso } from '../../lib/format'
import { applyAutoDebit, reverseAutoDebit } from '../../lib/autoDebit'
import { computeNextDate } from '../../lib/recurring'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useTranslation } from '../../hooks/useTranslation'
import { tNoPocketWarning } from '../../i18n/translations'
import { EditIcon } from '../common/EditIcon'
import { DeleteIcon } from '../common/DeleteIcon'
import { EntryBadges } from '../common/EntryBadges'
import { AddExpenseIcon } from '../common/AddExpenseIcon'
import { RecurringIcon } from '../common/RecurringIcon'

interface Props {
  initialDate: string
  // True when opened from the "+" FAB — a focused quick-add flow for
  // today's spending, so it skips straight to the form instead of the
  // day-overview (total spent, existing entries, collapsed form) that a
  // calendar-day tap shows.
  quickAdd?: boolean
  onClose: () => void
  onManageCategories: () => void
}

export function DayEntriesModal({ initialDate, quickAdd = false, onClose, onManageCategories }: Props) {
  const { t, lang } = useTranslation()
  const [date, setDate] = useState(initialDate)
  const entries = useLiveQuery(
    () => db.spendingEntries.where('date').equals(date).toArray(),
    [date],
  )
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const activeCategories = useMemo(() => categories?.filter((c) => !c.archived) ?? [], [categories])
  const categoryMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const [spendingCurrencies] = useMetaSetting<Currency[]>('enabledSpendingCurrencies', DEFAULT_SPENDING_CURRENCIES)
  const defaultCurrency = spendingCurrencies[0] ?? 'EUR'
  const [mode] = useMetaSetting<SavingsTrackingMode>('savingsTrackingMode', 'manual')
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(quickAdd)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [note, setNote] = useState('')
  const [debitPocketId, setDebitPocketId] = useState<number | ''>('')
  const [recurring, setRecurring] = useState(false)
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('monthly')
  const [intervalDays, setIntervalDays] = useState('30')
  // Keep an entry's own currency selectable even if it was later disabled in Settings.
  const currencyOptions = CURRENCIES.filter((c) => spendingCurrencies.includes(c.code) || c.code === currency)

  const pocketsForCurrency = useLiveQuery(
    () => db.savingsEntries.where('currency').equals(currency).toArray(),
    [currency],
  ) ?? []

  async function refreshDebitDefault(cur: Currency, restoreId: number | null) {
    // Read straight from the DB (not the useMetaSetting state) — on the very first
    // render that state is still its fallback default, since the underlying
    // liveQuery hasn't resolved yet, which was silently defaulting to "first
    // pocket found" instead of the one actually configured in Settings.
    const [list, metaRec] = await Promise.all([
      db.savingsEntries.where('currency').equals(cur).toArray(),
      db.meta.get('defaultSavingsPocketByCurrency'),
    ])
    const defaults = (metaRec?.value as Partial<Record<Currency, number>>) ?? {}
    const candidate = list.find((p) => p.id === restoreId) ?? list.find((p) => p.id === defaults[cur]) ?? list[0]
    setDebitPocketId(candidate?.id ?? '')
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    refreshDebitDefault(defaultCurrency, null)
  }, [])

  const dayTotalsByCurrency = useMemo(() => {
    const map = new Map<Currency, number>()
    for (const e of entries ?? []) {
      map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount)
    }
    return Array.from(map.entries())
  }, [entries])

  function resetForm() {
    setEditingId(null)
    setCategoryId('')
    setAmount('')
    setCurrency(defaultCurrency)
    setNote('')
    setRecurring(false)
    setRecurrenceType('monthly')
    setIntervalDays('30')
    refreshDebitDefault(defaultCurrency, null)
  }

  function handleCancel() {
    resetForm()
    setFormOpen(false)
  }

  function startEdit(entry: SpendingEntry) {
    setEditingId(entry.id ?? null)
    setCategoryId(entry.categoryId)
    setAmount(String(entry.amount))
    setCurrency(entry.currency)
    setNote(entry.note)
    setFormOpen(true)
    refreshDebitDefault(entry.currency, entry.debitedFromPocketId ?? null)
  }

  function handleCurrencyChange(next: Currency) {
    setCurrency(next)
    refreshDebitDefault(next, null)
  }

  const parsedIntervalDays = Number(intervalDays)
  const recurringValid =
    !recurring || recurrenceType !== 'custom' || (Number.isFinite(parsedIntervalDays) && parsedIntervalDays > 0)

  async function handleSave() {
    const parsed = parseAmount(amount)
    if (categoryId === '' || Number.isNaN(parsed) || parsed <= 0) return
    if (mode === 'auto' && (pocketsForCurrency.length === 0 || debitPocketId === '')) return
    if (editingId == null && !recurringValid) return

    const categoryName = categoryMap.get(categoryId)?.name ?? 'expense'
    const comment = `Spent on ${categoryName}${note.trim() ? ` — ${note.trim()}` : ''}`

    if (editingId != null) {
      const id = editingId
      await db.transaction('rw', db.spendingEntries, db.savingsEntries, db.savingsHistory, async () => {
        // Always reverse first — if the date moved into the future, this
        // correctly un-charges it since the block below won't re-apply.
        await reverseAutoDebit(id)
        await db.spendingEntries.update(id, {
          categoryId,
          amount: parsed,
          currency,
          note: note.trim(),
          debitedFromPocketId: mode === 'auto' ? (debitPocketId as number) : undefined,
        })
        if (mode === 'auto' && debitPocketId !== '' && date <= todayIso()) {
          await applyAutoDebit(debitPocketId as number, parsed, id, comment)
        }
      })
      toast(t('Spending entry updated'))
      handleCancel()
    } else {
      await db.transaction(
        'rw',
        db.spendingEntries,
        db.savingsEntries,
        db.savingsHistory,
        db.recurringExpenses,
        async () => {
          const newId = await db.spendingEntries.add({
            categoryId,
            amount: parsed,
            currency,
            note: note.trim(),
            date,
            createdAt: new Date().toISOString(),
          })
          if (mode === 'auto' && debitPocketId !== '') {
            // A future-dated expense isn't charged yet — the pocket is
            // remembered so materializePendingAutoDebits() can apply it
            // once the date actually arrives.
            await db.spendingEntries.update(newId, { debitedFromPocketId: debitPocketId as number })
            if (date <= todayIso()) {
              await applyAutoDebit(debitPocketId as number, parsed, newId, comment)
            }
          }
          if (recurring) {
            const intervalDaysValue = recurrenceType === 'custom' ? Math.round(parsedIntervalDays) : undefined
            const recurringId = await db.recurringExpenses.add({
              categoryId,
              amount: parsed,
              currency,
              note: note.trim(),
              recurrenceType,
              intervalDays: intervalDaysValue,
              nextDate: computeNextDate(date, recurrenceType, intervalDaysValue),
              active: true,
              debitedFromPocketId: mode === 'auto' && debitPocketId !== '' ? (debitPocketId as number) : undefined,
              createdAt: new Date().toISOString(),
            })
            await db.spendingEntries.update(newId, { recurringExpenseId: recurringId })
          }
        },
      )
      toast(t('Spending entry added'))
      onClose()
    }
  }

  async function handleDelete(id?: number) {
    if (!id) return
    if (!confirm(t('Delete this spending entry?'))) return
    await db.transaction('rw', db.spendingEntries, db.savingsEntries, db.savingsHistory, async () => {
      await reverseAutoDebit(id)
      await db.spendingEntries.delete(id)
    })
    if (editingId === id) handleCancel()
  }

  const blockedNoPocket = mode === 'auto' && pocketsForCurrency.length === 0
  // Recurring and future-dated expenses need a note — they're the ones you
  // won't have fresh context on later, so the note is what makes "what was
  // this again?" answerable when it actually shows up in the calendar.
  const noteRequired = editingId == null && (recurring || date > todayIso())
  const valid =
    categoryId !== '' &&
    parseAmount(amount) > 0 &&
    !blockedNoPocket &&
    (mode !== 'auto' || debitPocketId !== '') &&
    (editingId != null || recurringValid) &&
    (!noteRequired || note.trim().length > 0)

  return (
    <Modal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 8 }}>
          {formatDate(date, lang)}
          <AddExpenseIcon size={27} />
        </span>
      }
      onClose={onClose}
    >
      <div className="form-group">
        <label htmlFor="spendDate">{t('Date')}</label>
        <input id="spendDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {!quickAdd && (
        <div className="section-title">
          <span className="muted">{t('Total spent')}</span>
          <span className="entry-amount">
            {dayTotalsByCurrency.length === 0
              ? formatMoney(0, defaultCurrency)
              : dayTotalsByCurrency.map(([cur, total]) => formatMoney(total, cur)).join(' · ')}
          </span>
        </div>
      )}

      {activeCategories.length === 0 ? (
        <div className="empty-state">
          <span className="icon">🏷️</span>
          {t('No categories yet.')}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={onManageCategories} type="button">
              {t('Create a category')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {!quickAdd && (entries ?? []).length > 0 && (
            <div className="entry-list">
              {entries!.map((e) => {
                const cat = categoryMap.get(e.categoryId)
                return (
                  <div className="day-entry-row" key={e.id}>
                    <div className="info">
                      <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                      <div className="text">
                        <div className="cat entry-badges">
                          <span>{cat?.name ?? t('Unknown')}</span>
                          <EntryBadges recurring={e.recurringExpenseId != null} upcoming={e.date > todayIso()} />
                        </div>
                        {e.note && <div className="note">{e.note}</div>}
                      </div>
                    </div>
                    <div className="icon-btn-row" style={{ alignItems: 'center' }}>
                      <strong>{formatMoney(e.amount, e.currency)}</strong>
                      <button className="btn btn-ghost btn-icon" onClick={() => startEdit(e)} type="button">
                        <EditIcon />
                      </button>
                      <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(e.id)} type="button">
                        <DeleteIcon />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!formOpen && editingId == null && (
            <button className="btn btn-primary btn-block" onClick={() => setFormOpen(true)} type="button">
              {t('+ Add expense')}
            </button>
          )}

          {(formOpen || editingId != null) && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="form-group">
              <label htmlFor="spendCategory">{t('Category')}</label>
              <select
                id="spendCategory"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">{t('Select…')}</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="spendAmount">{t('Amount')}</label>
                <input
                  id="spendAmount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label htmlFor="spendCurrency">{t('Currency')}</label>
                <select
                  id="spendCurrency"
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
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
              <label htmlFor="spendNote">
                {t('Note')}
                {noteRequired ? ' *' : ''}
              </label>
              <input
                id="spendNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={noteRequired ? '' : t('Optional')}
              />
            </div>

            {mode === 'auto' && (
              blockedNoPocket ? (
                <div className="muted" style={{ color: 'var(--danger-strong)' }}>
                  {tNoPocketWarning(lang, currency)}
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="debitPocket">{t('Debit from')}</label>
                  <select
                    id="debitPocket"
                    value={debitPocketId}
                    onChange={(e) => setDebitPocketId(e.target.value ? Number(e.target.value) : '')}
                  >
                    {pocketsForCurrency.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.location} — {formatMoney(p.amount, p.currency)}
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}

            {editingId == null && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={recurring}
                    onChange={(e) => setRecurring(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {t('Repeat this expense')}
                    <RecurringIcon size={21} />
                  </span>
                </label>

                {recurring && (
                  <>
                    <div className="segmented">
                      <button
                        type="button"
                        className={recurrenceType === 'monthly' ? 'active' : ''}
                        onClick={() => setRecurrenceType('monthly')}
                      >
                        {t('Monthly')}
                      </button>
                      <button
                        type="button"
                        className={recurrenceType === 'annually' ? 'active' : ''}
                        onClick={() => setRecurrenceType('annually')}
                      >
                        {t('Annually')}
                      </button>
                      <button
                        type="button"
                        className={recurrenceType === 'custom' ? 'active' : ''}
                        onClick={() => setRecurrenceType('custom')}
                      >
                        {t('Every X days')}
                      </button>
                    </div>
                    {recurrenceType === 'custom' && (
                      <div className="form-group">
                        <label htmlFor="intervalDays">{t('Repeats every (days)')}</label>
                        <input
                          id="intervalDays"
                          type="text"
                          inputMode="numeric"
                          value={intervalDays}
                          onChange={(e) => setIntervalDays(e.target.value)}
                          placeholder={t('e.g. 14')}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <div className="modal-actions">
              <button className="btn" onClick={handleCancel} type="button">
                {t('Cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!valid} type="button">
                {editingId != null ? t('Save') : t('Add expense')}
              </button>
            </div>
          </div>
          )}
        </>
      )}
    </Modal>
  )
}

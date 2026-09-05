import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency, RecurrenceType, RecurringExpense, SavingsTrackingMode, SpendingEntry } from '../../db/types'
import { CURRENCIES, DEFAULT_SPENDING_CURRENCIES } from '../../lib/constants'
import { formatDate, formatMoney, parseAmount, roundFiat, todayIso } from '../../lib/format'
import { applyAutoDebit, reverseAutoDebit, updateAutoDebit } from '../../lib/autoDebit'
import { computeNextDate, recurringPreviewDates } from '../../lib/recurring'
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
  const recurringExpenses = useLiveQuery(() => db.recurringExpenses.toArray(), []) ?? []
  // Recurring expenses with an occurrence (among the next 12 previewed) that
  // lands on this day but hasn't materialized into a real entry yet (only
  // happens once the date arrives).
  const plannedRecurring = useMemo(
    () =>
      recurringExpenses.filter(
        (r) => r.active && recurringPreviewDates(r).includes(date) && !(entries ?? []).some((e) => e.recurringExpenseId === r.id),
      ),
    [recurringExpenses, date, entries],
  )
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
  // The entry's own date, only while editing — separate from `date` above
  // (which is this whole view's day, e.g. what "+" was tapped for/which
  // day's overview is showing) so changing it doesn't also change which
  // day's list is being browsed.
  const [editDate, setEditDate] = useState(initialDate)
  // Keep an entry's own currency selectable even if it was later disabled in Settings.
  const currencyOptions = CURRENCIES.filter((c) => spendingCurrencies.includes(c.code) || c.code === currency)

  // Credits can't be chosen as a payment source for expenses.
  const pocketsForCurrency = (
    useLiveQuery(() => db.savingsEntries.where('currency').equals(currency).toArray(), [currency]) ?? []
  ).filter((p) => p.kind !== 'credit')

  async function refreshDebitDefault(cur: Currency, restoreId: number | null) {
    // Read straight from the DB (not the useMetaSetting state) — on the very first
    // render that state is still its fallback default, since the underlying
    // liveQuery hasn't resolved yet, which was silently defaulting to "first
    // pocket found" instead of the one actually configured in Settings.
    const [list, metaRec] = await Promise.all([
      db.savingsEntries.where('currency').equals(cur).toArray(),
      db.meta.get('defaultSavingsPocketByCurrency'),
    ])
    const candidates = list.filter((p) => p.kind !== 'credit')
    const defaults = (metaRec?.value as Partial<Record<Currency, number>>) ?? {}
    const candidate =
      candidates.find((p) => p.id === restoreId) ?? candidates.find((p) => p.id === defaults[cur]) ?? candidates[0]
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
    setEditDate(initialDate)
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
    setEditDate(entry.date)
    setRecurring(false)
    setRecurrenceType('monthly')
    setIntervalDays('30')
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
    const parsed = roundFiat(parseAmount(amount), currency)
    if (categoryId === '' || Number.isNaN(parsed) || parsed <= 0) return
    if (mode === 'auto' && (pocketsForCurrency.length === 0 || debitPocketId === '')) return
    if (!recurringValid) return

    const categoryName = categoryMap.get(categoryId)?.name ?? 'expense'
    const comment = `Spent on ${categoryName}${note.trim() ? ` — ${note.trim()}` : ''}`

    if (editingId != null) {
      const id = editingId
      // A future-dated expense isn't charged yet, same as when adding one —
      // null here makes updateAutoDebit reverse any existing debit without
      // re-applying it (and, the other way round, an entry that WAS future
      // and just got moved to today/the past has no existing debit for
      // updateAutoDebit to adjust, so it applies a fresh one instead — see
      // its own fallback branch).
      const newPocketId =
        mode === 'auto' && debitPocketId !== '' && editDate <= todayIso() ? (debitPocketId as number) : null
      await db.transaction(
        'rw',
        db.spendingEntries,
        db.savingsEntries,
        db.savingsHistory,
        db.recurringExpenses,
        async () => {
          await updateAutoDebit(id, newPocketId, parsed, comment)
          await db.spendingEntries.update(id, {
            categoryId,
            amount: parsed,
            currency,
            note: note.trim(),
            date: editDate,
            debitedFromPocketId: mode === 'auto' ? (debitPocketId as number) : undefined,
          })
          // Only offered for an entry that wasn't already part of a
          // recurring series (see the form's own showRecurring check) —
          // turns this one-off expense into the first occurrence of a new
          // series, the same as checking "Repeat" while adding one.
          if (recurring) {
            const intervalDaysValue = recurrenceType === 'custom' ? Math.round(parsedIntervalDays) : undefined
            const nextDate =
              editDate <= todayIso() ? computeNextDate(editDate, recurrenceType, intervalDaysValue) : editDate
            const recurringId = await db.recurringExpenses.add({
              categoryId,
              amount: parsed,
              currency,
              note: note.trim(),
              recurrenceType,
              intervalDays: intervalDaysValue,
              nextDate,
              active: true,
              debitedFromPocketId: mode === 'auto' && debitPocketId !== '' ? (debitPocketId as number) : undefined,
              createdAt: new Date().toISOString(),
            })
            await db.spendingEntries.update(id, { recurringExpenseId: recurringId })
          }
        },
      )
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
            // If this first occurrence is still in the future, it hasn't
            // actually happened yet — nextDate should stay on it (not the
            // occurrence after) so "next billing date" reflects reality.
            // materializeRecurringExpenses() skips re-creating a duplicate
            // entry for it once that date arrives (see its dedup check).
            const nextDate = date <= todayIso() ? computeNextDate(date, recurrenceType, intervalDaysValue) : date
            const recurringId = await db.recurringExpenses.add({
              categoryId,
              amount: parsed,
              currency,
              note: note.trim(),
              recurrenceType,
              intervalDays: intervalDaysValue,
              nextDate,
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

  async function handleDelete(entry: SpendingEntry) {
    const id = entry.id
    if (!id) return
    if (!confirm(t('Delete this spending entry?'))) return
    await db.transaction(
      'rw',
      db.spendingEntries,
      db.savingsEntries,
      db.savingsHistory,
      db.recurringExpenses,
      async () => {
        await reverseAutoDebit(id, { deleted: true })
        await db.spendingEntries.delete(id)
        // A future, not-yet-happened occurrence of a recurring expense —
        // record it as skipped so materializeRecurringExpenses doesn't
        // quietly recreate this exact date once it arrives.
        if (entry.recurringExpenseId != null && entry.date > todayIso()) {
          const r = await db.recurringExpenses.get(entry.recurringExpenseId)
          if (r) {
            await db.recurringExpenses.update(r.id!, { skippedDates: [...(r.skippedDates ?? []), entry.date] })
          }
        }
      },
    )
    if (editingId === id) handleCancel()
  }

  // A previewed (not-yet-materialized) future occurrence — tapping Edit
  // creates the real row on the spot (same thing that already happens for
  // a recurring expense's very first occurrence) so it can be edited like
  // any other entry.
  async function materializePlanned(r: RecurringExpense): Promise<SpendingEntry> {
    // Carries the recurring template's pocket forward (same as the due-date
    // catch-up in materializeRecurringExpenses) so materializePendingAutoDebits
    // still charges it once this now-real, still-future entry's date arrives.
    const base = {
      categoryId: r.categoryId,
      amount: r.amount,
      currency: r.currency,
      note: r.note,
      date,
      createdAt: new Date().toISOString(),
      recurringExpenseId: r.id,
      debitedFromPocketId: r.debitedFromPocketId,
    }
    const newId = await db.spendingEntries.add(base)
    return { id: newId, ...base }
  }

  async function editPlanned(r: RecurringExpense) {
    const entry = await materializePlanned(r)
    startEdit(entry)
  }

  // Skips just this one occurrence — the series keeps generating on
  // schedule after it (deactivating the whole recurring expense would
  // cancel every future occurrence, not just this date).
  async function skipPlanned(r: RecurringExpense) {
    if (!r.id) return
    if (!confirm(t('Skip this occurrence? The recurring expense will continue on its normal schedule after this date.'))) return
    await db.recurringExpenses.update(r.id, { skippedDates: [...(r.skippedDates ?? []), date] })
  }

  const blockedNoPocket = mode === 'auto' && pocketsForCurrency.length === 0
  const editingEntry = editingId != null ? entries?.find((e) => e.id === editingId) : undefined
  // The date this save is actually happening for — the entry's own (editable)
  // date while editing, or this view's day while adding.
  const effectiveDate = editingId != null ? editDate : date
  // Only offered for an entry not already part of a recurring series —
  // converting one occurrence of an existing series is a different thing
  // (skipPlanned/the series' own schedule) than turning a one-off expense
  // into a new series.
  const showRecurringOption = editingId == null || editingEntry?.recurringExpenseId == null
  // Recurring and future-dated expenses need a note — they're the ones you
  // won't have fresh context on later, so the note is what makes "what was
  // this again?" answerable when it actually shows up in the calendar.
  // Applies the same way whether adding or editing — moving an existing
  // expense's date into the future has the same "won't remember why" gap.
  const noteRequired = recurring || effectiveDate > todayIso()
  const noteMissing = noteRequired && note.trim().length === 0

  // Auto-debit floor check — mirrors Transfer's "can't go below zero" rule
  // for a regular pocket. Only relevant when this save will actually charge
  // the pocket right now (a future-dated expense's debit is deferred, and by
  // the time it fires the balance may no longer look like this). Credits
  // have no floor, same as everywhere else.
  const selectedPocket = pocketsForCurrency.find((p) => p.id === debitPocketId)
  const willDebitNow = mode === 'auto' && debitPocketId !== '' && effectiveDate <= todayIso()
  const parsedForDebitCheck = roundFiat(parseAmount(amount), currency)
  let projectedPocketBalance: number | null = null
  if (willDebitNow && selectedPocket && selectedPocket.kind !== 'credit') {
    // Editing an entry already debited from this same pocket: undo that old
    // debit first before checking the new amount against it.
    const startingBalance =
      editingEntry && editingEntry.debitedFromPocketId === selectedPocket.id
        ? selectedPocket.amount + editingEntry.amount
        : selectedPocket.amount
    projectedPocketBalance = roundFiat(startingBalance - parsedForDebitCheck, currency)
  }
  const wouldGoNegative = projectedPocketBalance != null && projectedPocketBalance < 0

  const valid =
    categoryId !== '' &&
    roundFiat(parseAmount(amount), currency) > 0 &&
    !blockedNoPocket &&
    (mode !== 'auto' || debitPocketId !== '') &&
    recurringValid &&
    (!noteRequired || note.trim().length > 0) &&
    !wouldGoNegative

  // Only the open add form counts as "unsaved" — anything typed at all.
  const addFormDirty = formOpen && (categoryId !== '' || amount !== '' || note.trim() !== '')
  // The edit modal's own dirty check: the fields have actually diverged
  // from the entry being edited (including its date, and turning on the
  // new "make recurring" option, both editable now).
  const editFormDirty =
    editingId != null &&
    editingEntry != null &&
    (categoryId !== editingEntry.categoryId ||
      amount !== String(editingEntry.amount) ||
      currency !== editingEntry.currency ||
      note !== editingEntry.note ||
      editDate !== editingEntry.date ||
      recurring)

  // Shared between the inline "add" form (below, in the day's own overview)
  // and the separate "edit" sheet (rendered further down) — the fields
  // themselves are identical; only whether a date field shows, and whether
  // "Repeat this expense" is offered, differ between the two.
  function renderFormFields(dateField: { value: string; onChange: (v: string) => void } | null, showRecurring: boolean) {
    return (
      <>
        {dateField && (
          <div className="form-group">
            <label htmlFor="entryDate">{t('Date')}</label>
            <input id="entryDate" type="date" value={dateField.value} onChange={(e) => dateField.onChange(e.target.value)} />
          </div>
        )}
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
            <select id="spendCurrency" value={currency} onChange={(e) => handleCurrencyChange(e.target.value as Currency)}>
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
            style={noteMissing ? { borderColor: 'var(--danger-strong)' } : undefined}
          />
          {noteMissing && (
            <span style={{ fontSize: '0.78rem', color: 'var(--danger-strong)' }}>
              {recurring ? t('Mandatory for recurring') : t('Mandatory')}
            </span>
          )}
        </div>

        {mode === 'auto' &&
          (blockedNoPocket ? (
            <div className="muted" style={{ color: 'var(--danger-strong)' }}>
              {tNoPocketWarning(lang, currency)}
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="debitPocket">{t('Debit from')}</label>
              <select id="debitPocket" value={debitPocketId} onChange={(e) => setDebitPocketId(e.target.value ? Number(e.target.value) : '')}>
                {pocketsForCurrency.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.location} — {formatMoney(p.amount, p.currency)}
                  </option>
                ))}
              </select>
              {wouldGoNegative && projectedPocketBalance != null && (
                <div className="muted" style={{ color: 'var(--danger-strong)' }}>
                  {selectedPocket?.location} → {formatMoney(projectedPocketBalance, currency)}
                  {t(" — can't go below zero")}
                </div>
              )}
            </div>
          ))}

        {showRecurring && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} style={{ width: 'auto' }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {t('Repeat this expense')}
                <RecurringIcon size={21} />
              </span>
            </label>

            {recurring && (
              <>
                <div className="segmented">
                  <button type="button" className={recurrenceType === 'monthly' ? 'active' : ''} onClick={() => setRecurrenceType('monthly')}>
                    {t('Monthly')}
                  </button>
                  <button type="button" className={recurrenceType === 'annually' ? 'active' : ''} onClick={() => setRecurrenceType('annually')}>
                    {t('Annually')}
                  </button>
                  <button type="button" className={recurrenceType === 'custom' ? 'active' : ''} onClick={() => setRecurrenceType('custom')}>
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
      </>
    )
  }

  return (
    <>
    <Modal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 8 }}>
          {formatDate(date, lang)}
          <AddExpenseIcon size={27} />
        </span>
      }
      onClose={onClose}
      hasUnsavedChanges={addFormDirty}
    >
      {quickAdd && (
        <div className="form-group">
          <label htmlFor="spendDate">{t('Date')}</label>
          <input id="spendDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      )}

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
          {!quickAdd && plannedRecurring.length > 0 && (
            <div className="entry-list">
              {plannedRecurring.map((r) => {
                const cat = categoryMap.get(r.categoryId)
                return (
                  <div className="day-entry-row" key={`planned-${r.id}`}>
                    <div className="info">
                      <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                      <div className="text">
                        <div className="cat entry-badges">
                          <span>{cat?.name ?? t('Unknown')}</span>
                          <EntryBadges recurring recurringHappened={false} />
                        </div>
                        <div className="note">{t('Recurring expense planned for this day')}</div>
                      </div>
                    </div>
                    <div className="icon-btn-row" style={{ alignItems: 'center' }}>
                      <strong>{formatMoney(r.amount, r.currency)}</strong>
                      <button className="btn btn-ghost btn-icon" onClick={() => editPlanned(r)} type="button">
                        <EditIcon />
                      </button>
                      <button className="btn btn-ghost btn-icon" onClick={() => skipPlanned(r)} type="button">
                        <DeleteIcon />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

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
                          <EntryBadges
                            recurring={e.recurringExpenseId != null}
                            recurringHappened={e.date <= todayIso()}
                            upcoming={e.date > todayIso()}
                          />
                        </div>
                        {e.note && <div className="note">{e.note}</div>}
                      </div>
                    </div>
                    <div className="icon-btn-row" style={{ alignItems: 'center' }}>
                      <strong>{formatMoney(e.amount, e.currency)}</strong>
                      <button className="btn btn-ghost btn-icon" onClick={() => startEdit(e)} type="button">
                        <EditIcon />
                      </button>
                      <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(e)} type="button">
                        <DeleteIcon />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!formOpen && (
            <button className="btn btn-primary btn-block" onClick={() => setFormOpen(true)} type="button">
              {t('+ Add expense')}
            </button>
          )}

          {formOpen && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {renderFormFields(null, true)}
              <div className="modal-actions">
                <button className="btn" onClick={handleCancel} type="button">
                  {t('Cancel')}
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!valid} type="button">
                  {t('Add expense')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>

    {editingId != null && (
      <Modal title={t('Edit expense')} onClose={handleCancel} hasUnsavedChanges={editFormDirty}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {renderFormFields({ value: editDate, onChange: setEditDate }, showRecurringOption)}
          <div className="modal-actions">
            <button className="btn" onClick={handleCancel} type="button">
              {t('Cancel')}
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!valid} type="button">
              {t('Save')}
            </button>
          </div>
        </div>
      </Modal>
    )}
    </>
  )
}

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { RecurrenceType, RecurringExpense } from '../../db/types'
import { formatDate, formatMoney, parseAmount } from '../../lib/format'
import { recurrenceLabel } from '../../lib/recurring'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'

interface Props {
  onClose: () => void
}

export function RecurringExpensesModal({ onClose }: Props) {
  const recurring = useLiveQuery(
    async () =>
      (await db.recurringExpenses.toArray())
        .filter((r) => r.active)
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate)),
    [],
  )
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]))
  const toast = useToast()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('monthly')
  const [intervalDays, setIntervalDays] = useState('30')

  function startEdit(r: RecurringExpense) {
    setEditingId(r.id ?? null)
    setAmount(String(r.amount))
    setNote(r.note)
    setRecurrenceType(r.recurrenceType)
    setIntervalDays(String(r.intervalDays ?? 30))
  }

  function cancelEdit() {
    setEditingId(null)
  }

  const parsedAmount = parseAmount(amount)
  const parsedInterval = Number(intervalDays)
  const editValid =
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    (recurrenceType !== 'custom' || (Number.isFinite(parsedInterval) && parsedInterval > 0))

  async function saveEdit(r: RecurringExpense) {
    if (!r.id || !editValid) return
    await db.recurringExpenses.update(r.id, {
      amount: parsedAmount,
      note: note.trim(),
      recurrenceType,
      intervalDays: recurrenceType === 'custom' ? Math.round(parsedInterval) : undefined,
    })
    toast('Recurring expense updated')
    setEditingId(null)
  }

  async function stopRecurring(r: RecurringExpense) {
    if (!r.id) return
    if (!confirm('Stop this expense from recurring? Past expenses will not be affected.')) return
    await db.recurringExpenses.update(r.id, { active: false })
    toast('Recurring expense stopped')
    if (editingId === r.id) setEditingId(null)
  }

  return (
    <Modal title="Manage recurring expenses" onClose={onClose}>
      {!recurring || recurring.length === 0 ? (
        <div className="empty-state">
          <span className="icon">🔁</span>
          No recurring expenses yet. Turn on "Repeat" when adding an expense to create one.
        </div>
      ) : (
        <div className="category-list">
          {recurring.map((r) => {
            const cat = categoryMap.get(r.categoryId)
            const isEditing = editingId === r.id
            return (
              <div
                className="category-row"
                key={r.id}
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}
              >
                {isEditing ? (
                  <>
                    <div className="form-group">
                      <label htmlFor={`amt-${r.id}`}>Amount ({r.currency})</label>
                      <input
                        id={`amt-${r.id}`}
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor={`note-${r.id}`}>Note</label>
                      <input
                        id={`note-${r.id}`}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="segmented">
                      <button
                        type="button"
                        className={recurrenceType === 'monthly' ? 'active' : ''}
                        onClick={() => setRecurrenceType('monthly')}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        className={recurrenceType === 'annually' ? 'active' : ''}
                        onClick={() => setRecurrenceType('annually')}
                      >
                        Annually
                      </button>
                      <button
                        type="button"
                        className={recurrenceType === 'custom' ? 'active' : ''}
                        onClick={() => setRecurrenceType('custom')}
                      >
                        Every X days
                      </button>
                    </div>
                    {recurrenceType === 'custom' && (
                      <div className="form-group">
                        <label htmlFor={`interval-${r.id}`}>Repeats every (days)</label>
                        <input
                          id={`interval-${r.id}`}
                          type="text"
                          inputMode="numeric"
                          value={intervalDays}
                          onChange={(e) => setIntervalDays(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="modal-actions">
                      <button className="btn btn-danger" onClick={() => stopRecurring(r)} type="button">
                        Make not recurring
                      </button>
                      <button className="btn" onClick={cancelEdit} type="button">
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => saveEdit(r)}
                        disabled={!editValid}
                        type="button"
                      >
                        Save
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                    <div style={{ flex: 1 }}>
                      <div>
                        {cat?.name ?? 'Unknown'} — {formatMoney(r.amount, r.currency)}
                      </div>
                      <div className="muted">
                        {recurrenceLabel(r.recurrenceType, r.intervalDays)} · Next: {formatDate(r.nextDate)}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={() => startEdit(r)} type="button">
                      ✎
                    </button>
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

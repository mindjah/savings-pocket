import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency, SpendingEntry } from '../../db/types'
import { CURRENCIES, DEFAULT_SPENDING_CURRENCIES } from '../../lib/constants'
import { formatDate, formatMoney } from '../../lib/format'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'
import { useMetaSetting } from '../../hooks/useMetaSetting'

interface Props {
  initialDate: string
  onClose: () => void
  onManageCategories: () => void
}

export function DayEntriesModal({ initialDate, onClose, onManageCategories }: Props) {
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
  const toast = useToast()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [note, setNote] = useState('')
  // Keep an entry's own currency selectable even if it was later disabled in Settings.
  const currencyOptions = CURRENCIES.filter((c) => spendingCurrencies.includes(c.code) || c.code === currency)

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
  }

  function startEdit(entry: SpendingEntry) {
    setEditingId(entry.id ?? null)
    setCategoryId(entry.categoryId)
    setAmount(String(entry.amount))
    setCurrency(entry.currency)
    setNote(entry.note)
  }

  async function handleSave() {
    const parsed = Number(amount)
    if (categoryId === '' || Number.isNaN(parsed) || parsed <= 0) return
    if (editingId != null) {
      await db.spendingEntries.update(editingId, { categoryId, amount: parsed, currency, note: note.trim() })
      toast('Spending entry updated')
      resetForm()
    } else {
      await db.spendingEntries.add({
        categoryId,
        amount: parsed,
        currency,
        note: note.trim(),
        date,
        createdAt: new Date().toISOString(),
      })
      toast('Spending entry added')
      onClose()
    }
  }

  async function handleDelete(id?: number) {
    if (!id) return
    if (!confirm('Delete this spending entry?')) return
    await db.spendingEntries.delete(id)
    if (editingId === id) resetForm()
  }

  const valid = categoryId !== '' && Number(amount) > 0

  return (
    <Modal title={formatDate(date)} onClose={onClose}>
      <div className="form-group">
        <label htmlFor="spendDate">Date</label>
        <input id="spendDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="section-title">
        <span className="muted">Total spent</span>
        <span className="entry-amount">
          {dayTotalsByCurrency.length === 0
            ? formatMoney(0, defaultCurrency)
            : dayTotalsByCurrency.map(([cur, total]) => formatMoney(total, cur)).join(' · ')}
        </span>
      </div>

      {activeCategories.length === 0 ? (
        <div className="empty-state">
          <span className="icon">🏷️</span>
          No categories yet.
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={onManageCategories} type="button">
              Create a category
            </button>
          </div>
        </div>
      ) : (
        <>
          {(entries ?? []).length > 0 && (
            <div className="entry-list">
              {entries!.map((e) => {
                const cat = categoryMap.get(e.categoryId)
                return (
                  <div className="day-entry-row" key={e.id}>
                    <div className="info">
                      <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                      <div className="text">
                        <div className="cat">{cat?.name ?? 'Unknown'}</div>
                        {e.note && <div className="note">{e.note}</div>}
                      </div>
                    </div>
                    <div className="icon-btn-row" style={{ alignItems: 'center' }}>
                      <strong>{formatMoney(e.amount, e.currency)}</strong>
                      <button className="btn btn-ghost btn-icon" onClick={() => startEdit(e)} type="button">
                        ✎
                      </button>
                      <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(e.id)} type="button">
                        🗑
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="form-group">
              <label htmlFor="spendCategory">Category</label>
              <select
                id="spendCategory"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Select…</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="spendAmount">Amount</label>
                <input
                  id="spendAmount"
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
                <label htmlFor="spendCurrency">Currency</label>
                <select id="spendCurrency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  {currencyOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="spendNote">Note</label>
              <input id="spendNote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
            <div className="modal-actions">
              {editingId != null && (
                <button className="btn" onClick={resetForm} type="button">
                  Cancel
                </button>
              )}
              <button className="btn btn-primary" onClick={handleSave} disabled={!valid} type="button">
                {editingId != null ? 'Save' : 'Add expense'}
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

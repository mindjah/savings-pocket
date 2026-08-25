import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency, SavingsTrackingMode, SpendingEntry } from '../../db/types'
import { CURRENCIES, DEFAULT_SPENDING_CURRENCIES } from '../../lib/constants'
import { formatDate, formatMoney, parseAmount } from '../../lib/format'
import { applyAutoDebit, reverseAutoDebit } from '../../lib/autoDebit'
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
  const [mode] = useMetaSetting<SavingsTrackingMode>('savingsTrackingMode', 'manual')
  const [defaultPockets] = useMetaSetting<Partial<Record<Currency, number>>>('defaultSavingsPocketByCurrency', {})
  const toast = useToast()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [note, setNote] = useState('')
  const [debitPocketId, setDebitPocketId] = useState<number | ''>('')
  // Keep an entry's own currency selectable even if it was later disabled in Settings.
  const currencyOptions = CURRENCIES.filter((c) => spendingCurrencies.includes(c.code) || c.code === currency)

  const pocketsForCurrency = useLiveQuery(
    () => db.savingsEntries.where('currency').equals(currency).toArray(),
    [currency],
  ) ?? []

  async function refreshDebitDefault(cur: Currency, restoreId: number | null) {
    const list = await db.savingsEntries.where('currency').equals(cur).toArray()
    const candidate = list.find((p) => p.id === restoreId) ?? list.find((p) => p.id === defaultPockets[cur]) ?? list[0]
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
    refreshDebitDefault(defaultCurrency, null)
  }

  function startEdit(entry: SpendingEntry) {
    setEditingId(entry.id ?? null)
    setCategoryId(entry.categoryId)
    setAmount(String(entry.amount))
    setCurrency(entry.currency)
    setNote(entry.note)
    refreshDebitDefault(entry.currency, entry.debitedFromPocketId ?? null)
  }

  function handleCurrencyChange(next: Currency) {
    setCurrency(next)
    refreshDebitDefault(next, null)
  }

  async function handleSave() {
    const parsed = parseAmount(amount)
    if (categoryId === '' || Number.isNaN(parsed) || parsed <= 0) return
    if (mode === 'auto' && (pocketsForCurrency.length === 0 || debitPocketId === '')) return

    const categoryName = categoryMap.get(categoryId)?.name ?? 'expense'
    const comment = `Spent on ${categoryName}${note.trim() ? ` — ${note.trim()}` : ''}`

    if (editingId != null) {
      const id = editingId
      await db.transaction('rw', db.spendingEntries, db.savingsEntries, db.savingsHistory, async () => {
        await reverseAutoDebit(id)
        await db.spendingEntries.update(id, {
          categoryId,
          amount: parsed,
          currency,
          note: note.trim(),
          debitedFromPocketId: mode === 'auto' ? (debitPocketId as number) : undefined,
        })
        if (mode === 'auto' && debitPocketId !== '') {
          await applyAutoDebit(debitPocketId as number, parsed, id, comment)
        }
      })
      toast('Spending entry updated')
      resetForm()
    } else {
      await db.transaction('rw', db.spendingEntries, db.savingsEntries, db.savingsHistory, async () => {
        const newId = await db.spendingEntries.add({
          categoryId,
          amount: parsed,
          currency,
          note: note.trim(),
          date,
          createdAt: new Date().toISOString(),
        })
        if (mode === 'auto' && debitPocketId !== '') {
          await applyAutoDebit(debitPocketId as number, parsed, newId, comment)
          await db.spendingEntries.update(newId, { debitedFromPocketId: debitPocketId as number })
        }
      })
      toast('Spending entry added')
      onClose()
    }
  }

  async function handleDelete(id?: number) {
    if (!id) return
    if (!confirm('Delete this spending entry?')) return
    await db.transaction('rw', db.spendingEntries, db.savingsEntries, db.savingsHistory, async () => {
      await reverseAutoDebit(id)
      await db.spendingEntries.delete(id)
    })
    if (editingId === id) resetForm()
  }

  const blockedNoPocket = mode === 'auto' && pocketsForCurrency.length === 0
  const valid = categoryId !== '' && parseAmount(amount) > 0 && !blockedNoPocket && (mode !== 'auto' || debitPocketId !== '')

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
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label htmlFor="spendCurrency">Currency</label>
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
              <label htmlFor="spendNote">Note</label>
              <input id="spendNote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>

            {mode === 'auto' && (
              blockedNoPocket ? (
                <div className="muted" style={{ color: 'var(--danger-strong)' }}>
                  No saving pocket exists in {currency} — create one in Savings before logging spending in this
                  currency.
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="debitPocket">Debit from</label>
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

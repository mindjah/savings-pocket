import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Category, Currency, PlannedExpense, PlannedIncome } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { formatMoney, pad2, parseAmount, roundFiat, todayIso } from '../../lib/format'
import { fixedExpensesForMonth, planCategoryTotals } from '../../lib/planning'
import { Modal } from '../common/Modal'
import { DeleteConfirmModal } from '../Savings/DeleteConfirmModal'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { EditIcon } from '../common/EditIcon'

interface Props {
  planId: number
  onClose: () => void
}

interface CurrencyTotals {
  income: number
  fixed: number
  planned: number
}

interface AddIncomeModalProps {
  currencyOptions: { code: Currency; symbol: string }[]
  onAdd: (source: string, amount: number, currency: Currency) => void
  onClose: () => void
}

function AddIncomeModal({ currencyOptions, onAdd, onClose }: AddIncomeModalProps) {
  const { t } = useTranslation()
  const [source, setSource] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency | ''>('')
  const parsed = currency ? roundFiat(parseAmount(amount), currency) : NaN
  const valid = source.trim().length > 0 && currency !== '' && !Number.isNaN(parsed) && parsed > 0

  function submit() {
    if (!valid || !currency) return
    onAdd(source.trim(), parsed, currency)
    onClose()
  }

  return (
    <Modal title={t('Add income')} onClose={onClose}>
      <div className="form-group">
        <label htmlFor="newIncomeSource">{t('Source')}</label>
        <input
          id="newIncomeSource"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={t('e.g. Salary')}
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="newIncomeAmount">{t('Amount')}</label>
          <input
            id="newIncomeAmount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label htmlFor="newIncomeCurrency">{t('Currency')}</label>
          <select id="newIncomeCurrency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency | '')}>
            <option value="">{t('Select…')}</option>
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button className={`btn btn-block${valid ? ' btn-primary' : ''}`} onClick={submit} disabled={!valid} type="button">
        {t('Add income')}
      </button>
    </Modal>
  )
}

interface EditIncomeModalProps {
  entry: PlannedIncome
  currencyOptions: { code: Currency; symbol: string }[]
  onSave: (source: string, amount: number, currency: Currency) => void
  onDelete: () => void
  onClose: () => void
}

function EditIncomeModal({ entry, currencyOptions, onSave, onDelete, onClose }: EditIncomeModalProps) {
  const { t } = useTranslation()
  const [source, setSource] = useState(entry.source)
  const [amount, setAmount] = useState(String(entry.amount))
  const [currency, setCurrency] = useState<Currency>(entry.currency)
  const parsed = roundFiat(parseAmount(amount), currency)
  const valid = source.trim().length > 0 && !Number.isNaN(parsed) && parsed > 0

  function submit() {
    if (!valid) return
    onSave(source.trim(), parsed, currency)
    onClose()
  }

  function handleDelete() {
    onDelete()
    onClose()
  }

  return (
    <Modal title={t('Planned income')} onClose={onClose}>
      <div className="form-group">
        <label htmlFor="editIncomeSource">{t('Source')}</label>
        <input id="editIncomeSource" value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('e.g. Salary')} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="editIncomeAmount">{t('Amount')}</label>
          <input
            id="editIncomeAmount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label htmlFor="editIncomeCurrency">{t('Currency')}</label>
          <select id="editIncomeCurrency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button className={`btn btn-block${valid ? ' btn-primary' : ''}`} onClick={submit} disabled={!valid} type="button">
        {t('Save')}
      </button>
      <button className="btn btn-danger btn-block" onClick={handleDelete} type="button" style={{ marginTop: 8 }}>
        {t('Delete')}
      </button>
    </Modal>
  )
}

interface AddExpenseModalProps {
  categories: Category[]
  currencyOptions: { code: Currency; symbol: string }[]
  onAdd: (categoryId: number, amount: number, currency: Currency, note: string) => void
  onClose: () => void
}

function AddExpenseModal({ categories, currencyOptions, onAdd, onClose }: AddExpenseModalProps) {
  const { t } = useTranslation()
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency | ''>(currencyOptions.length === 1 ? currencyOptions[0].code : '')
  const [note, setNote] = useState('')
  const parsed = currency ? roundFiat(parseAmount(amount), currency) : NaN
  const valid = categoryId !== '' && currency !== '' && !Number.isNaN(parsed) && parsed > 0

  function submit() {
    if (!valid || !currency) return
    onAdd(categoryId as number, parsed, currency, note.trim())
    onClose()
  }

  return (
    <Modal title={t('Add planned expense')} onClose={onClose}>
      <div className="form-group">
        <label htmlFor="newExpenseCategory">{t('Category')}</label>
        <select id="newExpenseCategory" value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">{t('Select…')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="newExpenseAmount">{t('Amount')}</label>
          <input
            id="newExpenseAmount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label htmlFor="newExpenseCurrency">{t('Currency')}</label>
          <select id="newExpenseCurrency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency | '')}>
            {currencyOptions.length > 1 && <option value="">{t('Select…')}</option>}
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="newExpenseNote">{t('Note')}</label>
        <input
          id="newExpenseNote"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t('Optional')}
        />
      </div>
      <button className={`btn btn-block${valid ? ' btn-primary' : ''}`} onClick={submit} disabled={!valid} type="button">
        {t('Add planned expense')}
      </button>
    </Modal>
  )
}

interface EditExpenseModalProps {
  entry: PlannedExpense
  categories: Category[]
  currencyOptions: { code: Currency; symbol: string }[]
  onSave: (categoryId: number, amount: number, currency: Currency, note: string) => void
  onDelete: () => void
  onClose: () => void
}

function EditExpenseModal({ entry, categories, currencyOptions, onSave, onDelete, onClose }: EditExpenseModalProps) {
  const { t } = useTranslation()
  const [categoryId, setCategoryId] = useState(entry.categoryId)
  const [amount, setAmount] = useState(String(entry.amount))
  const [currency, setCurrency] = useState<Currency>(entry.currency)
  const [note, setNote] = useState(entry.note)
  const parsed = roundFiat(parseAmount(amount), currency)
  const valid = !Number.isNaN(parsed) && parsed > 0

  function submit() {
    if (!valid) return
    onSave(categoryId, parsed, currency, note.trim())
    onClose()
  }

  function handleDelete() {
    onDelete()
    onClose()
  }

  return (
    <Modal title={t('Other planned expenses')} onClose={onClose}>
      <div className="form-group">
        <label htmlFor="editExpenseCategory">{t('Category')}</label>
        <select id="editExpenseCategory" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="editExpenseAmount">{t('Amount')}</label>
          <input
            id="editExpenseAmount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label htmlFor="editExpenseCurrency">{t('Currency')}</label>
          <select id="editExpenseCurrency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="editExpenseNote">{t('Note')}</label>
        <input
          id="editExpenseNote"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t('Optional')}
        />
      </div>
      <button className={`btn btn-block${valid ? ' btn-primary' : ''}`} onClick={submit} disabled={!valid} type="button">
        {t('Save')}
      </button>
      <button className="btn btn-danger btn-block" onClick={handleDelete} type="button" style={{ marginTop: 8 }}>
        {t('Delete')}
      </button>
    </Modal>
  )
}

export function PlanEditorModal({ planId, onClose }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const currencyOptions = CURRENCIES

  const today = new Date()
  const realMonthPrefix = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`

  const plan = useLiveQuery(() => db.plans.get(planId), [planId])
  const appliesMonth = plan?.appliesMonth ?? realMonthPrefix
  const recurringExpenses = useLiveQuery(() => db.recurringExpenses.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const activeCategories = categories.filter((c) => !c.archived)
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const spendingThisMonthRaw =
    useLiveQuery(() => db.spendingEntries.where('date').startsWith(appliesMonth).toArray(), [appliesMonth]) ?? []
  // A future-dated entry hasn't actually happened yet — it shouldn't count
  // as "already spent" any more than a recurring expense that hasn't
  // materialized yet does.
  const spendingThisMonth = useMemo(
    () => spendingThisMonthRaw.filter((e) => e.date <= todayIso()),
    [spendingThisMonthRaw],
  )

  const fixedExpenses = useMemo(
    () => fixedExpensesForMonth(recurringExpenses, appliesMonth, spendingThisMonth),
    [recurringExpenses, appliesMonth, spendingThisMonth],
  )

  async function changeAppliesMonth(value: string) {
    if (!value) return
    await db.plans.update(planId, { appliesMonth: value, updatedAt: new Date().toISOString() })
  }

  // --- draft income/expenses: loaded once from the DB, edited only in local
  // state, and only written back when "Save plan" is pressed. ---
  const tempIdRef = useRef(-1)
  const nextTempId = () => tempIdRef.current--
  const [draftIncome, setDraftIncome] = useState<PlannedIncome[]>([])
  const [draftExpenses, setDraftExpenses] = useState<PlannedExpense[]>([])
  const [draftLoaded, setDraftLoaded] = useState(false)
  // Tracks whether the draft has diverged from what's actually saved, so
  // closing the modal can warn instead of silently discarding it.
  const [dirty, setDirty] = useState(false)
  const [recurringInfoOpen, setRecurringInfoOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDraftLoaded(false)
    Promise.all([
      db.plannedIncome.where('planId').equals(planId).toArray(),
      db.plannedExpenses.where('planId').equals(planId).toArray(),
    ]).then(([income, expenses]) => {
      if (cancelled) return
      setDraftIncome(income)
      setDraftExpenses(expenses)
      setDraftLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [planId])

  // --- rename ---
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function startRename() {
    setNameDraft(plan?.name ?? '')
    setRenaming(true)
  }

  async function saveRename() {
    const trimmed = nameDraft.trim()
    if (!trimmed) return
    await db.plans.update(planId, { name: trimmed, updatedAt: new Date().toISOString() })
    setRenaming(false)
  }

  async function deletePlan() {
    await db.transaction('rw', db.plans, db.plannedIncome, db.plannedExpenses, async () => {
      await db.plannedIncome.where('planId').equals(planId).delete()
      await db.plannedExpenses.where('planId').equals(planId).delete()
      await db.plans.delete(planId)
    })
    toast(t('Plan deleted'))
    onClose()
  }

  const [showAddIncome, setShowAddIncome] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingIncomeId, setEditingIncomeId] = useState<number | null>(null)
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null)

  function addIncome(source: string, amount: number, currency: Currency) {
    setDraftIncome((prev) => [...prev, { id: nextTempId(), planId, source, amount, currency, createdAt: new Date().toISOString() }])
    setDirty(true)
  }

  function updateIncome(id: number, source: string, amount: number, currency: Currency) {
    setDraftIncome((prev) => (prev.map((i) => (i.id === id ? { ...i, source, amount, currency } : i))))
    setDirty(true)
  }

  function removeIncome(id?: number) {
    if (id == null) return
    setDraftIncome((prev) => prev.filter((i) => i.id !== id))
    setDirty(true)
  }

  function addExpense(categoryId: number, amount: number, currency: Currency, note: string) {
    setDraftExpenses((prev) => [
      ...prev,
      { id: nextTempId(), planId, categoryId, amount, currency, note, createdAt: new Date().toISOString() },
    ])
    setDirty(true)
  }

  function updateExpense(id: number, categoryId: number, amount: number, currency: Currency, note: string) {
    setDraftExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, categoryId, amount, currency, note } : e)))
    setDirty(true)
  }

  function removeExpense(id?: number) {
    if (id == null) return
    setDraftExpenses((prev) => prev.filter((e) => e.id !== id))
    setDirty(true)
  }

  // --- per-currency summary ---
  const totalsByCurrency = useMemo(() => {
    const map = new Map<Currency, CurrencyTotals>()
    const ensure = (c: Currency) => map.get(c) ?? map.set(c, { income: 0, fixed: 0, planned: 0 }).get(c)!
    draftIncome.forEach((i) => {
      ensure(i.currency).income += i.amount
    })
    fixedExpenses.forEach((r) => {
      ensure(r.currency).fixed += r.amount
    })
    draftExpenses.forEach((e) => {
      ensure(e.currency).planned += e.amount
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [draftIncome, fixedExpenses, draftExpenses])

  // --- per-category breakdown: planned (fixed + other) vs actual so far ---
  const categoryBreakdown = useMemo(() => {
    const planned = planCategoryTotals(draftExpenses, fixedExpenses)
    const actualByKey = new Map<string, number>()
    spendingThisMonth.forEach((e) => {
      const key = `${e.categoryId}:${e.currency}`
      actualByKey.set(key, (actualByKey.get(key) ?? 0) + e.amount)
    })
    return planned
      .map((p) => ({ ...p, actual: actualByKey.get(`${p.categoryId}:${p.currency}`) ?? 0 }))
      .sort((a, b) => a.currency.localeCompare(b.currency) || b.amount - a.amount)
  }, [draftExpenses, fixedExpenses, spendingThisMonth])

  // Planned expenses should stick to whichever currencies planned income
  // already established — falls back to the full list only before any
  // income has been added.
  const expenseCurrencyOptions = useMemo(() => {
    const established = new Set(draftIncome.map((i) => i.currency))
    return established.size > 0 ? currencyOptions.filter((c) => established.has(c.code)) : currencyOptions
  }, [draftIncome, currencyOptions])

  const canSavePlan = draftIncome.some((i) => i.amount > 0) && draftExpenses.some((e) => e.amount > 0)

  async function savePlan() {
    if (!canSavePlan) {
      toast(t('Add at least one income source and one expense before saving.'))
      return
    }
    const nowIso = new Date().toISOString()
    await db.transaction('rw', db.plans, db.plannedIncome, db.plannedExpenses, async () => {
      await db.plannedIncome.where('planId').equals(planId).delete()
      await db.plannedExpenses.where('planId').equals(planId).delete()
      for (const i of draftIncome) {
        await db.plannedIncome.add({
          planId,
          source: i.source,
          amount: i.amount,
          currency: i.currency,
          createdAt: i.createdAt,
        })
      }
      for (const e of draftExpenses) {
        await db.plannedExpenses.add({
          planId,
          categoryId: e.categoryId,
          amount: e.amount,
          currency: e.currency,
          note: e.note,
          createdAt: e.createdAt,
        })
      }
      await db.plans.update(planId, { updatedAt: nowIso })
    })
    toast(t('Plan saved'))
    onClose()
  }

  function handleClose() {
    if (dirty && !confirm(t('You have unsaved changes. Close without saving?'))) return
    onClose()
  }

  if (!plan || !draftLoaded) return null

  return (
    <>
      <Modal
        wide
        title={
          renaming ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                style={{ fontSize: '1rem' }}
              />
              <button className="btn btn-primary" onClick={saveRename} type="button">
                {t('Save')}
              </button>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {plan.name}
              <button className="btn btn-ghost btn-icon" onClick={startRename} type="button">
                <EditIcon />
              </button>
            </span>
          )
        }
        onClose={handleClose}
      >
        <div className="form-group">
          <label htmlFor="planAppliesMonth">{t('Applies to month')}</label>
          <input
            id="planAppliesMonth"
            type="month"
            value={appliesMonth}
            onChange={(e) => changeAppliesMonth(e.target.value)}
          />
        </div>

        <div className="section-title" style={{ marginTop: 20 }}>
          <h2>{t('Planned income')}</h2>
        </div>
        <div className="card settings-list">
          {draftIncome.length === 0 ? (
            <div className="muted">{t('No planned income yet.')}</div>
          ) : (
            <div className="list-frame">
              {draftIncome.map((i) => (
                <button className="list-frame-row as-button" key={i.id} onClick={() => setEditingIncomeId(i.id!)} type="button">
                  <div style={{ flex: 1 }}>{i.source}</div>
                  <strong>{formatMoney(i.amount, i.currency)}</strong>
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-accent-outline btn-block" onClick={() => setShowAddIncome(true)} type="button">
            {t('Add income')}
          </button>
        </div>

        <div className="section-title" style={{ marginTop: 20 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <h2>{t('Fixed expenses')}</h2>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setRecurringInfoOpen((o) => !o)}
              aria-label={t('Recurring expenses can be edited in the Manage Recurring Expenses menu.')}
              type="button"
            >
              ⓘ
            </button>
          </span>
        </div>
        {recurringInfoOpen && (
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: -8 }}>
            {t('Recurring expenses can be edited in the Manage Recurring Expenses menu.')}
          </p>
        )}
        <div className="card settings-list">
          {fixedExpenses.length === 0 ? (
            <div className="muted">{t('No recurring expenses due this month.')}</div>
          ) : (
            <div className="list-frame">
              {fixedExpenses.map((r) => {
                const cat = categoryMap.get(r.categoryId)
                return (
                  <div className="list-frame-row" key={r.id}>
                    <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                    <div style={{ flex: 1 }}>
                      <div>{r.note || cat?.name || t('Unknown')}</div>
                      {r.note && <div className="muted" style={{ fontSize: '0.82rem' }}>{cat?.name ?? t('Unknown')}</div>}
                    </div>
                    <strong>{formatMoney(r.amount, r.currency)}</strong>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="section-title" style={{ marginTop: 20 }}>
          <h2>{t('Other planned expenses')}</h2>
        </div>
        <div className="card settings-list">
          {draftExpenses.length === 0 ? (
            <div className="muted">{t('No other planned expenses yet.')}</div>
          ) : (
            <div className="list-frame">
              {draftExpenses.map((e) => {
                const cat = categoryMap.get(e.categoryId)
                return (
                  <button className="list-frame-row as-button" key={e.id} onClick={() => setEditingExpenseId(e.id!)} type="button">
                    <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                    <div style={{ flex: 1 }}>
                      <div>{e.note || cat?.name || t('Unknown')}</div>
                      {e.note && <div className="muted" style={{ fontSize: '0.82rem' }}>{cat?.name ?? t('Unknown')}</div>}
                    </div>
                    <strong>{formatMoney(e.amount, e.currency)}</strong>
                  </button>
                )
              })}
            </div>
          )}
          <button className="btn btn-accent-outline btn-block" onClick={() => setShowAddExpense(true)} type="button">
            {t('Add planned expense')}
          </button>
        </div>

        <div className="section-title">
          <h2>{t('Summary')}</h2>
        </div>
        {totalsByCurrency.length === 0 ? (
          <div className="muted">{t('Add planned income or expenses to see a summary.')}</div>
        ) : (
          <div className="card settings-list">
            {totalsByCurrency.map(([currency, totals]) => {
              const remaining = totals.income - totals.fixed - totals.planned
              return (
                <div className="settings-row wrap" key={currency}>
                  <div style={{ fontWeight: 700, width: '100%' }}>{currency}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">{t('Income')}</span>
                      <span>{formatMoney(totals.income, currency)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">{t('Fixed expenses')}</span>
                      <span>{formatMoney(totals.fixed, currency)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">{t('Other planned')}</span>
                      <span>{formatMoney(totals.planned, currency)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>{t('Remaining')}</span>
                      <span style={{ color: remaining < 0 ? 'var(--danger-strong)' : 'var(--accent)' }}>
                        {formatMoney(remaining, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="section-title">
          <h2>{t('Per category')}</h2>
        </div>
        {categoryBreakdown.length === 0 ? (
          <div className="muted">{t('No planned expenses in any category yet.')}</div>
        ) : (
          <div className="list-frame">
            {categoryBreakdown.map(({ categoryId, currency, amount, actual }) => {
              const cat = categoryMap.get(categoryId)
              const left = amount - actual
              return (
                <div className="list-frame-row" key={`${categoryId}:${currency}`}>
                  <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                  <div style={{ flex: 1 }}>
                    <div>{cat?.name ?? t('Unknown')}</div>
                    <div className="muted" style={{ fontSize: '0.82rem' }}>
                      {t('Planned')}: {formatMoney(amount, currency)} · {t('Actual')}: {formatMoney(actual, currency)}
                    </div>
                  </div>
                  <strong style={{ color: left < 0 ? 'var(--danger-strong)' : undefined }}>
                    {formatMoney(left, currency)}
                  </strong>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16 }}>
          <button className="btn btn-primary btn-block" onClick={savePlan} disabled={!canSavePlan} type="button">
            {t('Save plan')}
          </button>
          {!canSavePlan && (
            <div className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
              {t('Add at least one income source and one expense before saving.')}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)} type="button">
            {t('Delete this plan')}
          </button>
        </div>
      </Modal>

      {confirmingDelete && (
        <DeleteConfirmModal itemLabel={t('this plan')} onConfirmed={deletePlan} onClose={() => setConfirmingDelete(false)} />
      )}

      {showAddIncome && (
        <AddIncomeModal currencyOptions={currencyOptions} onAdd={addIncome} onClose={() => setShowAddIncome(false)} />
      )}

      {showAddExpense && (
        <AddExpenseModal
          categories={activeCategories}
          currencyOptions={expenseCurrencyOptions}
          onAdd={addExpense}
          onClose={() => setShowAddExpense(false)}
        />
      )}

      {editingIncomeId != null &&
        (() => {
          const entry = draftIncome.find((i) => i.id === editingIncomeId)
          if (!entry) return null
          return (
            <EditIncomeModal
              entry={entry}
              currencyOptions={currencyOptions}
              onSave={(source, amount, currency) => updateIncome(entry.id!, source, amount, currency)}
              onDelete={() => removeIncome(entry.id)}
              onClose={() => setEditingIncomeId(null)}
            />
          )
        })()}

      {editingExpenseId != null &&
        (() => {
          const entry = draftExpenses.find((e) => e.id === editingExpenseId)
          if (!entry) return null
          // The entry's own (possibly no-longer-"established") currency must
          // always stay selectable, even if it's not among expenseCurrencyOptions.
          const editCurrencyOptions = expenseCurrencyOptions.some((c) => c.code === entry.currency)
            ? expenseCurrencyOptions
            : [...expenseCurrencyOptions, ...currencyOptions.filter((c) => c.code === entry.currency)]
          return (
            <EditExpenseModal
              entry={entry}
              categories={categories}
              currencyOptions={editCurrencyOptions}
              onSave={(categoryId, amount, currency, note) => updateExpense(entry.id!, categoryId, amount, currency, note)}
              onDelete={() => removeExpense(entry.id)}
              onClose={() => setEditingExpenseId(null)}
            />
          )
        })()}
    </>
  )
}

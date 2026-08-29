import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency, PlannedExpense, PlannedIncome } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { formatMoney, pad2, parseAmount, roundFiat } from '../../lib/format'
import { fixedExpensesForMonth, planCategoryTotals } from '../../lib/planning'
import { Modal } from '../common/Modal'
import { DeleteConfirmModal } from '../Savings/DeleteConfirmModal'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { DeleteIcon } from '../common/DeleteIcon'
import { EditIcon } from '../common/EditIcon'

interface Props {
  planId: number
  onClose: () => void
  onManageRecurring: () => void
}

interface CurrencyTotals {
  income: number
  fixed: number
  planned: number
}

export function PlanEditorModal({ planId, onClose, onManageRecurring }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const defaultCurrency: Currency = 'EUR'
  const currencyOptions = CURRENCIES

  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`

  const plan = useLiveQuery(() => db.plans.get(planId), [planId])
  const recurringExpenses = useLiveQuery(() => db.recurringExpenses.toArray(), []) ?? []
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const activeCategories = categories.filter((c) => !c.archived)
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const spendingThisMonth =
    useLiveQuery(() => db.spendingEntries.where('date').startsWith(monthPrefix).toArray(), [monthPrefix]) ?? []

  const fixedExpenses = useMemo(
    () => fixedExpensesForMonth(recurringExpenses, monthPrefix),
    [recurringExpenses, monthPrefix],
  )

  // --- draft income/expenses: loaded once from the DB, edited only in local
  // state, and only written back when "Save plan" is pressed. ---
  const tempIdRef = useRef(-1)
  const nextTempId = () => tempIdRef.current--
  const [draftIncome, setDraftIncome] = useState<PlannedIncome[]>([])
  const [draftExpenses, setDraftExpenses] = useState<PlannedExpense[]>([])
  const [draftLoaded, setDraftLoaded] = useState(false)

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

  // --- add-income form ---
  const [incomeSource, setIncomeSource] = useState('')
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeCurrency, setIncomeCurrency] = useState<Currency>(defaultCurrency)
  const parsedIncomeAmount = roundFiat(parseAmount(incomeAmount), incomeCurrency)
  const incomeValid = incomeSource.trim().length > 0 && !Number.isNaN(parsedIncomeAmount) && parsedIncomeAmount > 0

  function addIncome() {
    if (!incomeValid) return
    setDraftIncome((prev) => [
      ...prev,
      {
        id: nextTempId(),
        planId,
        source: incomeSource.trim(),
        amount: parsedIncomeAmount,
        currency: incomeCurrency,
        createdAt: new Date().toISOString(),
      },
    ])
    setIncomeSource('')
    setIncomeAmount('')
  }

  function removeIncome(id?: number) {
    if (id == null) return
    setDraftIncome((prev) => prev.filter((i) => i.id !== id))
  }

  // --- add-expense form ---
  const [expenseCategoryId, setExpenseCategoryId] = useState<number | ''>('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>(defaultCurrency)
  const [expenseNote, setExpenseNote] = useState('')
  const parsedExpenseAmount = roundFiat(parseAmount(expenseAmount), expenseCurrency)
  const expenseValid = expenseCategoryId !== '' && !Number.isNaN(parsedExpenseAmount) && parsedExpenseAmount > 0

  function addExpense() {
    if (!expenseValid) return
    setDraftExpenses((prev) => [
      ...prev,
      {
        id: nextTempId(),
        planId,
        categoryId: expenseCategoryId as number,
        amount: parsedExpenseAmount,
        currency: expenseCurrency,
        note: expenseNote.trim(),
        createdAt: new Date().toISOString(),
      },
    ])
    setExpenseAmount('')
    setExpenseNote('')
  }

  function removeExpense(id?: number) {
    if (id == null) return
    setDraftExpenses((prev) => prev.filter((e) => e.id !== id))
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

  if (!plan || !draftLoaded) return null

  return (
    <Modal
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
      onClose={onClose}
    >
      <div className="section-title">
        <h2>{t('Planned income')}</h2>
      </div>
      {draftIncome.length === 0 ? (
        <div className="muted">{t('No planned income yet.')}</div>
      ) : (
        <div className="list-frame">
          {draftIncome.map((i) => (
            <div className="list-frame-row" key={i.id}>
              <div style={{ flex: 1 }}>{i.source}</div>
              <strong>{formatMoney(i.amount, i.currency)}</strong>
              <button className="btn btn-ghost btn-icon" onClick={() => removeIncome(i.id)} type="button">
                <DeleteIcon />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label htmlFor="incomeSource">{t('Source')}</label>
          <input
            id="incomeSource"
            value={incomeSource}
            onChange={(e) => setIncomeSource(e.target.value)}
            placeholder={t('e.g. Salary')}
          />
        </div>
        <div className="form-group">
          <label htmlFor="incomeAmount">{t('Amount')}</label>
          <input
            id="incomeAmount"
            type="text"
            inputMode="decimal"
            value={incomeAmount}
            onChange={(e) => setIncomeAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label htmlFor="incomeCurrency">{t('Currency')}</label>
          <select id="incomeCurrency" value={incomeCurrency} onChange={(e) => setIncomeCurrency(e.target.value as Currency)}>
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button className="btn btn-primary btn-block" onClick={addIncome} disabled={!incomeValid} type="button">
        {t('Add income')}
      </button>

      <div className="section-title">
        <h2>{t('Fixed expenses')}</h2>
      </div>
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
                  <div>{cat?.name ?? t('Unknown')}</div>
                  {r.note && <div className="muted" style={{ fontSize: '0.82rem' }}>{r.note}</div>}
                </div>
                <strong>{formatMoney(r.amount, r.currency)}</strong>
              </div>
            )
          })}
        </div>
      )}
      <button className="btn btn-ghost" onClick={onManageRecurring} type="button">
        {t('Manage Recurring Expenses')} ›
      </button>

      <div className="section-title">
        <h2>{t('Other planned expenses')}</h2>
      </div>
      {draftExpenses.length === 0 ? (
        <div className="muted">{t('No other planned expenses yet.')}</div>
      ) : (
        <div className="list-frame">
          {draftExpenses.map((e) => {
            const cat = categoryMap.get(e.categoryId)
            return (
              <div className="list-frame-row" key={e.id}>
                <span className="swatch" style={{ background: cat?.color ?? '#888' }} />
                <div style={{ flex: 1 }}>
                  <div>{cat?.name ?? t('Unknown')}</div>
                  {e.note && <div className="muted" style={{ fontSize: '0.82rem' }}>{e.note}</div>}
                </div>
                <strong>{formatMoney(e.amount, e.currency)}</strong>
                <button className="btn btn-ghost btn-icon" onClick={() => removeExpense(e.id)} type="button">
                  <DeleteIcon />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <div className="form-group">
        <label htmlFor="expenseCategory">{t('Category')}</label>
        <select
          id="expenseCategory"
          value={expenseCategoryId}
          onChange={(e) => setExpenseCategoryId(e.target.value ? Number(e.target.value) : '')}
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
          <label htmlFor="expenseAmount">{t('Amount')}</label>
          <input
            id="expenseAmount"
            type="text"
            inputMode="decimal"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label htmlFor="expenseCurrency">{t('Currency')}</label>
          <select id="expenseCurrency" value={expenseCurrency} onChange={(e) => setExpenseCurrency(e.target.value as Currency)}>
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="expenseNote">{t('Note')}</label>
        <input id="expenseNote" value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} placeholder={t('Optional')} />
      </div>
      <button className="btn btn-primary btn-block" onClick={addExpense} disabled={!expenseValid} type="button">
        {t('Add planned expense')}
      </button>

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

      <button className="btn btn-primary btn-block" onClick={savePlan} disabled={!canSavePlan} type="button">
        {t('Save plan')}
      </button>
      {!canSavePlan && (
        <div className="muted" style={{ textAlign: 'center', marginTop: 4 }}>
          {t('Add at least one income source and one expense before saving.')}
        </div>
      )}

      <div className="modal-actions">
        <button className="btn btn-danger" onClick={() => setConfirmingDelete(true)} type="button">
          {t('Delete this plan')}
        </button>
      </div>

      {confirmingDelete && (
        <DeleteConfirmModal
          itemLabel={t('this plan')}
          onConfirmed={deletePlan}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </Modal>
  )
}

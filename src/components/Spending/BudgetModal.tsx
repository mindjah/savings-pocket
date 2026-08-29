import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Category, CategoryBudget, Currency } from '../../db/types'
import { CURRENCIES } from '../../lib/constants'
import { formatMoney, pad2, parseAmount, roundFiat } from '../../lib/format'
import { fixedExpensesForMonth, planCategoryTotals } from '../../lib/planning'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useTranslation } from '../../hooks/useTranslation'
import { DeleteIcon } from '../common/DeleteIcon'

interface Props {
  onClose: () => void
}

type TotalBudget = Partial<Record<Currency, number>>

interface RowProps {
  entry: CategoryBudget
  category?: Category
  currencyOptions: { code: Currency; symbol: string }[]
  onChange: (amount: string, currency: Currency) => void
  onDelete: () => void
  removeLabel: string
}

function BudgetEntryRow({ entry, category, currencyOptions, onChange, onDelete, removeLabel }: RowProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(String(entry.amount))

  return (
    <div className="list-frame-row">
      <span className="swatch" style={{ background: category?.color ?? '#888' }} />
      <div style={{ flex: 1 }}>
        <div>{category?.name ?? t('Unknown')}</div>
        {entry.note && <div className="muted" style={{ fontSize: '0.82rem' }}>{entry.note}</div>}
      </div>
      <input
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => onChange(amount, entry.currency)}
        placeholder="0.00"
        style={{ width: 80 }}
      />
      <select
        value={entry.currency}
        onChange={(e) => onChange(amount, e.target.value as Currency)}
        style={{ width: 75 }}
      >
        {currencyOptions.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code}
          </option>
        ))}
      </select>
      <button className="btn btn-ghost btn-icon" onClick={onDelete} type="button" aria-label={removeLabel}>
        <DeleteIcon />
      </button>
    </div>
  )
}

interface AddTotalBudgetModalProps {
  currencyOptions: { code: Currency; symbol: string }[]
  defaultCurrency: Currency
  onAdd: (currency: Currency, amount: number) => void
  onClose: () => void
}

function AddTotalBudgetModal({ currencyOptions, defaultCurrency, onAdd, onClose }: AddTotalBudgetModalProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const parsed = roundFiat(parseAmount(amount), currency)
  const valid = !Number.isNaN(parsed) && parsed > 0

  function submit() {
    if (!valid) return
    onAdd(currency, parsed)
    onClose()
  }

  return (
    <Modal title={t('Add total budget')} onClose={onClose}>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="newTotalBudgetAmount">{t('Amount')}</label>
          <input
            id="newTotalBudgetAmount"
            type="text"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label htmlFor="newTotalBudgetCurrency">{t('Currency')}</label>
          <select id="newTotalBudgetCurrency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button className={`btn btn-block${valid ? ' btn-primary' : ''}`} onClick={submit} disabled={!valid} type="button">
        {t('Add total budget')}
      </button>
    </Modal>
  )
}

interface AddBudgetExpenseModalProps {
  categories: Category[]
  currencyOptions: { code: Currency; symbol: string }[]
  defaultCurrency: Currency
  onAdd: (categoryId: number, amount: number, currency: Currency, note: string) => void
  onClose: () => void
}

function AddBudgetExpenseModal({ categories, currencyOptions, defaultCurrency, onAdd, onClose }: AddBudgetExpenseModalProps) {
  const { t } = useTranslation()
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [note, setNote] = useState('')
  const parsed = roundFiat(parseAmount(amount), currency)
  const valid = categoryId !== '' && !Number.isNaN(parsed) && parsed > 0

  function submit() {
    if (!valid) return
    onAdd(categoryId as number, parsed, currency, note.trim())
    onClose()
  }

  return (
    <Modal title={t('Add budget expense')} onClose={onClose}>
      <div className="form-group">
        <label htmlFor="newBudgetCategory">{t('Category')}</label>
        <select
          id="newBudgetCategory"
          autoFocus
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
        >
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
          <label htmlFor="newBudgetAmount">{t('Amount')}</label>
          <input
            id="newBudgetAmount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label htmlFor="newBudgetCurrency">{t('Currency')}</label>
          <select id="newBudgetCurrency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="newBudgetNote">{t('Note')}</label>
        <input
          id="newBudgetNote"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t('Optional')}
        />
      </div>
      <button className={`btn btn-block${valid ? ' btn-primary' : ''}`} onClick={submit} disabled={!valid} type="button">
        {t('Add budget expense')}
      </button>
    </Modal>
  )
}

export function BudgetModal({ onClose }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const defaultCurrency: Currency = 'EUR'
  const currencyOptions = CURRENCIES
  const [budgetEnabled, setBudgetEnabled] = useMetaSetting<boolean>('budgetEnabled', false)
  const [, setTotalBudgetMeta] = useMetaSetting<TotalBudget>('totalBudgetLimit', {})

  const tempIdRef = useRef(-1)
  const nextTempId = () => tempIdRef.current--

  // --- draft state: loaded once from the DB, edited only locally, and only
  // written back when "Save budget" is pressed. One total-budget input per
  // currency, so a plan mixing e.g. USD and EUR income sets both. ---
  const [draftTotalInputs, setDraftTotalInputs] = useState<Partial<Record<Currency, string>>>({})
  const [draftBudgets, setDraftBudgets] = useState<CategoryBudget[]>([])
  const [draftLoaded, setDraftLoaded] = useState(false)
  // Tracks whether the draft has diverged from what's actually saved, so
  // closing the modal can warn instead of silently discarding it.
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([db.meta.get('totalBudgetLimit'), db.categoryBudgets.toArray()]).then(([rec, rows]) => {
      if (cancelled) return
      const val = (rec?.value as TotalBudget | undefined) ?? {}
      const inputs: Partial<Record<Currency, string>> = {}
      for (const [currency, amount] of Object.entries(val) as [Currency, number][]) {
        if (amount) inputs[currency] = String(amount)
      }
      setDraftTotalInputs(inputs)
      setDraftBudgets(rows)
      setDraftLoaded(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const activeCategories = categories.filter((c) => !c.archived)
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const sortedBudgets = useMemo(
    () => [...draftBudgets].sort((a, b) => (categoryMap.get(a.categoryId)?.name ?? '').localeCompare(categoryMap.get(b.categoryId)?.name ?? '')),
    [draftBudgets, categoryMap],
  )
  const plans = useLiveQuery(() => db.plans.toArray(), []) ?? []

  function allocatedInCurrency(currency: Currency, excludeId?: number) {
    return draftBudgets
      .filter((b) => b.currency === currency && b.id !== excludeId)
      .reduce((sum, b) => sum + b.amount, 0)
  }

  // One total-budget cap per currency that has a value entered.
  const totalsByCurrency = useMemo(() => {
    const result: { currency: Currency; amount: number }[] = []
    for (const c of currencyOptions) {
      const raw = draftTotalInputs[c.code]
      if (!raw) continue
      const parsed = roundFiat(parseAmount(raw), c.code)
      if (!Number.isNaN(parsed) && parsed > 0) result.push({ currency: c.code, amount: parsed })
    }
    return result
  }, [draftTotalInputs, currencyOptions])

  const overAllocatedCurrencies = totalsByCurrency.filter(({ currency, amount }) => allocatedInCurrency(currency) > amount)
  const hasTotalBudget = totalsByCurrency.length > 0
  const canSaveBudget = hasTotalBudget && overAllocatedCurrencies.length === 0

  const [showAddTotal, setShowAddTotal] = useState(false)
  const [showAddEntry, setShowAddEntry] = useState(false)

  function addTotalBudget(currency: Currency, amount: number) {
    setDraftTotalInputs((prev) => ({ ...prev, [currency]: String(amount) }))
    setDirty(true)
  }

  function removeTotalBudget(currency: Currency) {
    setDraftTotalInputs((prev) => {
      const next = { ...prev }
      delete next[currency]
      return next
    })
    setDirty(true)
  }

  function changeTotalBudgetAmount(currency: Currency, value: string) {
    setDraftTotalInputs((prev) => ({ ...prev, [currency]: value }))
    setDirty(true)
  }

  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('')

  function addEntry(categoryId: number, amount: number, currency: Currency, note: string) {
    const now = new Date().toISOString()
    setDraftBudgets((prev) => [
      ...prev,
      { id: nextTempId(), categoryId, amount, currency, note, createdAt: now, updatedAt: now },
    ])
    setDirty(true)
  }

  function updateEntry(id: number, amountStr: string, currency: Currency) {
    const parsed = roundFiat(parseAmount(amountStr), currency)
    if (Number.isNaN(parsed) || parsed <= 0) return
    setDraftBudgets((prev) =>
      prev.map((b) => (b.id === id ? { ...b, amount: parsed, currency, updatedAt: new Date().toISOString() } : b)),
    )
    setDirty(true)
  }

  function deleteEntry(id?: number) {
    if (id == null) return
    setDraftBudgets((prev) => prev.filter((b) => b.id !== id))
    setDirty(true)
  }

  async function fillFromPlan() {
    if (selectedPlanId === '') return
    if (!confirm(t('This will replace your current (unsaved) budget with this plan. Continue?'))) return
    const plan = plans.find((p) => p.id === selectedPlanId)
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
    const [planExpenses, planIncome, allRecurring] = await Promise.all([
      db.plannedExpenses.where('planId').equals(selectedPlanId).toArray(),
      db.plannedIncome.where('planId').equals(selectedPlanId).toArray(),
      db.recurringExpenses.toArray(),
    ])
    const fixed = fixedExpensesForMonth(allRecurring, monthPrefix)
    const totals = planCategoryTotals(planExpenses, fixed)
    const nowIso = now.toISOString()
    const note = plan ? `${t('From plan:')} ${plan.name}` : ''
    setDraftBudgets(
      totals.map((total) => ({
        id: nextTempId(),
        categoryId: total.categoryId,
        amount: total.amount,
        currency: total.currency,
        note,
        createdAt: nowIso,
        updatedAt: nowIso,
      })),
    )

    const incomeByCurrency = new Map<Currency, number>()
    planIncome.forEach((i) => incomeByCurrency.set(i.currency, (incomeByCurrency.get(i.currency) ?? 0) + i.amount))
    setDraftTotalInputs((prev) => {
      const next = { ...prev }
      incomeByCurrency.forEach((amount, currency) => {
        next[currency] = String(roundFiat(amount, currency))
      })
      return next
    })
    setDirty(true)
    toast(t('Budget filled from plan'))
  }

  async function saveBudget() {
    if (!hasTotalBudget) {
      toast(t('Enter a total budget amount before saving.'))
      return
    }
    if (!canSaveBudget) {
      toast(t('Budget expenses exceed the total budget. Reduce them or raise the total before saving.'))
      return
    }
    const nowIso = new Date().toISOString()
    await db.transaction('rw', db.categoryBudgets, async () => {
      await db.categoryBudgets.clear()
      for (const b of draftBudgets) {
        await db.categoryBudgets.add({
          categoryId: b.categoryId,
          amount: b.amount,
          currency: b.currency,
          note: b.note,
          createdAt: b.createdAt,
          updatedAt: nowIso,
        })
      }
    })
    const totalMeta: TotalBudget = {}
    for (const { currency, amount } of totalsByCurrency) totalMeta[currency] = amount
    await setTotalBudgetMeta(totalMeta)
    toast(t('Budget saved'))
    onClose()
  }

  function handleClose() {
    if (dirty && !confirm(t('You have unsaved changes. Close without saving?'))) return
    onClose()
  }

  if (!draftLoaded) return null

  return (
    <>
      <Modal title={t('Manage budget')} onClose={handleClose}>
        <div className="settings-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>{t('Enable budget tracking')}</div>
            <div className="muted">{t('Shows a spending-pace warning under Total spent on the Spending screen')}</div>
          </div>
          <label className="switch" style={{ flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={budgetEnabled}
              onChange={(e) => setBudgetEnabled(e.target.checked)}
              aria-label={t('Enable budget tracking')}
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>

        <div className="section-title">
          <h2>{t('Fill from a saved plan')}</h2>
        </div>
        <div className="card settings-list">
          <div className="form-row" style={{ margin: 0 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">{t('Select…')}</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={fillFromPlan} disabled={selectedPlanId === ''} type="button">
              {t('Apply')}
            </button>
          </div>
        </div>

        <div className="section-title">
          <h2>{t('Total budget')}</h2>
        </div>
        <div className="card settings-list">
          {totalsByCurrency.length === 0 ? (
            <div className="muted">{t('No total budget set yet.')}</div>
          ) : (
            <div className="list-frame">
              {totalsByCurrency.map(({ currency, amount }) => {
                const allocated = allocatedInCurrency(currency)
                const over = allocated > amount
                return (
                  <div className="list-frame-row" key={currency}>
                    <div style={{ flex: 1 }}>
                      <div>{currency}</div>
                      <div className="muted" style={{ fontSize: '0.82rem', color: over ? 'var(--danger-strong)' : undefined }}>
                        {t('Allocated')}: {formatMoney(allocated, currency)} / {formatMoney(amount, currency)}
                      </div>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draftTotalInputs[currency] ?? ''}
                      onChange={(e) => changeTotalBudgetAmount(currency, e.target.value)}
                      placeholder="0.00"
                      style={{ width: 80 }}
                    />
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={() => removeTotalBudget(currency)}
                      type="button"
                      aria-label={t('Remove budget')}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <button className="btn btn-accent-outline btn-block" onClick={() => setShowAddTotal(true)} type="button">
            {t('Add total budget')}
          </button>
        </div>

        <div className="section-title">
          <h2>{t('Budget expenses')}</h2>
        </div>
        <div className="card settings-list">
          {sortedBudgets.length === 0 ? (
            <div className="muted">{t('No budget expenses yet.')}</div>
          ) : (
            <div className="list-frame">
              {sortedBudgets.map((b) => (
                <BudgetEntryRow
                  key={b.id}
                  entry={b}
                  category={categoryMap.get(b.categoryId)}
                  currencyOptions={currencyOptions}
                  onChange={(amount, currency) => updateEntry(b.id!, amount, currency)}
                  onDelete={() => deleteEntry(b.id)}
                  removeLabel={t('Remove budget')}
                />
              ))}
            </div>
          )}
          <button className="btn btn-accent-outline btn-block" onClick={() => setShowAddEntry(true)} type="button">
            {t('Add budget expense')}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16 }}>
          <button className="btn btn-primary btn-block" onClick={saveBudget} disabled={!canSaveBudget} type="button">
            {t('Save budget')}
          </button>
          {!canSaveBudget && (
            <div className="muted" style={{ textAlign: 'center', marginTop: 8, color: 'var(--danger-strong)' }}>
              {!hasTotalBudget
                ? t('Enter a total budget amount before saving.')
                : t('Budget expenses exceed the total budget. Reduce them or raise the total before saving.')}
            </div>
          )}
        </div>
      </Modal>

      {showAddTotal && (
        <AddTotalBudgetModal
          currencyOptions={currencyOptions}
          defaultCurrency={defaultCurrency}
          onAdd={addTotalBudget}
          onClose={() => setShowAddTotal(false)}
        />
      )}

      {showAddEntry && (
        <AddBudgetExpenseModal
          categories={activeCategories}
          currencyOptions={currencyOptions}
          defaultCurrency={defaultCurrency}
          onAdd={addEntry}
          onClose={() => setShowAddEntry(false)}
        />
      )}
    </>
  )
}

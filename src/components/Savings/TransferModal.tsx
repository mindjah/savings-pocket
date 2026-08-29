import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Currency, PocketKind } from '../../db/types'
import { formatMoney, parseAmount, roundFiat } from '../../lib/format'
import { Modal } from '../common/Modal'
import { ExpandableTextarea } from '../common/ExpandableTextarea'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { TransferIcon } from '../common/TransferIcon'

interface Asset {
  key: string
  table: 'savingsEntries' | 'loanEntries'
  id: number
  currency: Currency
  amount: number
  name: string
  group: 'pocket' | 'credit' | 'loan'
  kind?: PocketKind
}

interface Props {
  onClose: () => void
}

export function TransferModal({ onClose }: Props) {
  const { t } = useTranslation()
  const toast = useToast()

  const savingsEntries = useLiveQuery(() => db.savingsEntries.toArray(), []) ?? []
  const loans = useLiveQuery(() => db.loanEntries.toArray(), []) ?? []

  const assets = useMemo<Asset[]>(() => {
    const pockets: Asset[] = savingsEntries
      .filter((e) => e.id != null)
      .map((e) => ({
        key: `savingsEntries-${e.id}`,
        table: 'savingsEntries',
        id: e.id!,
        currency: e.currency,
        amount: e.amount,
        name: e.location,
        group: e.kind === 'credit' ? 'credit' : 'pocket',
        kind: e.kind,
      }))
    const loanAssets: Asset[] = loans
      .filter((l) => l.id != null)
      .map((l) => ({
        key: `loanEntries-${l.id}`,
        table: 'loanEntries',
        id: l.id!,
        currency: l.currency,
        amount: l.amount,
        name: l.borrowerName,
        group: 'loan',
      }))
    return [...pockets, ...loanAssets]
  }, [savingsEntries, loans])

  const [fromKey, setFromKey] = useState('')
  const [toKey, setToKey] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const fromAsset = assets.find((a) => a.key === fromKey) ?? null
  const toAsset = assets.find((a) => a.key === toKey) ?? null
  // Same currency only — an internal transfer moves the exact amount, no FX conversion.
  const toOptions = fromAsset ? assets.filter((a) => a.key !== fromKey && a.currency === fromAsset.currency) : []

  const parsedAmount = useMemo(
    () => (fromAsset ? roundFiat(parseAmount(amount), fromAsset.currency) : NaN),
    [amount, fromAsset],
  )
  const newFromAmount = fromAsset ? roundFiat(fromAsset.amount - parsedAmount, fromAsset.currency) : NaN
  const newToAmount = toAsset ? roundFiat(toAsset.amount + parsedAmount, toAsset.currency) : NaN
  // Only regular pockets are floored at zero — credits and loans can freely go negative.
  const requiresNonNegative = fromAsset?.group === 'pocket'

  const valid =
    !!fromAsset &&
    !!toAsset &&
    fromAsset.key !== toAsset.key &&
    amount.trim() !== '' &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    (!requiresNonNegative || newFromAmount >= 0)

  function groupLabel(group: Asset['group']): string {
    if (group === 'pocket') return t('Pockets')
    if (group === 'credit') return t('Credits')
    return t('Lent out')
  }

  function renderOptions(list: Asset[]) {
    const groups: Asset['group'][] = ['pocket', 'credit', 'loan']
    return groups
      .map((group) => list.filter((a) => a.group === group))
      .filter((group) => group.length > 0)
      .map((group, i) => (
        <optgroup key={groups[i]} label={groupLabel(group[0].group)}>
          {group.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name} — {formatMoney(a.amount, a.currency)}
            </option>
          ))}
        </optgroup>
      ))
  }

  async function handleSubmit() {
    if (!valid || !fromAsset || !toAsset) return
    const now = new Date().toISOString()
    // History comments stay in English always, like every other DB-persisted
    // audit comment in this app — never routed through t().
    const fromComment = reason.trim() || `Transfer to ${toAsset.name}`
    const toComment = reason.trim() || `Transfer from ${fromAsset.name}`

    await db.transaction('rw', db.savingsEntries, db.savingsHistory, db.loanEntries, db.loanHistory, async () => {
      if (fromAsset.table === 'savingsEntries') {
        await db.savingsEntries.update(fromAsset.id, { amount: newFromAmount, updatedAt: now })
        await db.savingsHistory.add({
          entryId: fromAsset.id,
          previousAmount: fromAsset.amount,
          newAmount: newFromAmount,
          date: now,
          comment: fromComment,
          source: 'manual',
        })
      } else {
        await db.loanEntries.update(fromAsset.id, { amount: newFromAmount, updatedAt: now })
        await db.loanHistory.add({
          entryId: fromAsset.id,
          previousAmount: fromAsset.amount,
          newAmount: newFromAmount,
          date: now,
          comment: fromComment,
        })
      }
      if (toAsset.table === 'savingsEntries') {
        await db.savingsEntries.update(toAsset.id, { amount: newToAmount, updatedAt: now })
        await db.savingsHistory.add({
          entryId: toAsset.id,
          previousAmount: toAsset.amount,
          newAmount: newToAmount,
          date: now,
          comment: toComment,
          source: 'manual',
        })
      } else {
        await db.loanEntries.update(toAsset.id, { amount: newToAmount, updatedAt: now })
        await db.loanHistory.add({
          entryId: toAsset.id,
          previousAmount: toAsset.amount,
          newAmount: newToAmount,
          date: now,
          comment: toComment,
        })
      }
    })
    toast(t('Transfer completed'))
    onClose()
  }

  return (
    <Modal title={t('Transfer')} onClose={onClose}>
      <p className="muted" style={{ marginTop: -4 }}>
        {t('Move money between any of your own pockets, credits, and loans.')}
      </p>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="transferFrom">{t('Move from')}</label>
          <select
            id="transferFrom"
            value={fromKey}
            onChange={(e) => {
              setFromKey(e.target.value)
              setToKey('')
            }}
          >
            <option value="">{t('Select…')}</option>
            {renderOptions(assets.filter((a) => a.key !== toKey))}
          </select>
        </div>
        <span className="transfer-row-icon" aria-hidden="true">
          <TransferIcon size={16} />
        </span>
        <div className="form-group">
          <label htmlFor="transferTo">{t('Move to')}</label>
          <select id="transferTo" value={toKey} onChange={(e) => setToKey(e.target.value)} disabled={!fromAsset}>
            <option value="">{t('Select…')}</option>
            {renderOptions(toOptions)}
          </select>
        </div>
      </div>

      {fromAsset && toOptions.length === 0 && (
        <p className="muted">{t('No other account in this currency to transfer to.')}</p>
      )}

      <div className="form-group">
        <label htmlFor="transferAmount">{t('Amount')}</label>
        <input
          id="transferAmount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          disabled={!fromAsset}
        />
      </div>

      {fromAsset && toAsset && amount.trim() !== '' && !Number.isNaN(parsedAmount) && (
        <div className="muted" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>
            {fromAsset.name}: {formatMoney(fromAsset.amount, fromAsset.currency)} → {formatMoney(newFromAmount, fromAsset.currency)}
            {requiresNonNegative && newFromAmount < 0 && (
              <span style={{ color: 'var(--danger-strong)' }}>{t(" — can't go below zero")}</span>
            )}
          </span>
          <span>
            {toAsset.name}: {formatMoney(toAsset.amount, toAsset.currency)} → {formatMoney(newToAmount, toAsset.currency)}
          </span>
        </div>
      )}

      <ExpandableTextarea
        id="transferReason"
        label={t('Reason (saved to history)')}
        value={reason}
        onChange={setReason}
        placeholder={t('e.g. Moving savings to a better rate account')}
      />

      <div className="modal-actions">
        <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={!valid} type="button">
          {t('Transfer')}
        </button>
      </div>
    </Modal>
  )
}

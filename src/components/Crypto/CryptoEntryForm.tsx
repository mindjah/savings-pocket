import { useMemo, useState } from 'react'
import { db } from '../../db/db'
import type { CryptoEntry } from '../../db/types'
import { POPULAR_COINS } from '../../lib/constants'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'

interface Props {
  entry: CryptoEntry | null
  onClose: () => void
}

const CUSTOM_VALUE = '__custom__'

export function CryptoEntryForm({ entry, onClose }: Props) {
  const isEdit = !!entry
  const initialIsPopular = entry ? POPULAR_COINS.some((c) => c.coinId === entry.coinId) : true
  const [preset, setPreset] = useState(
    entry ? (initialIsPopular ? entry.coinId : CUSTOM_VALUE) : POPULAR_COINS[0].coinId,
  )
  const [customCoinId, setCustomCoinId] = useState(!initialIsPopular ? entry?.coinId ?? '' : '')
  const [customSymbol, setCustomSymbol] = useState(!initialIsPopular ? entry?.symbol ?? '' : '')
  const [customName, setCustomName] = useState(!initialIsPopular ? entry?.name ?? '' : '')
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [reason, setReason] = useState('')
  const toast = useToast()

  const parsedAmount = useMemo(() => Number(amount), [amount])
  const amountChanged = isEdit && entry && parsedAmount !== entry.amount

  const resolved = useMemo(() => {
    if (preset === CUSTOM_VALUE) {
      return {
        coinId: customCoinId.trim().toLowerCase(),
        symbol: customSymbol.trim().toUpperCase(),
        name: customName.trim() || customSymbol.trim().toUpperCase(),
      }
    }
    const found = POPULAR_COINS.find((c) => c.coinId === preset)!
    return found
  }, [preset, customCoinId, customSymbol, customName])

  const valid =
    resolved.coinId.length > 0 &&
    resolved.symbol.length > 0 &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount >= 0

  async function handleSubmit() {
    if (!valid) return
    const now = new Date().toISOString()
    if (isEdit && entry?.id != null) {
      if (amountChanged) {
        await db.cryptoHistory.add({
          entryId: entry.id,
          previousAmount: entry.amount,
          newAmount: parsedAmount,
          date: now,
          comment: reason.trim(),
        })
      }
      await db.cryptoEntries.update(entry.id, {
        coinId: resolved.coinId,
        symbol: resolved.symbol,
        name: resolved.name,
        amount: parsedAmount,
        note: note.trim(),
        updatedAt: now,
      })
      toast('Crypto holding updated')
    } else {
      await db.cryptoEntries.add({
        coinId: resolved.coinId,
        symbol: resolved.symbol,
        name: resolved.name,
        amount: parsedAmount,
        note: note.trim(),
        createdAt: now,
        updatedAt: now,
      })
      toast('Crypto holding added')
    }
    onClose()
  }

  async function handleDelete() {
    if (!entry?.id) return
    if (!confirm('Delete this crypto holding and its history? This cannot be undone.')) return
    await db.transaction('rw', db.cryptoEntries, db.cryptoHistory, async () => {
      await db.cryptoHistory.where('entryId').equals(entry.id!).delete()
      await db.cryptoEntries.delete(entry.id!)
    })
    toast('Crypto holding deleted')
    onClose()
  }

  return (
    <Modal title={isEdit ? 'Edit crypto holding' : 'Add crypto holding'} onClose={onClose}>
      <div className="form-group">
        <label htmlFor="coin">Coin</label>
        <select id="coin" value={preset} disabled={isEdit} onChange={(e) => setPreset(e.target.value)}>
          {POPULAR_COINS.map((c) => (
            <option key={c.coinId} value={c.coinId}>
              {c.symbol} — {c.name}
            </option>
          ))}
          <option value={CUSTOM_VALUE}>Custom coin…</option>
        </select>
      </div>

      {preset === CUSTOM_VALUE && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="customSymbol">Symbol</label>
              <input
                id="customSymbol"
                value={customSymbol}
                disabled={isEdit}
                onChange={(e) => setCustomSymbol(e.target.value)}
                placeholder="e.g. LINK"
              />
            </div>
            <div className="form-group">
              <label htmlFor="customName">Name</label>
              <input
                id="customName"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Chainlink"
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="customCoinId">CoinGecko id</label>
            <input
              id="customCoinId"
              value={customCoinId}
              disabled={isEdit}
              onChange={(e) => setCustomCoinId(e.target.value)}
              placeholder="e.g. chainlink"
            />
            <span className="datalist-hint">
              Find the id in the coin's CoinGecko URL, e.g. coingecko.com/en/coins/<b>chainlink</b>
            </span>
          </div>
        </>
      )}

      <div className="form-group">
        <label htmlFor="cryptoAmount">Amount</label>
        <input
          id="cryptoAmount"
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="form-group">
        <label htmlFor="cryptoNote">Note</label>
        <textarea
          id="cryptoNote"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Cold wallet, exchange name…"
        />
      </div>

      {amountChanged && (
        <div className="form-group">
          <label htmlFor="cryptoReason">Reason for change (saved to history)</label>
          <textarea
            id="cryptoReason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why did this amount change?"
          />
        </div>
      )}

      <div className="modal-actions">
        {isEdit && (
          <button className="btn btn-danger" onClick={handleDelete} type="button">
            Delete
          </button>
        )}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!valid} type="button">
          {isEdit ? 'Save changes' : 'Add holding'}
        </button>
      </div>
    </Modal>
  )
}

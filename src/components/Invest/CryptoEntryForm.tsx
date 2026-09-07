import { useMemo, useState } from 'react'
import { db } from '../../db/db'
import type { CryptoEntry } from '../../db/types'
import { POPULAR_COINS } from '../../lib/constants'
import { parseAmount } from '../../lib/format'
import { Modal } from '../common/Modal'
import { ExpandableTextarea } from '../common/ExpandableTextarea'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { AddCryptoIcon } from '../common/AddCryptoIcon'

interface Props {
  entry: CryptoEntry | null
  onClose: () => void
}

const CUSTOM_VALUE = '__custom__'

export function CryptoEntryForm({ entry, onClose }: Props) {
  const { t } = useTranslation()
  const isEdit = !!entry
  const initialIsPopular = entry ? POPULAR_COINS.some((c) => c.coinId === entry.coinId) : true
  const [preset, setPreset] = useState(
    entry ? (initialIsPopular ? entry.coinId : CUSTOM_VALUE) : POPULAR_COINS[0].coinId,
  )
  const [customCoinId, setCustomCoinId] = useState(!initialIsPopular ? entry?.coinId ?? '' : '')
  const [customSymbol, setCustomSymbol] = useState(!initialIsPopular ? entry?.symbol ?? '' : '')
  const [customName, setCustomName] = useState(!initialIsPopular ? entry?.name ?? '' : '')
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const [pinned, setPinned] = useState(entry?.pinned ?? false)
  const [note, setNote] = useState(entry?.note ?? '')
  const [reason, setReason] = useState('')
  const toast = useToast()

  const parsedAmount = useMemo(() => parseAmount(amount), [amount])
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
    amount.trim() !== '' &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount >= 0

  const dirty = entry
    ? preset !== (initialIsPopular ? entry.coinId : CUSTOM_VALUE) ||
      customCoinId !== (!initialIsPopular ? entry.coinId : '') ||
      customSymbol !== (!initialIsPopular ? entry.symbol : '') ||
      customName !== (!initialIsPopular ? entry.name : '') ||
      amount !== String(entry.amount) ||
      pinned !== entry.pinned ||
      note !== entry.note ||
      reason.trim() !== ''
    : preset !== POPULAR_COINS[0].coinId ||
      customCoinId !== '' ||
      customSymbol !== '' ||
      customName !== '' ||
      amount !== '' ||
      pinned !== false ||
      note !== ''

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
        pinned,
        updatedAt: now,
      })
      toast(t('Crypto holding updated'))
    } else {
      await db.cryptoEntries.add({
        coinId: resolved.coinId,
        symbol: resolved.symbol,
        name: resolved.name,
        amount: parsedAmount,
        note: note.trim(),
        pinned,
        createdAt: now,
        updatedAt: now,
      })
      toast(t('Crypto holding added'))
    }
    onClose()
  }

  async function handleDelete() {
    if (!entry?.id) return
    if (!confirm(t('Delete this crypto holding and its history? This cannot be undone.'))) return
    await db.transaction('rw', db.cryptoEntries, db.cryptoHistory, async () => {
      await db.cryptoHistory.where('entryId').equals(entry.id!).delete()
      await db.cryptoEntries.delete(entry.id!)
    })
    toast(t('Crypto holding deleted'))
    onClose()
  }

  return (
    <Modal
      title={
        isEdit ? (
          t('Edit crypto holding')
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 8 }}>
            {t('Add crypto holding')}
            <AddCryptoIcon size={30} />
          </span>
        )
      }
      onClose={onClose}
      hasUnsavedChanges={dirty}
    >
      <div className="form-group">
        <label htmlFor="coin">{t('Coin')}</label>
        <select id="coin" value={preset} disabled={isEdit} onChange={(e) => setPreset(e.target.value)}>
          {POPULAR_COINS.map((c) => (
            <option key={c.coinId} value={c.coinId}>
              {c.symbol} — {c.name}
            </option>
          ))}
          <option value={CUSTOM_VALUE}>{t('Custom coin…')}</option>
        </select>
      </div>

      {preset === CUSTOM_VALUE && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="customSymbol">{t('Symbol')}</label>
              <input
                id="customSymbol"
                value={customSymbol}
                disabled={isEdit}
                onChange={(e) => setCustomSymbol(e.target.value)}
                placeholder={t('e.g. LINK')}
              />
            </div>
            <div className="form-group">
              <label htmlFor="customName">{t('Name')}</label>
              <input
                id="customName"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={t('e.g. Chainlink')}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="customCoinId">{t('CoinGecko id')}</label>
            <input
              id="customCoinId"
              value={customCoinId}
              disabled={isEdit}
              onChange={(e) => setCustomCoinId(e.target.value)}
              placeholder="e.g. chainlink"
            />
            <span className="datalist-hint">
              {t("Find the id in the coin's CoinGecko URL, e.g. ")}coingecko.com/en/coins/<b>chainlink</b>
            </span>
          </div>
        </>
      )}

      <div className="form-group">
        <label htmlFor="cryptoAmount">{t('Amount')}</label>
        <input
          id="cryptoAmount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="settings-row">
        <div>{t('Pin to top')}</div>
        <label className="switch">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          <span className="switch-track">
            <span className="switch-thumb" />
          </span>
        </label>
      </div>

      <ExpandableTextarea
        id="cryptoNote"
        label={t('Note')}
        value={note}
        onChange={setNote}
        placeholder={t('e.g. Cold wallet, exchange name…')}
      />

      {amountChanged && (
        <ExpandableTextarea
          id="cryptoReason"
          label={t('Reason for change (saved to history)')}
          value={reason}
          onChange={setReason}
          placeholder={t('Why did this amount change?')}
        />
      )}

      <div className="modal-actions">
        {isEdit && (
          <button className="btn btn-danger" onClick={handleDelete} type="button">
            {t('Delete')}
          </button>
        )}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!valid} type="button">
          {t(isEdit ? 'Save changes' : 'Add holding')}
        </button>
      </div>
    </Modal>
  )
}

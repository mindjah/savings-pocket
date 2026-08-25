import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { CURRENCIES, DEFAULT_CRYPTO_CURRENCIES, DEFAULT_SAVINGS_CURRENCIES, DEFAULT_SPENDING_CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { exportBackup, importBackup } from '../../lib/backup'
import { useToast } from '../../hooks/useToast'
import type { Currency, SavingsTrackingMode } from '../../db/types'
import { CurrencyMultiSelect } from '../common/CurrencyMultiSelect'
import { CurrencySingleSelect } from '../common/CurrencySingleSelect'

export function SettingsView() {
  const [savingsCurrencies, setSavingsCurrencies] = useMetaSetting<Currency[]>(
    'enabledSavingsCurrencies',
    DEFAULT_SAVINGS_CURRENCIES,
  )
  const [cryptoCurrencies, setCryptoCurrencies] = useMetaSetting<Currency[]>(
    'enabledCryptoCurrencies',
    DEFAULT_CRYPTO_CURRENCIES,
  )
  const [spendingCurrencies, setSpendingCurrencies] = useMetaSetting<Currency[]>(
    'enabledSpendingCurrencies',
    DEFAULT_SPENDING_CURRENCIES,
  )
  const [netWorthCurrency, setNetWorthCurrency] = useMetaSetting<Currency>('netWorthCurrency', 'EUR')
  const netWorthOptions = useMemo(
    () => CURRENCIES.filter((c) => savingsCurrencies.includes(c.code) || cryptoCurrencies.includes(c.code)).map((c) => c.code),
    [savingsCurrencies, cryptoCurrencies],
  )
  // If the saved display currency was disabled in Settings, fall back to the first available one.
  useEffect(() => {
    if (netWorthOptions.length > 0 && !netWorthOptions.includes(netWorthCurrency)) {
      setNetWorthCurrency(netWorthOptions[0])
    }
  }, [netWorthOptions, netWorthCurrency, setNetWorthCurrency])

  // Draft state so mode/default-pocket edits only take effect once Save is tapped.
  // Seeded with a direct one-time DB read (not useMetaSetting's live-updating value,
  // which briefly reports its fallback default before the query resolves — syncing
  // from that reactively caused the draft to permanently lock onto the wrong value).
  const [trackingMode, setTrackingMode] = useState<SavingsTrackingMode>('manual')
  const [defaultPockets, setDefaultPockets] = useState<Partial<Record<Currency, number>>>({})
  const [trackingChanged, setTrackingChanged] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([db.meta.get('savingsTrackingMode'), db.meta.get('defaultSavingsPocketByCurrency')]).then(
      ([modeRec, pocketsRec]) => {
        if (cancelled) return
        setTrackingMode((modeRec?.value as SavingsTrackingMode) ?? 'manual')
        setDefaultPockets((pocketsRec?.value as Partial<Record<Currency, number>>) ?? {})
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  function updateDraftMode(next: SavingsTrackingMode) {
    setTrackingMode(next)
    setTrackingChanged(true)
  }

  function updateDraftPocket(cur: Currency, pocketId: number | undefined) {
    setDefaultPockets({ ...defaultPockets, [cur]: pocketId })
    setTrackingChanged(true)
  }

  async function handleSaveTracking() {
    await db.meta.put({ key: 'savingsTrackingMode', value: trackingMode })
    await db.meta.put({ key: 'defaultSavingsPocketByCurrency', value: defaultPockets })
    setTrackingChanged(false)
    toast('Savings tracking settings saved')
  }

  const [modeInfoOpen, setModeInfoOpen] = useState(false)
  const pockets = useLiveQuery(() => db.savingsEntries.toArray(), []) ?? []

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function handleExport() {
    setBusy(true)
    try {
      await exportBackup()
      toast('Backup exported')
    } finally {
      setBusy(false)
    }
  }

  async function handleImportFile(file: File) {
    if (
      !confirm(
        'Importing will replace ALL current data (savings, crypto, spending, categories) with the contents of this backup file. Continue?',
      )
    ) {
      return
    }
    setBusy(true)
    try {
      const { imported } = await importBackup(file)
      const total = Object.values(imported).reduce((a, b) => a + b, 0)
      toast(`Import complete — ${total} records restored`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import backup')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view">
      <div className="section-title">
        <h2>Currencies</h2>
      </div>

      <div className="card settings-list">
        <div className="settings-row wrap">
          <div>
            <div>Savings currencies</div>
            <div className="muted">Shown as totals in Savings and Lent out — at least one required</div>
          </div>
          <CurrencyMultiSelect selected={savingsCurrencies} onChange={setSavingsCurrencies} />
        </div>

        <div className="settings-row wrap">
          <div>
            <div>Total net worth</div>
            <div className="muted">Currency used to display the combined savings + crypto + lent-out total</div>
          </div>
          <CurrencySingleSelect value={netWorthCurrency} options={netWorthOptions} onChange={setNetWorthCurrency} />
        </div>
      </div>

      <div className="card settings-list">
        <div className="settings-row wrap">
          <div>
            <div>Crypto currencies</div>
            <div className="muted">Fiat currencies shown for crypto holdings and totals</div>
          </div>
          <CurrencyMultiSelect selected={cryptoCurrencies} onChange={setCryptoCurrencies} />
        </div>
      </div>

      <div className="card settings-list">
        <div className="settings-row wrap">
          <div>
            <div>Spending currencies</div>
            <div className="muted">Shown in the spending calendar totals</div>
          </div>
          <CurrencyMultiSelect selected={spendingCurrencies} onChange={setSpendingCurrencies} />
        </div>
      </div>

      <div className="section-title">
        <h2>Savings tracking</h2>
      </div>

      <div className="card settings-list">
        <div className="settings-row wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div>Savings tracking mode</div>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setModeInfoOpen((o) => !o)}
              aria-label="What do these modes mean?"
              type="button"
            >
              ⓘ
            </button>
          </div>
          {modeInfoOpen && (
            <div className="muted" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.82rem' }}>
              <p style={{ margin: 0 }}>
                <strong>Manual</strong> — spending is tracked separately and never changes your saving pocket
                balances.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Auto spending</strong> — choose a default saving pocket per currency below; every expense
                you log is automatically debited from that pocket (you can pick a different one per expense) and
                shows up in that pocket's Spending history.
              </p>
            </div>
          )}
          <select value={trackingMode} onChange={(e) => updateDraftMode(e.target.value as SavingsTrackingMode)}>
            <option value="manual">Manual</option>
            <option value="auto">Auto spending</option>
          </select>
        </div>

        {trackingMode === 'auto' && (
          <div className="settings-row wrap">
            <div>
              <div>Default saving pocket per currency</div>
              <div className="muted">Used when you log an expense — you can still override it per expense</div>
            </div>
            {spendingCurrencies.map((cur) => {
              const options = pockets.filter((p) => p.currency === cur)
              return (
                <div
                  key={cur}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}
                >
                  <span>{cur}</span>
                  {options.length === 0 ? (
                    <span className="muted">No pocket in {cur} yet</span>
                  ) : (
                    <select
                      value={defaultPockets[cur] ?? ''}
                      onChange={(e) => updateDraftPocket(cur, e.target.value ? Number(e.target.value) : undefined)}
                    >
                      <option value="">None selected</option>
                      {options.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.location} — {formatMoney(p.amount, p.currency)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="settings-row">
          {trackingChanged && <span className="muted">Unsaved changes</span>}
          <button
            className="btn btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={handleSaveTracking}
            disabled={!trackingChanged}
            type="button"
          >
            Save
          </button>
        </div>
      </div>

      <div className="section-title">
        <h2>Backup</h2>
      </div>

      <div className="card settings-list">
        <p className="muted">
          All data is stored locally in your browser. Export a backup regularly, especially before clearing browser
          data or switching devices.
        </p>
        <button className="btn btn-primary btn-block" onClick={handleExport} disabled={busy} type="button">
          Export backup (.json)
        </button>
        <button
          className="btn btn-block"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          type="button"
        >
          Import backup (.json)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImportFile(file)
            e.target.value = ''
          }}
        />
      </div>

      <p className="muted" style={{ textAlign: 'center' }}>
        Savings Pocket — your data never leaves this device.
      </p>
    </div>
  )
}

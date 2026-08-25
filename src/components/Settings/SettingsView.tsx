import { useRef, useState } from 'react'
import { DEFAULT_CRYPTO_CURRENCIES, DEFAULT_SAVINGS_CURRENCIES, DEFAULT_SPENDING_CURRENCIES } from '../../lib/constants'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { exportBackup, importBackup } from '../../lib/backup'
import { useToast } from '../../hooks/useToast'
import type { Currency } from '../../db/types'
import { CurrencyMultiSelect } from '../common/CurrencyMultiSelect'

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

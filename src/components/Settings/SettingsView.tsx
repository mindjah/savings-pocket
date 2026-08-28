import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { CURRENCIES, DEFAULT_CRYPTO_CURRENCIES, DEFAULT_SAVINGS_CURRENCIES, DEFAULT_SPENDING_CURRENCIES } from '../../lib/constants'
import { formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { exportBackup, importBackup } from '../../lib/backup'
import { backupToGoogleDrive, isGoogleDriveConfigured, restoreFromGoogleDrive } from '../../lib/googleDrive'
import { useToast } from '../../hooks/useToast'
import type { Currency, Language, SavingsTrackingMode } from '../../db/types'
import { CurrencyMultiSelect } from '../common/CurrencyMultiSelect'
import { CurrencySingleSelect } from '../common/CurrencySingleSelect'
import { disableFaceId, isFaceIdAvailable, registerFaceId } from '../../lib/webauthn'
import { clearPasscode } from '../../lib/passcode'
import { useTranslation } from '../../hooks/useTranslation'
import { tImportComplete, tNoPocketYet } from '../../i18n/translations'
import { PasscodeSetupModal } from './PasscodeSetupModal'

export function SettingsView() {
  const { t } = useTranslation()
  const [language, setLanguage] = useMetaSetting<Language>('language', 'en')

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
    toast(t('Savings tracking settings saved'))
  }

  const [modeInfoOpen, setModeInfoOpen] = useState(false)
  const pockets = useLiveQuery(() => db.savingsEntries.toArray(), []) ?? []

  const [faceIdEnabled] = useMetaSetting<boolean>('faceIdEnabled', false)
  const [faceIdAvailable, setFaceIdAvailable] = useState<boolean | null>(null)
  const [faceIdBusy, setFaceIdBusy] = useState(false)
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false)
  const passcodeRec = useLiveQuery(() => db.meta.get('faceIdPasscodeHash'), [])
  const passcodeSet = typeof passcodeRec?.value === 'string' && passcodeRec.value.length > 0

  useEffect(() => {
    isFaceIdAvailable().then(setFaceIdAvailable)
  }, [])

  async function handleToggleFaceId() {
    if (faceIdEnabled) {
      if (!confirm(t('Turn off Face ID lock?'))) return
      await disableFaceId()
      await clearPasscode()
      toast(t('Face ID disabled'))
      return
    }
    setFaceIdBusy(true)
    const ok = await registerFaceId()
    setFaceIdBusy(false)
    if (ok) toast(t('Face ID enabled'))
    else alert(t('Could not set up Face ID on this device.'))
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function handleExport() {
    setBusy(true)
    try {
      await exportBackup()
      toast(t('Backup exported'))
    } finally {
      setBusy(false)
    }
  }

  async function handleImportFile(file: File) {
    if (!confirm(t('Importing will replace ALL current data (savings, crypto, spending, categories) with the contents of this backup file. Continue?'))) {
      return
    }
    setBusy(true)
    try {
      const { imported } = await importBackup(file)
      const total = Object.values(imported).reduce((a, b) => a + b, 0)
      toast(tImportComplete(language, total))
    } catch (err) {
      alert(err instanceof Error ? err.message : t('Failed to import backup'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDriveBackup() {
    setBusy(true)
    try {
      await backupToGoogleDrive()
      toast(t('Backed up to Google Drive'))
    } catch (err) {
      alert(err instanceof Error ? err.message : t('Failed to back up to Google Drive'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDriveRestore() {
    if (!confirm(t('Restoring will replace ALL current data (savings, crypto, spending, categories) with your Google Drive backup. Continue?'))) {
      return
    }
    setBusy(true)
    try {
      const { imported } = await restoreFromGoogleDrive()
      const total = Object.values(imported).reduce((a, b) => a + b, 0)
      toast(tImportComplete(language, total))
    } catch (err) {
      alert(err instanceof Error ? err.message : t('Failed to restore from Google Drive'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view">
      <div className="section-title">
        <h2>{t('Language')}</h2>
      </div>

      <div className="card settings-list">
        <div className="settings-row">
          <div className="segmented" style={{ width: '100%' }}>
            <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
              English
            </button>
            <button type="button" className={language === 'ru' ? 'active' : ''} onClick={() => setLanguage('ru')}>
              Русский
            </button>
          </div>
        </div>
      </div>

      <div className="section-title">
        <h2>{t('Security')}</h2>
      </div>

      <div className="card settings-list">
        <div className="settings-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>{t('Face ID lock')}</div>
            <div className="muted">
              {faceIdAvailable === false ? t('Not available on this device or browser') : t('Require Face ID / Touch ID to open the app')}
            </div>
          </div>
          <label className="switch" style={{ flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={faceIdEnabled}
              onChange={handleToggleFaceId}
              disabled={faceIdAvailable === false || faceIdBusy}
              aria-label={t('Face ID lock')}
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>

        {faceIdEnabled && (
          <div className="settings-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>{t('Backup passcode')}</div>
              <div className="muted">{t('Used to unlock if Face ID ever fails')}</div>
            </div>
            <button
              className="btn"
              style={{ flexShrink: 0 }}
              onClick={() => setShowPasscodeSetup(true)}
              type="button"
            >
              {passcodeSet ? t('Change') : t('Set up')}
            </button>
          </div>
        )}
      </div>

      <div className="section-title">
        <h2>{t('Currencies')}</h2>
      </div>

      <div className="card settings-list">
        <div className="settings-row wrap">
          <div>
            <div>{t('Savings currencies')}</div>
            <div className="muted">{t('Shown as totals in Savings and Lent out — at least one required')}</div>
          </div>
          <CurrencyMultiSelect selected={savingsCurrencies} onChange={setSavingsCurrencies} />
        </div>

        <div className="settings-row wrap">
          <div>
            <div>{t('Total net worth')}</div>
            <div className="muted">{t('Currency used to display the combined savings + crypto + lent-out total')}</div>
          </div>
          <CurrencySingleSelect value={netWorthCurrency} options={netWorthOptions} onChange={setNetWorthCurrency} />
        </div>
      </div>

      <div className="card settings-list">
        <div className="settings-row wrap">
          <div>
            <div>{t('Crypto currencies')}</div>
            <div className="muted">{t('Fiat currencies shown for crypto holdings and totals')}</div>
          </div>
          <CurrencyMultiSelect selected={cryptoCurrencies} onChange={setCryptoCurrencies} />
        </div>
      </div>

      <div className="card settings-list">
        <div className="settings-row wrap">
          <div>
            <div>{t('Spending currencies')}</div>
            <div className="muted">{t('Shown in the spending calendar totals')}</div>
          </div>
          <CurrencyMultiSelect selected={spendingCurrencies} onChange={setSpendingCurrencies} />
        </div>
      </div>

      <div className="section-title">
        <h2>{t('Savings tracking')}</h2>
      </div>

      <div className="card settings-list">
        <div className="settings-row wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div>{t('Savings tracking mode')}</div>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setModeInfoOpen((o) => !o)}
              aria-label={t('What do these modes mean?')}
              type="button"
            >
              ⓘ
            </button>
          </div>
          {modeInfoOpen && (
            <div className="muted" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.82rem' }}>
              <p style={{ margin: 0 }}>
                <strong>{t('Manual')}</strong>
                {t(' — spending is tracked separately and never changes your saving pocket balances.')}
              </p>
              <p style={{ margin: 0 }}>
                <strong>{t('Auto spending')}</strong>
                {t(
                  " — choose a default saving pocket per currency below; every expense you log is automatically debited from that pocket (you can pick a different one per expense) and shows up in that pocket's Spending history.",
                )}
              </p>
            </div>
          )}
          <select value={trackingMode} onChange={(e) => updateDraftMode(e.target.value as SavingsTrackingMode)}>
            <option value="manual">{t('Manual')}</option>
            <option value="auto">{t('Auto spending')}</option>
          </select>
        </div>

        {trackingMode === 'auto' && (
          <div className="settings-row wrap">
            <div>
              <div>{t('Default saving pocket per currency')}</div>
              <div className="muted">{t('Used when you log an expense — you can still override it per expense')}</div>
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
                    <span className="muted">{tNoPocketYet(language, cur)}</span>
                  ) : (
                    <select
                      value={defaultPockets[cur] ?? ''}
                      onChange={(e) => updateDraftPocket(cur, e.target.value ? Number(e.target.value) : undefined)}
                    >
                      <option value="">{t('None selected')}</option>
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
          {trackingChanged && <span className="muted">{t('Unsaved changes')}</span>}
          <button
            className="btn btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={handleSaveTracking}
            disabled={!trackingChanged}
            type="button"
          >
            {t('Save')}
          </button>
        </div>
      </div>

      <div className="section-title">
        <h2>{t('Backup')}</h2>
      </div>

      <div className="card settings-list">
        <p className="muted">
          {t(
            'All data is stored locally in your browser. Export a backup regularly, especially before clearing browser data or switching devices.',
          )}
        </p>
        <button className="btn btn-primary btn-block" onClick={handleExport} disabled={busy} type="button">
          {t('Export backup (.json)')}
        </button>
        <button
          className="btn btn-block"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          type="button"
        >
          {t('Import backup (.json)')}
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

      <div className="card settings-list">
        <p className="muted">
          {isGoogleDriveConfigured()
            ? t('Sign in with Google to back up or restore from your own Google Drive — no file to save yourself.')
            : t('Google Drive backup is not set up for this deployment.')}
        </p>
        {isGoogleDriveConfigured() && (
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            {t("If sign-in doesn't work, ask the app's owner to add your Google account as a test user.")}
          </p>
        )}
        <button
          className="btn btn-primary btn-block"
          onClick={handleDriveBackup}
          disabled={busy || !isGoogleDriveConfigured()}
          type="button"
        >
          {t('Backup to Google Drive')}
        </button>
        <button
          className="btn btn-block"
          onClick={handleDriveRestore}
          disabled={busy || !isGoogleDriveConfigured()}
          type="button"
        >
          {t('Restore from Google Drive')}
        </button>
      </div>

      <p className="muted" style={{ textAlign: 'center' }}>
        {t('Savings Pocket — your data never leaves this device.')}
      </p>

      {showPasscodeSetup && (
        <PasscodeSetupModal
          onClose={() => setShowPasscodeSetup(false)}
          onSaved={() => setShowPasscodeSetup(false)}
        />
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { CURRENCIES, DEFAULT_CRYPTO_CURRENCIES, DEFAULT_SAVINGS_CURRENCIES, DEFAULT_SPENDING_CURRENCIES } from '../../lib/constants'
import { formatDateTime, formatMoney } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { exportBackup, hasEverConnectedToDrive, importBackup } from '../../lib/backup'
import {
  DriveBackupCancelled,
  isGoogleDriveConfigured,
  listGoogleDriveBackupHistory,
  restoreGoogleDriveBackupHistoryEntry,
  type DriveBackupHistoryEntry,
} from '../../lib/googleDrive'
import { useToast } from '../../hooks/useToast'
import type { Currency, Language, SavingsTrackingMode } from '../../db/types'
import { CurrencyMultiSelect } from '../common/CurrencyMultiSelect'
import { CurrencySingleSelect } from '../common/CurrencySingleSelect'
import { disableFaceId, isFaceIdAvailable, registerFaceId } from '../../lib/webauthn'
import { clearPasscode } from '../../lib/passcode'
import { useTranslation } from '../../hooks/useTranslation'
import { tImportComplete, tNoPocketYet, tRestoreBackupHistoryEntry } from '../../i18n/translations'
import { PasscodeSetupModal } from './PasscodeSetupModal'
import { GoogleIdentityCard } from '../common/GoogleIdentityCard'
import { GoogleDriveCard } from '../common/GoogleDriveCard'

interface Props {
  resetKey: number
}

export function SettingsView({ resetKey }: Props) {
  const { t, lang } = useTranslation()
  const [language, setLanguage] = useMetaSetting<Language>('language', 'en')
  const [themePreference, setThemePreference] = useMetaSetting<'system' | 'light' | 'dark'>('themePreference', 'system')

  const [savingsCurrencies, setSavingsCurrencies] = useMetaSetting<Currency[]>(
    'enabledSavingsCurrencies',
    DEFAULT_SAVINGS_CURRENCIES,
  )
  // Crypto shows just one converted total (no per-currency breakdown, unlike
  // every other currency picker here) — a single choice, not a multi-select.
  const [cryptoDisplayCurrency, setCryptoDisplayCurrency] = useMetaSetting<Currency>('cryptoDisplayCurrency', 'EUR')
  // Independent from every other currency picker here — offers every app
  // currency, same as Savings/Spending's own multi-selects.
  const [assetCurrencies, setAssetCurrencies] = useMetaSetting<Currency[]>('enabledAssetCurrencies', DEFAULT_CRYPTO_CURRENCIES)
  const [spendingCurrencies, setSpendingCurrencies] = useMetaSetting<Currency[]>(
    'enabledSpendingCurrencies',
    DEFAULT_SPENDING_CURRENCIES,
  )
  const [netWorthCurrency, setNetWorthCurrency] = useMetaSetting<Currency>('netWorthCurrency', 'EUR')
  const netWorthOptions = useMemo(
    () =>
      CURRENCIES.filter(
        (c) => savingsCurrencies.includes(c.code) || c.code === cryptoDisplayCurrency || assetCurrencies.includes(c.code),
      ).map((c) => c.code),
    [savingsCurrencies, cryptoDisplayCurrency, assetCurrencies],
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
  const [includeCreditsInNetWorth, setIncludeCreditsInNetWorth] = useMetaSetting<boolean>('includeCreditsInNetWorth', false)
  const allPockets = useLiveQuery(() => db.savingsEntries.toArray(), []) ?? []
  // Only spending-purpose pockets can be picked as an auto-debit payment
  // source — credits can't be, and neither can a savings pocket (auto mode's
  // whole point is finding the recurring-expense target at a glance; a
  // savings pocket ending up "the default" for a currency also broke My
  // Pockets' own amount sort for every other savings pocket there — see
  // SavingsView's sortPockets).
  const pockets = allPockets.filter((p) => p.kind !== 'credit' && (p.purpose ?? 'savings') === 'spending')

  const [faceIdEnabled] = useMetaSetting<boolean>('faceIdEnabled', false)
  const [faceIdAvailable, setFaceIdAvailable] = useState<boolean | null>(null)
  const [faceIdBusy, setFaceIdBusy] = useState(false)
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false)
  const passcodeRec = useLiveQuery(() => db.meta.get('faceIdPasscodeHash'), [])
  const passcodeSet = typeof passcodeRec?.value === 'string' && passcodeRec.value.length > 0
  const [blurBalances, setBlurBalances] = useMetaSetting<boolean>('blurBalances', false)

  // resetKey bumps when the user re-taps the already-active Settings nav tab —
  // close any open popup/hint, skipping the very first render (that's not a re-tap).
  const isFirstResetRef = useRef(true)
  useEffect(() => {
    if (isFirstResetRef.current) {
      isFirstResetRef.current = false
      return
    }
    setModeInfoOpen(false)
    setShowPasscodeSetup(false)
  }, [resetKey])

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
    if (!confirm(t('Importing will replace ALL current data (savings, invest, spending, categories) with the contents of this backup file. Continue?'))) {
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

  const driveEverConnected = useLiveQuery(() => hasEverConnectedToDrive(), []) ?? false

  const [backupHistory, setBackupHistory] = useState<DriveBackupHistoryEntry[] | null>(null)
  const [historyBusy, setHistoryBusy] = useState(false)

  async function handleLoadBackupHistory() {
    setHistoryBusy(true)
    try {
      const entries = await listGoogleDriveBackupHistory()
      setBackupHistory(entries)
    } catch (err) {
      alert(err instanceof Error ? err.message : t('Failed to load backup history'))
    } finally {
      setHistoryBusy(false)
    }
  }

  async function handleRestoreBackupHistoryEntry(entry: DriveBackupHistoryEntry) {
    setBusy(true)
    try {
      const { imported } = await restoreGoogleDriveBackupHistoryEntry(entry.id, () =>
        confirm(tRestoreBackupHistoryEntry(lang, formatDateTime(entry.createdAt, lang))),
      )
      const total = Object.values(imported).reduce((a, b) => a + b, 0)
      toast(tImportComplete(language, total))
    } catch (err) {
      if (err instanceof DriveBackupCancelled) return
      alert(err instanceof Error ? err.message : t('Failed to restore this backup'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view boucoup-scope">
      <GoogleIdentityCard />

      <div className="section-title">
        <h2>{t('General')}</h2>
      </div>

      <div className="card settings-list">
        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div>{t('Language')}</div>
          <div className="segmented" style={{ width: '100%' }}>
            <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
              English
            </button>
            <button type="button" className={language === 'ru' ? 'active' : ''} onClick={() => setLanguage('ru')}>
              Русский
            </button>
          </div>
        </div>
        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div>{t('Theme')}</div>
          <div className="segmented" style={{ width: '100%' }}>
            <button type="button" className={themePreference === 'system' ? 'active' : ''} onClick={() => setThemePreference('system')}>
              {t('System')}
            </button>
            <button type="button" className={themePreference === 'light' ? 'active' : ''} onClick={() => setThemePreference('light')}>
              {t('Light')}
            </button>
            <button type="button" className={themePreference === 'dark' ? 'active' : ''} onClick={() => setThemePreference('dark')}>
              {t('Dark')}
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

        <div className="settings-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>{t('Blur balances')}</div>
            <div className="muted">{t('Hide amounts on the Savings screen until you tap the eye icon')}</div>
          </div>
          <label className="switch" style={{ flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={blurBalances}
              onChange={(e) => setBlurBalances(e.target.checked)}
              aria-label={t('Blur balances')}
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>
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
            <div className="muted">{t('Currency used to display the combined savings + invest + lent-out total')}</div>
          </div>
          <CurrencySingleSelect value={netWorthCurrency} options={netWorthOptions} onChange={setNetWorthCurrency} />
        </div>

        <div className="settings-row wrap">
          <div>
            <div>{t('Crypto currency')}</div>
            <div className="muted">{t('Fiat currency crypto holdings and totals are converted to')}</div>
          </div>
          <CurrencySingleSelect
            value={cryptoDisplayCurrency}
            options={CURRENCIES.map((c) => c.code)}
            onChange={setCryptoDisplayCurrency}
          />
        </div>

        <div className="settings-row wrap">
          <div>
            <div>{t('Assets currencies')}</div>
            <div className="muted">{t('Currencies shown for asset totals')}</div>
          </div>
          <CurrencyMultiSelect selected={assetCurrencies} onChange={setAssetCurrencies} />
        </div>

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
        <div className="settings-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>{t('Include credits in net worth')}</div>
            <div className="muted">{t('Credits are excluded from Total net worth by default')}</div>
          </div>
          <label className="switch" style={{ flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={includeCreditsInNetWorth}
              onChange={(e) => setIncludeCreditsInNetWorth(e.target.checked)}
              aria-label={t('Include credits in net worth')}
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>
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
        <div style={{ fontWeight: 700 }}>{t('Manual')}</div>
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

      <GoogleDriveCard />

      {driveEverConnected && (
        <div className="card settings-list">
          <div style={{ fontWeight: 700 }}>{t('Backup history')}</div>
          <p className="muted">
            {t('Every backup also keeps a dated snapshot, in case you need to go back further than the latest one.')}
          </p>
          <button
            className="btn btn-block"
            onClick={handleLoadBackupHistory}
            disabled={historyBusy || !isGoogleDriveConfigured()}
            type="button"
          >
            {historyBusy ? t('Loading…') : t('Load backup history')}
          </button>
          {backupHistory && backupHistory.length === 0 && (
            <p className="muted">{t('No dated backups yet — the next backup will start one.')}</p>
          )}
          {backupHistory && backupHistory.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {backupHistory.map((entry) => (
                <div key={entry.id} className="settings-row">
                  <span className="muted" style={{ flex: 1, minWidth: 0 }}>
                    {formatDateTime(entry.createdAt, lang)}
                  </span>
                  <button
                    className="btn btn-ghost"
                    style={{ flexShrink: 0 }}
                    onClick={() => handleRestoreBackupHistoryEntry(entry)}
                    disabled={busy}
                    type="button"
                  >
                    {t('Restore')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showPasscodeSetup && (
        <PasscodeSetupModal
          onClose={() => setShowPasscodeSetup(false)}
          onSaved={() => setShowPasscodeSetup(false)}
        />
      )}
    </div>
  )
}

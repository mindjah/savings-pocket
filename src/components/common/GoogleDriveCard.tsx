import { useState } from 'react'
import { backupToGoogleDrive, DriveBackupCancelled, isGoogleDriveConfigured, restoreFromGoogleDrive } from '../../lib/googleDrive'
import { formatDateTime } from '../../lib/format'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { tDriveBackupConflict, tImportComplete } from '../../i18n/translations'
import { GoogleDriveIcon } from './GoogleDriveIcon'

// The backup/restore/auto-backup card — shared between Settings (rendered
// inline, in its Backup section) and the Dashboard's own account popup
// (see GoogleAccountModal), which shows this directly below
// GoogleIdentityCard.
export function GoogleDriveCard() {
  const { t, lang } = useTranslation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [driveInfoOpen, setDriveInfoOpen] = useState(false)
  const [autoBackupEnabled, setAutoBackupEnabled] = useMetaSetting<boolean>('autoBackupToGoogleDrive', false)

  async function handleDriveBackup() {
    setBusy(true)
    try {
      await backupToGoogleDrive((remoteModifiedAt) => confirm(tDriveBackupConflict(lang, formatDateTime(remoteModifiedAt, lang))))
      toast(t('Backed up to Google Drive'))
    } catch (err) {
      if (err instanceof DriveBackupCancelled) return
      alert(err instanceof Error ? err.message : t('Failed to back up to Google Drive'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDriveRestore() {
    setBusy(true)
    try {
      const { imported } = await restoreFromGoogleDrive((hasLocalChanges) => {
        const confirmMessage = hasLocalChanges
          ? t("You have local changes that haven't been backed up to Google Drive yet — restoring now will replace them with your Google Drive backup and they'll be permanently lost. Continue?")
          : t('Restoring will replace ALL current data (savings, invest, spending, categories) with your Google Drive backup. Continue?')
        return confirm(confirmMessage)
      })
      const total = Object.values(imported).reduce((a, b) => a + b, 0)
      toast(tImportComplete(lang, total))
    } catch (err) {
      if (err instanceof DriveBackupCancelled) return
      alert(err instanceof Error ? err.message : t('Failed to restore from Google Drive'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card settings-list">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
          <GoogleDriveIcon size={20} />
          Google Drive
        </div>
        {isGoogleDriveConfigured() && (
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setDriveInfoOpen((o) => !o)}
            aria-label={t("If sign-in doesn't work, ask the app's owner to add your Google account as a test user.")}
            type="button"
          >
            ⓘ
          </button>
        )}
      </div>
      {driveInfoOpen && (
        <p className="muted" style={{ fontSize: '0.8rem' }}>
          {t("If sign-in doesn't work, ask the app's owner to add your Google account as a test user.")}
        </p>
      )}
      <p className="muted">
        {isGoogleDriveConfigured()
          ? t('Sign in with Google to back up or restore from your own Google Drive — no file to save yourself.')
          : t('Google Drive backup is not set up for this deployment.')}
      </p>
      <button
        className="btn btn-primary btn-block"
        onClick={handleDriveBackup}
        disabled={busy || !isGoogleDriveConfigured()}
        type="button"
      >
        {t('Backup to Google Drive')}
      </button>
      <button className="btn btn-block" onClick={handleDriveRestore} disabled={busy || !isGoogleDriveConfigured()} type="button">
        {t('Restore from Google Drive')}
      </button>

      {isGoogleDriveConfigured() && (
        <div className="settings-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>{t('Auto-backup to Google Drive')}</div>
            <div className="muted">
              {t('Silently back up to Google Drive a few seconds after each change, using your last sign-in. Only works while the app is open.')}
            </div>
          </div>
          <label className="switch" style={{ flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              aria-label={t('Auto-backup to Google Drive')}
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useToast } from './useToast'
import { useTranslation } from './useTranslation'
import { checkDriveForNewerBackup, restoreFromGoogleDrive } from '../lib/googleDrive'
import { hasUnsyncedLocalChanges } from '../lib/backup'
import { formatDateTime } from '../lib/format'
import { tImportComplete, tStartupDriveOffer } from '../i18n/translations'

// Runs once per app open (only once unlocked, if Face ID is on) and offers
// to import a newer Google Drive backup before the user starts editing —
// see checkDriveForNewerBackup for why this only fires for devices that
// have signed in to Drive before.
export function useDriveStartupCheck(enabled: boolean) {
  const { t, lang } = useTranslation()
  const toast = useToast()
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (!enabled || hasRunRef.current) return
    // Guards against StrictMode's dev-only double-invoke (mount, cleanup,
    // mount again on the same instance) — not a real second app open, so no
    // cleanup/cancellation here: the ref alone makes this fire at most once.
    hasRunRef.current = true
    ;(async () => {
      const result = await checkDriveForNewerBackup()
      if (!result) return
      const hasLocalChanges = await hasUnsyncedLocalChanges()
      const message = tStartupDriveOffer(lang, formatDateTime(result.remoteModifiedAt, lang), hasLocalChanges)
      if (!confirm(message)) return
      try {
        const { imported } = await restoreFromGoogleDrive()
        const total = Object.values(imported).reduce((a, b) => a + b, 0)
        toast(tImportComplete(lang, total))
      } catch (err) {
        alert(err instanceof Error ? err.message : t('Failed to restore from Google Drive'))
      }
    })()
  }, [enabled, lang, t, toast])
}

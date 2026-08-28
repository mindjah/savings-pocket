import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BACKUP_TABLES, db } from '../db/db'
import { useMetaSetting } from './useMetaSetting'
import { useTranslation } from './useTranslation'
import { attemptSilentAutoBackup, isGoogleDriveConfigured } from '../lib/googleDrive'
import { tAutoBackupConflict } from '../i18n/translations'
import { formatDateTime } from '../lib/format'

const DEBOUNCE_MS = 4000
const WATCHED_TABLES = BACKUP_TABLES.filter((table) => table !== 'meta')

// Watches every backed-up table and, a few seconds after the last edit,
// silently pushes a backup to Google Drive — but only if a token from an
// earlier explicit sign-in is still cached (see attemptSilentAutoBackup),
// so this never pops up Google's sign-in UI unattended.
export function useAutoBackup() {
  const { lang } = useTranslation()
  const [enabled] = useMetaSetting<boolean>('autoBackupToGoogleDrive', false)
  const configured = isGoogleDriveConfigured()

  // Reading every row (not just counts) so Dexie's liveQuery reactivity picks
  // up in-place edits too, not just row additions/removals — same pattern
  // already used throughout the app (e.g. SavingsView's pockets query).
  const snapshot = useLiveQuery(
    () => (enabled && configured ? Promise.all(WATCHED_TABLES.map((table) => db.table(table).toArray())) : null),
    [enabled, configured],
  )

  const isFirstRun = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notifiedConflictRef = useRef(false)

  useEffect(() => {
    if (!enabled || !configured || snapshot == null) return
    // Skip the initial load — only react to edits made after this mounted.
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      attemptSilentAutoBackup((remoteModifiedAt) => {
        if (!notifiedConflictRef.current) {
          notifiedConflictRef.current = true
          alert(tAutoBackupConflict(lang, formatDateTime(remoteModifiedAt, lang)))
        }
        return false
      }).then((result) => {
        if (result === 'ok') notifiedConflictRef.current = false
      })
    }, DEBOUNCE_MS)
    // snapshot's identity changes only when Dexie detects a relevant write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, enabled, configured, lang])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )
}

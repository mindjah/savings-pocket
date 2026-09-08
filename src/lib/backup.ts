import { BACKUP_TABLES, db } from '../db/db'

export type BackupMethod = 'manual' | 'google'

export interface LastBackup {
  at: string
  method: BackupMethod
}

export interface BackupFile {
  app: 'savings-pocket'
  version: 1
  exportedAt: string
  data: Record<string, unknown[]>
}

// This device's own WebAuthn credential/passcode — meaningless (and
// dangerous) on any other device: restoring faceIdEnabled: true onto a
// device with no matching credential and no passcode would lock the app
// with no way back in. Left out of the backup file entirely; a restore also
// strips them from whatever it's importing (an older backup made before
// this existed might still have them) and preserves this device's own
// current values instead of letting the generic clear-then-bulkPut wipe them.
const DEVICE_ONLY_META_KEYS = new Set(['faceIdEnabled', 'faceIdCredentialId', 'faceIdPasscodeHash'])

// Each device keeps its own dashboard card order (desktop's grid vs
// mobile's stack are reordered independently — see DashboardView). Unlike
// Face ID these ARE meant to travel with a backup (restoring on the same
// kind of device, or the device that made the backup, should bring the
// arrangement back) — but a backup made on a device that's only ever used
// ONE of the two layouts simply has no row at all for the other one, and
// the generic clear-then-bulkPut would otherwise wipe the target device's
// own value for it down to nothing (see applyBackupPayload). Preserved only
// when the incoming backup doesn't mention a given key; a backup that does
// have it still overwrites, same as everything else.
const PRESERVE_IF_ABSENT_META_KEYS = new Set(['dashboardCardOrder', 'dashboardCardOrderMobile'])

export async function buildBackupPayload(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {}
  for (const table of BACKUP_TABLES) {
    const rows = await db.table(table).toArray()
    data[table] = table === 'meta' ? rows.filter((row) => !DEVICE_ONLY_META_KEYS.has((row as { key: string }).key)) : rows
  }
  return {
    app: 'savings-pocket',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function parseBackupFile(text: string): BackupFile {
  const parsed = JSON.parse(text) as BackupFile
  if (parsed.app !== 'savings-pocket' || !parsed.data) {
    throw new Error('This file is not a Savings Pocket backup.')
  }
  return parsed
}

export async function applyBackupPayload(parsed: BackupFile): Promise<{ imported: Record<string, number> }> {
  const imported: Record<string, number> = {}
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    const existingMetaRows = BACKUP_TABLES.includes('meta') ? await db.meta.toArray() : []
    const preservedMetaRows = existingMetaRows.filter((row) => DEVICE_ONLY_META_KEYS.has(row.key))
    for (const table of BACKUP_TABLES) {
      const rows = parsed.data[table]
      if (!Array.isArray(rows)) continue
      let rowsToImport = table === 'meta' ? rows.filter((row) => !DEVICE_ONLY_META_KEYS.has((row as { key: string }).key)) : rows
      if (table === 'meta') {
        const incomingKeys = new Set(rowsToImport.map((row) => (row as { key: string }).key))
        const keptExisting = existingMetaRows.filter(
          (row) => PRESERVE_IF_ABSENT_META_KEYS.has(row.key) && !incomingKeys.has(row.key),
        )
        rowsToImport = [...rowsToImport, ...keptExisting]
      }
      await db.table(table).clear()
      if (rowsToImport.length) await db.table(table).bulkPut(rowsToImport)
      imported[table] = rowsToImport.length
    }
    if (preservedMetaRows.length) await db.meta.bulkPut(preservedMetaRows)
  })
  return { imported }
}

// Tracked so Settings can show "last backup" status — updated by any
// successful backup action (local export or Google Drive), never by restore.
export async function recordBackup(method: BackupMethod): Promise<void> {
  const value: LastBackup = { at: new Date().toISOString(), method }
  await db.meta.put({ key: 'lastBackup', value })
}

export interface DriveSyncState {
  at: string
}

// Separate from lastBackup: this marks the point this device's local data is
// known to match Google Drive, set after EITHER a backup or a restore, and is
// what conflict checks compare against (multi-device backup/restore is a full
// overwrite, not a merge — see backupToGoogleDrive/hasUnsyncedLocalChanges).
export async function recordDriveSync(at: string): Promise<void> {
  await db.meta.put({ key: 'driveSyncState', value: { at } satisfies DriveSyncState })
}

export async function getDriveSyncState(): Promise<DriveSyncState | null> {
  const row = await db.meta.get('driveSyncState')
  return (row?.value as DriveSyncState | undefined) ?? null
}

function rowTimestamp(row: unknown): number {
  const r = row as { updatedAt?: string; createdAt?: string; date?: string }
  const t = r.updatedAt ?? r.createdAt ?? r.date
  return t ? new Date(t).getTime() : 0
}

// Tracked so the app-open Drive check only ever runs for someone who has
// signed in before — never triggers a surprise Google sign-in for a feature
// they've never touched.
export async function recordDriveConnected(): Promise<void> {
  await db.meta.put({ key: 'driveEverConnected', value: true })
}

export async function hasEverConnectedToDrive(): Promise<boolean> {
  const row = await db.meta.get('driveEverConnected')
  return row?.value === true
}

// Warns before a Drive restore silently discards edits this device made
// since it last backed up to or restored from Drive.
export async function hasUnsyncedLocalChanges(): Promise<boolean> {
  const syncState = await getDriveSyncState()
  const syncedAt = syncState ? new Date(syncState.at).getTime() : 0
  for (const table of BACKUP_TABLES) {
    if (table === 'meta') continue
    const rows = await db.table(table).toArray()
    if (rows.some((row) => rowTimestamp(row) > syncedAt)) return true
  }
  return false
}

export async function exportBackup(): Promise<void> {
  const payload = await buildBackupPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = payload.exportedAt.slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = `savings-pocket-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  await recordBackup('manual')
}

export async function importBackup(file: File): Promise<{ imported: Record<string, number> }> {
  const text = await file.text()
  const parsed = parseBackupFile(text)
  return applyBackupPayload(parsed)
}

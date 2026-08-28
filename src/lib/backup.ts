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

export async function buildBackupPayload(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {}
  for (const table of BACKUP_TABLES) {
    data[table] = await db.table(table).toArray()
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
    for (const table of BACKUP_TABLES) {
      const rows = parsed.data[table]
      if (!Array.isArray(rows)) continue
      await db.table(table).clear()
      if (rows.length) await db.table(table).bulkPut(rows)
      imported[table] = rows.length
    }
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

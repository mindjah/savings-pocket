import { BACKUP_TABLES, db } from '../db/db'

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
export async function recordBackup(): Promise<void> {
  await db.meta.put({ key: 'lastBackupAt', value: new Date().toISOString() })
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
  await recordBackup()
}

export async function importBackup(file: File): Promise<{ imported: Record<string, number> }> {
  const text = await file.text()
  const parsed = parseBackupFile(text)
  return applyBackupPayload(parsed)
}

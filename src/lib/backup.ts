import { BACKUP_TABLES, db } from '../db/db'

interface BackupFile {
  app: 'savings-pocket'
  version: 1
  exportedAt: string
  data: Record<string, unknown[]>
}

export async function exportBackup(): Promise<void> {
  const data: Record<string, unknown[]> = {}
  for (const table of BACKUP_TABLES) {
    data[table] = await db.table(table).toArray()
  }
  const payload: BackupFile = {
    app: 'savings-pocket',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
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
}

export async function importBackup(file: File): Promise<{ imported: Record<string, number> }> {
  const text = await file.text()
  const parsed = JSON.parse(text) as BackupFile
  if (parsed.app !== 'savings-pocket' || !parsed.data) {
    throw new Error('This file is not a Savings Pocket backup.')
  }

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

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { formatDateOrTime } from '../../lib/format'
import type { LastBackup } from '../../lib/backup'
import { useTranslation } from '../../hooks/useTranslation'
import { CloudSyncIcon } from './CloudSyncIcon'
import { ManualSyncIcon } from './ManualSyncIcon'

const BACKUP_FRESH_DAYS = 7

// Last-backup status — shown in Settings' own mobile header (via
// HeaderPortal) and, on desktop, at the bottom of the sidebar (see NavBar)
// instead of above Settings' content, since the sidebar is visible from
// every screen, not just Settings.
export function SyncStatusBadge() {
  const { t, lang } = useTranslation()
  const lastBackupRec = useLiveQuery(() => db.meta.get('lastBackup'), [])
  const lastBackup = lastBackupRec?.value as LastBackup | undefined
  const daysSinceBackup = lastBackup ? (Date.now() - new Date(lastBackup.at).getTime()) / 86400000 : null
  const color = daysSinceBackup == null ? 'var(--danger-strong)' : daysSinceBackup < BACKUP_FRESH_DAYS ? 'var(--accent)' : 'var(--warning)'
  const text = lastBackup == null ? t('Never backed up') : `${t('Last backup')} ${formatDateOrTime(lastBackup.at, lang)}`

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color, fontSize: '0.8rem', fontWeight: 600 }}>
      <span>{text}</span>
      {lastBackup?.method === 'manual' ? <ManualSyncIcon size={24} /> : <CloudSyncIcon size={24} />}
    </span>
  )
}

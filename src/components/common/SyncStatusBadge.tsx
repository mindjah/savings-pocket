import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { formatDateOrTime } from '../../lib/format'
import type { LastBackup } from '../../lib/backup'
import { useTranslation } from '../../hooks/useTranslation'
import { CloudSyncIcon } from './CloudSyncIcon'
import { ManualSyncIcon } from './ManualSyncIcon'

const BACKUP_FRESH_DAYS = 7

// Last-backup status — mobile shows this in the Dashboard's own header (see
// DashboardView, replacing its title), desktop at the bottom of the
// sidebar (see NavBar) instead, since the sidebar is visible from every
// screen. Icon kept small (16px, not the 24px used where this stands
// alone) so it never forces a single-line header row taller than any
// other screen's own plain text title.
export function SyncStatusBadge() {
  const { t, lang } = useTranslation()
  const lastBackupRec = useLiveQuery(() => db.meta.get('lastBackup'), [])
  const lastBackup = lastBackupRec?.value as LastBackup | undefined
  const daysSinceBackup = lastBackup ? (Date.now() - new Date(lastBackup.at).getTime()) / 86400000 : null
  const color = daysSinceBackup == null ? 'var(--danger-strong)' : daysSinceBackup < BACKUP_FRESH_DAYS ? 'var(--accent)' : 'var(--warning)'
  const text = lastBackup == null ? t('Never backed up') : `${t('Last backup')} ${formatDateOrTime(lastBackup.at, lang)}`

  return (
    <span style={{ display: 'inline-flex', verticalAlign: 'top', alignItems: 'center', gap: 6, color, fontSize: '0.8rem', fontWeight: 600 }}>
      <span>{text}</span>
      {lastBackup?.method === 'manual' ? <ManualSyncIcon size={16} /> : <CloudSyncIcon size={16} />}
    </span>
  )
}

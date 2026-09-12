import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { formatDateOrTime } from '../../lib/format'
import type { LastBackup } from '../../lib/backup'
import { useTranslation } from '../../hooks/useTranslation'
import { CloudSyncIcon } from './CloudSyncIcon'
import { ManualSyncIcon } from './ManualSyncIcon'

const BACKUP_FRESH_DAYS = 7

interface Props {
  // 'sidebar' (default): desktop's own usage at the bottom of NavBar's
  // sidebar — text then icon, full "Last backup ..."/"Never backed up"
  // wording, a fixed narrow column already so no wrap handling needed.
  // 'header': mobile Dashboard's own header (see DashboardView) — icon and
  // text sized to match the header's own Exchange rates button (18px icon,
  // 0.9rem text, 6px gap) since they sit side by side there. Bare date/time
  // (or "Never"), no label wording — there's less room here than Settings'
  // own card, next to the account avatar.
  // 'compact': Settings' signed-in-as card — icon then the same bare
  // date/time (or "Never") 'header' shows, at the card's own (larger) size.
  variant?: 'sidebar' | 'header' | 'compact'
}

// Last-backup status — mobile shows this in the Dashboard's own header,
// desktop at the bottom of the sidebar (see NavBar) instead, since the
// sidebar is visible from every screen. Settings' signed-in-as card shows
// its own 'compact' copy too.
export function SyncStatusBadge({ variant = 'sidebar' }: Props) {
  const { t, lang } = useTranslation()
  const lastBackupRec = useLiveQuery(() => db.meta.get('lastBackup'), [])
  const lastBackup = lastBackupRec?.value as LastBackup | undefined
  const daysSinceBackup = lastBackup ? (Date.now() - new Date(lastBackup.at).getTime()) / 86400000 : null
  const color = daysSinceBackup == null ? 'var(--danger-strong)' : daysSinceBackup < BACKUP_FRESH_DAYS ? 'var(--accent)' : 'var(--warning)'
  const bare = variant === 'header' || variant === 'compact'
  const text = bare
    ? lastBackup == null
      ? t('Never')
      : formatDateOrTime(lastBackup.at, lang)
    : lastBackup == null
      ? t('Never backed up')
      : `${t('Last backup')} ${formatDateOrTime(lastBackup.at, lang)}`
  const iconSize = variant === 'header' ? 18 : 24
  const icon = lastBackup?.method === 'manual' ? <ManualSyncIcon size={iconSize} /> : <CloudSyncIcon size={iconSize} />

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color,
        fontSize: variant === 'header' ? '0.9rem' : '0.8rem',
        fontWeight: 600,
      }}
    >
      {bare ? (
        <>
          {icon}
          <span>{text}</span>
        </>
      ) : (
        <>
          <span>{text}</span>
          {icon}
        </>
      )}
    </span>
  )
}

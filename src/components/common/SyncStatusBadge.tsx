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
  // 'header': mobile Dashboard's own header (see DashboardView) — icon
  // above a bare date/time (or "Never"), no label wording, tightly spaced,
  // since this sits right next to the account avatar in a limited header.
  // 'compact': Settings' signed-in-as card — icon then the same full
  // wording 'sidebar' uses, just left-to-right instead of right-aligned.
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
  const text =
    variant === 'header'
      ? lastBackup == null
        ? t('Never')
        : formatDateOrTime(lastBackup.at, lang)
      : lastBackup == null
        ? t('Never backed up')
        : `${t('Last backup')} ${formatDateOrTime(lastBackup.at, lang)}`
  const iconSize = variant === 'header' ? 32 : 24
  const icon = lastBackup?.method === 'manual' ? <ManualSyncIcon size={iconSize} /> : <CloudSyncIcon size={iconSize} />

  if (variant === 'header') {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, color, fontSize: '0.75rem', fontWeight: 600 }}>
        {icon}
        <span>{text}</span>
      </span>
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color, fontSize: '0.8rem', fontWeight: 600 }}>
      {variant === 'compact' ? (
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

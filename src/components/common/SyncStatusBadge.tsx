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
  // sidebar — a fixed narrow column already, so no wrap handling needed.
  // 'header': mobile Dashboard's usage, replacing the header's title (see
  // DashboardView) — same properties Settings' own mobile header used
  // before this moved here (24px icon, wraps once it reaches roughly the
  // screen's own center, same as a long Russian date-string would have),
  // just left-aligned (was right-docked in Settings; this sits in the
  // header's left corner instead) instead of right-aligned. Also needs its
  // own line-height: the real <h1> it's portaled into is styled for a much
  // bigger single-line title (theme.css's .app-header h1 sets a 36px line
  // box for 24px heading text) — without an override, this badge's own
  // far-smaller text inherits that same 36px band per line, which is what
  // was inflating the header's height and the gap between wrapped lines.
  variant?: 'sidebar' | 'header'
}

// Last-backup status — mobile shows this in the Dashboard's own header,
// desktop at the bottom of the sidebar (see NavBar) instead, since the
// sidebar is visible from every screen.
export function SyncStatusBadge({ variant = 'sidebar' }: Props) {
  const { t, lang } = useTranslation()
  const lastBackupRec = useLiveQuery(() => db.meta.get('lastBackup'), [])
  const lastBackup = lastBackupRec?.value as LastBackup | undefined
  const daysSinceBackup = lastBackup ? (Date.now() - new Date(lastBackup.at).getTime()) / 86400000 : null
  const color = daysSinceBackup == null ? 'var(--danger-strong)' : daysSinceBackup < BACKUP_FRESH_DAYS ? 'var(--accent)' : 'var(--warning)'
  const text = lastBackup == null ? t('Never backed up') : `${t('Last backup')} ${formatDateOrTime(lastBackup.at, lang)}`
  const iconSize = variant === 'header' ? 32 : 24
  const icon = lastBackup?.method === 'manual' ? <ManualSyncIcon size={iconSize} /> : <CloudSyncIcon size={iconSize} />

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color,
        fontSize: '0.8rem',
        fontWeight: 600,
        ...(variant === 'header' ? { maxWidth: 'calc(50vw - 16px)', verticalAlign: 'top', lineHeight: 1.3 } : {}),
      }}
    >
      {variant === 'header' ? (
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

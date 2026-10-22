import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getDriveIdentity } from '../../lib/backup'
import { disconnectGoogleDrive, isGoogleDriveConfigured, pendingResumedDriveIntent } from '../../lib/googleDrive'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { ChevronDownIcon } from './ChevronDownIcon'
import { GoogleDriveCard } from './GoogleDriveCard'
import { GoogleDriveIcon } from './GoogleDriveIcon'
import { SyncStatusBadge } from './SyncStatusBadge'

interface Props {
  // Settings: one card that collapses to just the account + sync status and
  // expands to reveal the logout button and the Google Drive controls. Not
  // signed in yet, it's just the Drive card (that's where signing in starts).
  // The Dashboard's account popup leaves this off and shows both cards open.
  expandable?: boolean
}

export function GoogleIdentityCard({ expandable = false }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  // Opens already expanded when back from Google's sign-in for a Backup or
  // Restore — GoogleDriveCard (only mounted while expanded) is what resumes it.
  const [expanded, setExpanded] = useState(() => {
    const intent = pendingResumedDriveIntent()
    return intent === 'backup' || intent === 'restore'
  })
  const driveIdentity = useLiveQuery(() => getDriveIdentity(), [])

  async function handleDriveDisconnect() {
    if (!confirm(t('Disconnect Google Drive? Auto-backup will turn off and this device will stop checking for newer backups on open.'))) {
      return
    }
    setBusy(true)
    try {
      await disconnectGoogleDrive()
      toast(t('Disconnected from Google Drive'))
    } finally {
      setBusy(false)
    }
  }

  if (driveIdentity === undefined) return null
  if (!driveIdentity) return expandable ? <GoogleDriveCard /> : null

  const showLogout = !expandable || expanded

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {driveIdentity.picture ? (
        <img
          src={driveIdentity.picture}
          alt=""
          referrerPolicy="no-referrer"
          style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }}
        />
      ) : (
        <GoogleDriveIcon size={32} />
      )}
      {/* Name/email are their own tight column — previously each sat in a
          row alongside sync/exit, and being flex-centered against a
          taller sibling (the badge, the icon button) was what pushed
          them apart, not any deliberate margin. Sync/exit get their own
          column instead so they can stay roughly top/bottom-aligned
          without inflating the text's own line spacing. */}
      <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {driveIdentity.name || driveIdentity.email}
          </div>
          <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {driveIdentity.email}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            // Alone (collapsed) the sync status sits centered by height;
            // with logout below it, the two split top and bottom.
            justifyContent: showLogout ? 'space-between' : 'center',
            alignSelf: 'stretch',
            flexShrink: 0,
          }}
        >
          <SyncStatusBadge variant="compact" />
          {showLogout && (
            <button
              className="btn btn-ghost btn-icon"
              onClick={(e) => {
                e.stopPropagation()
                void handleDriveDisconnect()
              }}
              disabled={busy || !isGoogleDriveConfigured()}
              aria-label={t('Disconnect Google Drive')}
              type="button"
            >
              <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (!expandable) return <div className="card settings-list">{header}</div>

  return (
    <div className="card settings-list" style={{ position: 'relative', paddingBottom: 28 }}>
      <div onClick={() => setExpanded((o) => !o)} style={{ cursor: 'pointer' }}>
        {header}
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <GoogleDriveCard bare />
        </div>
      )}
      <button
        type="button"
        className={`card-expand-toggle${expanded ? ' open' : ''}`}
        aria-label={t(expanded ? 'Hide details' : 'Show details')}
        aria-expanded={expanded}
        onClick={() => setExpanded((o) => !o)}
      >
        <ChevronDownIcon size={20} />
      </button>
    </div>
  )
}

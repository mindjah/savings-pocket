import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getDriveIdentity } from '../../lib/backup'
import { disconnectGoogleDrive, isGoogleDriveConfigured } from '../../lib/googleDrive'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { GoogleDriveIcon } from './GoogleDriveIcon'
import { SyncStatusBadge } from './SyncStatusBadge'

// The signed-in-as card — shared between Settings (rendered inline, at the
// top of the page) and the Dashboard's own account popup (see
// GoogleAccountModal), which shows this directly above GoogleDriveCard.
export function GoogleIdentityCard() {
  const { t } = useTranslation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
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

  if (!driveIdentity) return null

  return (
    <div className="card settings-list">
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
              justifyContent: 'space-between',
              alignSelf: 'stretch',
              flexShrink: 0,
            }}
          >
            <SyncStatusBadge variant="compact" />
            <button
              className="btn btn-ghost btn-icon"
              onClick={handleDriveDisconnect}
              disabled={busy || !isGoogleDriveConfigured()}
              aria-label={t('Disconnect Google Drive')}
              type="button"
            >
              <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

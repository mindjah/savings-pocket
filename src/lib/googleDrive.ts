import {
  applyBackupPayload,
  buildBackupPayload,
  getDriveSyncState,
  hasEverConnectedToDrive,
  parseBackupFile,
  recordBackup,
  recordDriveConnected,
  recordDriveSync,
} from './backup'

// Set at build time via the VITE_GOOGLE_CLIENT_ID env var (see .env.example) —
// never hardcode a real client id in source, since this file ships to every
// visitor's browser.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

// appDataFolder is a hidden, per-app space Drive gives each OAuth client —
// invisible in the user's normal Drive UI and cleaned up if they ever revoke
// access, which is exactly the right shape for "this app's own backup blob"
// rather than a file cluttering their regular Drive.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const BACKUP_FILENAME = 'savings-pocket-backup.json'

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void
          }): { requestAccessToken: () => void }
        }
      }
    }
  }
}

export function isGoogleDriveConfigured(): boolean {
  return !!CLIENT_ID
}

function waitForGoogleIdentityServices(): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    function check() {
      if (window.google?.accounts?.oauth2) {
        resolve()
        return
      }
      if (Date.now() - start > 10000) {
        reject(new Error('Google Sign-In script failed to load.'))
        return
      }
      setTimeout(check, 100)
    }
    check()
  })
}

// Cached in memory only (never persisted) so a debounced auto-backup can
// reuse the token from the last explicit sign-in without re-prompting —
// cleared on reload, at which point auto-backup just stays quiet until the
// user interacts with Backup/Restore again.
let cachedToken: { token: string; expiresAt: number } | null = null

function cacheToken(token: string, expiresInSeconds: number | undefined) {
  // Refresh a bit early rather than racing an in-flight request against expiry.
  cachedToken = { token, expiresAt: Date.now() + (expiresInSeconds ?? 3500) * 1000 - 30000 }
}

function getCachedToken(): string | null {
  return cachedToken && cachedToken.expiresAt > Date.now() ? cachedToken.token : null
}

async function requestAccessToken(): Promise<string> {
  if (!CLIENT_ID) throw new Error('Google Drive is not configured for this deployment.')
  await waitForGoogleIdentityServices()
  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || 'Google sign-in was cancelled.'))
        } else {
          cacheToken(response.access_token, response.expires_in)
          void recordDriveConnected()
          resolve(response.access_token)
        }
      },
    })
    tokenClient.requestAccessToken()
  })
}

// Thrown when the user declines the "this will overwrite unseen data"
// warning, so callers can skip showing an error alert for it.
export class DriveBackupCancelled extends Error {}

async function findBackupFile(token: string): Promise<{ id: string; modifiedTime: string } | null> {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('spaces', 'appDataFolder')
  url.searchParams.set('q', `name='${BACKUP_FILENAME}'`)
  url.searchParams.set('fields', 'files(id,modifiedTime)')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Could not reach Google Drive.')
  const json = (await res.json()) as { files?: { id: string; modifiedTime: string }[] }
  const file = json.files?.[0]
  return file ? { id: file.id, modifiedTime: file.modifiedTime } : null
}

// onConflict is asked (and must return true to proceed) only when Drive
// already holds a backup this device hasn't seen — most likely pushed by
// another device — since backup is a full overwrite, not a merge. The
// confirmation text itself is built by the caller so it can be translated.
async function uploadBackup(token: string, onConflict: (remoteModifiedAt: string) => boolean): Promise<void> {
  const existing = await findBackupFile(token)

  if (existing) {
    const syncState = await getDriveSyncState()
    const remoteUnseen = !syncState || new Date(existing.modifiedTime).getTime() > new Date(syncState.at).getTime()
    if (remoteUnseen && !onConflict(existing.modifiedTime)) {
      throw new DriveBackupCancelled()
    }
  }

  const payload = await buildBackupPayload()
  const body = JSON.stringify(payload)
  // Recorded sync point comes from Drive's own response, not this device's
  // clock — the server's modifiedTime for our own upload is always a beat
  // after the local pre-upload timestamp (network latency), so comparing
  // against a locally-timestamped sync point would flag every device's very
  // next backup as a false conflict with itself.
  let uploadedModifiedTime: string

  if (existing) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media&fields=modifiedTime`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body,
      },
    )
    if (!res.ok) throw new Error('Failed to update the Google Drive backup.')
    uploadedModifiedTime = ((await res.json()) as { modifiedTime: string }).modifiedTime
  } else {
    const boundary = 'savings_pocket_backup_boundary'
    const metadata = { name: BACKUP_FILENAME, parents: ['appDataFolder'] }
    const multipartBody =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n` +
      `--${boundary}--`
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=modifiedTime', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    })
    if (!res.ok) throw new Error('Failed to create the Google Drive backup.')
    uploadedModifiedTime = ((await res.json()) as { modifiedTime: string }).modifiedTime
  }
  await recordBackup('google')
  await recordDriveSync(uploadedModifiedTime)
}

export async function backupToGoogleDrive(onConflict: (remoteModifiedAt: string) => boolean): Promise<void> {
  const token = await requestAccessToken()
  await uploadBackup(token, onConflict)
}

export type AutoBackupResult = 'ok' | 'skipped' | 'error'

// Never prompts for sign-in — only runs if a token from a previous explicit
// Backup/Restore is still cached, so a debounced watcher can call this after
// every edit without ever popping up Google's consent screen unattended.
export async function attemptSilentAutoBackup(onConflict: (remoteModifiedAt: string) => boolean): Promise<AutoBackupResult> {
  if (!isGoogleDriveConfigured()) return 'skipped'
  const token = getCachedToken()
  if (!token) return 'skipped'
  try {
    await uploadBackup(token, onConflict)
    return 'ok'
  } catch (err) {
    return err instanceof DriveBackupCancelled ? 'skipped' : 'error'
  }
}

export async function restoreFromGoogleDrive(): Promise<{ imported: Record<string, number> }> {
  const token = await requestAccessToken()
  const existing = await findBackupFile(token)
  if (!existing) throw new Error('No backup found in Google Drive yet.')
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to download the Google Drive backup.')
  const text = await res.text()
  const parsed = parseBackupFile(text)
  const result = await applyBackupPayload(parsed)
  // Use Drive's own modifiedTime (already fetched above), not the payload's
  // embedded exportedAt — that's the uploading device's local pre-upload
  // clock, which is always a beat earlier than Drive's server timestamp for
  // that same upload, and would make the very next backup from this device
  // look like a conflict with the file it just restored from.
  await recordDriveSync(existing.modifiedTime)
  return result
}

export interface DriveStartupCheckResult {
  remoteModifiedAt: string
}

// Called once on app open. Only attempts a token request — which may not be
// silent, occasionally showing Google's sign-in UI — if this device has
// signed in to Drive at least once before, so a visitor who's never touched
// Google Drive is never surprised by an auth prompt. Any failure (revoked
// access, offline, dismissed prompt) is swallowed — this is a courtesy
// check, not a required step.
export async function checkDriveForNewerBackup(): Promise<DriveStartupCheckResult | null> {
  if (!isGoogleDriveConfigured()) return null
  if (!(await hasEverConnectedToDrive())) return null
  let token: string
  try {
    token = await requestAccessToken()
  } catch {
    return null
  }
  const existing = await findBackupFile(token)
  if (!existing) return null
  const syncState = await getDriveSyncState()
  const remoteNewer = !syncState || new Date(existing.modifiedTime).getTime() > new Date(syncState.at).getTime()
  return remoteNewer ? { remoteModifiedAt: existing.modifiedTime } : null
}

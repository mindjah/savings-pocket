import {
  applyBackupPayload,
  buildBackupPayload,
  clearDriveConnection,
  getDriveSyncState,
  hasEverConnectedToDrive,
  hasUnsyncedLocalChanges,
  parseBackupFile,
  recordBackup,
  recordDriveConnected,
  recordDriveIdentity,
  recordDriveSync,
} from './backup'

// Set at build time via the VITE_GOOGLE_CLIENT_ID env var (see .env.example) —
// never hardcode a real client id in source, since this file ships to every
// visitor's browser.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

// appDataFolder is a hidden, per-app space Drive gives each OAuth client —
// invisible in the user's normal Drive UI and cleaned up if they ever revoke
// access, which is exactly the right shape for "this app's own backup blob"
// rather than a file cluttering their regular Drive. openid/email/profile
// are along for the ride purely to show "signed in as" in Settings — they
// grant no access beyond basic profile info, and (like drive.appdata) are
// non-sensitive scopes, so this never triggers Google's "unverified app"
// warning screen or needs a security review.
const DRIVE_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata'
const BACKUP_FILENAME = 'savings-pocket-backup.json'
// Separate, timestamped snapshots kept alongside the single canonical file
// above — the canonical file is always overwritten in place (that's what
// every conflict/sync check compares against), so on its own there's no way
// back if a bad backup or restore clobbers something. These are pure
// history: written best-effort after every successful backup, never read by
// the sync/conflict logic, browsable from Settings.
const BACKUP_HISTORY_PREFIX = 'savings-pocket-history-'
const MAX_BACKUP_HISTORY_ENTRIES = 10

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void
          }): { requestAccessToken: (overrideConfig?: { prompt?: string }) => void }
          revoke(token: string, callback: () => void): void
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

// Best-effort and fire-and-forget — purely so Settings can show "signed in
// as", never something a backup/restore should fail or even wait on.
async function fetchAndStoreIdentity(token: string): Promise<void> {
  try {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const json = (await res.json()) as { email?: string; name?: string; picture?: string }
    if (!json.email) return
    await recordDriveIdentity({ email: json.email, name: json.name, picture: json.picture })
  } catch {
    // Ignored — see comment above.
  }
}

// silent: true passes prompt: 'none' to Google Identity Services, which
// asks it to resolve (or fail) using an existing Google session with no
// popup or other UI of its own — used for the automatic app-open freshness
// check (see checkDriveForNewerBackup), which previously relied entirely on
// the BROWSER's own popup blocker to stay invisible. That's not a real
// guarantee: a visitor who's allowed auto popups for this site got a live
// Google sign-in window on every single app open. Explicit connect/restore
// flows (a real click behind them) still ask silent: false (the default),
// since those are exactly when an interactive picker is wanted.
async function requestAccessToken(options?: { silent?: boolean }): Promise<string> {
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
          void fetchAndStoreIdentity(response.access_token)
          resolve(response.access_token)
        }
      },
    })
    tokenClient.requestAccessToken(options?.silent ? { prompt: 'none' } : undefined)
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

// A random-per-request boundary (rather than one fixed string) so it can
// never collide with the JSON body it's wrapping, however unlikely that was
// in practice.
function buildMultipartBody(name: string, jsonBody: string): { boundary: string; body: string } {
  const boundary = `savings_pocket_${crypto.randomUUID()}`
  const metadata = { name, parents: ['appDataFolder'] }
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${jsonBody}\r\n` +
    `--${boundary}--`
  return { boundary, body }
}

export interface DriveBackupHistoryEntry {
  id: string
  createdAt: string
}

async function listBackupHistoryFiles(token: string): Promise<{ id: string; name: string; modifiedTime: string }[]> {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('spaces', 'appDataFolder')
  url.searchParams.set('q', `name contains '${BACKUP_HISTORY_PREFIX}' and trashed = false`)
  url.searchParams.set('fields', 'files(id,name,modifiedTime)')
  url.searchParams.set('orderBy', 'modifiedTime desc')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Could not reach Google Drive.')
  const json = (await res.json()) as { files?: { id: string; name: string; modifiedTime: string }[] }
  return json.files ?? []
}

// Best-effort — a hiccup here shouldn't make the user think their actual
// backup (the canonical file) failed, since that's already succeeded by the
// time this runs.
async function saveBackupHistoryEntry(token: string, body: string): Promise<void> {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const { boundary, body: multipartBody } = buildMultipartBody(`${BACKUP_HISTORY_PREFIX}${stamp}.json`, body)
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody,
    })
    const files = await listBackupHistoryFiles(token)
    const excess = files.slice(MAX_BACKUP_HISTORY_ENTRIES)
    await Promise.all(
      excess.map((f) =>
        fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    )
  } catch {
    // Ignored — see comment above.
  }
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
    const { boundary, body: multipartBody } = buildMultipartBody(BACKUP_FILENAME, body)
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
  await saveBackupHistoryEntry(token, body)
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

// onConfirm is asked (and must return true to proceed) only after a token has
// already been obtained — requesting the token FIRST, before any awaited
// pre-check or confirm() dialog, is what lets Google's popup succeed as a
// lightweight account picker instead of being silently blocked: an await (or
// a dialog) ahead of it breaks the chain back to the tap that triggered this,
// and the browser then treats the token request as gesture-less.
export async function restoreFromGoogleDrive(
  onConfirm: (hasLocalChanges: boolean) => boolean,
): Promise<{ imported: Record<string, number> }> {
  const token = await requestAccessToken()
  const existing = await findBackupFile(token)
  if (!existing) throw new Error('No backup found in Google Drive yet.')
  const hasLocalChanges = await hasUnsyncedLocalChanges()
  if (!onConfirm(hasLocalChanges)) throw new DriveBackupCancelled()
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

// Requires a real click behind it — same reasoning as restoreFromGoogleDrive
// above (token request first, before any UI of ours).
export async function listGoogleDriveBackupHistory(): Promise<DriveBackupHistoryEntry[]> {
  const token = await requestAccessToken()
  const files = await listBackupHistoryFiles(token)
  return files.map((f) => ({ id: f.id, createdAt: f.modifiedTime }))
}

// Restoring an old snapshot is still a full local overwrite, same as
// restoreFromGoogleDrive — but since the user is deliberately reaching past
// the current canonical state to an older one, this also pushes a fresh
// backup of whatever's on this device FIRST, so picking the wrong entry (or
// changing their mind) never costs the device's current, unsaved state.
export async function restoreGoogleDriveBackupHistoryEntry(
  fileId: string,
  onConfirm: () => boolean,
): Promise<{ imported: Record<string, number> }> {
  const token = await requestAccessToken()
  if (!onConfirm()) throw new DriveBackupCancelled()
  await uploadBackup(token, () => true)
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to download the selected backup.')
  const text = await res.text()
  const parsed = parseBackupFile(text)
  return applyBackupPayload(parsed)
}

export interface DriveStartupCheckResult {
  remoteModifiedAt: string
}

// Called once on app open. Only attempts a token request — silently, no
// popup or other Google UI (see requestAccessToken) — if this device has
// signed in to Drive at least once before, so a visitor who's never touched
// Google Drive is never surprised by an auth prompt. Any failure (revoked
// access, needs re-consent, offline) is swallowed — this is a courtesy
// check, not a required step; shouldOfferDriveReconnect's own banner is
// what offers an interactive reconnect afterward.
export async function checkDriveForNewerBackup(): Promise<DriveStartupCheckResult | null> {
  if (!isGoogleDriveConfigured()) return null
  if (!(await hasEverConnectedToDrive())) return null
  let token: string
  try {
    token = await requestAccessToken({ silent: true })
  } catch {
    return null
  }
  const existing = await findBackupFile(token)
  if (!existing) return null
  const syncState = await getDriveSyncState()
  const remoteNewer = !syncState || new Date(existing.modifiedTime).getTime() > new Date(syncState.at).getTime()
  return remoteNewer ? { remoteModifiedAt: existing.modifiedTime } : null
}

// How long to stay quiet after asking (whether accepted or declined) before
// offering to reconnect again — keeps a long-lived background session from
// being nagged every time it resumes.
const RECONNECT_COOLDOWN_MS = 60 * 60 * 1000
let lastReconnectPromptAt = 0

// Auto-backup only ever uses an already-cached token (see
// attemptSilentAutoBackup) — it never prompts on its own. That token dies
// after under an hour, and refreshing it needs real user interaction (an
// expired grant can't be silently renewed, see requestAccessToken's own
// silent mode) — this decides WHETHER to offer an interactive reconnect
// prompt: only when auto-backup is actually turned on, this device has
// connected to Drive before, there's currently no valid token, and it's
// been at least an hour since the last time this was offered. Marks the
// cooldown as soon as it returns true, regardless of whether the caller's
// resulting prompt gets accepted — same "ask at most once an hour" either way.
//
// Deliberately does NOT itself call requestAccessToken() — an interactive
// (non-silent) request needs a real DOM-dispatched user gesture behind it or
// browsers with a popup blocker enabled will still block it. The caller must
// render an actual clickable element and call connectDriveForAutoBackup()
// directly from its onClick handler.
export async function shouldOfferDriveReconnect(autoBackupEnabled: boolean): Promise<boolean> {
  if (!autoBackupEnabled) return false
  if (!isGoogleDriveConfigured()) return false
  if (getCachedToken()) return false
  if (!(await hasEverConnectedToDrive())) return false
  if (Date.now() - lastReconnectPromptAt < RECONNECT_COOLDOWN_MS) return false
  lastReconnectPromptAt = Date.now()
  return true
}

// Call this directly from a real onClick handler — that's what lets the
// popup succeed as just the lightweight account picker (same as a manual
// Backup/Restore tap) instead of being blocked.
export async function connectDriveForAutoBackup(): Promise<void> {
  try {
    await requestAccessToken()
  } catch {
    // Best-effort only — silently try again next time the cooldown clears.
  }
}

// Revokes the grant with Google (so it no longer shows up under this app in
// the user's Google Account access list) when a token is available to revoke
// it with, then always clears this device's own local connection state
// regardless — a revoke failure (or no cached token to revoke with, e.g.
// after a reload) shouldn't leave the app still thinking it's connected.
export async function disconnectGoogleDrive(): Promise<void> {
  const token = getCachedToken()
  cachedToken = null
  if (token && window.google?.accounts?.oauth2) {
    await new Promise<void>((resolve) => window.google!.accounts.oauth2.revoke(token, () => resolve()))
  }
  await clearDriveConnection()
}

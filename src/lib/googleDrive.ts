import {
  applyBackupPayload,
  buildBackupPayload,
  clearDriveConnection,
  getDriveIdentity,
  getDriveSyncState,
  getPendingDriveUpload,
  hasEverConnectedToDrive,
  hasUnsyncedLocalChanges,
  parseBackupFile,
  recordBackup,
  recordDriveConnected,
  recordDriveIdentity,
  recordDriveSync,
  recordPendingDriveUpload,
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

export function isGoogleDriveConfigured(): boolean {
  return !!CLIENT_ID
}

// Sign-in is Google's OAuth flow for browser apps (response_type=token) as a
// same-window redirect rather than the Google Identity Services popup: on an
// iPhone home-screen app that popup opens as an extra sheet with Google's
// account picker every time, and its silent mode (prompt: 'none') never works
// there because Safari blocks Google's third-party cookies. The redirect
// passes login_hint with the account this device last used, so Google comes
// straight back without asking which account, and the token it returns is
// kept in localStorage until it expires (about an hour) — reopening the app
// within that hour needs no Google screen at all.
const TOKEN_KEY = 'savings-pocket:driveToken'
const PENDING_KEY = 'savings-pocket:driveSignIn'

// What the user tapped before leaving for Google — resumed once they're back
// (see takeResumedDriveIntent). Restoring a history entry resumes as
// 'history' — the list is shown again rather than restoring an entry
// unattended, since that's a full overwrite.
export type DriveIntent = 'connect' | 'backup' | 'restore' | 'history'

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode — kept for this page load only via the in-memory copy.
  }
}

let cachedToken: { token: string; expiresAt: number } | null = readStorage(TOKEN_KEY)

function cacheToken(token: string, expiresInSeconds: number | undefined) {
  // Refresh a bit early rather than racing an in-flight request against expiry.
  cachedToken = { token, expiresAt: Date.now() + (expiresInSeconds ?? 3500) * 1000 - 60000 }
  writeStorage(TOKEN_KEY, cachedToken)
}

function clearCachedToken() {
  cachedToken = null
  writeStorage(TOKEN_KEY, null)
}

function getCachedToken(): string | null {
  return cachedToken && cachedToken.expiresAt > Date.now() ? cachedToken.token : null
}

// Best-effort and fire-and-forget — purely so Settings can show "signed in
// as" (and so the next sign-in can skip the account picker), never something
// a backup/restore should fail or even wait on.
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

// Thrown when the user declines the "this will overwrite unseen data"
// warning, so callers can skip showing an error alert for it.
export class DriveBackupCancelled extends Error {}

// Thrown while the page is leaving for Google's sign-in — a cancellation as
// far as callers are concerned (nothing to report); the action itself picks
// up again after the redirect back.
export class DriveSignInRedirect extends DriveBackupCancelled {}

const redirectUri = () => new URL(import.meta.env.BASE_URL, location.href).href

// Returns the stored token while it's valid; otherwise leaves the app for
// Google's sign-in page and throws DriveSignInRedirect.
async function requestAccessToken(intent: DriveIntent): Promise<string> {
  if (!CLIENT_ID) throw new Error('Google Drive is not configured for this deployment.')
  const cached = getCachedToken()
  if (cached) return cached
  const identity = await getDriveIdentity()
  const state = crypto.randomUUID()
  writeStorage(PENDING_KEY, { state, intent, leftAt: Date.now() })
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: DRIVE_SCOPE,
    state,
    include_granted_scopes: 'true',
    // A known account comes straight back without the account picker.
    ...(identity?.email ? { login_hint: identity.email } : { prompt: 'select_account' }),
  })
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  throw new DriveSignInRedirect()
}

let resumedIntent: DriveIntent | null = null
let cameBack = false
let signInLeftAt: number | null = null

// True when this page load is the return from Google's sign-in page.
export const cameBackFromDriveSignIn = () => cameBack

// When the app left for Google, on the page load that's the matching return
// (null otherwise). The redirect reloads the app from scratch, so App uses
// this to keep a Face ID unlock from just before the trip instead of
// locking again — a sign-in can only start from an already-unlocked app.
export const driveSignInLeftAt = () => signInLeftAt

// Without consuming it — for choosing which tab the app opens on.
export const pendingResumedDriveIntent = () => resumedIntent

// The action the user started before signing in, handed out once — to
// whichever screen performs it (GoogleDriveCard, Settings' history list).
export function takeResumedDriveIntent(intents: DriveIntent[]): DriveIntent | null {
  if (!resumedIntent || !intents.includes(resumedIntent)) return null
  const intent = resumedIntent
  resumedIntent = null
  return intent
}

// Call once at startup, before the first render: picks up the token Google
// puts in the URL fragment after sign-in, synchronously, so screens mounting
// right after already see it.
export function handleDriveRedirect(): void {
  const hash = location.hash
  if (!hash.includes('access_token=') && !hash.includes('error=')) return
  const params = new URLSearchParams(hash.slice(1))
  history.replaceState(null, '', location.pathname + location.search)
  const pending = readStorage<{ state: string; intent: DriveIntent; leftAt?: number }>(PENDING_KEY)
  writeStorage(PENDING_KEY, null)
  if (!pending || params.get('state') !== pending.state) return
  cameBack = true
  signInLeftAt = typeof pending.leftAt === 'number' ? pending.leftAt : null
  const token = params.get('access_token')
  if (params.get('error') || !token) return
  cacheToken(token, Number(params.get('expires_in')) || undefined)
  void recordDriveConnected()
  void fetchAndStoreIdentity(token)
  // Google's consent screen has a checkbox per permission — without the Drive
  // one there's nothing to resume (the next Drive call would only fail).
  const granted = params.get('scope') ?? ''
  if (granted && !granted.includes('drive.appdata')) return
  resumedIntent = pending.intent
}


// Every copy of the canonical backup file, newest first. There should only
// ever be one, but if two were ever created, taking whichever Drive happened
// to list first meant backup could write one copy while the app-open check
// and restore read the other, stale one.
interface DriveBackupFile {
  id: string
  modifiedTime: string
  sha256Checksum?: string
}

async function listBackupFiles(token: string): Promise<DriveBackupFile[]> {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('spaces', 'appDataFolder')
  url.searchParams.set('q', `name='${BACKUP_FILENAME}' and trashed = false`)
  url.searchParams.set('fields', 'files(id,modifiedTime,sha256Checksum)')
  url.searchParams.set('orderBy', 'modifiedTime desc')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Could not reach Google Drive.')
  const json = (await res.json()) as { files?: DriveBackupFile[] }
  return json.files ?? []
}

async function findBackupFile(token: string): Promise<DriveBackupFile | null> {
  return (await listBackupFiles(token))[0] ?? null
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Whether Drive's copy is something this device hasn't seen — i.e. most
// likely written by another device. A copy newer than the recorded sync
// point whose content checksum matches what this device last sent (see
// recordPendingDriveUpload) or last synced is this device's own write after
// all: it's adopted as the new sync point instead of being reported.
async function isUnseenRemote(file: DriveBackupFile): Promise<boolean> {
  const sync = await getDriveSyncState()
  if (sync && new Date(file.modifiedTime).getTime() <= new Date(sync.at).getTime()) return false
  const pending = await getPendingDriveUpload()
  if (file.sha256Checksum && (file.sha256Checksum === pending || file.sha256Checksum === sync?.sha256)) {
    await recordDriveSync(file.modifiedTime, file.sha256Checksum)
    await recordPendingDriveUpload(null)
    return false
  }
  return true
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
  const [existing, ...extraCopies] = await listBackupFiles(token)

  if (existing && (await isUnseenRemote(existing)) && !onConflict(existing.modifiedTime)) {
    throw new DriveBackupCancelled()
  }

  const payload = await buildBackupPayload()
  const body = JSON.stringify(payload)
  const bodySha256 = await sha256Hex(body)
  await recordPendingDriveUpload(bodySha256)
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
  await recordDriveSync(uploadedModifiedTime, bodySha256)
  await recordPendingDriveUpload(null)
  // Older duplicates of the canonical file (see listBackupFiles) — best-effort,
  // the backup itself already succeeded.
  await Promise.all(
    extraCopies.map((f) =>
      fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {}),
    ),
  )
  await saveBackupHistoryEntry(token, body)
}

export async function backupToGoogleDrive(onConflict: (remoteModifiedAt: string) => boolean): Promise<void> {
  const token = await requestAccessToken('backup')
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
// been obtained, so a sign-in round trip doesn't ask the same question twice.
export async function restoreFromGoogleDrive(
  onConfirm: (hasLocalChanges: boolean) => boolean,
): Promise<{ imported: Record<string, number> }> {
  const token = await requestAccessToken('restore')
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
  await recordDriveSync(existing.modifiedTime, existing.sha256Checksum)
  return result
}

// May leave for Google's sign-in first — see requestAccessToken.
export async function listGoogleDriveBackupHistory(): Promise<DriveBackupHistoryEntry[]> {
  const token = await requestAccessToken('history')
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
  const token = await requestAccessToken('history')
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

// Called once on app open. Only uses a still-valid stored token — never any
// Google UI — so it runs quietly when the app was used within the last hour;
// otherwise shouldOfferDriveReconnect's own banner is what offers to
// reconnect afterward.
export async function checkDriveForNewerBackup(): Promise<DriveStartupCheckResult | null> {
  if (!isGoogleDriveConfigured()) return null
  if (!(await hasEverConnectedToDrive())) return null
  const token = getCachedToken()
  if (!token) return null
  const existing = await findBackupFile(token)
  if (!existing) return null
  return (await isUnseenRemote(existing)) ? { remoteModifiedAt: existing.modifiedTime } : null
}

// How long to stay quiet after asking (whether accepted or declined) before
// offering to reconnect again — keeps a long-lived background session from
// being nagged every time it resumes.
const RECONNECT_COOLDOWN_MS = 60 * 60 * 1000
let lastReconnectPromptAt = 0

// Auto-backup only ever uses an already-cached token (see
// attemptSilentAutoBackup) — it never prompts on its own. That token dies
// after under an hour, and a browser app can't renew it without a trip
// through Google's sign-in page — this decides WHETHER to offer an interactive reconnect
// prompt: only when auto-backup is actually turned on, this device has
// connected to Drive before, there's currently no valid token, and it's
// been at least an hour since the last time this was offered. Marks the
// cooldown as soon as it returns true, regardless of whether the caller's
// resulting prompt gets accepted — same "ask at most once an hour" either way.
// The caller shows a banner whose Connect button calls
// connectDriveForAutoBackup(), rather than leaving the app unasked.
export async function shouldOfferDriveReconnect(autoBackupEnabled: boolean): Promise<boolean> {
  if (!autoBackupEnabled) return false
  if (!isGoogleDriveConfigured()) return false
  if (getCachedToken()) return false
  if (!(await hasEverConnectedToDrive())) return false
  if (Date.now() - lastReconnectPromptAt < RECONNECT_COOLDOWN_MS) return false
  lastReconnectPromptAt = Date.now()
  return true
}

// Leaves for Google's sign-in (straight back for the account last used) and
// returns with a fresh token for auto-backup.
export async function connectDriveForAutoBackup(): Promise<void> {
  try {
    await requestAccessToken('connect')
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
  clearCachedToken()
  if (token) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {})
  }
  await clearDriveConnection()
}

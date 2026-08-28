import { applyBackupPayload, buildBackupPayload, parseBackupFile } from './backup'

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
            callback: (response: { access_token?: string; error?: string }) => void
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
          resolve(response.access_token)
        }
      },
    })
    tokenClient.requestAccessToken()
  })
}

async function findBackupFileId(token: string): Promise<string | null> {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('spaces', 'appDataFolder')
  url.searchParams.set('q', `name='${BACKUP_FILENAME}'`)
  url.searchParams.set('fields', 'files(id)')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Could not reach Google Drive.')
  const json = (await res.json()) as { files?: { id: string }[] }
  return json.files?.[0]?.id ?? null
}

export async function backupToGoogleDrive(): Promise<void> {
  const token = await requestAccessToken()
  const payload = await buildBackupPayload()
  const body = JSON.stringify(payload)
  const existingId = await findBackupFileId(token)

  if (existingId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body,
      },
    )
    if (!res.ok) throw new Error('Failed to update the Google Drive backup.')
  } else {
    const boundary = 'savings_pocket_backup_boundary'
    const metadata = { name: BACKUP_FILENAME, parents: ['appDataFolder'] }
    const multipartBody =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n` +
      `--${boundary}--`
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    })
    if (!res.ok) throw new Error('Failed to create the Google Drive backup.')
  }
}

export async function restoreFromGoogleDrive(): Promise<{ imported: Record<string, number> }> {
  const token = await requestAccessToken()
  const fileId = await findBackupFileId(token)
  if (!fileId) throw new Error('No backup found in Google Drive yet.')
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to download the Google Drive backup.')
  const text = await res.text()
  const parsed = parseBackupFile(text)
  return applyBackupPayload(parsed)
}

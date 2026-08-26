import { db } from '../db/db'

// Local fallback for the Face ID lock — unlike the biometric prompt, this
// never depends on a flaky platform authenticator, so it's the one path
// that can't hang or get silently blocked by the browser.
async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function setPasscode(code: string): Promise<void> {
  await db.meta.put({ key: 'faceIdPasscodeHash', value: await sha256Hex(code) })
}

export async function hasPasscode(): Promise<boolean> {
  const rec = await db.meta.get('faceIdPasscodeHash')
  return typeof rec?.value === 'string' && rec.value.length > 0
}

export async function verifyPasscode(code: string): Promise<boolean> {
  const rec = await db.meta.get('faceIdPasscodeHash')
  const stored = rec?.value as string | undefined
  if (!stored) return false
  return (await sha256Hex(code)) === stored
}

export async function clearPasscode(): Promise<void> {
  await db.meta.delete('faceIdPasscodeHash')
}

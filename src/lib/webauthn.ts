import { db } from '../db/db'

const RP_NAME = 'Savings Pocket'

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export async function isFaceIdAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
    return false
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// This app has no server, so the credential this creates is never verified
// cryptographically — the OS resolving the ceremony IS the proof Face ID /
// Touch ID / device passcode approved, which is all a fully local,
// offline-first app needs for an on-device lock screen.
export async function registerFaceId(): Promise<boolean> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: RP_NAME },
        user: { id: userId, name: 'savings-pocket', displayName: 'Savings Pocket' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
        attestation: 'none',
      },
    })
    if (!credential || !('rawId' in credential)) return false
    await db.meta.put({ key: 'faceIdCredentialId', value: bufToBase64((credential as PublicKeyCredential).rawId) })
    await db.meta.put({ key: 'faceIdEnabled', value: true })
    return true
  } catch {
    return false
  }
}

export async function disableFaceId(): Promise<void> {
  await db.meta.put({ key: 'faceIdEnabled', value: false })
}

export async function verifyFaceId(): Promise<boolean> {
  const rec = await db.meta.get('faceIdCredentialId')
  const credId = rec?.value as string | undefined
  if (!credId) return false
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: base64ToBuf(credId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    return !!assertion
  } catch {
    return false
  }
}

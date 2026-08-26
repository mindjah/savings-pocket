import { useEffect, useRef, useState } from 'react'
import { verifyFaceId } from '../../lib/webauthn'
import { hasPasscode, verifyPasscode } from '../../lib/passcode'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  onUnlock: () => void
}

export function LockScreen({ onUnlock }: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [passcodeAvailable, setPasscodeAvailable] = useState(false)
  const [showPasscodeInput, setShowPasscodeInput] = useState(false)
  const [passcodeValue, setPasscodeValue] = useState('')
  const [passcodeError, setPasscodeError] = useState(false)

  useEffect(() => {
    hasPasscode().then(setPasscodeAvailable)
  }, [])

  async function attempt() {
    setShowPasscodeInput(false)
    setBusy(true)
    setFailed(false)
    const ok = await verifyFaceId()
    setBusy(false)
    if (ok) onUnlock()
    else setFailed(true)
  }

  // Fire the prompt immediately so unlocking feels instant — this screen
  // stays underneath as the fallback (manual retry, or the passcode below)
  // for when the auto-fired call is blocked, fails, or hangs.
  const autoFired = useRef(false)
  useEffect(() => {
    if (autoFired.current) return
    autoFired.current = true
    attempt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePasscodeSubmit() {
    if (passcodeValue.length < 4) return
    const ok = await verifyPasscode(passcodeValue)
    if (ok) {
      onUnlock()
    } else {
      setPasscodeError(true)
      setPasscodeValue('')
    }
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <span className="lock-icon">🔒</span>
        <h2>{t('Savings Pocket is locked')}</h2>
        <p className="muted">{t('Unlock with Face ID to continue')}</p>

        {failed && !showPasscodeInput && (
          <p className="muted" style={{ color: 'var(--danger-strong)' }}>
            {t('Unlock failed or was cancelled — try again.')}
          </p>
        )}

        {!showPasscodeInput && (
          <button className="btn btn-primary btn-block" onClick={attempt} disabled={busy} type="button">
            {busy ? t('Waiting…') : t('Unlock')}
          </button>
        )}

        {failed && passcodeAvailable && !showPasscodeInput && (
          <button className="btn btn-block" onClick={() => setShowPasscodeInput(true)} type="button">
            {t('Use passcode instead')}
          </button>
        )}

        {showPasscodeInput && (
          <>
            <div className="form-group" style={{ width: '100%', textAlign: 'left' }}>
              <label htmlFor="unlockPasscode">{t('Passcode')}</label>
              <input
                id="unlockPasscode"
                type="password"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                value={passcodeValue}
                onChange={(e) => {
                  setPasscodeValue(e.target.value.replace(/\D/g, ''))
                  setPasscodeError(false)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePasscodeSubmit()}
              />
            </div>
            {passcodeError && (
              <p className="muted" style={{ color: 'var(--danger-strong)' }}>
                {t('Incorrect passcode')}
              </p>
            )}
            <button className="btn btn-primary btn-block" onClick={handlePasscodeSubmit} type="button">
              {t('Unlock')}
            </button>
            <button className="btn btn-block" onClick={attempt} type="button">
              {t('Try Face ID again')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

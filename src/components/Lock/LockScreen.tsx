import { useEffect, useState } from 'react'
import { verifyFaceId } from '../../lib/webauthn'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  onUnlock: () => void
}

export function LockScreen({ onUnlock }: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function attempt() {
    setBusy(true)
    setFailed(false)
    const ok = await verifyFaceId()
    setBusy(false)
    if (ok) onUnlock()
    else setFailed(true)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    attempt()
  }, [])

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <span className="lock-icon">🔒</span>
        <h2>{t('Savings Pocket is locked')}</h2>
        <p className="muted">{t('Unlock with Face ID to continue')}</p>
        {failed && (
          <p className="muted" style={{ color: 'var(--danger-strong)' }}>
            {t('Unlock failed or was cancelled — try again.')}
          </p>
        )}
        <button className="btn btn-primary btn-block" onClick={attempt} disabled={busy} type="button">
          {busy ? t('Waiting…') : t('Unlock')}
        </button>
      </div>
    </div>
  )
}

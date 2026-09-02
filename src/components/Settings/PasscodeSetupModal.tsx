import { useState } from 'react'
import { Modal } from '../common/Modal'
import { useToast } from '../../hooks/useToast'
import { useTranslation } from '../../hooks/useTranslation'
import { setPasscode } from '../../lib/passcode'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export function PasscodeSetupModal({ onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [confirmCode, setConfirmCode] = useState('')

  const valid = /^\d{4,6}$/.test(code) && code === confirmCode

  async function handleSave() {
    if (!valid) return
    await setPasscode(code)
    toast(t('Passcode set'))
    onSaved()
  }

  return (
    <Modal
      title={t('Set a backup passcode')}
      onClose={onClose}
      hasUnsavedChanges={code !== '' || confirmCode !== ''}
    >
      <p className="muted">{t('Used to unlock if Face ID ever fails. 4–6 digits.')}</p>
      <div className="form-group">
        <label htmlFor="newPasscode">{t('Passcode')}</label>
        <input
          id="newPasscode"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <div className="form-group">
        <label htmlFor="confirmPasscode">{t('Confirm passcode')}</label>
        <input
          id="confirmPasscode"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={confirmCode}
          onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary btn-block" onClick={handleSave} disabled={!valid} type="button">
          {t('Save passcode')}
        </button>
      </div>
    </Modal>
  )
}

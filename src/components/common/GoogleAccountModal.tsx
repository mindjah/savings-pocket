import { Modal } from './Modal'
import { GoogleIdentityCard } from './GoogleIdentityCard'
import { GoogleDriveCard } from './GoogleDriveCard'
import { useTranslation } from '../../hooks/useTranslation'

interface Props {
  onClose: () => void
}

// Opened by tapping the account avatar in Dashboard's mobile header — the
// same identity + Google Drive cards Settings shows inline, just reachable
// without a full trip to the Settings tab.
export function GoogleAccountModal({ onClose }: Props) {
  const { t } = useTranslation()
  return (
    <Modal title={t('Google account')} onClose={onClose}>
      <GoogleIdentityCard />
      <GoogleDriveCard />
    </Modal>
  )
}

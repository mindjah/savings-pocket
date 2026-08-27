import { useEffect, useRef, useState } from 'react'
import { NavBar, type Tab } from './components/Layout/NavBar'
import { SavingsView } from './components/Savings/SavingsView'
import { CryptoView } from './components/Crypto/CryptoView'
import { SpendingView } from './components/Spending/SpendingView'
import { SettingsView } from './components/Settings/SettingsView'
import { ToastProvider } from './hooks/useToast'
import { HEADER_ACTIONS_ID } from './components/common/HeaderPortal'
import { materializeRecurringExpenses } from './lib/recurring'
import { materializePendingAutoDebits } from './lib/pendingDebits'
import { LockScreen } from './components/Lock/LockScreen'
import { useMetaSetting } from './hooks/useMetaSetting'
import { useTranslation } from './hooks/useTranslation'

const TITLES: Record<Tab, string> = {
  savings: 'Savings',
  crypto: 'Crypto',
  spending: 'Spending',
  settings: 'Settings',
}

const STORAGE_KEY = 'savings-pocket:activeTab'
// Quick app-switches (checking a notification, glancing at another app)
// shouldn't force a re-auth — only re-lock once backgrounded this long.
const RELOCK_AFTER_MS = 5 * 60 * 1000

function readInitialTab(): Tab {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'savings' || stored === 'crypto' || stored === 'spending' || stored === 'settings') {
    return stored
  }
  return 'savings'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readInitialTab)
  const { t } = useTranslation()
  const [faceIdEnabled] = useMetaSetting<boolean>('faceIdEnabled', false)
  const [unlocked, setUnlocked] = useState(false)
  const locked = faceIdEnabled && !unlocked

  useEffect(() => {
    materializeRecurringExpenses()
    materializePendingAutoDebits()
  }, [])

  // Re-lock only once the app has been backgrounded for a while — a brief
  // switch to another app shouldn't demand another Face ID check.
  const hiddenAtRef = useRef<number | null>(null)
  useEffect(() => {
    function onVisibility() {
      if (!faceIdEnabled) return
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      if (hiddenAt != null && Date.now() - hiddenAt >= RELOCK_AFTER_MS) {
        setUnlocked(false)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [faceIdEnabled])

  function handleChange(next: Tab) {
    setTab(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  if (locked) {
    return (
      <ToastProvider>
        <LockScreen onUnlock={() => setUnlocked(true)} />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <div className="app-shell">
        <header className="app-header">
          <h1>{t(TITLES[tab])}</h1>
          <div id={HEADER_ACTIONS_ID} className="app-header-actions" />
        </header>
        <NavBar active={tab} onChange={handleChange} />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {tab === 'savings' && <SavingsView />}
          {tab === 'crypto' && <CryptoView />}
          {tab === 'spending' && <SpendingView />}
          {tab === 'settings' && <SettingsView />}
        </main>
      </div>
    </ToastProvider>
  )
}

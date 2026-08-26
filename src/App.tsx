import { useEffect, useState } from 'react'
import { NavBar, type Tab } from './components/Layout/NavBar'
import { SavingsView } from './components/Savings/SavingsView'
import { CryptoView } from './components/Crypto/CryptoView'
import { SpendingView } from './components/Spending/SpendingView'
import { SettingsView } from './components/Settings/SettingsView'
import { ToastProvider } from './hooks/useToast'
import { HEADER_ACTIONS_ID } from './components/common/HeaderPortal'
import { materializeRecurringExpenses } from './lib/recurring'
import { LockScreen } from './components/Lock/LockScreen'
import { useMetaSetting } from './hooks/useMetaSetting'

const TITLES: Record<Tab, string> = {
  savings: 'Savings',
  crypto: 'Crypto',
  spending: 'Spending',
  settings: 'Settings',
}

const STORAGE_KEY = 'savings-pocket:activeTab'

function readInitialTab(): Tab {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'savings' || stored === 'crypto' || stored === 'spending' || stored === 'settings') {
    return stored
  }
  return 'savings'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readInitialTab)
  const [faceIdEnabled] = useMetaSetting<boolean>('faceIdEnabled', false)
  const [unlocked, setUnlocked] = useState(false)
  const locked = faceIdEnabled && !unlocked

  useEffect(() => {
    materializeRecurringExpenses()
  }, [])

  // Re-lock whenever the app is backgrounded, so a resumed session always
  // demands another Face ID check rather than trusting a stale unlock.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden' && faceIdEnabled) setUnlocked(false)
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
          <h1>{TITLES[tab]}</h1>
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

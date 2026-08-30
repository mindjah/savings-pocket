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
import { useAutoBackup } from './hooks/useAutoBackup'
import { useDriveStartupCheck } from './hooks/useDriveStartupCheck'

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
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  )
}

// Split from App so hooks here (useDriveStartupCheck, and anything else that
// needs useToast) render as a descendant of ToastProvider — a hook called
// directly in App's own body would read the context's no-op default instead,
// since App isn't itself a child of the ToastProvider it returns.
function AppShell() {
  const [tab, setTab] = useState<Tab>(readInitialTab)
  const { t } = useTranslation()
  const [faceIdEnabled] = useMetaSetting<boolean>('faceIdEnabled', false)
  const [unlocked, setUnlocked] = useState(false)
  const locked = faceIdEnabled && !unlocked

  useEffect(() => {
    materializeRecurringExpenses()
    materializePendingAutoDebits()
  }, [])

  // Only installed/standalone PWAs are allowed to lock orientation — and only on
  // browsers that support the Screen Orientation API (notably not iOS Safari, where
  // the CSS landscape-block overlay is the only available fallback).
  useEffect(() => {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    orientation?.lock?.('portrait').catch(() => {})
  }, [])

  useAutoBackup()
  useDriveStartupCheck(!locked)

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

  const [savingsResetKey, setSavingsResetKey] = useState(0)
  const [cryptoResetKey, setCryptoResetKey] = useState(0)
  const [spendingResetKey, setSpendingResetKey] = useState(0)
  const [settingsResetKey, setSettingsResetKey] = useState(0)

  function handleChange(next: Tab) {
    if (next === tab) {
      // Re-tapping the already-active tab jumps back to its main screen and
      // scrolls up — the same "tap to go home" pattern as most apps' bottom nav bars.
      if (next === 'savings') setSavingsResetKey((k) => k + 1)
      if (next === 'crypto') setCryptoResetKey((k) => k + 1)
      if (next === 'spending') setSpendingResetKey((k) => k + 1)
      if (next === 'settings') setSettingsResetKey((k) => k + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setTab(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  if (locked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{t(TITLES[tab])}</h1>
        <div id={HEADER_ACTIONS_ID} className="app-header-actions" />
      </header>
      <NavBar active={tab} onChange={handleChange} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {tab === 'savings' && <SavingsView resetKey={savingsResetKey} />}
        {tab === 'crypto' && <CryptoView resetKey={cryptoResetKey} />}
        {tab === 'spending' && <SpendingView resetKey={spendingResetKey} />}
        {tab === 'settings' && <SettingsView resetKey={settingsResetKey} />}
      </main>
    </div>
  )
}

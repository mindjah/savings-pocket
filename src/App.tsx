import { useEffect, useRef, useState } from 'react'
import { NavBar, type Tab } from './components/Layout/NavBar'
import { SavingsView } from './components/Savings/SavingsView'
import { CryptoView } from './components/Crypto/CryptoView'
import { SpendingView } from './components/Spending/SpendingView'
import { PlanningScreen } from './components/Spending/PlanningModal'
import { BudgetScreen } from './components/Spending/BudgetModal'
import { AnalyticsScreen } from './components/Spending/AnalyticsModal'
import { SettingsView } from './components/Settings/SettingsView'
import { ToastProvider } from './hooks/useToast'
import { HEADER_ACTIONS_ID, HEADER_TITLE_ID, HeaderTitlePortal } from './components/common/HeaderPortal'
import { materializeRecurringExpenses } from './lib/recurring'
import { materializePendingAutoDebits } from './lib/pendingDebits'
import { LockScreen } from './components/Lock/LockScreen'
import { useMetaSetting } from './hooks/useMetaSetting'
import { useTranslation } from './hooks/useTranslation'
import { useAutoBackup } from './hooks/useAutoBackup'
import { useDriveStartupCheck } from './hooks/useDriveStartupCheck'
import { useIsDesktop } from './hooks/useIsDesktop'
import { connectDriveForAutoBackup, shouldOfferDriveReconnect } from './lib/googleDrive'
import { GoogleDriveIcon } from './components/common/GoogleDriveIcon'

const TITLES: Record<Tab, string> = {
  savings: 'Savings',
  crypto: 'Crypto',
  spending: 'Spending',
  planning: 'Planning sandbox',
  budget: 'Manage budget',
  analytics: 'Analytics',
  settings: 'Settings',
}

// Only reachable through the desktop sidebar (see NavBar's desktopOnly
// flag) — on mobile they stay bottom sheets opened from Spending's own
// Manage menu instead.
const DESKTOP_ONLY_TABS: Tab[] = ['planning', 'budget', 'analytics']

const STORAGE_KEY = 'savings-pocket:activeTab'
// Quick app-switches (checking a notification, glancing at another app)
// shouldn't force a re-auth — only re-lock once backgrounded this long.
const RELOCK_AFTER_MS = 5 * 60 * 1000

function readInitialTab(isDesktop: boolean): Tab {
  const stored = localStorage.getItem(STORAGE_KEY)
  const valid: Tab[] = ['savings', 'crypto', 'spending', 'planning', 'budget', 'analytics', 'settings']
  if (stored && (valid as string[]).includes(stored)) {
    const tab = stored as Tab
    // A tab saved from a wider window shouldn't strand a phone-width reopen
    // on a nav item that isn't there — same fallback as an unrecognized tab.
    if (DESKTOP_ONLY_TABS.includes(tab) && !isDesktop) return 'spending'
    return tab
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
  const isDesktop = useIsDesktop()
  const [tab, setTab] = useState<Tab>(() => readInitialTab(isDesktop))
  const { t } = useTranslation()
  const [faceIdEnabled] = useMetaSetting<boolean>('faceIdEnabled', false)
  const [unlocked, setUnlocked] = useState(false)
  const locked = faceIdEnabled && !unlocked
  const [autoBackupEnabled] = useMetaSetting<boolean>('autoBackupToGoogleDrive', false)
  const [showDriveReconnect, setShowDriveReconnect] = useState(false)

  // A window resized down to phone width (or a desktop tab reopened on a
  // phone via restored session state) shouldn't strand the user on a nav
  // item the sidebar just removed — fall back to Spending, where these
  // three screens are still reachable through the Manage menu.
  useEffect(() => {
    if (!isDesktop && DESKTOP_ONLY_TABS.includes(tab)) setTab('spending')
  }, [isDesktop, tab])

  // Whichever desktop-only screen (Planning sandbox/Manage budget/Analytics)
  // is currently active reports its own unsaved-changes state here, so
  // switching tabs away from it can warn first — the same protection its
  // mobile bottom-sheet form already gets from tapping outside/the X
  // button. Reset on every tab change so a freshly mounted screen starts
  // clean rather than inheriting the previous one's leftover value.
  const [activeScreenDirty, setActiveScreenDirty] = useState(false)
  useEffect(() => {
    setActiveScreenDirty(false)
  }, [tab])

  useEffect(() => {
    materializeRecurringExpenses()
    materializePendingAutoDebits()
  }, [])

  // Give useDriveStartupCheck's own silent token attempt (below) a head
  // start before falling back to this interactive prompt, so the two don't
  // race into two competing Google popups on the same fresh open.
  // autoBackupEnabled starts out false (useMetaSetting's fallback) until its
  // async IndexedDB read resolves a moment later — depending on it here (not
  // just []) means this re-schedules with the real value once that lands,
  // instead of permanently running with a stale false from the first render.
  // Also skipped entirely while the Face ID lock screen is still showing —
  // depending on `locked` means this reschedules to run again shortly after
  // the user actually unlocks, instead of firing behind the lock screen.
  useEffect(() => {
    if (locked) return
    const timer = setTimeout(() => {
      shouldOfferDriveReconnect(autoBackupEnabled).then((should) => {
        if (should) setShowDriveReconnect(true)
      })
    }, 2000)
    return () => clearTimeout(timer)
  }, [autoBackupEnabled, locked])

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
  // switch to another app shouldn't demand another Face ID check. Coming
  // back to the foreground (with or without Face ID on) is also the only
  // other moment — besides app open — where a long-lived background session
  // gets a chance to catch up on recurring expenses and refresh its Drive
  // connection, since neither runs on any kind of timer.
  const hiddenAtRef = useRef<number | null>(null)
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        if (faceIdEnabled) hiddenAtRef.current = Date.now()
        return
      }
      if (faceIdEnabled) {
        const hiddenAt = hiddenAtRef.current
        hiddenAtRef.current = null
        if (hiddenAt != null && Date.now() - hiddenAt >= RELOCK_AFTER_MS) {
          setUnlocked(false)
          return // re-locked — skip background work until they authenticate again
        }
      }
      if (locked) return // still (or already) behind the lock screen — skip until unlocked
      materializeRecurringExpenses()
      materializePendingAutoDebits()
      shouldOfferDriveReconnect(autoBackupEnabled).then((should) => {
        if (should) setShowDriveReconnect(true)
      })
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [faceIdEnabled, autoBackupEnabled, locked])

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
    if (DESKTOP_ONLY_TABS.includes(tab) && activeScreenDirty) {
      if (!confirm(t('You have unsaved changes. Leave without saving?'))) return
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
        {/* Never given direct React children — always written to via
            HeaderTitlePortal below, for every tab, including the default
            per-tab title. Mixing a directly-rendered child with a portal
            target on the same node crashes on unmount: React's text-content
            fast path wipes the portal's out-of-band node, which then throws
            when the portal's own cleanup tries to remove it again. */}
        <h1 id={HEADER_TITLE_ID} />
        <div id={HEADER_ACTIONS_ID} className="app-header-actions" />
      </header>
      {tab !== 'spending' && <HeaderTitlePortal>{t(TITLES[tab])}</HeaderTitlePortal>}
      <NavBar active={tab} onChange={handleChange} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {tab === 'savings' && <SavingsView resetKey={savingsResetKey} />}
        {tab === 'crypto' && <CryptoView resetKey={cryptoResetKey} />}
        {tab === 'spending' && <SpendingView resetKey={spendingResetKey} />}
        {tab === 'planning' && <PlanningScreen onDirtyChange={setActiveScreenDirty} />}
        {tab === 'budget' && <BudgetScreen onDirtyChange={setActiveScreenDirty} />}
        {tab === 'analytics' && <AnalyticsScreen />}
        {tab === 'settings' && <SettingsView resetKey={settingsResetKey} />}
      </main>

      {showDriveReconnect && (
        <>
          {/* Dims the rest of the app to signal an action is wanted, without
              blocking it — pointer-events:none lets taps pass straight
              through to whatever's underneath. */}
          <div className="drive-reconnect-dim" />
          <div className="drive-reconnect-banner" role="alert">
            <div className="drive-reconnect-row">
              <span style={{ flexShrink: 0 }}>
                <GoogleDriveIcon size={32} />
              </span>
              <span className="drive-reconnect-text">{t('Reconnect to Google Drive to keep backing up automatically?')}</span>
            </div>
            <div className="drive-reconnect-actions">
              <button
                className="drive-reconnect-close"
                onClick={() => setShowDriveReconnect(false)}
                aria-label={t('Close')}
                type="button"
              >
                ✕
              </button>
              <button
                className="drive-reconnect-connect"
                onClick={() => {
                  setShowDriveReconnect(false)
                  connectDriveForAutoBackup()
                }}
                type="button"
              >
                {t('Connect')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

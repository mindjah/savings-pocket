import { useEffect, useState } from 'react'
import { useMetaSetting } from '../../hooks/useMetaSetting'
import { useTranslation } from '../../hooks/useTranslation'
import { MoonIcon } from '../common/MoonIcon'
import { SunIcon } from '../common/SunIcon'

// A quick binary light/dark switch, duplicating Settings > General's own
// three-way System/Light/Dark control (desktop dashboard only, see
// DashboardView) — this one only ever sets an explicit light or dark
// choice, never 'system'. Reads the OS preference just to decide which
// icon/direction to show while the stored preference is still 'system'.
export function ThemeQuickToggle() {
  const { t } = useTranslation()
  const [themePreference, setThemePreference] = useMetaSetting<'system' | 'light' | 'dark'>('themePreference', 'system')
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setPrefersDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const isDark = themePreference === 'dark' || (themePreference === 'system' && prefersDark)

  return (
    <button
      className="dashboard-theme-toggle"
      type="button"
      onClick={() => setThemePreference(isDark ? 'light' : 'dark')}
      aria-label={t(isDark ? 'Switch to light theme' : 'Switch to dark theme')}
    >
      {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  )
}

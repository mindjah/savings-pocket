import { useEffect, useState } from 'react'
import { isStandalonePwa } from '../lib/pwaStandalone'

// Mirrors the app's own CSS desktop breakpoint (the @media (min-width: 860px)
// rules in index.css that turn the bottom nav into a sidebar) — kept as one
// constant so a JS decision (which tabs exist, which screens are full pages
// vs. bottom sheets) never drifts from what the layout actually looks like.
export const DESKTOP_BREAKPOINT = 860

// index.css's own landscape rotation-lock trick (.pwa-standalone +
// orientation: landscape) keeps the app's rendered layout in its original
// portrait dimensions regardless of the phone's physical orientation — but
// window.innerWidth/innerHeight themselves never change, since a CSS
// transform doesn't affect the viewport's own reported size. Without this,
// a phone whose LANDSCAPE width happens to cross 860px (some larger phones
// do) would get switched into the desktop sidebar layout the instant it's
// physically rotated, even though the rotation trick is deliberately still
// showing it the portrait one — the two would visibly disagree. Swapping
// which dimension counts as "width" for the breakpoint check exactly when
// that trick is active keeps them in sync. Uses isStandalonePwa() directly
// (not the .pwa-standalone class App.tsx sets) so this is correct even on
// the very first render, before that class-setting effect has run.
function computeIsDesktop(): boolean {
  const rotationLockActive = isStandalonePwa() && window.matchMedia('(orientation: landscape)').matches
  const width = rotationLockActive ? window.innerHeight : window.innerWidth
  return width >= DESKTOP_BREAKPOINT
}

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(computeIsDesktop)

  useEffect(() => {
    function onChange() {
      setIsDesktop(computeIsDesktop())
    }
    const widthMql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
    const heightMql = window.matchMedia(`(min-height: ${DESKTOP_BREAKPOINT}px)`)
    const orientationMql = window.matchMedia('(orientation: landscape)')
    widthMql.addEventListener('change', onChange)
    heightMql.addEventListener('change', onChange)
    orientationMql.addEventListener('change', onChange)
    return () => {
      widthMql.removeEventListener('change', onChange)
      heightMql.removeEventListener('change', onChange)
      orientationMql.removeEventListener('change', onChange)
    }
  }, [])

  return isDesktop
}

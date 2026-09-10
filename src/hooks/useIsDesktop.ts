import { useEffect, useState } from 'react'
import { isStandalonePwa } from '../lib/pwaStandalone'

// Mirrors the app's own CSS desktop breakpoint (the @media (min-width: 860px)
// rules in index.css that turn the bottom nav into a sidebar) — kept as one
// constant so a JS decision (which tabs exist, which screens are full pages
// vs. bottom sheets) never drifts from what the layout actually looks like.
export const DESKTOP_BREAKPOINT = 860

// index.css's own landscape rotation-lock trick (.force-portrait-rotate)
// keeps the app's rendered layout in its original portrait dimensions
// regardless of the phone's physical orientation — but window.innerWidth/
// innerHeight themselves never change, since a CSS transform doesn't
// affect the viewport's own reported size. Without this, a phone whose
// LANDSCAPE width happens to cross 860px (some larger phones do) would get
// switched into the desktop sidebar layout the instant it's physically
// rotated, even though the rotation trick is deliberately still showing it
// the portrait one — the two would visibly disagree. Swapping which
// dimension counts as "width" for the breakpoint check exactly when that
// trick is active keeps them in sync. Measures window.innerWidth/
// innerHeight directly (matching App.tsx's own .force-portrait-rotate
// toggle) rather than the orientation: landscape media feature, which is
// the riskier thing to trust on a home-screen PWA whose manifest also
// declares orientation: 'portrait' — see vite.config.ts.
function computeIsDesktop(): boolean {
  const rotationLockActive = isStandalonePwa() && window.innerWidth > window.innerHeight
  const width = rotationLockActive ? window.innerHeight : window.innerWidth
  return width >= DESKTOP_BREAKPOINT
}

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(computeIsDesktop)

  useEffect(() => {
    function onChange() {
      setIsDesktop(computeIsDesktop())
    }
    window.addEventListener('resize', onChange)
    return () => window.removeEventListener('resize', onChange)
  }, [])

  return isDesktop
}

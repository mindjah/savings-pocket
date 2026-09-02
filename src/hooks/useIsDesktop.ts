import { useEffect, useState } from 'react'

// Mirrors the app's own CSS desktop breakpoint (the @media (min-width: 860px)
// rules in index.css that turn the bottom nav into a sidebar) — kept as one
// constant so a JS decision (which tabs exist, which screens are full pages
// vs. bottom sheets) never drifts from what the layout actually looks like.
export const DESKTOP_BREAKPOINT = 860

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches)

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
    const onChange = () => setIsDesktop(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../hooks/useTranslation'

interface ModalProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  // Budget status, Planning sandbox, Manage budget and Analytics (plus the
  // bottom sheets Analytics opens) have enough content — lists, charts,
  // forms — to earn a wider sheet on a laptop screen instead of staying
  // pinned to the same narrow column every other (mobile-shaped) modal
  // uses. Mobile is untouched — the widening only kicks in at the app's
  // existing desktop breakpoint (see .app-shell in index.css).
  wide?: boolean
  // When true, closing (tap-outside, the X button, or Escape) asks for
  // confirmation first instead of silently discarding whatever the user
  // was in the middle of entering — the same protection either way, so
  // tapping outside can't be used to bypass the warning the X button gives.
  hasUnsavedChanges?: boolean
  // Renders as a centered dialog (all 4 corners rounded, no bottom-sheet
  // drag grabber) instead of a bottom sheet, even on mobile — for a
  // lightweight, quick-in-quick-out surface (e.g. Search) rather than one
  // that reads as "a screen of its own" the way every other sheet does.
  popup?: boolean
}

// How many Modals are currently mounted (a bottom sheet opened from within
// another bottom sheet — e.g. Analytics' budget card opening
// BudgetStatusModal — briefly has two at once). Ref-counted so the body
// scroll lock below only actually releases once the last one closes,
// instead of the inner modal's unmount prematurely re-enabling scroll
// while the outer one is still open.
let openModalCount = 0
let visualViewportUnlock: (() => void) | null = null

// Locks background scroll for as long as any Modal is open — without this,
// a touch-scroll gesture starting on the (non-scrollable) overlay can
// still chain through to the page underneath on mobile, letting you scroll
// the screen behind a bottom sheet that's supposed to be the only
// interactive thing on screen. Plain `overflow: hidden` on <body> alone is
// well-known to NOT stop this on iOS Safari (it still allows the page to
// pan/rubber-band, especially once a focused input's on-screen keyboard is
// involved) — pinning the body in place with position: fixed is the
// standard, more robust fix, restoring the exact scroll position on close.
function useBodyScrollLock() {
  useEffect(() => {
    openModalCount += 1
    if (openModalCount === 1) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.overflow = 'hidden'
      // <html> too — some mobile browsers scroll the root element instead
      // of (or in addition to) <body>.
      document.documentElement.style.overflow = 'hidden'

      // Even with the above, iOS Safari can still PAN the visual viewport
      // itself (a distinct mechanism from document/body scroll) once a
      // keyboard is involved — a position: fixed overlay tracks that pan,
      // so it (and the "page" behind it) visually drags around under a
      // swipe despite scroll being otherwise fully locked. Snapping back
      // to (0, 0) the instant any such pan is detected cancels it out.
      const vv = window.visualViewport
      function snapBack() {
        if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0)
      }
      vv?.addEventListener('scroll', snapBack)
      visualViewportUnlock = () => vv?.removeEventListener('scroll', snapBack)
    }
    return () => {
      openModalCount -= 1
      if (openModalCount === 0) {
        const restoreY = -parseInt(document.body.style.top || '0', 10)
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        document.body.style.overflow = ''
        document.documentElement.style.overflow = ''
        visualViewportUnlock?.()
        visualViewportUnlock = null
        window.scrollTo(0, restoreY)
      }
    }
  }, [])
}

// On a browser where the on-screen keyboard doesn't resize the layout
// viewport on its own (`.modal-overlay`'s `position: fixed; inset: 0`
// still sizes against the full, un-shrunk layout viewport while only the
// VISUAL viewport shrinks), the gap between the two is exactly how much
// the sheet needs shifted up to clear the keyboard.
//
// On a browser that DOES resize the layout viewport for the keyboard
// (see index.html's `interactive-widget=resizes-content`), that gap is
// already ~0 — `.modal-overlay` is naturally sized correctly with no
// shift needed. But the sheet's own height still separately shrinks to
// fit its content either way, which is the OTHER half of this bug (see
// forcedHeight below) — so this being ~0 there doesn't mean nothing needs
// fixing, just that no shift does.
function useKeyboardShiftInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      const covered = window.innerHeight - vv!.height - vv!.offsetTop
      setInset(covered > 0 ? covered : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}

// Whatever the mechanism, the browser's currently visible height (the
// space actually available above any on-screen keyboard) — visualViewport
// when it exists, innerHeight otherwise. Compared against a baseline
// captured when the sheet first mounted (before its autofocused input had
// a chance to open a keyboard) to tell "a keyboard opened" apart from
// "this browser just doesn't have a small screen to begin with."
function useAvailableHeight(): number | null {
  const [available, setAvailable] = useState<number | null>(null)
  const baselineRef = useRef<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    function currentHeight() {
      return vv ? vv.height : window.innerHeight
    }
    if (baselineRef.current == null) baselineRef.current = currentHeight()

    function update() {
      const height = currentHeight()
      // A meaningful shrink vs. this sheet's own baseline is treated as
      // "something (a keyboard) is now covering part of the screen" —
      // small fluctuations (browser chrome show/hide) stay under this and
      // don't trigger it.
      setAvailable(baselineRef.current! - height > 40 ? height : null)
    }
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return available
}

export function Modal({ title, onClose, children, wide, hasUnsavedChanges, popup }: ModalProps) {
  const { t } = useTranslation()
  useBodyScrollLock()
  const keyboardShiftInset = useKeyboardShiftInset()
  const availableHeight = useAvailableHeight()

  function requestClose() {
    if (hasUnsavedChanges && !confirm(t('You have unsaved changes. Close without saving?'))) return
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, hasUnsavedChanges])

  // Portaled straight to <body> — rendered inline, a bottom sheet opened
  // from within another bottom sheet (e.g. Analytics' budget card opening
  // BudgetStatusModal) would sit inside the outer .modal's DOM subtree.
  // That outer .modal has an always-attached slide-up animation, which
  // (same containing-block mechanic as the FAB fix elsewhere in this app)
  // makes it a new containing block for the inner modal's position: fixed
  // — so the inner sheet ends up positioned/sized against the outer
  // sheet's box instead of the real viewport, opening from the middle of
  // the screen instead of the bottom and not fully covering it either.
  //
  // The .boucoup-scope wrapper restores the token/animation cascade that
  // portaling outside the active screen's own .view.boucoup-scope would
  // otherwise lose (theme.css's colors and the slide-up/fade animations
  // are all scoped through .boucoup-scope descendant selectors). display:
  // contents keeps it from generating its own box — no containing block,
  // no stacking context, no background of its own to collide with
  // .modal-overlay's — while CSS custom properties and inherited
  // properties (color, font-family) still cascade through it normally.
  // A popup dialog isn't anchored to any screen edge — its own background
  // reaching down to the keyboard the way a bottom sheet's does would look
  // like a shape-shifting mistake, not "expanding." It only needs a
  // lowered ceiling so it doesn't overflow past the now-smaller visible
  // area, same as before this force-height fix existed for sheets.
  const modalSizeStyle =
    availableHeight == null
      ? undefined
      : popup
        ? { maxHeight: availableHeight * 0.9 }
        : { height: availableHeight * 0.9, maxHeight: availableHeight * 0.9 }

  return createPortal(
    <div className="boucoup-scope" style={{ display: 'contents' }}>
      <div
        className={`modal-overlay${popup ? ' modal-overlay-popup' : ''}`}
        style={{ paddingBottom: keyboardShiftInset }}
        onClick={requestClose}
      >
        <div
          className={`modal${wide ? ' modal-wide' : ''}${popup ? ' modal-popup' : ''}`}
          style={modalSizeStyle}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {!popup && <div className="modal-grabber" aria-hidden="true" />}
          <div className="modal-header">
            <h2>{title}</h2>
            <button className="btn btn-ghost btn-icon" onClick={requestClose} aria-label={t('Close')}>
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

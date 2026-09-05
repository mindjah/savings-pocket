import { useEffect, useState } from 'react'
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
}

// How many Modals are currently mounted (a bottom sheet opened from within
// another bottom sheet — e.g. Analytics' budget card opening
// BudgetStatusModal — briefly has two at once). Ref-counted so the body
// scroll lock below only actually releases once the last one closes,
// instead of the inner modal's unmount prematurely re-enabling scroll
// while the outer one is still open.
let openModalCount = 0

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
        window.scrollTo(0, restoreY)
      }
    }
  }, [])
}

// On mobile, opening the on-screen keyboard shrinks the VISUAL viewport but
// not the LAYOUT viewport that `.modal-overlay`'s `position: fixed; inset:
// 0` sizes itself against — so a focused input near the top of a bottom
// sheet can end up sitting underneath the keyboard instead of above it.
// Tracks how much of the layout viewport is currently covered by the
// keyboard (0 when it's closed), via the VisualViewport API.
function useKeyboardInset(): number {
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

export function Modal({ title, onClose, children, wide, hasUnsavedChanges }: ModalProps) {
  const { t } = useTranslation()
  useBodyScrollLock()
  const keyboardInset = useKeyboardInset()

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
  return createPortal(
    <div className="boucoup-scope" style={{ display: 'contents' }}>
      <div className="modal-overlay" style={{ paddingBottom: keyboardInset }} onClick={requestClose}>
        <div
          className={`modal${wide ? ' modal-wide' : ''}`}
          // The sheet's own max-height (90dvh, from CSS) is measured
          // against the full layout viewport — with the keyboard open and
          // the overlay's own box already shrunk via paddingBottom above,
          // the sheet still needs its OWN ceiling lowered too, or it'll
          // simply overflow upward past the now-smaller visible area
          // instead of scrolling internally.
          style={keyboardInset > 0 ? { maxHeight: `calc(90dvh - ${keyboardInset}px)` } : undefined}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-grabber" aria-hidden="true" />
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

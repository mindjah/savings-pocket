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
  // drag grabber, fade+scale entrance) instead of a bottom sheet, even on
  // mobile — for a lightweight, quick-in-quick-out surface (Search) rather
  // than one that reads as "a screen of its own" the way every other
  // sheet does. Purely a styling variant — everything else about Modal
  // (scroll lock, Escape/tap-outside close) stays identical either way.
  popup?: boolean
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
// interactive thing on screen.
function useBodyScrollLock() {
  useEffect(() => {
    openModalCount += 1
    if (openModalCount === 1) document.body.style.overflow = 'hidden'
    return () => {
      openModalCount -= 1
      if (openModalCount === 0) document.body.style.overflow = ''
    }
  }, [])
}

// Extra lock used ONLY by the `popup` variant (Search), layered on top of
// (not replacing) useBodyScrollLock above — bottom sheets never call this,
// so they're unaffected by any of it. Kept as its own ref-counted pair
// rather than folded into useBodyScrollLock so the two can never interact.
//
// Plain `overflow: hidden` on <body> is well-known to not fully stop
// touch-scroll/pan on iOS Safari, especially once a focused input's
// on-screen keyboard is involved — iOS can still pan the VISUAL viewport
// itself (a mechanism distinct from document/body scroll), dragging a
// position: fixed popup around along with the page underneath despite the
// body lock. Also locks <html> (some mobile browsers scroll the root
// element instead of/in addition to body) and snaps any such pan back to
// (0, 0) the instant it's detected.
let openPopupCount = 0

function usePopupHardenedLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    openPopupCount += 1
    if (openPopupCount === 1) document.documentElement.style.overflow = 'hidden'

    const vv = window.visualViewport
    function snapBack() {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0)
    }
    vv?.addEventListener('scroll', snapBack)

    return () => {
      vv?.removeEventListener('scroll', snapBack)
      openPopupCount -= 1
      if (openPopupCount === 0) document.documentElement.style.overflow = ''
    }
  }, [active])
}

// On a browser where the on-screen keyboard doesn't resize the layout
// viewport on its own, `.modal-overlay`'s `position: fixed; inset: 0`
// still sizes against the full, un-shrunk layout viewport while only the
// VISUAL viewport shrinks — so a popup centered within that full box can
// still land partly behind the keyboard even with its own height capped
// (see usePopupAvailableHeight). The gap between the two is exactly how
// much the overlay's own box needs shrunk from the bottom so centering
// happens against the space actually above the keyboard instead. Used
// only by the `popup` variant.
function usePopupKeyboardShiftInset(active: boolean): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    if (!active) return
    const vv = window.visualViewport
    if (!vv) return
    // The keyboard's OWN slide-up animation (typically ~250-300ms end to
    // end) fires many intermediate resize/scroll events on visualViewport
    // throughout that whole time, not just one at the end — reacting to
    // each one snaps this popup-only style repeatedly in quick succession,
    // which reads as flickery even without an animation to interrupt.
    // 200ms comfortably outlasts the gaps between those intermediate
    // events, so this settles to a single snap once the keyboard's own
    // motion is actually done, not partway through it.
    let timer: ReturnType<typeof setTimeout> | null = null
    function update() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const covered = window.innerHeight - vv!.height - vv!.offsetTop
        setInset(covered > 0 ? covered : 0)
      }, 200)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      if (timer) clearTimeout(timer)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])

  return active ? inset : 0
}

// Whatever the mechanism, the browser's currently visible height (the
// space actually available above any on-screen keyboard) — visualViewport
// when it exists, innerHeight otherwise. Compared against a baseline
// captured when the popup first mounted (before its autofocused input had
// a chance to open a keyboard) to tell "a keyboard opened" apart from
// "this browser just doesn't have a small screen to begin with." Used
// only by the `popup` variant — bottom sheets don't call this either.
function usePopupAvailableHeight(active: boolean): number | null {
  const [available, setAvailable] = useState<number | null>(null)
  const baselineRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    const vv = window.visualViewport
    function currentHeight() {
      return vv ? vv.height : window.innerHeight
    }
    if (baselineRef.current == null) baselineRef.current = currentHeight()

    // Same reasoning and 200ms as usePopupKeyboardShiftInset's own
    // debounce above — settle once the keyboard's whole slide-up is
    // actually done, not once per intermediate event along the way.
    let timer: ReturnType<typeof setTimeout> | null = null
    function update() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const height = currentHeight()
        setAvailable(baselineRef.current! - height > 40 ? height : null)
      }, 200)
    }
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      if (timer) clearTimeout(timer)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [active])

  return active ? available : null
}

export function Modal({ title, onClose, children, wide, hasUnsavedChanges, popup }: ModalProps) {
  const { t } = useTranslation()
  useBodyScrollLock()
  usePopupHardenedLock(!!popup)
  const popupKeyboardShiftInset = usePopupKeyboardShiftInset(!!popup)
  const popupAvailableHeight = usePopupAvailableHeight(!!popup)

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
      <div
        className={`modal-overlay${popup ? ' modal-overlay-popup' : ''}`}
        style={popup ? { paddingBottom: popupKeyboardShiftInset } : undefined}
        onClick={requestClose}
      >
        <div
          className={`modal${wide ? ' modal-wide' : ''}${popup ? ' modal-popup' : ''}`}
          // Only for the popup variant: cap the dialog's height to
          // whatever's actually visible above an on-screen keyboard, once
          // one is open — a floating dialog reaching down to the keyboard
          // like a bottom sheet fills to it would look like a mistake, so
          // this only lowers the ceiling, never forces a fixed height.
          style={popup && popupAvailableHeight != null ? { maxHeight: popupAvailableHeight * 0.9 } : undefined}
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

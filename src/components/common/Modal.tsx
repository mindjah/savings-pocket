import { useEffect } from 'react'
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

export function Modal({ title, onClose, children, wide, hasUnsavedChanges, popup }: ModalProps) {
  const { t } = useTranslation()
  useBodyScrollLock()

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
      <div className={`modal-overlay${popup ? ' modal-overlay-popup' : ''}`} onClick={requestClose}>
        <div
          className={`modal${wide ? ' modal-wide' : ''}${popup ? ' modal-popup' : ''}`}
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

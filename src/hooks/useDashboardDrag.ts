import { useRef, useState } from 'react'

// A brief hold before a touch on the handle actually starts dragging — long
// enough that a scroll swipe that happens to pass over the thin handle bar
// doesn't yank a card out from under it, short enough a deliberate press
// still feels immediate. Cancelled outright if the finger moves past
// MOVE_CANCEL_THRESHOLD_PX before the hold completes (that's a swipe, not a
// hold-to-drag attempt).
const HOLD_MS = 200
const MOVE_CANCEL_THRESHOLD_PX = 8

/**
 * Pointer Events (not the HTML5 drag-and-drop API) so the exact same code
 * reorders cards on both mouse (desktop grid) and touch (mobile stacked
 * list) — native HTML5 `draggable` has no reliable touch support. Drag
 * starts only from a dedicated handle (see DashboardCell's grip icon), not
 * the whole card, so tapping a card's own buttons still works normally.
 * setPointerCapture on the handle keeps move/up events routed to it
 * even as the pointer travels over other cards, so no window-level
 * listeners are needed.
 */
export function useDashboardDrag<T extends string>(order: T[], setOrder: (next: T[]) => void) {
  const [draggingKey, setDraggingKey] = useState<T | null>(null)
  const [overKey, setOverKey] = useState<T | null>(null)
  const draggingRef = useRef<T | null>(null)
  const pendingRef = useRef<{ key: T; startX: number; startY: number } | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearHoldTimer() {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  function onHandlePointerDown(key: T) {
    return (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      pendingRef.current = { key, startX: e.clientX, startY: e.clientY }
      clearHoldTimer()
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null
        if (!pendingRef.current || pendingRef.current.key !== key) return
        draggingRef.current = key
        setDraggingKey(key)
      }, HOLD_MS)
    }
  }

  function onHandlePointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!draggingRef.current) {
      // Still waiting out the hold — a real move this early means a scroll
      // swipe passed over the handle, not a deliberate press-and-hold.
      const pending = pendingRef.current
      if (pending) {
        const dx = e.clientX - pending.startX
        const dy = e.clientY - pending.startY
        if (Math.hypot(dx, dy) > MOVE_CANCEL_THRESHOLD_PX) {
          clearHoldTimer()
          pendingRef.current = null
        }
      }
      return
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const cell = el?.closest<HTMLElement>('[data-card-key]')
    const key = cell?.dataset.cardKey as T | undefined
    setOverKey(key && key !== draggingRef.current ? key : null)
  }

  function onHandlePointerUp() {
    clearHoldTimer()
    pendingRef.current = null
    const dragged = draggingRef.current
    const target = overKey
    draggingRef.current = null
    setDraggingKey(null)
    setOverKey(null)
    if (!dragged || !target || dragged === target) return
    const next = order.slice()
    const from = next.indexOf(dragged)
    const to = next.indexOf(target)
    if (from === -1 || to === -1) return
    next.splice(from, 1)
    next.splice(to, 0, dragged)
    setOrder(next)
  }

  return { draggingKey, overKey, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp }
}

/** Keeps a persisted order in sync with the current set of valid keys —
 * drops anything no longer valid, appends anything new at the end (so
 * shipping a new card doesn't require a migration for existing users). */
export function sanitizeOrder<T extends string>(stored: T[] | undefined, defaults: readonly T[]): T[] {
  const known = new Set(defaults)
  const kept = (stored ?? []).filter((k) => known.has(k))
  const missing = defaults.filter((k) => !kept.includes(k))
  return [...kept, ...missing]
}

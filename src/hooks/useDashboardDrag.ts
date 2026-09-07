import { useRef, useState } from 'react'

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

  function onHandlePointerDown(key: T) {
    return (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault()
      draggingRef.current = key
      setDraggingKey(key)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  function onHandlePointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!draggingRef.current) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const cell = el?.closest<HTMLElement>('[data-card-key]')
    const key = cell?.dataset.cardKey as T | undefined
    setOverKey(key && key !== draggingRef.current ? key : null)
  }

  function onHandlePointerUp() {
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

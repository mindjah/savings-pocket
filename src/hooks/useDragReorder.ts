import { useState } from 'react'

/**
 * Native HTML5 drag-and-drop reordering for a list of string keys — no
 * library, just dragstart/dragover/drop wired to whatever order state the
 * caller already persists (see DashboardView's per-row meta-setting-backed
 * order arrays). Swaps the dragged key to the drop target's position.
 */
export function useDragReorder<T extends string>(order: T[], setOrder: (next: T[]) => void) {
  const [draggingKey, setDraggingKey] = useState<T | null>(null)

  function onDragStart(key: T) {
    return () => setDraggingKey(key)
  }

  function onDragEnd() {
    setDraggingKey(null)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function onDrop(targetKey: T) {
    return () => {
      const dragged = draggingKey
      setDraggingKey(null)
      if (!dragged || dragged === targetKey) return
      const next = order.slice()
      const from = next.indexOf(dragged)
      const to = next.indexOf(targetKey)
      if (from === -1 || to === -1) return
      next.splice(from, 1)
      next.splice(to, 0, dragged)
      setOrder(next)
    }
  }

  return { draggingKey, onDragStart, onDragEnd, onDragOver, onDrop }
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

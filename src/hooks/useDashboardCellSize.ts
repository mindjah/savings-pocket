import { useEffect, useState, type RefObject } from 'react'

/**
 * Measures the actual rendered width of one column in the dashboard's
 * fixed-column grid, so `grid-auto-rows` can be set to that same pixel
 * value — a card's height then comes purely from its own `grid-row: span
 * N` against that fixed row size, giving a true square 1x1 base unit.
 * Recomputed on resize via ResizeObserver.
 */
export function useDashboardCellSize(containerRef: RefObject<HTMLElement | null>, columns: number, gap: number): number {
  const [cellSize, setCellSize] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function compute() {
      const width = el!.clientWidth
      if (width <= 0) return
      setCellSize((width - (columns - 1) * gap) / columns)
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, columns, gap])

  return cellSize
}

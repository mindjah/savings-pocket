import { useEffect, useState, type RefObject } from 'react'

/**
 * Measures the actual rendered width of one column in the dashboard's
 * `repeat(auto-fit, minmax(minColumnWidth, 1fr))` grid, so cards can be
 * sized in exact multiples of that one square unit (see DashboardCell) —
 * recomputed on resize via ResizeObserver. Mirrors the browser's own
 * auto-fit column-count formula, using the same minColumnWidth/gap the
 * grid's own CSS uses, so it lines up with what the grid actually renders.
 */
export function useDashboardCellSize(containerRef: RefObject<HTMLElement | null>, minColumnWidth: number, gap: number): number {
  const [cellSize, setCellSize] = useState(minColumnWidth)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function compute() {
      const width = el!.clientWidth
      if (width <= 0) return
      const columns = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)))
      setCellSize((width - (columns - 1) * gap) / columns)
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, minColumnWidth, gap])

  return cellSize
}

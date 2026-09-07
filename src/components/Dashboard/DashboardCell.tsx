import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  cellSize: number
  gap: number
  widthUnits: 1 | 2
  heightUnits: 1 | 2
  // Standard cards only: if this card's own content doesn't fit a 1x1
  // cell, it promotes itself to 1x2 (taller, same width) — the only size
  // change that happens automatically; every other size is set explicitly
  // per card and never grows on its own.
  autoPromote?: boolean
  dragging?: boolean
  draggable?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: () => void
}

// One dashboard card's grid cell — Monthly Expenses at 1x1 is the base
// square unit (cellSize, measured from the grid's own rendered column
// width by useDashboardCellSize); every other card is some multiple of it.
// Explicit pixel height (rather than CSS grid-row spanning, which would
// need grid-auto-rows to already know the square unit) keeps this exact
// regardless of what else is in the same row, and lets same-tier cards'
// "Go to X" buttons land at the same Y position as each other.
export function DashboardCell({
  children,
  cellSize,
  gap,
  widthUnits,
  heightUnits,
  autoPromote,
  dragging,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [promoted, setPromoted] = useState(false)

  // One-way: once promoted, stop measuring. Promoting doubles the height,
  // which typically makes the content fit — re-measuring against that
  // taller box would immediately see "no overflow" and demote back to
  // short, which overflows again, forever (an infinite render loop this
  // caught in practice, not just in theory).
  useLayoutEffect(() => {
    if (!autoPromote || promoted) return
    const body = ref.current?.querySelector('.dashboard-card-body')
    if (!body) return
    if (body.scrollHeight > body.clientHeight + 1) setPromoted(true)
  })

  const effectiveHeightUnits = autoPromote && promoted ? 2 : heightUnits
  const height = cellSize * effectiveHeightUnits + gap * (effectiveHeightUnits - 1)

  return (
    <div
      ref={ref}
      className={`dashboard-cell${dragging ? ' dragging' : ''}`}
      style={{ height, gridColumn: `span ${widthUnits}` }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
    </div>
  )
}

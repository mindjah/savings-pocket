import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
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

// One dashboard card's grid cell. Sized purely via CSS grid-column/grid-row
// spans against the grid's own fixed-column-width/matching grid-auto-rows
// (see DashboardView) — the browser's own `grid-auto-flow: dense` packing
// then places every cell with no gaps, reflowing everything else around a
// promoted or reordered card automatically. No manual collision/placement
// logic needed on this end.
export function DashboardCell({
  children,
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

  // A card's own content (crypto prices, exchange rates, etc.) usually
  // finishes loading well after this cell's own first render — that's a
  // re-render of some deeply nested child, which doesn't propagate back up
  // to re-run an effect here. A MutationObserver on the body catches the
  // resulting overflow regardless of which descendant's data arriving
  // caused it, instead of only checking once at mount.
  //
  // One-way: once promoted, stop measuring (and disconnect). Promoting
  // doubles the height, which typically makes the content fit —
  // re-measuring against that taller box would immediately see "no
  // overflow" and demote back to short, which overflows again, forever
  // (an infinite render loop this caught in practice, not just in theory).
  useEffect(() => {
    if (!autoPromote || promoted) return
    const body = ref.current?.querySelector('.dashboard-card-body')
    if (!body) return

    function check() {
      if (body!.scrollHeight > body!.clientHeight + 1) setPromoted(true)
    }
    check()
    const observer = new MutationObserver(check)
    observer.observe(body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [autoPromote, promoted])

  const effectiveHeightUnits = autoPromote && promoted ? 2 : heightUnits

  return (
    <div
      ref={ref}
      className={`dashboard-cell${dragging ? ' dragging' : ''}`}
      style={{ gridColumn: `span ${widthUnits}`, gridRow: `span ${effectiveHeightUnits}` }}
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

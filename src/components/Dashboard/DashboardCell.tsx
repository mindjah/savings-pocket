import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  cardKey: string
  // 'grid' (desktop): sized via CSS grid-column/grid-row spans against the
  // shared grid (see DashboardView). 'stack' (mobile): a plain full-width
  // block at its own natural height, one per row, like every other mobile
  // screen's cards — no square unit, no auto-promote (nothing to overflow
  // when height is never constrained).
  layout: 'grid' | 'stack'
  widthUnits: 1 | 2
  heightUnits: 1 | 2
  // Standard cards only, grid layout only: if this card's own content
  // doesn't fit a 1x1 cell, it promotes itself to 1x2 (taller, same width)
  // — the only size change that happens automatically; every other size is
  // set explicitly per card and never grows on its own.
  autoPromote?: boolean
  dragging?: boolean
  dragOver?: boolean
  onHandlePointerDown: (e: React.PointerEvent<HTMLElement>) => void
  onHandlePointerMove: (e: React.PointerEvent<HTMLElement>) => void
  onHandlePointerUp: (e: React.PointerEvent<HTMLElement>) => void
}

// One dashboard card's cell. Desktop: sized purely via CSS grid-column/
// grid-row spans against the grid's own fixed-column-width/matching
// grid-auto-rows (see DashboardView) — the browser's own
// `grid-auto-flow: dense` packing then places every cell with no gaps,
// reflowing everything else around a promoted or reordered card
// automatically. Mobile: a plain stacked block, full width. Reordering
// (see useDashboardDrag) is Pointer Events based, not HTML5 drag-and-drop,
// so the same grip handle works with both mouse and touch.
export function DashboardCell({
  children,
  cardKey,
  layout,
  widthUnits,
  heightUnits,
  autoPromote,
  dragging,
  dragOver,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
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
    if (layout !== 'grid' || !autoPromote || promoted) return
    const body = ref.current?.querySelector('.dashboard-card-body')
    if (!body) return

    function check() {
      if (body!.scrollHeight > body!.clientHeight + 1) setPromoted(true)
    }
    check()
    const observer = new MutationObserver(check)
    observer.observe(body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [layout, autoPromote, promoted])

  const effectiveHeightUnits = autoPromote && promoted ? 2 : heightUnits
  const gridStyle = layout === 'grid' ? { gridColumn: `span ${widthUnits}`, gridRow: `span ${effectiveHeightUnits}` } : undefined

  return (
    <div
      ref={ref}
      className={`dashboard-cell dashboard-cell-${layout}${!autoPromote ? ' dashboard-cell-fixed' : ''}${dragging ? ' dragging' : ''}${dragOver ? ' drag-over' : ''}`}
      style={gridStyle}
      data-card-key={cardKey}
    >
      {/* A dedicated slim bar above the card's own content — not overlaid
          on top of it — so it never collides with a card's own top-right
          control (Net worth's eye toggle) or top-left icon. */}
      <button
        type="button"
        className="dashboard-drag-handle"
        aria-label="Reorder"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      >
        <i className="fa-solid fa-grip-lines" aria-hidden="true" />
      </button>
      {children}
    </div>
  )
}

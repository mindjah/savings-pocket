import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const HEADER_ACTIONS_ID = 'app-header-actions'
export const HEADER_TITLE_ID = 'app-header-title'

function usePortalNode(id: string): HTMLElement | null {
  const [node, setNode] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setNode(document.getElementById(id))
  }, [id])

  return node
}

// Renders into the mobile top app-header (hidden entirely on desktop, where
// callers should render their own inline action instead).
export function HeaderPortal({ children }: { children: ReactNode }) {
  const node = usePortalNode(HEADER_ACTIONS_ID)
  if (!node) return null
  return createPortal(children, node)
}

// Replaces the app-header's <h1> content — App.tsx leaves it empty for
// whichever tab renders one of these instead of the static per-tab title
// (see TITLES in App.tsx), so there's no flash of the default title before
// this takes over.
export function HeaderTitlePortal({ children }: { children: ReactNode }) {
  const node = usePortalNode(HEADER_TITLE_ID)
  if (!node) return null
  return createPortal(children, node)
}

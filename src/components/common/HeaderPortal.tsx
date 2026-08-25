import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const HEADER_ACTIONS_ID = 'app-header-actions'

// Renders into the mobile top app-header (hidden entirely on desktop, where
// callers should render their own inline action instead).
export function HeaderPortal({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setNode(document.getElementById(HEADER_ACTIONS_ID))
  }, [])

  if (!node) return null
  return createPortal(children, node)
}

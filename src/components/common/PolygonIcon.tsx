export function PolygonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#8247E5" />
      <text x="16" y="21" textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif" fill="#fff">
        P
      </text>
    </svg>
  )
}

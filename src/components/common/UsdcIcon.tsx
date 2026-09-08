export function UsdcIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <text x="16" y="21" textAnchor="middle" fontSize="15" fontWeight="700" fontFamily="Arial, sans-serif" fill="#fff">
        $
      </text>
    </svg>
  )
}

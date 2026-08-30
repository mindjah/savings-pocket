export function WarningIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <line x1="12" y1="4" x2="12" y2="14" />
      <circle cx="12" cy="19.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0088CC" />
      <rect x="10.5" y="10.5" width="11" height="11" rx="3" transform="rotate(45 16 16)" fill="#fff" />
    </svg>
  )
}

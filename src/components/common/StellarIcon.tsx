export function StellarIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#000" />
      <path fill="#fff" d="M16 7.5 17.8 13.7 24 15.5 17.8 17.3 16 23.5 14.2 17.3 8 15.5 14.2 13.7Z" />
    </svg>
  )
}

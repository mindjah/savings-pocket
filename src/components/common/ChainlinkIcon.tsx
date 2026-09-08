export function ChainlinkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#2A5ADA" />
      <path
        fill="#fff"
        d="M16 7.5 21.7 10.75V17.25L16 20.5 10.3 17.25V10.75Z"
        fillOpacity="0"
        stroke="#fff"
        strokeWidth="2"
      />
      <path fill="#fff" d="m16 11 3.2 1.85v3.7L16 18.4l-3.2-1.85v-3.7Z" />
    </svg>
  )
}

export function CardanoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0033AD" />
      <g fill="#fff">
        <circle cx="16" cy="10.5" r="1.6" />
        <circle cx="16" cy="21.5" r="1.6" />
        <circle cx="10.6" cy="13.2" r="1.6" />
        <circle cx="21.4" cy="13.2" r="1.6" />
        <circle cx="10.6" cy="18.8" r="1.6" />
        <circle cx="21.4" cy="18.8" r="1.6" />
        <circle cx="16" cy="16" r="1.9" />
      </g>
    </svg>
  )
}

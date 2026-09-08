export function PolkadotIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#E6007A" />
      <g fill="#fff">
        <ellipse cx="16" cy="9" rx="3" ry="4" />
        <ellipse cx="9.5" cy="19.5" rx="3" ry="4" transform="rotate(-60 9.5 19.5)" />
        <ellipse cx="22.5" cy="19.5" rx="3" ry="4" transform="rotate(60 22.5 19.5)" />
      </g>
    </svg>
  )
}

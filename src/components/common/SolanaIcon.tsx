export function SolanaIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#9945FF" />
      <g fill="#fff">
        <path d="M10.2 19.4a.6.6 0 0 1 .42-.17h11.1c.3 0 .45.36.24.57l-2.24 2.24a.6.6 0 0 1-.42.18H8.2c-.3 0-.45-.37-.24-.58Z" />
        <path d="M10.2 9.8a.6.6 0 0 1 .42-.18h11.1c.3 0 .45.37.24.58l-2.24 2.24a.6.6 0 0 1-.42.17H8.2c-.3 0-.45-.36-.24-.57Z" />
        <path d="M21.8 14.58a.6.6 0 0 0-.42-.18h-11.1c-.3 0-.45.37-.24.58l2.24 2.24a.6.6 0 0 0 .42.17h11.1c.3 0 .45-.36.24-.57Z" />
      </g>
    </svg>
  )
}

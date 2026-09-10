export function TonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0098EA" />
      <g transform="translate(6 6) scale(0.8333)" fill="#fff">
        <path d="M18.078 3H5.922C3.687 3 2.27 5.41 3.394 7.36l7.503 13.003c.49.85 1.716.85 2.206 0L20.607 7.36C21.729 5.414 20.313 3 18.079 3zM10.89 16.464l-1.634-3.162L5.314 6.25a.689.689 0 01.606-1.03h4.969v11.244zm7.791-10.215l-3.94 7.054-1.635 3.16V5.22h4.97c.544 0 .865.578.605 1.03z" />
      </g>
    </svg>
  )
}

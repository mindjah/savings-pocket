export function EthereumIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path fill="#fff" fillOpacity="0.6" d="M16.5 4v8.87l7.5 3.35z" />
      <path fill="#fff" d="M16.5 4 9 16.22l7.5-3.35z" />
      <path fill="#fff" fillOpacity="0.6" d="M16.5 21.97v6.03L24 17.62z" />
      <path fill="#fff" d="M16.5 28v-6.03L9 17.62z" />
      <path fill="#fff" fillOpacity="0.2" d="M16.5 20.57l7.5-4.35-7.5-3.35z" />
      <path fill="#fff" fillOpacity="0.6" d="M9 16.22l7.5 4.35v-7.7z" />
    </svg>
  )
}

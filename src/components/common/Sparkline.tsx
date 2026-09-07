interface Props {
  points: number[]
  width?: number
  height?: number
  color?: string
}

export function Sparkline({ points, width = 120, height = 36, color = '#3b82f6' }: Props) {
  if (points.length < 2) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const stepX = width / (points.length - 1)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(2)} ${(height - ((p - min) / range) * height).toFixed(2)}`)
    .join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {/* style (not the stroke attribute) so a CSS var() color resolves against the current theme */}
      <path d={path} fill="none" style={{ stroke: color }} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

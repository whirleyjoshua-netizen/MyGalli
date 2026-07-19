// Tiny inline-SVG trend line. Colored via `currentColor` (set text color on a
// parent). Renders a spacer when there are too few points to draw a line.
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return <div className="h-8" />
  const max = Math.max(...values, 1)
  const w = 100
  const h = 28
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`w-full h-8 ${className ?? ''}`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

'use client'

// The Kollab sub-brand carries its own orange; these are deliberately literal
// hex values, not Tailwind galli.* tokens. Each instance mints a unique gradient
// id so two wordmarks on one page can't collide in the SVG id namespace.
import { useId } from 'react'

export function KollabWordmark({ className }: { className?: string }) {
  const gradientId = useId()
  return (
    <svg
      viewBox="0 0 300 78"
      role="img"
      aria-label="Kollab"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF6B3D" />
          <stop offset="100%" stopColor="#FF8A5B" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y="60"
        fill={`url(#${gradientId})`}
        fontFamily="var(--font-plus-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize="72"
        fontWeight="800"
        letterSpacing="-2"
      >
        Kollab
      </text>
    </svg>
  )
}

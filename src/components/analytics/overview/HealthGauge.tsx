'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import type { HealthResult } from '@/lib/data-health'

const BAND_COPY: Record<HealthResult['band'], { title: string; blurb: string }> = {
  excellent: { title: 'Excellent', blurb: 'Your page is performing great and growing!' },
  good: { title: 'Good', blurb: 'Steady growth — keep the momentum going.' },
  fair: { title: 'Fair', blurb: 'Holding steady. Try sharing to lift your numbers.' },
  'needs-attention': { title: 'Needs attention', blurb: 'Engagement is slipping this period.' },
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function HealthGauge({ health }: { health: HealthResult }) {
  if (health.insufficientData) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <h3 className="text-sm font-bold">Page Health</h3>
        <p className="mt-3 text-sm font-semibold">Not enough data yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep sharing your page — we&apos;ll score its health once there&apos;s enough traffic to be meaningful.
        </p>
      </div>
    )
  }

  const copy = BAND_COPY[health.band]
  const offset = CIRCUMFERENCE * (1 - health.score / 100)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h3 className="text-sm font-bold">Page Health</h3>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" className="stroke-muted" />
            <circle
              cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" strokeLinecap="round"
              className="stroke-galli"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{health.score}</span>
            <span className="text-[11px] text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-galli">{copy.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy.blurb}</p>
        </div>
      </div>
      {health.drivers.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {health.drivers.map((driver) => {
            const up = driver.delta >= 0
            const Icon = up ? TrendingUp : TrendingDown
            return (
              <li key={driver.key} className="flex items-center gap-2 text-sm">
                <Icon className={`h-3.5 w-3.5 ${up ? 'text-galli' : 'text-rose-500'}`} />
                <span className={up ? 'text-galli' : 'text-rose-500'}>
                  {up ? '+' : ''}{driver.delta.toLocaleString()}
                </span>
                <span className="text-muted-foreground">{driver.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

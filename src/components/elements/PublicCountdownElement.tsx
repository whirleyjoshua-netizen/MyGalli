'use client'
import { useState, useEffect } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'

export function remainingParts(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs)
  const s = Math.floor(diff / 1000)
  return { expired: diff === 0, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}

const UNITS: [keyof ReturnType<typeof remainingParts>, string][] = [['days', 'Days'], ['hours', 'Hours'], ['minutes', 'Min'], ['seconds', 'Sec']]

export function PublicCountdownElement({ element }: { element: CanvasElement }) {
  const targetMs = element.countdownTarget ? new Date(element.countdownTarget).getTime() : NaN
  const [nowMs, setNowMs] = useState(() => 0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setNowMs(Date.now())
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const color = element.countdownColor || '#39D98A'
  if (!element.countdownTarget || Number.isNaN(targetMs)) {
    return <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-xl">Set a date to start the countdown.</div>
  }
  // Before mount, render as not-yet-expired to avoid SSR/CSR mismatch flashing the expired text.
  const parts = remainingParts(targetMs, mounted ? nowMs : Math.min(nowMs, targetMs - 1000))
  return (
    <div className="text-center space-y-3">
      {element.countdownTitle && <h3 className="text-lg font-bold">{element.countdownTitle}</h3>}
      {parts.expired ? (
        <p className="text-xl font-bold" style={{ color }}>{element.countdownExpiredText || "It's here!"}</p>
      ) : (
        <div className="flex justify-center gap-2 sm:gap-3">
          {UNITS.map(([key, label]) => (
            <div key={label} className="flex flex-col items-center min-w-[56px] rounded-xl px-2 py-3" style={{ backgroundColor: `${color}1a` }}>
              <span className="text-2xl sm:text-3xl font-extrabold tabular-nums" style={{ color }}>{String(parts[key]).padStart(2, '0')}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

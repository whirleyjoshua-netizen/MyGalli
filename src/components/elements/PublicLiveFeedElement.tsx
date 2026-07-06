'use client'

import { useEffect, useRef, useState } from 'react'
import { Radio } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface LiveState {
  isLive: boolean
  valueA: number
  valueB: number
  startedAt: string | null
  lastUpdatedAt: string | null
}

const POLL_MS = 3000

export function PublicLiveFeedElement({ element }: { element: CanvasElement }) {
  const preset = element.liveFeedPreset ?? 'single'
  const title = element.liveFeedTitle ?? 'Live'
  const labelA = element.liveFeedLabelA ?? ''
  const labelB = element.liveFeedLabelB ?? ''
  const target = element.liveFeedTarget ?? 0
  const color = element.liveFeedColor ?? '#39D98A'

  const [state, setState] = useState<LiveState>({
    isLive: false, valueA: 0, valueB: 0, startedAt: null, lastUpdatedAt: null,
  })
  const inFlight = useRef(false)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      if (inFlight.current || document.visibilityState === 'hidden') return
      inFlight.current = true
      try {
        const res = await fetch(`/api/live/${element.id}`, { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as LiveState
          if (!cancelled) setState(data)
        }
      } catch {
        /* keep last known state */
      } finally {
        inFlight.current = false
      }
    }
    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [element.id])

  const liveBadge = state.isLive ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-red-600">
      <Radio className="w-3.5 h-3.5 animate-pulse" /> Live
    </span>
  ) : (
    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Not live</span>
  )

  const dim = state.isLive ? '' : 'opacity-80'

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 ${dim}`} style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {liveBadge}
      </div>

      {preset === 'single' && (
        <div className="text-center py-2">
          <div className="text-6xl font-extrabold tabular-nums" style={{ color }}>{state.valueA}</div>
          {labelA && <div className="mt-1 text-sm font-medium text-slate-500">{labelA}</div>}
        </div>
      )}

      {preset === 'versus' && (
        <div className="flex items-center justify-around py-2">
          <div className="text-center flex-1">
            <div className="text-5xl font-extrabold tabular-nums text-slate-900">{state.valueA}</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">{labelA || 'Home'}</div>
          </div>
          <div className="text-2xl font-bold text-slate-300 px-3">–</div>
          <div className="text-center flex-1">
            <div className="text-5xl font-extrabold tabular-nums text-slate-900">{state.valueB}</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">{labelB || 'Away'}</div>
          </div>
        </div>
      )}

      {preset === 'goal' && (
        <div className="py-2">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-3xl font-extrabold tabular-nums" style={{ color }}>{state.valueA}</span>
            <span className="text-sm font-medium text-slate-500">of {target}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${target > 0 ? Math.min(100, (state.valueA / target) * 100) : 0}%`, backgroundColor: color }}
            />
          </div>
          {labelA && <div className="mt-2 text-sm font-medium text-slate-500">{labelA}</div>}
        </div>
      )}
    </div>
  )
}

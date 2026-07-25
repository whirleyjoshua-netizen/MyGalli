'use client'

import { useEffect, useRef, useState } from 'react'
import { Radio } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { ValueEntry, LiveClock } from '@/lib/live-feed'
import { computeDisplayMs, formatClock } from '@/lib/live-feed-clock'

interface LiveState {
  isLive: boolean
  values: ValueEntry[]
  startedAt: string | null
  clock: LiveClock
  serverTime: string
  lastUpdatedAt: string | null
}

const POLL_MS = 3000
const TICK_MS = 250

const OFF_CLOCK: LiveClock = { mode: 'off', running: false, elapsedMs: 0, lastStartedAt: null, durationMs: null }

const IDLE_STATE: LiveState = {
  isLive: false,
  values: [],
  startedAt: null,
  clock: OFF_CLOCK,
  serverTime: new Date(0).toISOString(),
  lastUpdatedAt: null,
}

function entryLabel(entry: ValueEntry, index: number, element: CanvasElement): string {
  if (entry.label) return entry.label
  if (index === 0) return element.liveFeedLabelA ?? ''
  if (index === 1) return element.liveFeedLabelB ?? ''
  return ''
}

function getSessionId(): string {
  try {
    const existing = localStorage.getItem('lf_sid')
    if (existing) return existing
    const minted = crypto.randomUUID()
    localStorage.setItem('lf_sid', minted)
    return minted
  } catch {
    return crypto.randomUUID()
  }
}

export function PublicLiveFeedElement({ element }: { element: CanvasElement }) {
  const preset = element.liveFeedPreset ?? 'single'
  const title = element.liveFeedTitle ?? 'Live'
  const target = element.liveFeedTarget ?? 0
  const color = element.liveFeedColor ?? '#39D98A'

  const [state, setState] = useState<LiveState>(IDLE_STATE)
  const [displayMs, setDisplayMs] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const inFlight = useRef(false)
  const anchorRef = useRef(performance.now())

  useEffect(() => {
    try {
      setHasVoted(Boolean(localStorage.getItem(`lf_voted_${element.id}`)))
    } catch {
      /* ignore storage errors */
    }
  }, [element.id])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      if (inFlight.current || document.visibilityState === 'hidden') return
      inFlight.current = true
      try {
        const res = await fetch(`/api/live/${element.id}`, { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as LiveState
          if (!cancelled) {
            setState(data)
            anchorRef.current = performance.now()
          }
        }
      } catch {
        /* keep last known state */
      } finally {
        inFlight.current = false
      }
    }
    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [element.id])

  useEffect(() => {
    if (state.clock.mode === 'off') return
    const tick = () => {
      setDisplayMs(computeDisplayMs(state.clock, state.serverTime, performance.now() - anchorRef.current))
    }
    tick()
    const timer = setInterval(tick, TICK_MS)
    return () => clearInterval(timer)
  }, [state.clock, state.serverTime])

  const handleVote = async (optionId: string) => {
    try {
      const sessionId = getSessionId()
      await fetch(`/api/live/${element.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, sessionId }),
      })
    } catch {
      /* ignore network errors; still mark voted locally */
    } finally {
      setHasVoted(true)
      try {
        localStorage.setItem(`lf_voted_${element.id}`, '1')
      } catch {
        /* ignore storage errors */
      }
    }
  }

  const liveBadge = state.isLive ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-red-600">
      <Radio className="w-3.5 h-3.5 animate-pulse" /> Live
    </span>
  ) : (
    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Not live</span>
  )

  const dim = state.isLive ? '' : 'opacity-80'
  const values = state.values

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 ${dim}`} style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {liveBadge}
      </div>

      {(preset === 'single' || preset === 'goal') && (() => {
        const value = values[0]?.value ?? 0
        const label = values[0] ? entryLabel(values[0], 0, element) : element.liveFeedLabelA ?? ''
        if (preset === 'goal') {
          return (
            <div className="py-2">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-3xl font-extrabold tabular-nums" style={{ color }}>{value}</span>
                <span className="text-sm font-medium text-slate-500">of {target}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${target > 0 ? Math.min(100, (value / target) * 100) : 0}%`, backgroundColor: color }}
                />
              </div>
              {label && <div className="mt-2 text-sm font-medium text-slate-500">{label}</div>}
            </div>
          )
        }
        return (
          <div className="text-center py-2">
            <div className="text-6xl font-extrabold tabular-nums" style={{ color }}>{value}</div>
            {label && <div className="mt-1 text-sm font-medium text-slate-500">{label}</div>}
          </div>
        )
      })()}

      {preset === 'versus' && (() => {
        const a = values[0]
        const b = values[1]
        const labelA = a ? entryLabel(a, 0, element) : element.liveFeedLabelA ?? 'Home'
        const labelB = b ? entryLabel(b, 1, element) : element.liveFeedLabelB ?? 'Away'
        return (
          <div className="flex items-center justify-around py-2">
            <div className="text-center flex-1">
              <div className="text-5xl font-extrabold tabular-nums text-slate-900">{a?.value ?? 0}</div>
              <div className="mt-1 text-sm font-semibold text-slate-600">{labelA}</div>
            </div>
            <div className="text-2xl font-bold text-slate-300 px-3">–</div>
            <div className="text-center flex-1">
              <div className="text-5xl font-extrabold tabular-nums text-slate-900">{b?.value ?? 0}</div>
              <div className="mt-1 text-sm font-semibold text-slate-600">{labelB}</div>
            </div>
          </div>
        )
      })()}

      {preset === 'leaderboard' && (() => {
        const ranked = [...values].sort((x, y) => y.value - x.value)
        return (
          <div className="py-2 space-y-2">
            {ranked.map((entry, index) => (
              <div
                key={entry.id}
                data-testid="lf-rank"
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5">{index + 1}</span>
                  <span className="text-sm font-semibold text-slate-800">{entry.label || `Entry ${index + 1}`}</span>
                </div>
                <span className="text-lg font-extrabold tabular-nums" style={{ color }}>{entry.value}</span>
              </div>
            ))}
          </div>
        )
      })()}

      {preset === 'poll' && (() => {
        const sum = values.reduce((n, v) => n + v.value, 0)
        const revealAlways = element.liveFeedPollReveal !== 'after-vote'
        const showTallies = revealAlways || hasVoted
        return (
          <div className="py-2 space-y-2">
            {values.map((entry, index) => {
              const pct = sum > 0 ? (entry.value / sum) * 100 : 0
              const label = entryLabel(entry, index, element) || `Option ${index + 1}`
              if (!showTallies) {
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleVote(entry.id)}
                    className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {label}
                  </button>
                )
              }
              return (
                <div key={entry.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-800">{label}</span>
                    <span className="text-sm font-medium text-slate-500">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {state.clock.mode !== 'off' && (
        <div className="mt-4 text-center">
          <time className="text-2xl font-extrabold tabular-nums text-slate-900">{formatClock(displayMs)}</time>
        </div>
      )}
    </div>
  )
}

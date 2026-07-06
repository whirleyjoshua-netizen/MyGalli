'use client'

import { use, useEffect, useState } from 'react'
import { Radio, Plus, Minus, RotateCcw } from 'lucide-react'
import type { LiveAction } from '@/lib/live-feed'

interface LiveState {
  isLive: boolean
  valueA: number
  valueB: number
  startedAt: string | null
  lastUpdatedAt: string | null
}

export default function LiveControlPage({ params }: { params: Promise<{ liveFeedId: string }> }) {
  const { liveFeedId } = use(params)
  const [state, setState] = useState<LiveState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/live/${liveFeedId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (cancelled) return
        if (!r.ok) { setError('Could not load this live feed. Please try again.'); return }
        setState(await r.json())
      })
      .catch(() => { if (!cancelled) setError('Could not load this live feed.') })
    return () => { cancelled = true }
  }, [liveFeedId])

  const send = async (action: LiveAction) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/live/${liveFeedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      })
      if (res.status === 404) { setError('Save your page first, then reopen this link.'); return }
      if (res.status === 401 || res.status === 403) { setError('You must be signed in as the page owner.'); return }
      if (res.ok) setState(await res.json())
    } catch {
      setError('Network error — try again.')
    } finally {
      setBusy(false)
    }
  }

  if (error && !state) {
    return <div className="min-h-screen grid place-items-center p-6 text-center text-slate-600">{error}</div>
  }
  if (!state) {
    return <div className="min-h-screen grid place-items-center text-slate-400">Loading…</div>
  }

  const stepper = (side: 'A' | 'B', value: number, label: string) => (
    <div className="flex-1 text-center">
      <div className="text-sm font-semibold text-slate-500 mb-2">{label}</div>
      <div className="text-6xl font-extrabold tabular-nums text-slate-900 mb-4">{value}</div>
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => send({ action: 'bump', side, delta: -1 })} className="w-16 h-16 rounded-full bg-slate-200 active:bg-slate-300 grid place-items-center" aria-label={`Decrease ${label}`}>
          <Minus className="w-7 h-7" />
        </button>
        <button onClick={() => send({ action: 'bump', side, delta: 1 })} className="w-16 h-16 rounded-full bg-primary text-primary-foreground active:brightness-95 grid place-items-center" aria-label={`Increase ${label}`}>
          <Plus className="w-7 h-7" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-5 gap-6 max-w-md mx-auto">
      <header className="flex items-center justify-between pt-2">
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
          <Radio className="w-5 h-5 text-primary" /> Live Control
        </span>
        <span className={`text-xs font-bold uppercase tracking-wide ${state.isLive ? 'text-red-600' : 'text-slate-400'}`}>
          {state.isLive ? '● Live' : 'Off'}
        </span>
      </header>

      {error && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">{error}</div>}

      <div className="flex items-start gap-4 bg-white rounded-2xl border border-slate-200 p-6">
        {stepper('A', state.valueA, 'Side A')}
        {stepper('B', state.valueB, 'Side B')}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {state.isLive ? (
          <button onClick={() => send({ action: 'end' })} disabled={busy} className="col-span-2 py-4 rounded-xl bg-slate-800 text-white font-bold disabled:opacity-50">End broadcast</button>
        ) : (
          <button onClick={() => send({ action: 'start' })} disabled={busy} className="col-span-2 py-4 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50">Go Live</button>
        )}
        <button onClick={() => send({ action: 'reset' })} disabled={busy} className="col-span-2 py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>

      <p className="text-center text-xs text-slate-400">Single & goal presets use Side A. Versus uses both.</p>
    </div>
  )
}

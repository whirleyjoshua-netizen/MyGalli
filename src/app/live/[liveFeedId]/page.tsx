'use client'

import { use, useEffect, useRef, useState } from 'react'
import { Radio, Plus, Minus, RotateCcw, Trash2, Pencil, Play, Pause, Timer } from 'lucide-react'
import type { LiveAction, LiveClock, ValueEntry } from '@/lib/live-feed'
import { computeDisplayMs, formatClock } from '@/lib/live-feed-clock'

interface LiveState {
  isLive: boolean
  values: ValueEntry[]
  startedAt: string | null
  clock: LiveClock
  serverTime: string
  lastUpdatedAt: string | null
}

const CLOCK_MODES: Array<{ value: LiveClock['mode']; label: string }> = [
  { value: 'off', label: 'No clock' },
  { value: 'countup', label: 'Count up' },
  { value: 'countdown', label: 'Count down' },
]

export default function LiveControlPage({ params }: { params: Promise<{ liveFeedId: string }> }) {
  const { liveFeedId } = use(params)
  const [state, setState] = useState<LiveState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(1)
  const anchorRef = useRef(performance.now())
  const seedingRef = useRef(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState('')
  const [setDrafts, setSetDrafts] = useState<Record<string, string>>({})
  const [newLabel, setNewLabel] = useState('')

  const [clockModeDraft, setClockModeDraft] = useState<LiveClock['mode']>('off')
  const [clockDurationDraft, setClockDurationDraft] = useState('')
  const [clockSetDraft, setClockSetDraft] = useState('')
  const [displayMs, setDisplayMs] = useState(0)

  useEffect(() => {
    const s = Number(new URLSearchParams(window.location.search).get('step'))
    if (Number.isFinite(s) && s >= 1) setStep(Math.floor(s))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/live/${liveFeedId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (cancelled) return
        if (!r.ok) { setError('Could not load this live feed. Please try again.'); return }
        const data = (await r.json()) as LiveState
        setState(data)
        anchorRef.current = performance.now()
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
      if (res.ok) {
        const data = (await res.json()) as LiveState
        setState(data)
        anchorRef.current = performance.now()
      }
    } catch {
      setError('Network error — try again.')
    } finally {
      setBusy(false)
    }
  }

  // Auto-seed: the first time this feed shows zero values (a brand-new feed,
  // or right after Reset), create one real row immediately so the owner's
  // very first tap already lands on a persisted entry instead of a phantom
  // one. This page only ever receives `liveFeedId` (and an optional `step`
  // query param) — it has no way to see which preset (single/versus/
  // leaderboard/poll) the element on the canvas is using — so it seeds
  // conservatively with a single row and leaves the Add control to build out
  // anything wider.
  useEffect(() => {
    if (!state || state.values.length > 0 || seedingRef.current) return
    seedingRef.current = true
    void send({ action: 'addValue', id: '', label: 'Value' }).finally(() => {
      seedingRef.current = false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useEffect(() => {
    if (!state) return
    setClockModeDraft(state.clock.mode)
    setClockDurationDraft(state.clock.durationMs != null ? String(Math.round(state.clock.durationMs / 1000)) : '')
  }, [state?.clock.mode, state?.clock.durationMs])

  useEffect(() => {
    if (!state || state.clock.mode === 'off') return
    const tick = () => setDisplayMs(computeDisplayMs(state.clock, state.serverTime, performance.now() - anchorRef.current))
    tick()
    const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [state?.clock, state?.serverTime])

  if (error && !state) {
    return <div className="min-h-screen grid place-items-center p-6 text-center text-slate-600">{error}</div>
  }
  if (!state) {
    return <div className="min-h-screen grid place-items-center text-slate-400">Loading…</div>
  }

  const startEdit = (v: ValueEntry) => {
    setEditingId(v.id)
    setLabelDraft(v.label)
  }
  const commitEdit = (id: string) => {
    const label = labelDraft.trim()
    setEditingId(null)
    if (label) void send({ action: 'renameValue', id, label })
  }

  const setDraftFor = (v: ValueEntry) => setDrafts[v.id] ?? String(v.value)
  const commitSet = (v: ValueEntry) => {
    const raw = setDrafts[v.id] ?? String(v.value)
    const parsed = Number(raw)
    setSetDrafts((prev) => {
      const next = { ...prev }
      delete next[v.id]
      return next
    })
    if (Number.isFinite(parsed)) void send({ action: 'set', id: v.id, value: parsed })
  }

  const addRow = () => {
    const label = newLabel.trim()
    if (!label) return
    setNewLabel('')
    void send({ action: 'addValue', id: '', label })
  }

  const applyClockConfig = () => {
    const durationMs = clockModeDraft === 'countdown' ? Math.max(0, Number(clockDurationDraft) || 0) * 1000 : undefined
    void send({ action: 'clockConfig', mode: clockModeDraft, durationMs })
  }

  const applyClockSet = () => {
    const seconds = Number(clockSetDraft)
    if (!Number.isFinite(seconds) || seconds < 0) return
    void send({ action: 'clockSet', elapsedMs: Math.round(seconds * 1000) })
  }

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

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-4">
        {state.values.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-4">Setting up your tracker…</div>
        ) : (
          state.values.map((v) => (
            <div key={v.id} className="flex flex-col gap-2 border-b border-slate-100 last:border-b-0 pb-4 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                {editingId === v.id ? (
                  <input
                    autoFocus
                    value={labelDraft}
                    onChange={(e) => setLabelDraft(e.target.value)}
                    onBlur={() => commitEdit(v.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(v.id); if (e.key === 'Escape') setEditingId(null) }}
                    className="flex-1 text-sm font-semibold text-slate-700 border border-slate-300 rounded px-2 py-1"
                  />
                ) : (
                  <button
                    onClick={() => startEdit(v)}
                    className="flex-1 text-left text-sm font-semibold text-slate-600 inline-flex items-center gap-1"
                  >
                    {v.label || 'Untitled'} <Pencil className="w-3 h-3 text-slate-300" />
                  </button>
                )}
                <button
                  onClick={() => void send({ action: 'removeValue', id: v.id })}
                  disabled={busy}
                  aria-label={`Remove ${v.label || 'value'}`}
                  className="p-1.5 text-slate-300 hover:text-red-500 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => void send({ action: 'bump', id: v.id, delta: -step })}
                  disabled={busy}
                  aria-label={`Decrease ${v.label || 'value'}`}
                  className="w-12 h-12 rounded-full bg-slate-200 active:bg-slate-300 grid place-items-center disabled:opacity-50"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <div className="text-4xl font-extrabold tabular-nums text-slate-900 min-w-[3ch] text-center">{v.value}</div>
                <button
                  onClick={() => void send({ action: 'bump', id: v.id, delta: step })}
                  disabled={busy}
                  aria-label={`Increase ${v.label || 'value'}`}
                  className="w-12 h-12 rounded-full bg-primary text-primary-foreground active:brightness-95 grid place-items-center disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2 justify-center">
                <input
                  type="number"
                  value={setDraftFor(v)}
                  onChange={(e) => setSetDrafts((prev) => ({ ...prev, [v.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitSet(v) }}
                  className="w-24 text-sm text-center border border-slate-200 rounded-lg px-2 py-1"
                  aria-label={`Set exact value for ${v.label || 'value'}`}
                />
                <button onClick={() => commitSet(v)} disabled={busy} className="text-xs font-semibold text-slate-500 px-2 py-1 rounded-lg border border-slate-200 disabled:opacity-50">
                  Set
                </button>
              </div>
            </div>
          ))
        )}

        <div className="flex items-center gap-2 pt-1">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addRow() }}
            placeholder="New row label"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2"
          />
          <button onClick={addRow} disabled={busy || !newLabel.trim()} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Timer className="w-4 h-4" /> Clock
        </div>
        <div className="flex items-center gap-2">
          <select
            value={clockModeDraft}
            onChange={(e) => setClockModeDraft(e.target.value as LiveClock['mode'])}
            className="flex-1 border border-slate-200 rounded-lg px-2 py-2 text-sm"
          >
            {CLOCK_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {clockModeDraft === 'countdown' && (
            <input
              type="number"
              min={0}
              value={clockDurationDraft}
              onChange={(e) => setClockDurationDraft(e.target.value)}
              placeholder="Seconds"
              className="w-24 border border-slate-200 rounded-lg px-2 py-2 text-sm"
            />
          )}
          <button onClick={applyClockConfig} disabled={busy} className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 disabled:opacity-50">
            Apply
          </button>
        </div>

        {state.clock.mode !== 'off' && (
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
            <time className="text-3xl font-extrabold tabular-nums text-center text-slate-900">{formatClock(displayMs)}</time>
            <div className="flex items-center justify-center gap-3">
              {state.clock.running ? (
                <button onClick={() => void send({ action: 'clockPause' })} disabled={busy} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
                  <Pause className="w-4 h-4" /> Pause
                </button>
              ) : (
                <button onClick={() => void send({ action: 'clockStart' })} disabled={busy} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
                  <Play className="w-4 h-4" /> Start
                </button>
              )}
              <button onClick={() => void send({ action: 'clockReset' })} disabled={busy} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <input
                type="number"
                min={0}
                value={clockSetDraft}
                onChange={(e) => setClockSetDraft(e.target.value)}
                placeholder="Seconds"
                className="w-24 text-sm text-center border border-slate-200 rounded-lg px-2 py-1"
              />
              <button onClick={applyClockSet} disabled={busy} className="text-xs font-semibold text-slate-500 px-2 py-1 rounded-lg border border-slate-200 disabled:opacity-50">
                Set time
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {state.isLive ? (
          <button onClick={() => void send({ action: 'end' })} disabled={busy} className="col-span-2 py-4 rounded-xl bg-slate-800 text-white font-bold disabled:opacity-50">End broadcast</button>
        ) : (
          <button onClick={() => void send({ action: 'start' })} disabled={busy} className="col-span-2 py-4 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50">Go Live</button>
        )}
        <button onClick={() => void send({ action: 'reset' })} disabled={busy} className="col-span-2 py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>

      <p className="text-center text-xs text-slate-400">Tap a label to rename it. Add or remove rows to match your tracker.</p>
    </div>
  )
}

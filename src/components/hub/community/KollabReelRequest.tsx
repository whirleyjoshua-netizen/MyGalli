'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

const PRESETS = [
  { key: 'recent', label: "This week's recap", hint: '~30s' },
  { key: 'best', label: 'Best of the pool', hint: '~45s' },
  { key: 'event', label: 'From an event', hint: 'last 2 days' },
  { key: 'everyone', label: "Everyone's drops", hint: '~60s' },
] as const

const LENGTHS = [15, 30, 45, 60]

export function KollabReelRequest({
  onSubmit, onClose, busy, error,
}: {
  onSubmit: (v: { preset: string; prompt: string | null; targetSec: number }) => void
  onClose: () => void
  busy: boolean
  error: string | null
}) {
  const [preset, setPreset] = useState<string>('recent')
  const [prompt, setPrompt] = useState('')
  const [targetSec, setTargetSec] = useState(30)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Make a reel">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">Make a reel</h2>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Reel type</legend>
          {PRESETS.map((p) => (
            <label key={p.key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <input
                type="radio"
                name="preset"
                value={p.key}
                aria-label={p.label}
                checked={preset === p.key}
                onChange={() => setPreset(p.key)}
              />
              <span className="flex-1">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.hint}</span>
            </label>
          ))}
        </fieldset>

        <label className="mt-4 block text-sm">
          <span className="text-muted-foreground">or describe it:</span>
          <textarea
            value={prompt}
            maxLength={200}
            rows={2}
            placeholder="describe it — e.g. the goals and the crowd"
            onChange={(e) => setPrompt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Length</span>
          <select
            value={targetSec}
            aria-label="Length"
            onChange={(e) => setTargetSec(Number(e.target.value))}
            className="rounded-lg border border-border bg-transparent px-2 py-1 text-sm"
          >
            {LENGTHS.map((s) => <option key={s} value={s}>{s}s</option>)}
          </select>
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
          <button
            onClick={() => onSubmit({ preset, prompt: prompt.trim() || null, targetSec })}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF6B3D] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? 'Making…' : 'Make it'}
          </button>
        </div>
      </div>
    </div>
  )
}

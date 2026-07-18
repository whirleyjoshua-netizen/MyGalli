'use client'

import { useState } from 'react'
import { HUB_REACTION_EMOJI, type ReactionSummary } from '@/lib/hub-reactions'

export function ReactionBar({
  postId,
  basePath,
  initial,
  disabled,
}: {
  postId: string
  basePath: string
  initial: ReactionSummary
  disabled?: boolean
}) {
  const [counts, setCounts] = useState<Record<string, number>>(initial.counts)
  const [mine, setMine] = useState<string[]>(initial.mine)
  const [open, setOpen] = useState(false)

  async function toggle(emoji: string) {
    if (disabled) return
    const prevCounts = counts
    const prevMine = mine
    const has = mine.includes(emoji)
    const method = has ? 'DELETE' : 'POST'
    // optimistic
    setMine((m) => (has ? m.filter((e) => e !== emoji) : [...m, emoji]))
    setCounts((c) => ({ ...c, [emoji]: Math.max(0, (c[emoji] || 0) + (has ? -1 : 1)) }))
    try {
      const res = await fetch(`${basePath}/${postId}/reactions`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
      if (res.status === 401) { window.location.href = '/login'; return }
      if (res.ok) {
        const d = await res.json()
        setCounts(d.counts)
        setMine(d.mine)
      } else {
        setCounts(prevCounts)
        setMine(prevMine)
      }
    } catch {
      setCounts(prevCounts)
      setMine(prevMine)
    }
    setOpen(false)
  }

  const active = HUB_REACTION_EMOJI.filter((e) => (counts[e] || 0) > 0)

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      {active.map((e) => (
        <button
          key={e}
          onClick={() => toggle(e)}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
            mine.includes(e) ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>{e}</span> <span>{counts[e]}</span>
        </button>
      ))}
      {!disabled && (
        <div className="relative">
          <button onClick={() => setOpen((o) => !o)} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground" aria-label="Add reaction">
            + 😊
          </button>
          {open && (
            <div className="absolute z-10 mt-1 flex gap-1 rounded-xl border border-border bg-surface p-1.5 shadow-soft">
              {HUB_REACTION_EMOJI.map((e) => (
                <button key={e} onClick={() => toggle(e)} className="rounded-lg px-1 text-lg hover:bg-muted">{e}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

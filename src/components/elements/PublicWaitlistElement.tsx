'use client'

import { useEffect, useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'
import { isFull, progressPercent, spotsRemaining, waitlistCountdownParts } from '@/lib/waitlist'

export function PublicWaitlistElement({ element, displayId }: { element: CanvasElement; displayId: string }) {
  const capacity = element.waitlistCapacity ?? null
  const [count, setCount] = useState(0)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/waitlist/${displayId}/${element.id}/count`)
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => { if (alive) setCount(d.count ?? 0) })
      .catch(() => {})
    return () => { alive = false }
  }, [displayId, element.id])

  const full = isFull(count, capacity)
  const parts = element.waitlistShowCountdown ? waitlistCountdownParts(element.waitlistLaunchDate, new Date()) : null

  async function join(e: React.FormEvent) {
    e.preventDefault()
    if (busy || full) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayId, elementId: element.id, email, name: name || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (typeof data.count === 'number') setCount(data.count)
        setJoined(true)
      } else {
        setError(data.error || 'Something went wrong')
        if (typeof data.count === 'number') setCount(data.count)
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const remaining = spotsRemaining(count, capacity)

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-soft">
      {element.waitlistStyle === 'hero' && element.waitlistCoverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={element.waitlistCoverImage} alt="" className="w-full h-40 object-cover" />
      )}
      <div className="p-5 space-y-3">
        {element.waitlistTitle && <h3 className="text-xl font-extrabold tracking-tight">{element.waitlistTitle}</h3>}
        {element.waitlistDescription && <p className="text-sm text-muted-foreground">{element.waitlistDescription}</p>}

        {parts && (
          <p className="text-sm font-semibold text-galli-dark">
            {parts.isPast ? 'Launching now' : `Opens in ${parts.days}d ${parts.hours}h ${parts.minutes}m`}
          </p>
        )}

        {capacity != null && (
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-galli" style={{ width: `${progressPercent(count, capacity)}%` }} />
            </div>
            <p className="text-xs font-medium text-muted-foreground">{count} / {capacity} spots reserved</p>
          </div>
        )}

        {element.waitlistShowCount && capacity == null && (
          <p className="text-sm font-semibold">{count.toLocaleString()} {count === 1 ? 'person is' : 'people are'} already waiting.</p>
        )}

        {joined ? (
          <p className="rounded-xl bg-galli/10 px-4 py-3 text-sm font-semibold text-galli-dark">
            {element.waitlistConfirmationMessage || "You're on the list! 🎉"}
          </p>
        ) : (
          <form onSubmit={join} className="space-y-2">
            {element.waitlistCollectName && (
              <input
                aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              />
            )}
            <input
              aria-label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit" disabled={busy || full}
              className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-105 disabled:opacity-50"
            >
              {full ? 'Wait list full' : busy ? 'Joining…' : (element.waitlistButtonLabel || 'Join Wait List')}
            </button>
            {remaining != null && !full && (
              <p className="text-center text-xs text-muted-foreground">{remaining} spots left</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

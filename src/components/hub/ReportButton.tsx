'use client'

import { useState } from 'react'
import { Flag, X, Loader2 } from 'lucide-react'

const REASONS: { value: 'spam' | 'harassment' | 'explicit' | 'violence' | 'other'; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'explicit', label: 'Explicit content' },
  { value: 'violence', label: 'Violence' },
  { value: 'other', label: 'Other' },
]

export function ReportButton({
  hubId, targetType, targetId, authorId, currentUserId, className,
}: {
  hubId: string
  targetType: 'post' | 'comment' | 'drop' | 'member'
  targetId: string
  authorId?: string
  currentUserId?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<typeof REASONS[number]['value'] | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Reporting your own content is noise — never show it to the author.
  if (authorId && currentUserId && authorId === currentUserId) return null

  async function submit() {
    if (!reason || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/hubs/${hubId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason }),
      })
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || 'Could not submit report')
        setBusy(false)
        return
      }
      setDone(true)
      setBusy(false)
    } catch {
      setError('Could not submit report')
      setBusy(false)
    }
  }

  function close() {
    setOpen(false)
    setReason('')
    setError(null)
    setDone(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Report"
        aria-label="Report"
        className={className ?? 'text-muted-foreground hover:text-destructive'}
      >
        <Flag className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">Report</h2>
              <button onClick={close} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            {done ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground">Thanks — a moderator will take a look.</p>
                <div className="flex justify-end">
                  <button onClick={close} className="rounded-lg bg-galli px-4 py-2 text-sm font-medium text-white">Done</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Why are you reporting this?</p>
                <div className="space-y-1.5">
                  {REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-galli"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={close} className="rounded-lg px-4 py-2 text-sm text-muted-foreground">Cancel</button>
                  <button
                    onClick={submit}
                    disabled={busy || !reason}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-galli px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

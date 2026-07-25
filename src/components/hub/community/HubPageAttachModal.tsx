'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

type Candidate = { id: string; title: string; slug: string; published: boolean; kind: string }

export function HubPageAttachModal({
  hubId, attachedDisplayIds, onClose, onAttached,
}: {
  hubId: string
  attachedDisplayIds: string[]
  onClose: () => void
  onAttached: () => void
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/displays')
      .then((r) => (r.ok ? r.json() : []))
      // Boards are not attachable, so they never enter the list at all.
      .then((rows: Candidate[]) => setCandidates(Array.isArray(rows) ? rows.filter((d) => d.kind !== 'collection') : []))
      .catch(() => setCandidates([]))
  }, [])

  async function attach(displayId: string) {
    setBusy(displayId)
    setError(null)
    try {
      const res = await fetch(`/api/hubs/${hubId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayId }),
      })
      setBusy(null)
      if (res.ok) { onAttached(); onClose(); return }
      const data = await res.json().catch(() => ({}))
      setError(data?.error || 'Could not attach that Page.')
    } catch {
      setBusy(null)
      setError('Could not attach that Page. Check your connection and try again.')
    }
  }

  return (
    <div role="dialog" aria-label="Attach a Page" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-soft-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Attach a Page</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <ul className="space-y-2">
          {candidates.map((d) => {
            const already = attachedDisplayIds.includes(d.id)
            const disabled = already || !d.published || busy === d.id
            return (
              <li key={d.id}>
                <button
                  onClick={() => attach(d.id)}
                  disabled={disabled}
                  className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm disabled:opacity-50"
                >
                  <span className="min-w-0 truncate">{d.title}</span>
                  {already ? (
                    <span className="shrink-0 text-xs text-muted-foreground">already added</span>
                  ) : !d.published ? (
                    <span className="shrink-0 text-xs text-muted-foreground">publish first</span>
                  ) : null}
                </button>
              </li>
            )
          })}
          {candidates.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">You have no Pages yet.</li>
          )}
        </ul>
      </div>
    </div>
  )
}

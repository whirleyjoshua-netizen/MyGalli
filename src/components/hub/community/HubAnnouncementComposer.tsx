'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ANNOUNCEMENT_MAX, type AnnouncementDTO } from '@/lib/hub-announcements'

export function HubAnnouncementComposer({
  hubId, onCreated, onClose, currentUser,
}: {
  hubId: string
  onCreated: (a: AnnouncementDTO) => void
  onClose: () => void
  currentUser: { username: string; name: string | null; avatar: string | null }
}) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = body.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/hubs/${hubId}/announcements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: trimmed }),
      })
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Could not post'); return }
      const { id } = await res.json()
      onCreated({ id, body: trimmed, createdAt: new Date().toISOString(), author: currentUser })
      setBody('')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, ANNOUNCEMENT_MAX))}
        placeholder="Share an announcement with your members…"
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-[11px] text-muted-foreground">{body.length}/{ANNOUNCEMENT_MAX}</span>
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
        <button onClick={submit} disabled={busy || !body.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-galli px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Post
        </button>
      </div>
    </div>
  )
}

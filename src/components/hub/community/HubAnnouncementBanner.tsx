'use client'

import { useState } from 'react'
import { Megaphone, ChevronLeft, ChevronRight, X, Plus } from 'lucide-react'
import type { AnnouncementDTO } from '@/lib/hub-announcements'
import { HubAnnouncementComposer } from './HubAnnouncementComposer'

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function HubAnnouncementBanner({
  hubId, isPrivileged, initial,
}: {
  hubId: string
  isPrivileged: boolean
  initial: AnnouncementDTO[]
}) {
  const [items, setItems] = useState<AnnouncementDTO[]>(initial)
  const [idx, setIdx] = useState(0)
  const [composing, setComposing] = useState(false)

  const current = items[idx]

  async function remove(id: string) {
    if (!confirm('Delete this announcement?')) return
    const res = await fetch(`/api/hubs/${hubId}/announcements/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems((cur) => {
        const next = cur.filter((a) => a.id !== id)
        setIdx((i) => Math.min(i, Math.max(0, next.length - 1)))
        return next
      })
    }
  }

  // Empty: members see nothing; privileged see a discoverable prompt.
  if (items.length === 0 && !composing) {
    if (!isPrivileged) return null
    return (
      <button onClick={() => setComposing(true)} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50">
        <Megaphone className="h-4 w-4 text-primary" /> Post your first announcement
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-galli/30 bg-galli/5 px-4 py-3">
      {composing ? (
        <HubAnnouncementComposer
          hubId={hubId}
          currentUser={{ username: 'you', name: null, avatar: null }}
          onClose={() => setComposing(false)}
          onCreated={(a) => { setItems((cur) => [a, ...cur]); setIdx(0) }}
        />
      ) : current ? (
        <div className="flex items-start gap-3">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">{current.body}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">posted {timeAgo(current.createdAt)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {items.length > 1 && (
              <>
                <button aria-label="Previous announcement" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-[11px] text-muted-foreground">{idx + 1}/{items.length}</span>
                <button aria-label="Next announcement" disabled={idx >= items.length - 1} onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </>
            )}
            {isPrivileged && (
              <>
                <button aria-label="Post announcement" onClick={() => setComposing(true)} className="rounded p-1 text-muted-foreground hover:bg-muted"><Plus className="h-4 w-4" /></button>
                <button aria-label="Delete announcement" onClick={() => remove(current.id)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

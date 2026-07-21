'use client'

import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { DropDTO } from '@/lib/hub-drops'
import { KollabGrid } from './KollabGrid'

type Tab = 'approved' | 'pending'

export function KollabViewer({
  hubId, isPrivileged, currentUserId, initialDrops, total, onClose, onApprovedCountChange, onPendingCountChange, pendingCount = 0, initialTab = 'approved',
}: {
  hubId: string
  isPrivileged: boolean
  currentUserId?: string
  initialDrops: DropDTO[]
  total: number
  onClose: () => void
  onApprovedCountChange: (delta: number) => void
  onPendingCountChange: (delta: number) => void
  pendingCount?: number
  initialTab?: Tab
}) {
  // A non-privileged viewer can never land on (or see) the Pending tab,
  // regardless of what the caller asks for.
  const startTab: Tab = initialTab === 'pending' && isPrivileged ? 'pending' : 'approved'
  const [tab, setTab] = useState<Tab>(startTab)
  const [approved, setApproved] = useState<DropDTO[]>(initialDrops)
  const [approvedTotal, setApprovedTotal] = useState(total)
  const [pending, setPending] = useState<DropDTO[]>([])
  const [pendingLoaded, setPendingLoaded] = useState(false)
  const [pendingBadge, setPendingBadge] = useState(pendingCount)
  const [cursor, setCursor] = useState<string | null>(initialDrops[initialDrops.length - 1]?.id ?? null)
  const [exhausted, setExhausted] = useState(false)
  const [pendingCursor, setPendingCursor] = useState<string | null>(null)
  const [pendingExhausted, setPendingExhausted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lightbox, setLightbox] = useState<DropDTO | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (lightbox) setLightbox(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, onClose])

  // Pending is fetched lazily: a plain visitor never triggers the privileged
  // request at all, and a moderator only pays for it if they open the tab
  // (or the viewer opens straight onto it because there's a backlog).
  async function openPending() {
    setTab('pending')
    if (pendingLoaded) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/drops?status=pending`)
      if (res.ok) {
        const d = await res.json()
        setPending(d.drops ?? [])
        setPendingCursor(d.nextCursor ?? null)
        if (!d.nextCursor) setPendingExhausted(true)
      }
      setPendingLoaded(true)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (startTab === 'pending') {
      openPending()
    }
    // Only run once on mount to trigger the initial lazy fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadMorePending() {
    if (pendingExhausted || busy) return
    setBusy(true)
    try {
      const qs = pendingCursor ? `&cursor=${encodeURIComponent(pendingCursor)}` : ''
      const res = await fetch(`/api/hubs/${hubId}/drops?status=pending${qs}`)
      if (!res.ok) return
      const d = await res.json()
      const fresh: DropDTO[] = d.drops ?? []
      setPending((cur) => {
        const seen = new Set(cur.map((x) => x.id))
        return [...cur, ...fresh.filter((x) => !seen.has(x.id))]
      })
      setPendingCursor(d.nextCursor ?? null)
      if (!d.nextCursor) setPendingExhausted(true)
    } finally {
      setBusy(false)
    }
  }

  async function loadMoreApproved() {
    if (approved.length >= approvedTotal || busy) return
    setBusy(true)
    try {
      const qs = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
      const res = await fetch(`/api/hubs/${hubId}/drops?status=approved${qs}`)
      if (!res.ok) return
      const d = await res.json()
      const fresh: DropDTO[] = d.drops ?? []
      setApproved((cur) => {
        const seen = new Set(cur.map((x) => x.id))
        return [...cur, ...fresh.filter((x) => !seen.has(x.id))]
      })
      setCursor(d.nextCursor ?? null)
      if (!d.nextCursor) setExhausted(true)
    } finally {
      setBusy(false)
    }
  }

  async function review(id: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !confirm('Reject this? The file will be deleted permanently.')) return
    const item = pending.find((d) => d.id === id)
    if (!item) return
    // Optimistic: pull it out of Pending first, put it back if the call fails.
    setPending((cur) => cur.filter((d) => d.id !== id))
    setPendingBadge((c) => Math.max(0, c - 1))
    onPendingCountChange(-1)
    if (action === 'approve') {
      setApproved((cur) => [{ ...item, status: 'approved' }, ...cur])
      setApprovedTotal((c) => c + 1)
      onApprovedCountChange(1)
    }
    const res = await fetch(`/api/hubs/${hubId}/drops/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    if (!res.ok) {
      setPending((cur) => [item, ...cur])
      setPendingBadge((c) => c + 1)
      onPendingCountChange(1)
      if (action === 'approve') {
        setApproved((cur) => cur.filter((d) => d.id !== id))
        setApprovedTotal((c) => Math.max(0, c - 1))
        onApprovedCountChange(-1)
      }
      setError('That didn’t go through. Try again.')
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this from the pool?')) return
    const res = await fetch(`/api/hubs/${hubId}/drops/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setApproved((cur) => cur.filter((d) => d.id !== id))
      setApprovedTotal((c) => Math.max(0, c - 1))
      onApprovedCountChange(-1)
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${active ? 'bg-[#FF6B3D] text-white' : 'text-muted-foreground hover:bg-muted'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kollab"
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div role="tablist" className="flex gap-1">
            <button role="tab" aria-selected={tab === 'approved'} onClick={() => setTab('approved')} className={tabClass(tab === 'approved')}>
              Approved ({approvedTotal})
            </button>
            {isPrivileged && (
              <button role="tab" aria-selected={tab === 'pending'} onClick={openPending} className={tabClass(tab === 'pending')}>
                Pending ({pendingLoaded ? pending.length : pendingBadge})
              </button>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}
          {busy && !pendingLoaded && tab === 'pending' ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <KollabGrid
              drops={tab === 'approved' ? approved : pending}
              mode={tab}
              hubId={hubId}
              currentUserId={currentUserId}
              isPrivileged={isPrivileged}
              onOpen={setLightbox}
              onApprove={(id) => review(id, 'approve')}
              onReject={(id) => review(id, 'reject')}
              onRemove={remove}
            />
          )}

          {tab === 'approved' && !exhausted && approved.length < approvedTotal && (
            <div className="mt-4 text-center">
              <button onClick={loadMoreApproved} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}

          {tab === 'pending' && pendingLoaded && !pendingExhausted && (
            <div className="mt-4 text-center">
              <button onClick={loadMorePending} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 text-white" aria-label="Close preview" onClick={() => setLightbox(null)}><X className="h-6 w-6" /></button>
          <div className="max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {lightbox.type === 'video' ? (
              <video src={lightbox.url} controls autoPlay className="max-h-[80vh] w-full rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt={lightbox.caption || ''} className="max-h-[80vh] w-full rounded-lg object-contain" />
            )}
            <p className="mt-2 text-center text-sm text-white/80">
              {lightbox.caption} <span className="text-white/50">· {lightbox.author.name || lightbox.author.username}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

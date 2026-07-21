'use client'

import { useEffect, useState } from 'react'
import { X, Trash2, EyeOff } from 'lucide-react'
import type { DropDTO } from '@/lib/hub-drops'

export function HubDropsModal({ hubId, onClose }: { hubId: string; onClose: () => void }) {
  const [drops, setDrops] = useState<DropDTO[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Paginated: the owner must be able to reach every drop, or an abusive item
  // past the first page would be impossible to hide or delete from any UI.
  const load = async (after?: string | null) => {
    setLoading(true)
    try {
      const qs = after ? `?cursor=${encodeURIComponent(after)}` : ''
      const res = await fetch(`/api/hubs/${hubId}/drops${qs}`)
      const d = res.ok ? await res.json() : { drops: [], nextCursor: null }
      const fresh: DropDTO[] = d.drops ?? []
      setDrops((cur) => {
        if (!after) return fresh
        const seen = new Set(cur.map((x) => x.id))
        return [...cur, ...fresh.filter((x) => !seen.has(x.id))]
      })
      setCursor(d.nextCursor ?? null)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [hubId])

  async function reject(d: DropDTO) {
    if (!window.confirm('Reject this drop? The file will be deleted permanently.')) return
    const res = await fetch(`/api/hubs/${hubId}/drops/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject' }) })
    if (res.ok) setDrops((cur) => cur.filter((x) => x.id !== d.id))
  }
  async function remove(d: DropDTO) {
    if (!window.confirm('Delete this drop permanently?')) return
    const res = await fetch(`/api/hubs/${hubId}/drops/${d.id}`, { method: 'DELETE' })
    if (res.ok) setDrops((cur) => cur.filter((x) => x.id !== d.id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Manage drops ({drops.length}{cursor ? '+' : ''})</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {drops.length === 0 ? (
          <p className="text-sm text-muted-foreground">The pool is empty.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {drops.map((d) => (
              <div key={d.id} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                {(d.thumbnailUrl || d.type === 'image') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.thumbnailUrl || d.url} alt={d.caption ?? ''} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black/80 text-xs text-white/40">Video</div>
                )}
                <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{d.author.name ?? d.author.username}</div>
                <div className="absolute right-1 top-1 flex gap-1">
                  <button onClick={() => reject(d)} title="Reject" className="rounded bg-black/60 p-1 text-white hover:bg-black/80">
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(d)} title="Delete" className="rounded bg-black/60 p-1 text-white hover:bg-black/80"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {cursor && (
          <div className="mt-4 text-center">
            <button
              onClick={() => load(cursor)}
              disabled={loading}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

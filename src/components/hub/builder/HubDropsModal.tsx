'use client'

import { useEffect, useState } from 'react'
import { X, Trash2, Eye, EyeOff } from 'lucide-react'
import type { DropDTO } from '@/lib/hub-drops'

export function HubDropsModal({ hubId, onClose }: { hubId: string; onClose: () => void }) {
  const [drops, setDrops] = useState<DropDTO[]>([])

  const load = () => fetch(`/api/hubs/${hubId}/drops`).then((r) => (r.ok ? r.json() : { drops: [] })).then((d) => setDrops(d.drops ?? []))
  useEffect(() => { load() }, [hubId])

  async function toggleHide(d: DropDTO) {
    const res = await fetch(`/api/hubs/${hubId}/drops/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden: !d.hidden }) })
    if (res.ok) setDrops((cur) => cur.map((x) => (x.id === d.id ? { ...x, hidden: !x.hidden } : x)))
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
          <h2 className="text-lg font-bold">Manage drops ({drops.length})</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {drops.length === 0 ? (
          <p className="text-sm text-muted-foreground">The pool is empty.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {drops.map((d) => (
              <div key={d.id} className={`relative aspect-square overflow-hidden rounded-lg border border-border bg-muted ${d.hidden ? 'opacity-50' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.thumbnailUrl || (d.type === 'image' ? d.url : '')} alt={d.caption ?? ''} className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{d.author.name ?? d.author.username}</div>
                <div className="absolute right-1 top-1 flex gap-1">
                  <button onClick={() => toggleHide(d)} title={d.hidden ? 'Unhide' : 'Hide'} className="rounded bg-black/60 p-1 text-white hover:bg-black/80">
                    {d.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => remove(d)} title="Delete" className="rounded bg-black/60 p-1 text-white hover:bg-black/80"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

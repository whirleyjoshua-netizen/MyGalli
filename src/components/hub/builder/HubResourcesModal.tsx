'use client'

import { useEffect, useState } from 'react'
import { X, Trash2, FileText, Link as LinkIcon } from 'lucide-react'

type Item = { id: string; type: string; title: string; url: string | null }

export function HubResourcesModal({ hubId, onClose }: { hubId: string; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [kind, setKind] = useState<'link' | 'file'>('link')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  // The hub GET is owner-gated and already returns every item; filter to the two
  // types the public Resources widget renders.
  const load = async () => {
    const res = await fetch(`/api/hubs/${hubId}`)
    if (!res.ok) return
    const d = await res.json()
    setItems((d.items ?? []).filter((i: Item) => i.type === 'file' || i.type === 'link'))
  }
  useEffect(() => { load() }, [hubId])

  async function add() {
    if (!title.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: kind, title: title.trim(), url: url.trim() || null }),
      })
      if (!res.ok) return
      const created = await res.json()
      setItems((cur) => [...cur, { id: created.id, type: created.type, title: created.title, url: created.url }])
      setTitle(''); setUrl('')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this resource?')) return
    const res = await fetch(`/api/hubs/${hubId}/items/${id}`, { method: 'DELETE' })
    if (res.ok) setItems((cur) => cur.filter((i) => i.id !== id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Files &amp; links ({items.length})</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resources yet.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                {i.type === 'link' ? <LinkIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                <span className="flex-1 truncate text-sm">{i.title}</span>
                <button onClick={() => remove(i.id)} title="Delete" className="rounded p-1 text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as 'link' | 'file')} className="rounded-lg border border-border bg-transparent px-2 py-1 text-sm">
              <option value="link">Link</option>
              <option value="file">File</option>
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="flex-1 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm" />
          </div>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm" />
          <button onClick={add} disabled={busy || !title.trim()} className="w-full rounded-lg bg-galli py-2 text-sm font-medium text-white disabled:opacity-50">Add</button>
        </div>
      </div>
    </div>
  )
}

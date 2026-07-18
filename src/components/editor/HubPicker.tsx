'use client'

import { useEffect, useState } from 'react'
import { Boxes, UsersRound, Plus, Loader2, X } from 'lucide-react'

export type PickedHub = { id: string; slug: string; community: boolean }

type HubRow = {
  id: string
  title: string
  slug: string
  coverImage: string | null
  community: boolean
  _count: { items: number; folders: number }
}

// Picker for the Hub element: link an existing hub/community, or create a new
// one (optionally a community). onSelect hands back the linked hub so the caller
// can denormalize hubId/hubSlug/hubCommunity onto the element.
export function HubPicker({
  isOpen,
  onClose,
  onSelect,
  displayId,
}: {
  isOpen: boolean
  onClose: () => void
  onSelect: (hub: PickedHub) => void
  displayId?: string | null
}) {
  const [hubs, setHubs] = useState<HubRow[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [asCommunity, setAsCommunity] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    fetch('/api/hubs')
      .then((r) => (r.ok ? r.json() : { hubs: [] }))
      .then((d) => setHubs(Array.isArray(d?.hubs) ? d.hubs : []))
      .catch(() => setHubs([]))
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  async function createNew() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/hubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name.trim(), community: asCommunity, displayId: displayId ?? undefined }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to create')
      const hub = await res.json()
      onSelect({ id: hub.id, slug: hub.slug, community: !!hub.community })
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Add a Hub or Community</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {/* Create new */}
        <div className="rounded-xl border border-border p-4">
          <p className="mb-2 text-sm font-medium">Create new</p>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createNew()}
            placeholder="Name…"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
          />
          <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={asCommunity} onChange={(e) => setAsCommunity(e.target.checked)} className="accent-galli" />
            <UsersRound className="h-3.5 w-3.5" /> Make it a community (people can join &amp; post)
          </label>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          <button
            onClick={createNew}
            disabled={busy || !name.trim()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-galli px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create &amp; add
          </button>
        </div>

        {/* Link existing */}
        <p className="mb-2 mt-5 text-sm font-medium">Or link an existing one</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : hubs.length === 0 ? (
          <p className="text-sm text-muted-foreground">You don&apos;t have any hubs yet.</p>
        ) : (
          <div className="space-y-2">
            {hubs.map((h) => (
              <button
                key={h.id}
                onClick={() => onSelect({ id: h.id, slug: h.slug, community: h.community })}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-galli/50 hover:bg-muted/40 transition"
              >
                {h.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.coverImage} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-galli/30 to-galli-violet/30 shrink-0">
                    <Boxes className="h-5 w-5 text-galli-dark" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{h.title}</span>
                    {h.community && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0">
                        <UsersRound className="h-2.5 w-2.5" /> Community
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">{h._count.items} items · {h._count.folders} folders</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState, useCallback } from 'react'
import { X, Plus, Check, GripVertical, Trash2 } from 'lucide-react'

interface MemberItem { memberId: string; position: number; published: boolean; slug: string; title: string; username: string }
interface OwnedPage { id: string; title: string; kind?: string }

export function CollectionMembersModal({
  boardId, isOpen, onClose, onChanged,
}: { boardId: string; isOpen: boolean; onClose: () => void; onChanged: () => void }) {
  const [members, setMembers] = useState<MemberItem[]>([])
  const [pages, setPages] = useState<OwnedPage[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [mRes, pRes] = await Promise.all([
      fetch(`/api/collections/${boardId}/members`),
      fetch('/api/displays'),
    ])
    if (mRes.ok) setMembers((await mRes.json()).members)
    if (pRes.ok) {
      const all: OwnedPage[] = await pRes.json()
      setPages(all.filter((d) => d.kind !== 'collection' && d.id !== boardId))
    }
    setLoading(false)
  }, [boardId])

  useEffect(() => { if (isOpen) load() }, [isOpen, load])

  if (!isOpen) return null
  const memberIds = new Set(members.map((m) => m.memberId))

  const add = async (memberId: string) => {
    await fetch(`/api/collections/${boardId}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }),
    })
    await load(); onChanged()
  }
  const remove = async (memberId: string) => {
    await fetch(`/api/collections/${boardId}/members`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }),
    })
    await load(); onChanged()
  }
  const move = async (from: number, to: number) => {
    if (to < 0 || to >= members.length) return
    const order = members.map((m) => m.memberId)
    const [x] = order.splice(from, 1); order.splice(to, 0, x)
    setMembers((cur) => { const c = [...cur]; const [y] = c.splice(from, 1); c.splice(to, 0, y); return c })
    await fetch(`/api/collections/${boardId}/members`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }),
    })
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Manage board pages</h2>
          <button aria-label="Close" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">In this board ({members.length})</h3>
            {members.length === 0 && <p className="text-sm text-muted-foreground">No pages yet. Add some below.</p>}
            <ul className="space-y-1">
              {members.map((m, i) => (
                <li key={m.memberId} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <div className="flex flex-col">
                    <button aria-label="Move up" onClick={() => move(i, i - 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === 0}>▲</button>
                    <button aria-label="Move down" onClick={() => move(i, i + 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === members.length - 1}>▼</button>
                  </div>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{m.title}</span>
                  {!m.published && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">draft — hidden</span>}
                  <button aria-label="Remove" onClick={() => remove(m.memberId)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your pages</h3>
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            <ul className="space-y-1">
              {pages.map((p) => {
                const added = memberIds.has(p.id)
                return (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="flex-1 truncate text-sm">{p.title}</span>
                    <button
                      onClick={() => (added ? remove(p.id) : add(p.id))}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${added ? 'bg-galli/15 text-green-700' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                    >
                      {added ? <><Check className="h-3 w-3" /> Added</> : <><Plus className="h-3 w-3" /> Add</>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
        <div className="flex justify-end border-t border-border px-5 py-3">
          <button onClick={onClose} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:brightness-110">Done</button>
        </div>
      </div>
    </div>
  )
}

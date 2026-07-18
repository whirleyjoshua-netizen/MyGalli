'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Loader2 } from 'lucide-react'
import type { EventDTO } from '@/lib/hub-events'

type Draft = { id?: string; title: string; start: string; end: string; allDay: boolean; isOnline: boolean; location: string; description: string }
const EMPTY: Draft = { title: '', start: '', end: '', allDay: false, isOnline: false, location: '', description: '' }

// ISO <-> <input type="datetime-local"> (local time, no seconds)
function toLocal(iso: string): string {
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function HubEventsModal({ hubId, onClose }: { hubId: string; onClose: () => void }) {
  const [events, setEvents] = useState<EventDTO[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => fetch(`/api/hubs/${hubId}/events?scope=all`).then((r) => (r.ok ? r.json() : { events: [] })).then((d) => setEvents(d.events ?? []))
  useEffect(() => { load() }, [hubId])

  async function save() {
    if (!draft) return
    setBusy(true); setError(null)
    const body = {
      title: draft.title.trim(),
      startsAt: draft.start ? new Date(draft.start).toISOString() : '',
      endsAt: draft.end ? new Date(draft.end).toISOString() : null,
      allDay: draft.allDay, isOnline: draft.isOnline,
      location: draft.location.trim(), description: draft.description.trim(),
    }
    const url = draft.id ? `/api/hubs/${hubId}/events/${draft.id}` : `/api/hubs/${hubId}/events`
    const res = await fetch(url, { method: draft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Failed'); setBusy(false); return }
    setDraft(null); setBusy(false); await load()
  }
  async function del(id: string) {
    if (!window.confirm('Delete this event?')) return
    await fetch(`/api/hubs/${hubId}/events/${id}`, { method: 'DELETE' }); await load()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Events</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {draft ? (
          <div className="space-y-3">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Event title" className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            <label className="block text-xs font-medium text-muted-foreground">Starts
              <input type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">Ends (optional)
              <input type="datetime-local" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            </label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })} className="accent-galli" /> All day</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isOnline} onChange={(e) => setDraft({ ...draft, isOnline: e.target.checked })} className="accent-galli" /> Online</label>
            </div>
            <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder={draft.isOnline ? 'Join URL' : 'Location'} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description (optional)" rows={2} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="rounded-lg px-4 py-2 text-sm text-muted-foreground">Cancel</button>
              <button onClick={save} disabled={busy || !draft.title.trim() || !draft.start} className="inline-flex items-center gap-1.5 rounded-lg bg-galli px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save</button>
            </div>
          </div>
        ) : (
          <>
            <button onClick={() => setDraft(EMPTY)} className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-galli px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" /> New event</button>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <button onClick={() => setDraft({ id: e.id, title: e.title, start: toLocal(e.startsAt), end: e.endsAt ? toLocal(e.endsAt) : '', allDay: e.allDay, isOnline: e.isOnline, location: e.location ?? '', description: e.description ?? '' })} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">{e.title}</span>
                      <span className="block text-xs text-muted-foreground">{new Date(e.startsAt).toLocaleString()}</span>
                    </button>
                    <button onClick={() => del(e.id)} className="ml-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

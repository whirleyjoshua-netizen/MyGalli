'use client'

import { useState } from 'react'
import { Plus, Sparkles, StickyNote, Wrench, X } from 'lucide-react'
import type { HubConfig, HubUtilityKey } from '@/lib/types/hub-config'
import type { StripNote } from '@/lib/hub-notes'

export function CommunityUtilityStrip({
  hubId, config, notes, isOwner, isPrivileged, preview, onOpenPoll, onOpenEvents, onOpenResources,
}: {
  hubId: string
  config: HubConfig
  notes: StripNote[]
  isOwner: boolean
  isPrivileged: boolean
  preview?: boolean
  onOpenPoll: () => void
  onOpenEvents: () => void
  onOpenResources: () => void
}) {
  const visible = config.utility.filter((w) => {
    if (!w.enabled) return false
    if (w.key === 'tools') return isPrivileged // Tools actions are owner surfaces
    return true
  })
  if (visible.length === 0) return null

  const card = (key: HubUtilityKey) => {
    if (key === 'notes') return <NotesCard key="notes" hubId={hubId} notes={notes} isOwner={isOwner} preview={preview} />
    if (key === 'ai') return <AiCard key="ai" />
    return <ToolsCard key="tools" onOpenPoll={onOpenPoll} onOpenEvents={onOpenEvents} onOpenResources={onOpenResources} />
  }

  return (
    <div className={`mb-6 grid gap-4 ${visible.length === 1 ? '' : visible.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
      {visible.map((w) => card(w.key))}
    </div>
  )
}

function Shell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="flex max-h-44 flex-col rounded-2xl border border-border bg-surface p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">{icon} {title}</h3>
      {children}
    </section>
  )
}

function AiCard() {
  return (
    <Shell icon={<Sparkles className="h-4 w-4 text-galli-violet" />} title="Kollab AI">
      <p className="mb-2 text-xs text-muted-foreground">Ask, brainstorm, get ideas.</p>
      <input
        disabled
        placeholder="Ask Kollab AI anything…"
        className="w-full cursor-not-allowed rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
      />
      <span className="mt-2 self-start rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Coming soon</span>
    </Shell>
  )
}

function NotesCard({ hubId, notes: initial, isOwner, preview }: { hubId: string; notes: StripNote[]; isOwner: boolean; preview?: boolean }) {
  const [notes, setNotes] = useState(initial)
  const [showAll, setShowAll] = useState(false)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (preview || !title.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), visibility: 'public' }),
      })
      if (!res.ok) return
      const n = await res.json()
      setNotes((cur) => [{ id: n.id, title: n.title, content: n.content, color: n.color }, ...cur])
      setTitle(''); setContent(''); setAdding(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell icon={<StickyNote className="h-4 w-4 text-primary" />} title="Notes">
      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {notes.slice(0, 2).map((n) => (
            <li key={n.id} className="rounded-lg border-l-2 bg-muted/40 px-2 py-1.5" style={{ borderColor: n.color }}>
              <p className="truncate text-xs font-medium">{n.title}</p>
              <p className="truncate text-xs text-muted-foreground">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between">
        {notes.length > 2 ? (
          <button onClick={() => setShowAll(true)} className="text-xs text-primary hover:underline">View all notes →</button>
        ) : <span />}
        {isOwner && (
          <button title="Add note" onClick={() => setAdding(true)} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {showAll && (
        <NoteModal title="Notes" onClose={() => setShowAll(false)}>
          {notes.map((n) => (
            <div key={n.id} className="mb-2 rounded-lg border-l-2 bg-muted/40 px-3 py-2" style={{ borderColor: n.color }}>
              <p className="text-sm font-medium">{n.title}</p>
              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{n.content}</p>
            </div>
          ))}
        </NoteModal>
      )}

      {adding && (
        <NoteModal title="New note" onClose={() => setAdding(false)}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} className="mb-2 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write a note for your community…" rows={4} maxLength={5000} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
          <button onClick={add} disabled={busy || !title.trim()} className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy ? 'Saving…' : 'Add note'}
          </button>
        </NoteModal>
      )}
    </Shell>
  )
}

function NoteModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Filled in by Task 7.
function ToolsCard({ }: { onOpenPoll: () => void; onOpenEvents: () => void; onOpenResources: () => void }) {
  return <Shell icon={<Wrench className="h-4 w-4 text-primary" />} title="Tools"><div /></Shell>
}

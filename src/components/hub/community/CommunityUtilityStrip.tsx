'use client'

import { useState } from 'react'
import { Activity, BarChart3, CalendarDays, FolderOpen, Link2, Plus, StickyNote, UsersRound, Wrench, X } from 'lucide-react'
import type { HubConfig, HubUtilityKey } from '@/lib/types/hub-config'
import type { StripNote } from '@/lib/hub-notes'
import { activityRows, isQuiet, type ActivityCounts } from '@/lib/hub-activity'

export function CommunityUtilityStrip({
  hubId, config, notes, isOwner, isPrivileged, preview, activity, joined, memberCount, tagline, onToggleJoin, onOpenPoll, onOpenEvents, onOpenResources,
}: {
  hubId: string
  config: HubConfig
  notes: StripNote[]
  isOwner: boolean
  isPrivileged: boolean
  preview?: boolean
  activity: ActivityCounts
  joined: boolean
  memberCount: number
  tagline: string | null
  onToggleJoin: () => void
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
    if (key === 'activity') return <ActivityCard key="activity" activity={activity} joined={joined} isPrivileged={isPrivileged} memberCount={memberCount} tagline={tagline} preview={preview} onToggleJoin={onToggleJoin} />
    return <ToolsCard key="tools" isOwner={isOwner} onOpenPoll={onOpenPoll} onOpenEvents={onOpenEvents} onOpenResources={onOpenResources} />
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

function ActivityCard({
  activity, joined, isPrivileged, memberCount, tagline, preview, onToggleJoin,
}: {
  activity: ActivityCounts
  joined: boolean
  isPrivileged: boolean
  memberCount: number
  tagline: string | null
  preview?: boolean
  onToggleJoin: () => void
}) {
  // A delta list means nothing to someone with no history here, so a visitor
  // gets orientation instead.
  if (!joined && !isPrivileged) {
    return (
      <Shell icon={<UsersRound className="h-4 w-4 text-primary" />} title="Community">
        {tagline && <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{tagline}</p>}
        <p className="mb-2 text-xs text-muted-foreground">{memberCount} {memberCount === 1 ? 'member' : 'members'}</p>
        <button
          onClick={() => { if (!preview) onToggleJoin() }}
          className="mt-auto w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Join community
        </button>
      </Shell>
    )
  }

  const rows = activityRows(activity)
  return (
    <Shell icon={<Activity className="h-4 w-4 text-primary" />} title="This week">
      {isQuiet(activity) ? (
        <p className="text-xs text-muted-foreground">It&apos;s been quiet — share something.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.key}>
              <button
                onClick={() => document.getElementById(jumpTargetId(r.key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}

const jumpTargetId = (key: 'posts' | 'clips' | 'members'): string =>
  key === 'clips' ? 'hub-kollab' : key === 'members' ? 'hub-members' : 'hub-feed'

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

function ToolsCard({ isOwner, onOpenPoll, onOpenEvents, onOpenResources }: { isOwner: boolean; onOpenPoll: () => void; onOpenEvents: () => void; onOpenResources: () => void }) {
  const tools = [
    { label: 'Polls', icon: <BarChart3 className="h-4 w-4" />, onClick: onOpenPoll },
    { label: 'Events', icon: <CalendarDays className="h-4 w-4" />, onClick: onOpenEvents },
    ...(isOwner
      ? [
          { label: 'Files', icon: <FolderOpen className="h-4 w-4" />, onClick: onOpenResources },
          { label: 'Links', icon: <Link2 className="h-4 w-4" />, onClick: onOpenResources },
        ]
      : []),
  ]
  return (
    <Shell icon={<Wrench className="h-4 w-4 text-primary" />} title="Tools">
      <div className={`grid gap-2 ${isOwner ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {tools.map((t) => (
          <button
            key={t.label}
            onClick={t.onClick}
            className="flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </Shell>
  )
}

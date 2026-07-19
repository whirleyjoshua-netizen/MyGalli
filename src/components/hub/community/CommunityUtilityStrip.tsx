'use client'

import { Sparkles, StickyNote, Wrench } from 'lucide-react'
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

// Filled in by Task 4.
function NotesCard({ }: { hubId: string; notes: StripNote[]; isOwner: boolean; preview?: boolean }) {
  return <Shell icon={<StickyNote className="h-4 w-4 text-primary" />} title="Notes"><div /></Shell>
}

// Filled in by Task 7.
function ToolsCard({ }: { onOpenPoll: () => void; onOpenEvents: () => void; onOpenResources: () => void }) {
  return <Shell icon={<Wrench className="h-4 w-4 text-primary" />} title="Tools"><div /></Shell>
}

'use client'

import type { CrmActivity, CrmContact, CrmStage } from '@prisma/client'
import { FileText, Calendar, Clock3, MessageSquare, Mail, StickyNote } from 'lucide-react'

export type CrmContactWithActivity = CrmContact & { activities: CrmActivity[] }

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  form: FileText,
  booking: Calendar,
  waitlist: Clock3,
  'lead-capture': Mail,
  comment: MessageSquare,
  note: StickyNote,
}

function SourceIcon({ source, className }: { source: string; className?: string }) {
  const Cmp = SOURCE_ICONS[source] || StickyNote
  return <Cmp className={className} />
}

export function CrmContactCard({
  contact,
  stages,
  onRestage,
  onSelect,
}: {
  contact: CrmContactWithActivity
  stages: CrmStage[]
  onRestage: (contactId: string, stageId: string) => void
  onSelect?: (contact: CrmContactWithActivity) => void
}) {
  const displayName = contact.name || contact.email || 'Unnamed contact'
  const latestActivity = contact.activities[0]
  const isOverdue = Boolean(contact.followUpAt && new Date(contact.followUpAt) < new Date())

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', contact.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onSelect?.(contact)}
      className="cursor-grab rounded-xl border border-border bg-surface p-3 shadow-soft transition hover:border-galli/40 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
          {contact.name && contact.email && (
            <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
          )}
        </div>
        {latestActivity && (
          <span className="shrink-0 rounded-lg bg-muted p-1.5 text-muted-foreground" title={latestActivity.source}>
            <SourceIcon source={latestActivity.source} className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {isOverdue && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
          <Clock3 className="h-3 w-3" /> Follow up overdue
        </span>
      )}

      <label className="mt-3 block">
        <span className="sr-only">Move {displayName} to a different stage</span>
        <select
          value={contact.stageId}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onRestage(contact.id, e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
    </div>
  )
}

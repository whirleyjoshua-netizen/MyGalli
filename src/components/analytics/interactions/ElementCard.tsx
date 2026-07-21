'use client'

import Link from 'next/link'
import { BarChart3, MessageSquare, Pencil } from 'lucide-react'
import type { ElementSummary, ElementStatus } from '@/lib/element-os'
import { CardBody } from './card-bodies'

const STATUS_PILL: Record<ElementStatus, { label: string; className: string } | null> = {
  live: { label: 'LIVE', className: 'bg-galli/15 text-galli-dark' },
  'needs-attention': { label: 'NEEDS YOU', className: 'bg-amber-500/15 text-amber-700' },
  draft: { label: 'DRAFT', className: 'bg-muted text-muted-foreground' },
  idle: null,
}

function relativeTime(iso: string | null): string | null {
  if (!iso) return null
  const diff = Date.now() - Date.parse(iso)
  if (!Number.isFinite(diff)) return null
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function ElementCard({
  element,
  onOpen,
  editHref,
}: {
  element: ElementSummary
  onOpen: (element: ElementSummary, tab: 'responses' | 'analytics') => void
  editHref: string
}) {
  const pill = STATUS_PILL[element.status]
  // Sections carry no name in the schema, so location is positional.
  const location =
    element.source === 'bulletin'
      ? null
      : [element.pageTitle, element.tabLabel, `Section ${element.sectionIndex}`].filter(Boolean).join(' · ')
  const last = relativeTime(element.lastResponseAt)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft transition hover:border-galli/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{element.title}</p>
          {location ? (
            <p className="truncate text-xs text-muted-foreground">{location}</p>
          ) : (
            <span className="mt-0.5 inline-block rounded-full bg-galli-violet/15 px-2 py-0.5 text-[10px] font-semibold text-galli-violet">
              Bulletin
            </span>
          )}
        </div>
        {pill && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${pill.className}`}>
            {pill.label}
          </span>
        )}
      </div>

      <div className="flex items-end gap-4">
        <span>
          <span className="block text-xl font-bold leading-none">{element.responseCount.toLocaleString('en-US')}</span>
          <span className="text-[11px] text-muted-foreground">Responses</span>
        </span>
        <span>
          <span className="block text-xl font-bold leading-none">
            {element.todayCount > 0 ? `+${element.todayCount}` : '0'}
          </span>
          <span className="text-[11px] text-muted-foreground">Today</span>
        </span>
        <span className="ml-auto text-right">
          <span className="block text-xl font-bold leading-none">
            {element.engagement === null ? '—' : `${element.engagement}%`}
          </span>
          <span className="text-[11px] text-muted-foreground">Engagement</span>
        </span>
      </div>

      <CardBody element={element} />

      {last && <p className="text-xs text-muted-foreground">Last response {last}</p>}

      <div className="flex items-center gap-1 border-t border-border pt-2 text-xs">
        <button
          onClick={() => onOpen(element, 'analytics')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <BarChart3 className="h-3.5 w-3.5" /> Analytics
        </button>
        <button
          onClick={() => onOpen(element, 'responses')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <MessageSquare className="h-3.5 w-3.5" /> Responses
        </button>
        <Link
          href={editHref}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </div>
    </div>
  )
}

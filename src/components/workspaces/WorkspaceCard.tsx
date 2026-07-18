'use client'

import Link from 'next/link'
import { Database } from 'lucide-react'
import { formatLastUpdated } from '@/lib/last-updated'

export type WorkspaceListItem = {
  id: string
  name: string
  description: string | null
  icon: string | null
  recordCount: number
  fieldCount: number
  primaryView: string | null
  lastActivity: string
}

function viewLabel(v: string | null): string {
  if (!v) return 'No views'
  return `${v.charAt(0).toUpperCase()}${v.slice(1)} view`
}

export function WorkspaceCard({ ws, layout }: { ws: WorkspaceListItem; layout: 'grid' | 'list' }) {
  const meta = (
    <p className="text-xs text-muted-foreground">
      {ws.recordCount} {ws.recordCount === 1 ? 'record' : 'records'} · {viewLabel(ws.primaryView)} ·{' '}
      Updated {formatLastUpdated(new Date(ws.lastActivity), new Date())}
    </p>
  )
  const icon = ws.icon ? <span className="text-lg leading-none">{ws.icon}</span> : <Database size={18} className="text-galli" />

  if (layout === 'list') {
    return (
      <Link href={`/workspaces/${ws.id}`}
        className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 transition hover:shadow-md">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2"><span className="truncate font-semibold">{ws.name}</span></span>
          {ws.description && <span className="block truncate text-sm text-muted-foreground">{ws.description}</span>}
        </span>
        <span className="hidden shrink-0 sm:block">{meta}</span>
      </Link>
    )
  }

  return (
    <Link href={`/workspaces/${ws.id}`}
      className="flex flex-col rounded-xl border border-border bg-surface p-5 transition hover:shadow-md">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">{icon}</span>
        <h3 className="truncate font-semibold">{ws.name}</h3>
      </div>
      {ws.description && <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{ws.description}</p>}
      <div className="mt-auto">{meta}</div>
    </Link>
  )
}

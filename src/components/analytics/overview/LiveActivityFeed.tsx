'use client'

import { useEffect } from 'react'
import { Activity } from 'lucide-react'
import { DataIllustration } from '@/components/analytics/DataIllustration'
import type { LiveActivityItem } from '@/lib/data-overview'

export const LIVE_POLL_MS = 20_000

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function LiveActivityFeed({
  items,
  onRefresh,
}: {
  items: LiveActivityItem[]
  onRefresh: () => void
}) {
  useEffect(() => {
    const id = setInterval(() => {
      // Only poll while the tab is actually being looked at.
      if (document.visibilityState === 'visible') onRefresh()
    }, LIVE_POLL_MS)
    return () => clearInterval(id)
  }, [onRefresh])

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Live Activity</h3>
        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-galli/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-galli">
          <span className="h-1.5 w-1.5 rounded-full bg-galli" /> Live
        </span>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="activity" />
          <p className="mt-3 text-sm font-medium">No activity yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Visits and interactions will appear here as they happen.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm">{item.label}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(item.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

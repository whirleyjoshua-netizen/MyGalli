'use client'

import { Users, MousePointerClick, UserPlus, Repeat, Timer, LogOut } from 'lucide-react'

export interface AudienceSummary {
  visitors: number
  sessions: number
  newVisitors: number
  returningVisitors: number
  avgSessionSeconds: number | null
  bounceRate: number
  measuredSessions: number
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  const rest = rounded % 60
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`
}

export function AudienceHeadline({
  summary,
  identityFallback,
}: {
  summary: AudienceSummary
  identityFallback: boolean
}) {
  const returningShare =
    summary.visitors > 0 ? (summary.returningVisitors / summary.visitors) * 100 : 0

  const cards = [
    { key: 'visitors', label: 'Visitors', icon: Users, value: summary.visitors.toLocaleString(), sub: 'people' },
    { key: 'sessions', label: 'Sessions', icon: MousePointerClick, value: summary.sessions.toLocaleString(), sub: 'visits' },
    { key: 'new', label: 'New', icon: UserPlus, value: summary.newVisitors.toLocaleString(), sub: 'first time here' },
    { key: 'returning', label: 'Returning', icon: Repeat, value: summary.returningVisitors.toLocaleString(), sub: `${returningShare.toFixed(1)}% came back` },
    { key: 'avg', label: 'Avg session', icon: Timer, value: formatDuration(summary.avgSessionSeconds), sub: summary.measuredSessions > 0 ? `over ${summary.measuredSessions.toLocaleString()} sessions` : 'not enough data' },
    { key: 'bounce', label: 'Bounce rate', icon: LogOut, value: `${summary.bounceRate.toFixed(0)}%`, sub: 'left after one action' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ key, label, icon: Icon, value, sub }) => (
          <div key={key} className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-galli/10 text-galli">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {identityFallback && (
        <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Some visits in this range couldn&apos;t be tied to a returning person — the visit happened
          before we could tell repeat visitors apart, the visitor&apos;s browser blocked the storage
          we use to recognize them, or they asked not to be tracked. Those count as new each time,
          so the visitor numbers above overcount slightly.
        </p>
      )}
    </div>
  )
}

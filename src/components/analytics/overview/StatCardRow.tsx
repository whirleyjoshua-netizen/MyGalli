'use client'

import { Eye, Users, UserPlus, Share2, MousePointerClick, TrendingUp, TrendingDown } from 'lucide-react'
import { Sparkline } from '@/components/analytics/Sparkline'
import { computeDelta } from '@/lib/data-health'

export interface StatMetrics {
  views: number
  uniqueVisitors: number
  followers: number
  shares: number
  interactions: number
}

const CARDS = [
  { key: 'views', label: 'Views', icon: Eye, tone: 'text-galli-aqua', chip: 'bg-galli-aqua/10' },
  { key: 'uniqueVisitors', label: 'Visitors', icon: Users, tone: 'text-galli', chip: 'bg-galli/10' },
  { key: 'followers', label: 'Followers', icon: UserPlus, tone: 'text-galli-violet', chip: 'bg-galli-violet/10' },
  { key: 'shares', label: 'Shares', icon: Share2, tone: 'text-rose-500', chip: 'bg-rose-500/10' },
  { key: 'interactions', label: 'Interactions', icon: MousePointerClick, tone: 'text-amber-500', chip: 'bg-amber-500/10' },
] as const

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = computeDelta({ current, previous })

  if (delta === null) {
    return <span className="text-xs font-semibold text-galli">New</span>
  }

  const up = delta >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-galli' : 'text-rose-500'}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

export function StatCardRow({
  metrics,
  previous,
  series,
}: {
  metrics: StatMetrics
  previous: StatMetrics
  series: Record<string, number[]>
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {CARDS.map(({ key, label, icon: Icon, tone, chip }) => (
        <div key={key} className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${chip} ${tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{metrics[key].toLocaleString()}</span>
            <DeltaBadge current={metrics[key]} previous={previous[key]} />
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">vs. previous period</p>
          <div className={`mt-2 ${tone}`}>
            <Sparkline values={series[key] ?? []} />
          </div>
        </div>
      ))}
    </div>
  )
}

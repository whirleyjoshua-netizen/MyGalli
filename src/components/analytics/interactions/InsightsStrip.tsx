'use client'

import { Boxes, MessageSquare, Activity, BellDot, Radio } from 'lucide-react'
import type { ElementStatus } from '@/lib/element-os'

export interface StripTotals {
  elements: number
  responses: number
  avgEngagement: number | null
  needsAttention: number
  liveNow: number
}

const fmt = (n: number) => n.toLocaleString('en-US')

function Stat({
  icon,
  value,
  label,
  tint,
  onClick,
}: {
  icon: React.ReactNode
  value: string
  label: string
  tint: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold leading-tight">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </>
  )
  if (!onClick) return <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-muted/60"
    >
      {inner}
    </button>
  )
}

export function InsightsStrip({
  totals,
  onFilterStatus,
}: {
  totals: StripTotals
  onFilterStatus: (status: ElementStatus) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-2 shadow-soft">
      <Stat icon={<Boxes className="h-5 w-5 text-galli-dark" />} tint="bg-galli/15" value={fmt(totals.elements)} label="Elements" />
      <Stat icon={<MessageSquare className="h-5 w-5 text-galli-violet" />} tint="bg-galli-violet/15" value={fmt(totals.responses)} label="Responses" />
      <Stat
        icon={<Activity className="h-5 w-5 text-galli-aqua" />}
        tint="bg-galli-aqua/15"
        value={totals.avgEngagement === null ? '—' : `${totals.avgEngagement}%`}
        label="Avg. Engagement"
      />
      <Stat
        icon={<BellDot className="h-5 w-5 text-amber-600" />}
        tint="bg-amber-500/15"
        value={fmt(totals.needsAttention)}
        label="Need Attention"
        onClick={() => onFilterStatus('needs-attention')}
      />
      <Stat
        icon={<Radio className="h-5 w-5 text-galli-dark" />}
        tint="bg-galli/15"
        value={fmt(totals.liveNow)}
        label="Live Now"
        onClick={() => onFilterStatus('live')}
      />
    </div>
  )
}

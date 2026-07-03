'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Globe, ExternalLink, MessageSquare, BarChart3, ArrowUpRight } from 'lucide-react'
import type { DashDisplay } from './PageCard'
import { BulletinTab } from '@/components/bulletin/BulletinTab'

interface AnalyticsData {
  summary: { views: number; uniqueVisitors: number }
  viewsByDay: Record<string, number>
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return <div className="h-8" />
  const max = Math.max(...values, 1)
  const w = 100
  const h = 28
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`w-full h-8 ${className ?? ''}`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StatTile({ label, value, spark }: { label: string; value: string; spark: number[] }) {
  return (
    <div className="flex-1 min-w-0 p-3 rounded-xl border border-border bg-surface">
      <p className="text-lg font-bold text-foreground leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
      <div className="mt-2 text-primary">
        <Sparkline values={spark} />
      </div>
    </div>
  )
}

export function AnalyticsPanel({ display, username }: { display: DashDisplay | null; username?: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [feedbackCount, setFeedbackCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'glance' | 'bulletin'>('glance')

  useEffect(() => {
    if (!display) return
    setLoading(true)
    setData(null)
    setFeedbackCount(null)
    fetch(`/api/analytics/${display.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
    fetch(`/api/analytics/${display.id}/elements`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const count = Array.isArray(d) ? d.length : Array.isArray(d?.elements) ? d.elements.length : 0
        setFeedbackCount(count)
      })
      .catch(() => setFeedbackCount(0))
  }, [display])

  const days = data ? Object.keys(data.viewsByDay).sort() : []
  const spark = days.map((d) => data!.viewsByDay[d])
  const views = data?.summary.views ?? display?.views ?? 0
  const visitors = data?.summary.uniqueVisitors ?? 0
  const engagement = views > 0 ? Math.round((visitors / views) * 100) : 0

  const glanceBody = !display ? (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <BarChart3 className="mb-3 h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Select a page to see its audience at a glance.</p>
    </div>
  ) : (
    <div className="space-y-5 p-5">
      {/* Selected page summary */}
      <div className="p-3 rounded-2xl border border-border bg-surface flex gap-3">
        <div className={`w-16 h-16 rounded-xl shrink-0 overflow-hidden ${display.coverImage ? '' : 'bg-gradient-to-br from-galli/20 to-galli-violet/20'}`}>
          {display.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={display.coverImage} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-foreground truncate">{display.title}</h3>
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Globe className="w-3 h-3" /> {display.published ? 'Public page' : 'Draft'}
          </p>
          {display.published && username && (
            <a
              href={`/${username}/${display.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline mt-1 truncate cursor-pointer"
            >
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span className="truncate">galli.page/{username}/{display.slug}</span>
            </a>
          )}
        </div>
      </div>

      {/* Audience at a glance */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-sm font-bold text-foreground">Audience at a glance</h4>
          <Link href="/analytics" className="text-xs text-primary hover:underline cursor-pointer">See analytics</Link>
        </div>
        <div className="flex gap-2">
          <StatTile label="Views" value={loading ? '—' : String(views)} spark={spark} />
          <StatTile label="Visitors" value={loading ? '—' : String(visitors)} spark={spark} />
          <StatTile label="Engagement" value={loading ? '—' : `${engagement}%`} spark={spark} />
        </div>
      </div>

      {/* Widget feedback */}
      <div>
        <h4 className="text-sm font-bold text-foreground mb-2.5">Widget feedback</h4>
        <div className="p-4 rounded-2xl border border-border bg-surface">
          {feedbackCount && feedbackCount > 0 ? (
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </span>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{feedbackCount}</span> interactive {feedbackCount === 1 ? 'widget' : 'widgets'} collecting responses.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No responses yet. Add a poll, rating, or form to start collecting feedback.</p>
          )}
        </div>
      </div>

      {/* CTA */}
      <Link
        href="/analytics"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-soft hover:brightness-105 transition-all cursor-pointer"
      >
        View full analytics
        <ArrowUpRight className="w-4 h-4" />
      </Link>
    </div>
  )

  return (
    <aside className="hidden xl:flex w-[360px] shrink-0 flex-col border-l border-border">
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('glance')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'glance' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          At a glance
        </button>
        <button
          onClick={() => setTab('bulletin')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'bulletin' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Bulletin
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'glance' ? glanceBody : <div className="p-4"><BulletinTab /></div>}
      </div>
    </aside>
  )
}

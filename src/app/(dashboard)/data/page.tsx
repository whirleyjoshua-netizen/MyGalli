'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, Eye, Users, Monitor, Smartphone, Tablet, Globe, Calendar, Inbox, Megaphone, Mail, Link2, Clock, Lightbulb, TrendingUp, Target } from 'lucide-react'
import { ElementsTab } from '@/components/analytics/ElementsTab'
import { BulletinAnalyticsTab } from '@/components/analytics/BulletinAnalyticsTab'
import { MessagesInbox } from '@/components/dashboard/MessagesInbox'
import { PageHero } from '@/components/dashboard/PageHero'
import { Sparkline } from '@/components/analytics/Sparkline'
import { DataIllustration, type DataIllustrationVariant } from '@/components/analytics/DataIllustration'

interface AnalyticsData {
  display: {
    id: string
    title: string
    totalViews: number
  }
  period: {
    days: number
    start: string
    end: string
  }
  summary: {
    views: number
    uniqueVisitors: number
  }
  breakdown: {
    devices: Record<string, number>
    browsers: Record<string, number>
    referrers: { domain: string; count: number }[]
  }
  viewsByDay: Record<string, number>
  uniqueVisitorsByDay?: Record<string, number>
  topReferrerByDay?: Record<string, number>
  recentEvents: {
    id: string
    eventType: string
    deviceType: string | null
    browser: string | null
    referrer: string | null
    createdAt: string
  }[]
}

interface DisplayOption {
  id: string
  title: string
  slug: string
  views: number
}

// Wrapper component to handle Suspense boundary for useSearchParams
export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  )
}

function AnalyticsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [displays, setDisplays] = useState<DisplayOption[]>([])
  const [selectedDisplayId, setSelectedDisplayId] = useState<string | null>(
    searchParams.get('displayId')
  )
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [activeTab, setActiveTab] = useState<'overview' | 'elements' | 'bulletin' | 'messages'>(
    (() => {
      const t = searchParams.get('tab')
      return t === 'elements' || t === 'bulletin' || t === 'messages' ? t : 'overview'
    })()
  )

  // Fetch user's displays
  useEffect(() => {
    async function fetchDisplays() {
      try {
        const res = await fetch('/api/displays')
        if (res.ok) {
          const data = await res.json()
          setDisplays(data)
          // Auto-select first display if none selected
          if (!selectedDisplayId && data.length > 0) {
            setSelectedDisplayId(data[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch displays:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDisplays()
  }, [router, selectedDisplayId])

  // Fetch analytics for selected display
  useEffect(() => {
    if (!selectedDisplayId) return

    async function fetchAnalytics() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/analytics/${selectedDisplayId}?days=${days}`
        )
        if (res.ok) {
          const data = await res.json()
          setAnalytics(data)
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [selectedDisplayId, days])

  // Device icon
  const DeviceIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />
      case 'tablet':
        return <Tablet className="w-4 h-4" />
      default:
        return <Monitor className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHero
        icon={<BarChart3 className="w-7 h-7 text-primary" />}
        title="Data"
        subtitle="Insights and analytics to help you understand and grow."
        controls={
          <select
            value={selectedDisplayId || ''}
            onChange={(e) => setSelectedDisplayId(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-sm max-w-[200px] truncate"
          >
            <option value="" disabled>
              Select a page
            </option>
            {displays.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        }
        tabs={
          <>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === 'overview'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('elements')}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'elements'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Inbox className="w-4 h-4" />
              Elements
            </button>
            <button
              onClick={() => setActiveTab('bulletin')}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'bulletin'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              Bulletin
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'messages'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail className="w-4 h-4" />
              Messages
            </button>
          </>
        }
      />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'messages' ? (
          <MessagesInbox />
        ) : activeTab === 'bulletin' ? (
          <BulletinAnalyticsTab />
        ) : activeTab === 'elements' ? (
          <ElementsTab displayId={selectedDisplayId} />
        ) : loading && !analytics ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        ) : !selectedDisplayId ? (
          <div className="text-center py-20">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-medium mb-2">No page selected</h2>
            <p className="text-muted-foreground">
              Select a page from the dropdown to view its analytics.
            </p>
          </div>
        ) : analytics ? (
          <div className="space-y-8">
            {/* Period Selector */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{analytics.display.title}</h2>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard tone="aqua" icon={<Eye className="h-5 w-5" />} label="Total Views" value={String(analytics.display.totalViews)} subline={`${analytics.summary.views} in last ${days} days`} byDay={analytics.viewsByDay} />
              <StatCard tone="green" icon={<Users className="h-5 w-5" />} label="Unique Visitors" value={String(analytics.summary.uniqueVisitors)} subline={`In last ${days} days`} byDay={analytics.uniqueVisitorsByDay ?? {}} />
              <StatCard tone="violet" icon={<Globe className="h-5 w-5" />} label="Top Referrer" value={analytics.breakdown.referrers[0]?.domain || 'Direct'} subline={`${analytics.breakdown.referrers[0]?.count || 0} visits`} byDay={analytics.topReferrerByDay ?? {}} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <OverviewCard icon={<Monitor className="h-4 w-4" />} title="Device Breakdown">
                {Object.entries(analytics.breakdown.devices).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(analytics.breakdown.devices)
                      .sort((a, b) => b[1] - a[1])
                      .map(([device, count]) => {
                        const total = Object.values(analytics.breakdown.devices).reduce((a, b) => a + b, 0)
                        const percentage = Math.round((count / total) * 100)
                        return (
                          <div key={device} className="flex items-center gap-3">
                            <DeviceIcon type={device} />
                            <span className="capitalize text-sm flex-1">{device}</span>
                            <span className="text-sm text-muted-foreground">{count}</span>
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                            </div>
                            <span className="text-sm text-muted-foreground w-10 text-right">{percentage}%</span>
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <EmptyState variant="device" text="Once visitors interact with your page, device data will appear here." />
                )}
              </OverviewCard>

              <OverviewCard icon={<Globe className="h-4 w-4" />} title="Browser Breakdown">
                {Object.entries(analytics.breakdown.browsers).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(analytics.breakdown.browsers)
                      .sort((a, b) => b[1] - a[1])
                      .map(([browser, count]) => {
                        const total = Object.values(analytics.breakdown.browsers).reduce((a, b) => a + b, 0)
                        const percentage = Math.round((count / total) * 100)
                        return (
                          <div key={browser} className="flex items-center gap-3">
                            <span className="capitalize text-sm flex-1">{browser}</span>
                            <span className="text-sm text-muted-foreground">{count}</span>
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${percentage}%` }} />
                            </div>
                            <span className="text-sm text-muted-foreground w-10 text-right">{percentage}%</span>
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <EmptyState variant="browser" text="Once visitors interact with your page, browser data will appear here." />
                )}
              </OverviewCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <OverviewCard icon={<Link2 className="h-4 w-4" />} title="Top Referrers">
                {analytics.breakdown.referrers.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.breakdown.referrers.map((ref, i) => (
                      <div
                        key={ref.domain}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-6">{i + 1}.</span>
                          <span className="text-sm">{ref.domain}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{ref.count} visits</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState variant="referrer" text="We'll show you which sites bring the most visitors to your page." />
                )}
              </OverviewCard>

              <OverviewCard icon={<Clock className="h-4 w-4" />} title="Recent Activity">
                {analytics.recentEvents.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {analytics.recentEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <DeviceIcon type={event.deviceType || 'desktop'} />
                          <span className="text-sm capitalize">{event.browser || 'Unknown'}</span>
                          {event.referrer && (
                            <span className="text-xs text-muted-foreground">
                              from {new URL(event.referrer).hostname}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState variant="activity" text="Recent events and interactions will appear here." />
                )}
              </OverviewCard>
            </div>

            <InsightsPanel />
          </div>
        ) : null}
      </main>
    </div>
  )
}

const STAT_TONE = {
  aqua: { chip: 'bg-galli-aqua/10 text-galli-aqua', line: 'text-galli-aqua' },
  green: { chip: 'bg-galli/15 text-galli-dark', line: 'text-galli' },
  violet: { chip: 'bg-galli-violet/10 text-galli-violet', line: 'text-galli-violet' },
} as const

function StatCard({
  icon, tone, label, value, subline, byDay,
}: {
  icon: React.ReactNode
  tone: keyof typeof STAT_TONE
  label: string
  value: string
  subline: string
  byDay: Record<string, number>
}) {
  const spark = Object.keys(byDay).sort().map((d) => byDay[d])
  const t = STAT_TONE[tone]
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.chip}`}>{icon}</span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
          <p className="truncate text-3xl font-bold">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subline}</p>
        </div>
        <div className={`w-24 shrink-0 self-end ${t.line}`}>
          <Sparkline values={spark} />
        </div>
      </div>
    </div>
  )
}

function OverviewCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span className="text-muted-foreground">{icon}</span> {title}
      </h3>
      {children}
    </div>
  )
}

function EmptyState({ variant, text }: { variant: DataIllustrationVariant; text: string }) {
  return (
    <div className="flex items-center gap-4">
      <DataIllustration variant={variant} className="h-20 w-28 shrink-0" />
      <div>
        <p className="text-sm font-semibold">No data yet</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}

const INSIGHTS = [
  { icon: Users, title: 'Grow Your Audience', text: 'Share your page and invite collaborators to expand your community.' },
  { icon: Eye, title: 'Create Engaging Content', text: 'Consistent, valuable content drives more views and engagement.' },
  { icon: TrendingUp, title: 'Analyze & Optimize', text: 'Use data insights to understand what works best for your audience.' },
  { icon: Target, title: 'Achieve Your Goals', text: 'Keep building, keep sharing, and watch your pond flourish.' },
]

function InsightsPanel() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-galli/20 bg-galli/5 p-6">
      <div className="mb-5 flex items-start gap-2">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-galli-dark" />
        <div>
          <h3 className="font-bold">Insights</h3>
          <p className="text-sm text-muted-foreground">Track your growth and discover opportunities.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:pr-36">
        {INSIGHTS.map((it) => (
          <div key={it.title}>
            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-galli-dark">
              <it.icon className="h-4 w-4" />
            </span>
            <h4 className="text-sm font-bold">{it.title}</h4>
            <p className="mt-0.5 text-sm text-muted-foreground">{it.text}</p>
          </div>
        ))}
      </div>
      <DataIllustration variant="sprout" className="pointer-events-none absolute bottom-0 right-2 hidden h-28 w-32 lg:block" />
    </div>
  )
}

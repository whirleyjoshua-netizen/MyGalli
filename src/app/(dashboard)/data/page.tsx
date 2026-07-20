'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, Calendar, Inbox, Megaphone, Users } from 'lucide-react'
import { ElementsTab } from '@/components/analytics/ElementsTab'
import { BulletinAnalyticsTab } from '@/components/analytics/BulletinAnalyticsTab'
import { PageHero } from '@/components/dashboard/PageHero'
import { StatCardRow } from '@/components/analytics/overview/StatCardRow'
import { HealthGauge } from '@/components/analytics/overview/HealthGauge'
import { LiveActivityFeed } from '@/components/analytics/overview/LiveActivityFeed'
import { SectionEngagementBars } from '@/components/analytics/overview/SectionEngagementBars'
import { WidgetPerformanceTable } from '@/components/analytics/overview/WidgetPerformanceTable'
import { ReferrerDonut } from '@/components/analytics/overview/ReferrerDonut'
import { QuickActions } from '@/components/analytics/overview/QuickActions'
import { AudienceBreakdowns } from '@/components/analytics/audience/AudienceBreakdowns'
import { AudienceHeadline, type AudienceSummary } from '@/components/analytics/audience/AudienceHeadline'
import { PeakHoursChart } from '@/components/analytics/audience/PeakHoursChart'
import { GeographyList } from '@/components/analytics/audience/GeographyList'
import { SourcesBreakdown } from '@/components/analytics/audience/SourcesBreakdown'
import type { HealthResult } from '@/lib/data-health'
import type { LiveActivityItem, SectionEngagementRow, WidgetPerformanceRow } from '@/lib/data-overview'
import type { SourceCategory } from '@/lib/data-audience'

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
    followers: number
    shares: number
    interactions: number
  }
  previous: {
    views: number
    uniqueVisitors: number
    followers: number
    shares: number
    interactions: number
  }
  health: HealthResult
  liveActivity: LiveActivityItem[]
  widgetPerformance: WidgetPerformanceRow[]
  sectionEngagement: SectionEngagementRow[]
  breakdown: {
    devices: Record<string, number>
    browsers: Record<string, number>
    referrers: { domain: string; count: number }[]
  }
  viewsByDay: Record<string, number>
  uniqueVisitorsByDay?: Record<string, number>
}

interface DisplayOption {
  id: string
  title: string
  slug: string
  views: number
}

interface AudienceData {
  summary: AudienceSummary
  identityFallback: boolean
  hourCountsUtc: number[]
  geography: { country: string; count: number }[]
  unknownCountryEvents: number
  sources: { source: SourceCategory; count: number }[]
  devices: Record<string, number>
  browsers: Record<string, number>
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
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [days, setDays] = useState(30)
  const [activeTab, setActiveTab] = useState<'overview' | 'audience' | 'elements' | 'bulletin'>(
    (() => {
      const t = searchParams.get('tab')
      return t === 'audience' || t === 'elements' || t === 'bulletin' ? t : 'overview'
    })()
  )
  const [username, setUsername] = useState<string | null>(null)
  const [audience, setAudience] = useState<AudienceData | null>(null)
  const [audienceLoading, setAudienceLoading] = useState(false)

  useEffect(() => {
    if (activeTab !== 'audience' || !selectedDisplayId) return
    let cancelled = false
    setAudienceLoading(true)
    setAudience(null)
    fetch(`/api/analytics/${selectedDisplayId}/audience?days=${days}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setAudience(data && data.summary ? data : null) })
      .catch(() => { if (!cancelled) setAudience(null) })
      .finally(() => { if (!cancelled) setAudienceLoading(false) })
    return () => { cancelled = true }
  }, [activeTab, selectedDisplayId, days])

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
          const me = await fetch('/api/profile').then((r) => (r.ok ? r.json() : null))
          setUsername(me?.username ?? null)
        }
      } catch (error) {
        console.error('Failed to fetch displays:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDisplays()
  }, [router, selectedDisplayId])

  // Fetch analytics for selected display. Clears stale data + resets error
  // state on every displayId/days change so a failed fetch never leaves the
  // previous page's numbers on screen under a new title.
  useEffect(() => {
    if (!selectedDisplayId) return

    setAnalytics(null)
    setError(false)

    async function fetchAnalytics() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/analytics/${selectedDisplayId}?days=${days}`
        )
        if (res.ok) {
          const data = await res.json()
          setAnalytics(data)
        } else {
          setError(true)
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [selectedDisplayId, days, retryCount])

  // Lightweight refresh for the 20s live-activity poll: fetches only the
  // bounded activity feed (`?live=1`) and merges it into existing state,
  // instead of re-running the full aggregate rebuild.
  const refreshAnalytics = useCallback(async () => {
    if (!selectedDisplayId) return
    try {
      const res = await fetch(`/api/analytics/${selectedDisplayId}?live=1&days=${days}`)
      if (res.ok) {
        const data = await res.json()
        setAnalytics((prev) => (prev ? { ...prev, liveActivity: data.liveActivity } : prev))
      }
    } catch (error) {
      console.error('Failed to refresh live activity:', error)
    }
  }, [selectedDisplayId, days])

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
              onClick={() => setActiveTab('audience')}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'audience'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4" />
              Audience
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
          </>
        }
      />

      <main className="w-full px-4 py-8 sm:px-6">
        {activeTab === 'bulletin' ? (
          <BulletinAnalyticsTab />
        ) : activeTab === 'audience' ? (
          audienceLoading && !audience ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Loading audience…</p>
            </div>
          ) : !audience ? (
            <div className="py-20 text-center">
              <p className="text-muted-foreground">Couldn&apos;t load audience data.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <AudienceHeadline summary={audience.summary} identityFallback={audience.identityFallback} />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PeakHoursChart hourCountsUtc={audience.hourCountsUtc} />
                <GeographyList
                  geography={audience.geography}
                  unknownCountryEvents={audience.unknownCountryEvents}
                />
                <SourcesBreakdown sources={audience.sources} />
                <div className="lg:col-span-1">
                  <AudienceBreakdowns devices={audience.devices} browsers={audience.browsers} />
                </div>
              </div>
            </div>
          )
        ) : activeTab === 'elements' ? (
          <ElementsTab displayId={selectedDisplayId} />
        ) : loading && !analytics ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-medium mb-2">Couldn&apos;t load analytics</h2>
            <p className="text-muted-foreground mb-4">Something went wrong fetching this page&apos;s data.</p>
            <button
              onClick={() => setRetryCount((c) => c + 1)}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Retry
            </button>
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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                <StatCardRow
                  metrics={analytics.summary}
                  previous={analytics.previous}
                  series={{
                    views: Object.keys(analytics.viewsByDay).sort().map((d) => analytics.viewsByDay[d]),
                    uniqueVisitors: Object.keys(analytics.uniqueVisitorsByDay ?? {}).sort().map((d) => (analytics.uniqueVisitorsByDay ?? {})[d]),
                  }}
                />

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <LiveActivityFeed items={analytics.liveActivity} onRefresh={refreshAnalytics} />
                  <SectionEngagementBars rows={analytics.sectionEngagement} />
                </div>

                <WidgetPerformanceTable rows={analytics.widgetPerformance} />
              </div>

              <aside className="space-y-6">
                <HealthGauge health={analytics.health} />
                <QuickActions
                  username={username}
                  slug={displays.find((d) => d.id === selectedDisplayId)?.slug ?? null}
                  displayId={selectedDisplayId}
                />
                <ReferrerDonut
                  referrers={analytics.breakdown.referrers}
                  totalViews={analytics.summary.views}
                />
              </aside>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

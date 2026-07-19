'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, Calendar, Inbox, Megaphone } from 'lucide-react'
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
import type { HealthResult } from '@/lib/data-health'
import type { LiveActivityItem, SectionEngagementRow, WidgetPerformanceRow } from '@/lib/data-overview'

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
  const [activeTab, setActiveTab] = useState<'overview' | 'elements' | 'bulletin'>(
    (() => {
      const t = searchParams.get('tab')
      return t === 'elements' || t === 'bulletin' ? t : 'overview'
    })()
  )
  const [username, setUsername] = useState<string | null>(null)

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

  const refreshAnalytics = useCallback(async () => {
    if (!selectedDisplayId) return
    try {
      const res = await fetch(`/api/analytics/${selectedDisplayId}?days=${days}`)
      if (res.ok) setAnalytics(await res.json())
    } catch (error) {
      console.error('Failed to refresh analytics:', error)
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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'bulletin' ? (
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

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Eye, Users, Monitor, Smartphone, Tablet, Globe, Calendar, Inbox } from 'lucide-react'
import { ElementsTab } from '@/components/analytics/ElementsTab'

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
  const [activeTab, setActiveTab] = useState<'overview' | 'elements'>(
    searchParams.get('tab') === 'elements' ? 'elements' : 'overview'
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
      {/* Header */}
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 hover:bg-muted rounded-lg transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold">Analytics</h1>
            </div>
          </div>

          {/* Display Selector */}
          <select
            value={selectedDisplayId || ''}
            onChange={(e) => setSelectedDisplayId(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-sm"
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
        </div>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto mt-4">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'overview'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('elements')}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'elements'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Inbox className="w-4 h-4" />
              Elements
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'elements' ? (
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
              <div className="bg-muted/30 rounded-lg p-6 border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <Eye className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Total Views</span>
                </div>
                <p className="text-3xl font-bold">{analytics.display.totalViews}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {analytics.summary.views} in last {days} days
                </p>
              </div>

              <div className="bg-muted/30 rounded-lg p-6 border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">Unique Visitors</span>
                </div>
                <p className="text-3xl font-bold">{analytics.summary.uniqueVisitors}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  In last {days} days
                </p>
              </div>

              <div className="bg-muted/30 rounded-lg p-6 border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <Globe className="w-5 h-5 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Top Referrer</span>
                </div>
                <p className="text-2xl font-bold truncate">
                  {analytics.breakdown.referrers[0]?.domain || 'Direct'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {analytics.breakdown.referrers[0]?.count || 0} visits
                </p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Device Breakdown */}
              <div className="bg-muted/30 rounded-lg p-6 border border-border">
                <h3 className="text-sm font-medium mb-4">Device Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.breakdown.devices).length > 0 ? (
                    Object.entries(analytics.breakdown.devices)
                      .sort((a, b) => b[1] - a[1])
                      .map(([device, count]) => {
                        const total = Object.values(analytics.breakdown.devices).reduce(
                          (a, b) => a + b,
                          0
                        )
                        const percentage = Math.round((count / total) * 100)
                        return (
                          <div key={device} className="flex items-center gap-3">
                            <DeviceIcon type={device} />
                            <span className="capitalize text-sm flex-1">{device}</span>
                            <span className="text-sm text-muted-foreground">{count}</span>
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-10 text-right">
                              {percentage}%
                            </span>
                          </div>
                        )
                      })
                  ) : (
                    <p className="text-sm text-muted-foreground">No data yet</p>
                  )}
                </div>
              </div>

              {/* Browser Breakdown */}
              <div className="bg-muted/30 rounded-lg p-6 border border-border">
                <h3 className="text-sm font-medium mb-4">Browser Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(analytics.breakdown.browsers).length > 0 ? (
                    Object.entries(analytics.breakdown.browsers)
                      .sort((a, b) => b[1] - a[1])
                      .map(([browser, count]) => {
                        const total = Object.values(analytics.breakdown.browsers).reduce(
                          (a, b) => a + b,
                          0
                        )
                        const percentage = Math.round((count / total) * 100)
                        return (
                          <div key={browser} className="flex items-center gap-3">
                            <span className="capitalize text-sm flex-1">{browser}</span>
                            <span className="text-sm text-muted-foreground">{count}</span>
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-10 text-right">
                              {percentage}%
                            </span>
                          </div>
                        )
                      })
                  ) : (
                    <p className="text-sm text-muted-foreground">No data yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Top Referrers */}
            <div className="bg-muted/30 rounded-lg p-6 border border-border">
              <h3 className="text-sm font-medium mb-4">Top Referrers</h3>
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
                <p className="text-sm text-muted-foreground">No referrer data yet</p>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-muted/30 rounded-lg p-6 border border-border">
              <h3 className="text-sm font-medium mb-4">Recent Activity</h3>
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
                <p className="text-sm text-muted-foreground">No recent activity</p>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

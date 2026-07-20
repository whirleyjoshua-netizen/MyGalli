import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { buildOverview, buildLiveOnly } from './overview'
import type { Section } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

// Collects every Section a display can hold: the top-level `sections` column
// plus each tab's own `sections` array (Display.tabs is a separate Json
// column — see src/lib/types/tabs.ts). Defensive against null/malformed JSON
// on older rows (including JSON-string-encoded columns) so a bad `sections`
// or `tabs` value never throws. Tab sections are only contributed when tabs
// are enabled — disabled tabs are never rendered on the public page, so
// their sections must not appear in Section Engagement.
export function collectAllSections(sections: unknown, tabs: unknown): Section[] {
  let sectionsValue: unknown = sections
  if (typeof sectionsValue === 'string') {
    try {
      sectionsValue = JSON.parse(sectionsValue)
    } catch {
      sectionsValue = []
    }
  }
  const topLevel = Array.isArray(sectionsValue) ? (sectionsValue as unknown as Section[]) : []

  let tabsValue: unknown = tabs
  if (typeof tabsValue === 'string') {
    try {
      tabsValue = JSON.parse(tabsValue)
    } catch {
      tabsValue = null
    }
  }

  let tabSections: Section[] = []
  try {
    const config = tabsValue as TabsConfig | null | undefined
    if (config && typeof config === 'object' && config.enabled === true && Array.isArray(config.tabs)) {
      tabSections = config.tabs.flatMap((tab) => (Array.isArray(tab?.sections) ? tab.sections : []))
    }
  } catch {
    tabSections = []
  }

  return [...topLevel, ...tabSections]
}

interface Props {
  params: Promise<{ displayId: string }>
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { displayId } = await params

    // Verify authentication
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get display and verify ownership
    const display = await db.display.findUnique({
      where: { id: displayId },
      select: { id: true, userId: true, title: true, views: true, sections: true, tabs: true },
    })

    if (!display) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    if (display.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get query params for date range
    const url = new URL(request.url)
    const days = parseInt(url.searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Lightweight live-only mode: the activity feed polls every 20s and only
    // needs a bounded slice of recent events + follows, not the full
    // aggregate rebuild (previous-window query, follower counts, breakdowns).
    if (url.searchParams.get('live') === '1') {
      const [liveEvents, liveFollows] = await Promise.all([
        db.analyticsEvent.findMany({
          where: { displayId, createdAt: { gte: startDate } },
          select: { eventType: true, country: true, metadata: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        db.follow.findMany({
          where: { followingId: display.userId, createdAt: { gte: startDate } },
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ])

      return NextResponse.json({
        liveActivity: buildLiveOnly({ recentEvents: liveEvents, recentFollows: liveFollows }),
      })
    }

    // Get analytics data
    const events = await db.analyticsEvent.findMany({
      where: {
        displayId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Previous window of equal length, for period-over-period deltas
    const previousStart = new Date(startDate)
    previousStart.setDate(previousStart.getDate() - days)

    const previousEvents = await db.analyticsEvent.findMany({
      where: { displayId, createdAt: { gte: previousStart, lt: startDate } },
      select: { eventType: true, sessionId: true, country: true, metadata: true, createdAt: true },
    })

    const [currentFollowers, previousFollowers, recentFollows] = await Promise.all([
      db.follow.count({ where: { followingId: display.userId, createdAt: { gte: startDate } } }),
      db.follow.count({ where: { followingId: display.userId, createdAt: { gte: previousStart, lt: startDate } } }),
      db.follow.findMany({
        where: { followingId: display.userId, createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    const sections = collectAllSections(display.sections, display.tabs)

    const overview = buildOverview({
      currentEvents: events.map((e) => ({
        eventType: e.eventType,
        sessionId: e.sessionId,
        country: e.country,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
      previousEvents,
      currentFollowers,
      previousFollowers,
      recentFollows,
      sections,
    })

    // Calculate summary stats
    const totalViews = events.filter((e) => e.eventType === 'view').length
    const uniqueSessions = new Set(
      events.filter((e) => e.eventType === 'view').map((e) => e.sessionId).filter(Boolean)
    ).size

    // Device breakdown
    const deviceBreakdown = events.reduce(
      (acc, e) => {
        if (e.eventType === 'view' && e.deviceType) {
          acc[e.deviceType] = (acc[e.deviceType] || 0) + 1
        }
        return acc
      },
      {} as Record<string, number>
    )

    // Browser breakdown
    const browserBreakdown = events.reduce(
      (acc, e) => {
        if (e.eventType === 'view' && e.browser) {
          acc[e.browser] = (acc[e.browser] || 0) + 1
        }
        return acc
      },
      {} as Record<string, number>
    )

    // Views by day
    const viewsByDay = events
      .filter((e) => e.eventType === 'view')
      .reduce(
        (acc, e) => {
          const day = e.createdAt.toISOString().split('T')[0]
          acc[day] = (acc[day] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

    // Unique visitors by day (distinct sessionId per day) — powers the visitors sparkline
    const sessionsByDay: Record<string, Set<string>> = {}
    for (const e of events) {
      if (e.eventType === 'view' && e.sessionId) {
        const day = e.createdAt.toISOString().split('T')[0]
        ;(sessionsByDay[day] ||= new Set()).add(e.sessionId)
      }
    }
    const uniqueVisitorsByDay: Record<string, number> = {}
    for (const [day, set] of Object.entries(sessionsByDay)) uniqueVisitorsByDay[day] = set.size

    // Top referrers
    const referrerCounts = events
      .filter((e) => e.eventType === 'view' && e.referrer)
      .reduce(
        (acc, e) => {
          try {
            const url = new URL(e.referrer!)
            const domain = url.hostname
            acc[domain] = (acc[domain] || 0) + 1
          } catch {
            acc['direct'] = (acc['direct'] || 0) + 1
          }
          return acc
        },
        {} as Record<string, number>
      )

    const topReferrers = Object.entries(referrerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }))

    return NextResponse.json({
      display: {
        id: display.id,
        title: display.title,
        totalViews: display.views,
      },
      period: {
        days,
        start: startDate.toISOString(),
        end: new Date().toISOString(),
      },
      summary: {
        views: totalViews,
        uniqueVisitors: uniqueSessions,
        interactions: overview.summary.interactions,
        shares: overview.summary.shares,
        followers: overview.summary.followers,
      },
      breakdown: {
        devices: deviceBreakdown,
        browsers: browserBreakdown,
        referrers: topReferrers,
      },
      viewsByDay,
      uniqueVisitorsByDay,
      previous: overview.previous,
      health: overview.health,
      liveActivity: overview.liveActivity,
      widgetPerformance: overview.widgetPerformance,
      sectionEngagement: overview.sectionEngagement,
    })
  } catch (error) {
    console.error('Analytics fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

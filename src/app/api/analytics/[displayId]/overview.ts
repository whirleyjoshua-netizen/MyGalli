import type { Section } from '@/lib/types/canvas'
import { parseInteractMetadata } from '@/lib/analytics-events'
import { computeHealth, type HealthResult, type MetricPair } from '@/lib/data-health'
import {
  liveActivityItems,
  sectionEngagement,
  widgetPerformance,
  type InteractionRecord,
  type LiveActivityItem,
  type RawActivity,
  type SectionEngagementRow,
  type WidgetPerformanceRow,
} from '@/lib/data-overview'

export const LIVE_ACTIVITY_LIMIT = 20

export interface OverviewEvent {
  eventType: string
  sessionId: string | null
  country: string | null
  metadata: unknown
  createdAt: Date
}

export interface OverviewInput {
  currentEvents: OverviewEvent[]
  previousEvents: OverviewEvent[]
  currentFollowers: number
  previousFollowers: number
  recentFollows: { createdAt: Date }[]
  sections: Section[]
}

export interface OverviewMetrics {
  views: number
  uniqueVisitors: number
  interactions: number
  shares: number
  followers: number
}

export interface OverviewResult {
  summary: OverviewMetrics
  previous: OverviewMetrics
  health: HealthResult
  liveActivity: LiveActivityItem[]
  widgetPerformance: WidgetPerformanceRow[]
  sectionEngagement: SectionEngagementRow[]
}

function countMetrics(events: OverviewEvent[], followers: number): OverviewMetrics {
  return {
    views: events.filter((e) => e.eventType === 'view').length,
    uniqueVisitors: new Set(
      events.filter((e) => e.eventType === 'view').map((e) => e.sessionId).filter(Boolean)
    ).size,
    interactions: events.filter((e) => e.eventType === 'interact').length,
    shares: events.filter((e) => e.eventType === 'share').length,
    followers,
  }
}

function interactionRecords(events: OverviewEvent[]): InteractionRecord[] {
  const records: InteractionRecord[] = []
  for (const event of events) {
    if (event.eventType !== 'interact') continue
    const parsed = parseInteractMetadata(event.metadata)
    if (!parsed) continue
    records.push({
      elementId: parsed.elementId,
      elementType: parsed.elementType,
      at: event.createdAt.toISOString(),
    })
  }
  return records
}

export interface LiveOnlyEvent {
  eventType: string
  country: string | null
  metadata: unknown
  createdAt: Date
}

export interface LiveOnlyInput {
  recentEvents: LiveOnlyEvent[]
  recentFollows: { createdAt: Date }[]
}

// Shared by the full overview build and the lightweight `?live=1` mode: turns
// raw events + follows into the sorted, capped activity feed shape.
function buildLiveActivity(
  events: LiveOnlyEvent[],
  follows: { createdAt: Date }[]
): LiveActivityItem[] {
  const raw: RawActivity[] = [
    ...events.map((event): RawActivity => {
      const parsed = event.eventType === 'interact' ? parseInteractMetadata(event.metadata) : null
      return {
        kind: event.eventType as RawActivity['kind'],
        elementType: parsed?.elementType,
        action: parsed?.action,
        country: event.country,
        at: event.createdAt.toISOString(),
      }
    }),
    ...follows.map((follow): RawActivity => ({
      kind: 'follow',
      country: null,
      at: follow.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, LIVE_ACTIVITY_LIMIT)

  return liveActivityItems(raw)
}

// Used by the `?live=1` fast path: just the activity feed, none of the
// aggregate/health computation the full overview does.
export function buildLiveOnly(input: LiveOnlyInput): LiveActivityItem[] {
  return buildLiveActivity(input.recentEvents, input.recentFollows)
}

export function buildOverview(input: OverviewInput): OverviewResult {
  const summary = countMetrics(input.currentEvents, input.currentFollowers)
  const previous = countMetrics(input.previousEvents, input.previousFollowers)

  const pair = (key: keyof OverviewMetrics): MetricPair => ({
    current: summary[key],
    previous: previous[key],
  })

  const health = computeHealth({
    views: pair('views'),
    visitors: pair('uniqueVisitors'),
    followers: pair('followers'),
    shares: pair('shares'),
    interactions: pair('interactions'),
  })

  const interactions = interactionRecords(input.currentEvents)

  return {
    summary,
    previous,
    health,
    liveActivity: buildLiveActivity(input.currentEvents, input.recentFollows),
    widgetPerformance: widgetPerformance(interactions, summary.views),
    sectionEngagement: sectionEngagement(input.sections, interactions),
  }
}

import {
  classifySource,
  identityKey,
  sessionStats,
  visitorSplit,
  type AudienceEvent,
  type SourceCategory,
} from '@/lib/data-audience'

export interface AudienceRow {
  sessionId: string | null
  visitorId: string | null
  country: string | null
  referrer: string | null
  utmSource: string | null
  deviceType: string | null
  browser: string | null
  createdAt: Date
  eventType: string
}

export interface AudienceInput {
  events: AudienceRow[]
  priorKeys: Set<string>
  ownHost: string
}

export interface AudienceResult {
  summary: {
    visitors: number
    sessions: number
    newVisitors: number
    returningVisitors: number
    avgSessionSeconds: number | null
    bounceRate: number
    measuredSessions: number
  }
  identityFallback: boolean
  hourCountsUtc: number[]
  geography: { country: string; count: number }[]
  unknownCountryEvents: number
  sources: { source: SourceCategory; count: number }[]
  devices: Record<string, number>
  browsers: Record<string, number>
}

function tally(map: Map<string, number>, key: string | null) {
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + 1)
}

export function buildAudience(input: AudienceInput): AudienceResult {
  const audienceEvents: AudienceEvent[] = input.events.map((e) => ({
    sessionId: e.sessionId,
    visitorId: e.visitorId,
    at: e.createdAt.toISOString(),
  }))

  const stats = sessionStats(audienceEvents)
  const split = visitorSplit(audienceEvents, input.priorKeys)

  const hourCountsUtc = new Array<number>(24).fill(0)
  const countries = new Map<string, number>()
  const sources = new Map<string, number>()
  const devices = new Map<string, number>()
  const browsers = new Map<string, number>()
  const sessions = new Set<string>()
  let unknownCountryEvents = 0
  let identityFallback = false

  for (const event of input.events) {
    if (event.sessionId) sessions.add(event.sessionId)
    if (!event.visitorId) identityFallback = true

    // Geography/sources/devices/browsers/hourCountsUtc describe VISITS, not
    // events — a single visitor clicking a poll 40 times must not swamp these
    // breakdowns. `interact`/`share` events are excluded; sessionStats and
    // visitorSplit above intentionally still see every event, since a
    // session's duration legitimately spans interactions and identity is
    // identity regardless of event type.
    if (event.eventType !== 'view') continue

    hourCountsUtc[event.createdAt.getUTCHours()] += 1

    if (event.country) tally(countries, event.country)
    else unknownCountryEvents += 1

    tally(sources, classifySource(event.referrer, event.utmSource, input.ownHost))
    tally(devices, event.deviceType)
    tally(browsers, event.browser)
  }

  return {
    summary: {
      visitors: split.visitors,
      sessions: sessions.size,
      newVisitors: split.newVisitors,
      returningVisitors: split.returningVisitors,
      avgSessionSeconds: stats.avgSessionSeconds,
      bounceRate: stats.bounceRate,
      measuredSessions: stats.measuredSessions,
    },
    identityFallback,
    hourCountsUtc,
    geography: Array.from(countries.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count),
    unknownCountryEvents,
    sources: Array.from(sources.entries())
      .map(([source, count]) => ({ source: source as SourceCategory, count }))
      .sort((a, b) => b.count - a.count),
    devices: Object.fromEntries(devices),
    browsers: Object.fromEntries(browsers),
  }
}

// Exported for the route: identity keys of everyone seen before the window.
export function priorKeysFrom(rows: { sessionId: string | null; visitorId: string | null }[]): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    const key = identityKey({ sessionId: row.sessionId, visitorId: row.visitorId, at: '' })
    if (key) keys.add(key)
  }
  return keys
}

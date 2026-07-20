// Pure audience aggregation. No I/O, no database, no framework imports — this
// module is consumed by both an API route and client components.

export interface AudienceEvent {
  sessionId: string | null
  visitorId: string | null
  at: string
}

export interface SessionStats {
  // null (not 0) when no session had two or more events, so the UI can show an
  // empty state rather than claim an average of zero.
  avgSessionSeconds: number | null
  bounceRate: number
  measuredSessions: number
}

// A stable identity for one person. Prefers the persistent visitor id; falls
// back to the per-tab session id for events recorded before visitorId existed
// (which overcounts, and the UI discloses that). Prefixed so a visitor id can
// never collide with an identical session id.
export function identityKey(event: AudienceEvent): string | null {
  if (event.visitorId) return `v:${event.visitorId}`
  if (event.sessionId) return `s:${event.sessionId}`
  return null
}

export function sessionStats(events: AudienceEvent[]): SessionStats {
  const bySession = new Map<string, number[]>()
  for (const event of events) {
    if (!event.sessionId) continue
    const time = new Date(event.at).getTime()
    if (Number.isNaN(time)) continue
    const bucket = bySession.get(event.sessionId) ?? []
    bucket.push(time)
    bySession.set(event.sessionId, bucket)
  }

  if (bySession.size === 0) {
    return { avgSessionSeconds: null, bounceRate: 0, measuredSessions: 0 }
  }

  let bounces = 0
  let totalSeconds = 0
  let measuredSessions = 0

  for (const times of bySession.values()) {
    if (times.length < 2) {
      bounces += 1
      continue
    }
    // Do not assume arrival order.
    totalSeconds += (Math.max(...times) - Math.min(...times)) / 1000
    measuredSessions += 1
  }

  return {
    avgSessionSeconds: measuredSessions > 0 ? totalSeconds / measuredSessions : null,
    bounceRate: (bounces / bySession.size) * 100,
    measuredSessions,
  }
}

export function visitorSplit(
  current: AudienceEvent[],
  priorKeys: Set<string>
): { visitors: number; newVisitors: number; returningVisitors: number } {
  const keys = new Set<string>()
  for (const event of current) {
    const key = identityKey(event)
    if (key) keys.add(key)
  }

  let returningVisitors = 0
  for (const key of keys) {
    if (priorKeys.has(key)) returningVisitors += 1
  }

  return {
    visitors: keys.size,
    newVisitors: keys.size - returningVisitors,
    returningVisitors,
  }
}

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

// `utcOffsetMinutes` is Date.prototype.getTimezoneOffset(): minutes BEHIND UTC,
// so UTC-5 is +300. Zones with a sub-hour offset round to the nearest hour.
export function peakHours(hourCountsUtc: number[], utcOffsetMinutes: number): number[] {
  const shift = Math.round(-utcOffsetMinutes / 60)
  const local = new Array<number>(24).fill(0)
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    const localHour = (((utcHour + shift) % 24) + 24) % 24
    local[localHour] += hourCountsUtc[utcHour] ?? 0
  }
  return local
}

export type SourceCategory = 'search' | 'social' | 'direct' | 'community' | 'referral'

export const SOURCE_LABELS: Record<SourceCategory, string> = {
  search: 'Search',
  social: 'Social',
  direct: 'Direct',
  community: 'Galli community',
  referral: 'Other sites',
}

const SEARCH_BRANDS = ['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'brave']
const SOCIAL_BRANDS = [
  'instagram', 'tiktok', 'facebook', 'twitter', 'linkedin',
  'pinterest', 'reddit', 'youtube', 'threads',
]
// Too generic to match as a domain label (`t`, `x`) — matched as exact hosts instead.
const SOCIAL_EXACT_HOSTS = ['t.co', 'x.com']

// True when any dot-separated label of `host` exactly equals a brand name.
// This is what stops `student.com` from matching `t.co`-style substrings and
// `mygoogle.com` from matching `google` — a label must be the WHOLE segment.
function hasLabelMatch(host: string, brands: string[]): boolean {
  const labels = host.split('.')
  return brands.some((brand) => labels.includes(brand))
}

function isExactHost(host: string, hosts: string[]): boolean {
  return hosts.includes(host)
}

export function classifySource(
  referrer: string | null,
  utmSource: string | null,
  ownHost: string
): SourceCategory {
  // An explicit campaign tag is more trustworthy than the referrer header.
  const utm = utmSource?.trim().toLowerCase()
  if (utm) {
    if (SEARCH_BRANDS.includes(utm)) return 'search'
    if (SOCIAL_BRANDS.includes(utm) || isExactHost(utm, SOCIAL_EXACT_HOSTS)) return 'social'
  }

  if (!referrer) return 'direct'

  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase()
  } catch {
    // A referrer we cannot parse tells us nothing; do not invent a source.
    return 'direct'
  }

  if (host === ownHost.toLowerCase() || host.endsWith(`.${ownHost.toLowerCase()}`)) return 'community'
  if (hasLabelMatch(host, SEARCH_BRANDS)) return 'search'
  if (hasLabelMatch(host, SOCIAL_BRANDS) || isExactHost(host, SOCIAL_EXACT_HOSTS)) return 'social'
  return 'referral'
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', DE: 'Germany', FR: 'France',
  CA: 'Canada', AU: 'Australia', JP: 'Japan', BR: 'Brazil', IN: 'India',
  NL: 'Netherlands', ES: 'Spain', IT: 'Italy', SE: 'Sweden', MX: 'Mexico',
  KR: 'South Korea', IE: 'Ireland', NZ: 'New Zealand', ZA: 'South Africa',
  NG: 'Nigeria', PL: 'Poland', PT: 'Portugal', NO: 'Norway', DK: 'Denmark',
  FI: 'Finland', CH: 'Switzerland', AT: 'Austria', BE: 'Belgium', SG: 'Singapore',
}

// Regional-indicator symbols: 'US' -> 🇺🇸. Only well-formed two-letter codes
// produce a flag; anything else renders a globe so the row never looks broken.
export function countryLabel(code: string): { flag: string; name: string } {
  const upper = (code ?? '').trim().toUpperCase()
  const name = COUNTRY_NAMES[upper] ?? upper

  if (!/^[A-Z]{2}$/.test(upper)) return { flag: '🌐', name }

  const flag = String.fromCodePoint(
    ...Array.from(upper).map((ch) => 0x1f1e6 + (ch.charCodeAt(0) - 65))
  )
  return { flag, name }
}

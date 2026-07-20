import { describe, it, expect } from 'vitest'
import {
  identityKey,
  sessionStats,
  visitorSplit,
  peakHours,
  classifySource,
  countryLabel,
  SOURCE_LABELS,
  type AudienceEvent,
} from './data-audience'

const ev = (sessionId: string | null, at: string, visitorId: string | null = null): AudienceEvent =>
  ({ sessionId, visitorId, at })

describe('sessionStats', () => {
  it('measures a session as last minus first event', () => {
    const out = sessionStats([
      ev('s1', '2026-07-20T10:00:00Z'),
      ev('s1', '2026-07-20T10:02:30Z'),
    ])
    expect(out.avgSessionSeconds).toBe(150)
    expect(out.measuredSessions).toBe(1)
  })

  it('does not assume events arrive in order', () => {
    const out = sessionStats([
      ev('s1', '2026-07-20T10:02:30Z'),
      ev('s1', '2026-07-20T10:00:00Z'),
    ])
    expect(out.avgSessionSeconds).toBe(150)
  })

  it('averages across sessions, excluding single-event ones', () => {
    const out = sessionStats([
      ev('s1', '2026-07-20T10:00:00Z'),
      ev('s1', '2026-07-20T10:00:10Z'),
      ev('s2', '2026-07-20T11:00:00Z'),
      ev('s2', '2026-07-20T11:00:30Z'),
      ev('s3', '2026-07-20T12:00:00Z'),
    ])
    // (10 + 30) / 2 measured sessions — s3 excluded, not averaged in as zero
    expect(out.avgSessionSeconds).toBe(20)
    expect(out.measuredSessions).toBe(2)
  })

  it('counts single-event sessions as bounces', () => {
    const out = sessionStats([
      ev('s1', '2026-07-20T10:00:00Z'),
      ev('s1', '2026-07-20T10:00:10Z'),
      ev('s2', '2026-07-20T12:00:00Z'),
    ])
    expect(out.bounceRate).toBeCloseTo(50)
  })

  it('returns null duration when no session has two events', () => {
    const out = sessionStats([ev('s1', '2026-07-20T10:00:00Z')])
    expect(out.avgSessionSeconds).toBeNull()
    expect(out.measuredSessions).toBe(0)
    expect(out.bounceRate).toBe(100)
  })

  it('handles no events without dividing by zero', () => {
    const out = sessionStats([])
    expect(out.avgSessionSeconds).toBeNull()
    expect(out.bounceRate).toBe(0)
    expect(out.measuredSessions).toBe(0)
  })

  it('ignores events with no session id', () => {
    const out = sessionStats([ev(null, '2026-07-20T10:00:00Z'), ev(null, '2026-07-20T10:05:00Z')])
    expect(out.avgSessionSeconds).toBeNull()
    expect(out.bounceRate).toBe(0)
  })
})

describe('identityKey', () => {
  it('prefers visitorId', () => {
    expect(identityKey(ev('s1', '2026-07-20T10:00:00Z', 'v1'))).toBe('v:v1')
  })

  it('falls back to sessionId for pre-visitorId events', () => {
    expect(identityKey(ev('s1', '2026-07-20T10:00:00Z', null))).toBe('s:s1')
  })

  it('returns null when neither is present', () => {
    expect(identityKey(ev(null, '2026-07-20T10:00:00Z', null))).toBeNull()
  })

  it('never collides a visitor id with an identical session id', () => {
    expect(identityKey(ev('x', '2026-07-20T10:00:00Z', null)))
      .not.toBe(identityKey(ev(null, '2026-07-20T10:00:00Z', 'x')))
  })
})

describe('visitorSplit', () => {
  it('counts a visitor seen before the window as returning', () => {
    const out = visitorSplit(
      [ev('s1', '2026-07-20T10:00:00Z', 'v1'), ev('s2', '2026-07-20T11:00:00Z', 'v2')],
      new Set(['v:v1'])
    )
    expect(out).toEqual({ visitors: 2, newVisitors: 1, returningVisitors: 1 })
  })

  it('deduplicates a visitor appearing many times in the window', () => {
    const out = visitorSplit(
      [
        ev('s1', '2026-07-20T10:00:00Z', 'v1'),
        ev('s2', '2026-07-20T11:00:00Z', 'v1'),
        ev('s3', '2026-07-20T12:00:00Z', 'v1'),
      ],
      new Set()
    )
    expect(out).toEqual({ visitors: 1, newVisitors: 1, returningVisitors: 0 })
  })

  it('counts everyone as new when there is no prior history', () => {
    const out = visitorSplit([ev('s1', '2026-07-20T10:00:00Z', 'v1')], new Set())
    expect(out).toEqual({ visitors: 1, newVisitors: 1, returningVisitors: 0 })
  })

  it('ignores events with no usable identity', () => {
    const out = visitorSplit([ev(null, '2026-07-20T10:00:00Z', null)], new Set())
    expect(out).toEqual({ visitors: 0, newVisitors: 0, returningVisitors: 0 })
  })
})

describe('peakHours', () => {
  const counts = (pairs: Record<number, number>) =>
    Array.from({ length: 24 }, (_, h) => pairs[h] ?? 0)

  it('returns the input unchanged at UTC', () => {
    const input = counts({ 9: 5 })
    expect(peakHours(input, 0)[9]).toBe(5)
  })

  it('shifts back for a western offset (UTC-5, getTimezoneOffset 300)', () => {
    // 14:00 UTC is 09:00 local
    expect(peakHours(counts({ 14: 7 }), 300)[9]).toBe(7)
  })

  it('shifts forward for an eastern offset (UTC+2, getTimezoneOffset -120)', () => {
    // 08:00 UTC is 10:00 local
    expect(peakHours(counts({ 8: 3 }), -120)[10]).toBe(3)
  })

  it('wraps across midnight in both directions', () => {
    // 02:00 UTC at UTC-5 is 21:00 the previous day
    expect(peakHours(counts({ 2: 4 }), 300)[21]).toBe(4)
    // 23:00 UTC at UTC+2 is 01:00 the next day
    expect(peakHours(counts({ 23: 6 }), -120)[1]).toBe(6)
  })

  it('rounds a sub-hour offset to the nearest hour (UTC+5:30)', () => {
    // getTimezoneOffset for UTC+5:30 is -330 -> rounds to +6
    expect(peakHours(counts({ 0: 2 }), -330)[6]).toBe(2)
  })

  it('always returns 24 buckets preserving the total', () => {
    const out = peakHours(counts({ 3: 1, 15: 2 }), 300)
    expect(out).toHaveLength(24)
    expect(out.reduce((a, b) => a + b, 0)).toBe(3)
  })
})

describe('classifySource', () => {
  const own = 'mygalli.com'

  it('treats a missing referrer as direct', () => {
    expect(classifySource(null, null, own)).toBe('direct')
    expect(classifySource('', null, own)).toBe('direct')
  })

  it('recognises search engines', () => {
    expect(classifySource('https://www.google.com/search?q=x', null, own)).toBe('search')
    expect(classifySource('https://duckduckgo.com/', null, own)).toBe('search')
    expect(classifySource('https://www.bing.com/', null, own)).toBe('search')
  })

  it('recognises social networks', () => {
    expect(classifySource('https://instagram.com/p/1', null, own)).toBe('social')
    expect(classifySource('https://www.tiktok.com/@a', null, own)).toBe('social')
    expect(classifySource('https://t.co/abc', null, own)).toBe('social')
  })

  it('treats our own host as community traffic', () => {
    expect(classifySource('https://mygalli.com/explore', null, own)).toBe('community')
  })

  it('falls back to referral for an unknown host', () => {
    expect(classifySource('https://some-blog.example/post', null, own)).toBe('referral')
  })

  it('lets an explicit utm_source override the referrer', () => {
    expect(classifySource('https://some-blog.example/post', 'instagram', own)).toBe('social')
    expect(classifySource(null, 'google', own)).toBe('search')
  })

  it('treats a malformed referrer as direct rather than throwing', () => {
    expect(classifySource('not a url', null, own)).toBe('direct')
  })

  it('matches subdomains of a known host', () => {
    expect(classifySource('https://m.facebook.com/x', null, own)).toBe('social')
  })

  it('has a label for every category', () => {
    for (const category of ['search', 'social', 'direct', 'community', 'referral'] as const) {
      expect(SOURCE_LABELS[category]).toBeTruthy()
    }
  })
})

describe('countryLabel', () => {
  it('builds a flag emoji from the ISO code', () => {
    expect(countryLabel('US').flag).toBe('🇺🇸')
    expect(countryLabel('JP').flag).toBe('🇯🇵')
  })

  it('names known countries', () => {
    expect(countryLabel('GB').name).toBe('United Kingdom')
  })

  it('falls back to the raw code for an unmapped country', () => {
    expect(countryLabel('ZZ').name).toBe('ZZ')
  })

  it('is case insensitive', () => {
    expect(countryLabel('us').flag).toBe('🇺🇸')
    expect(countryLabel('us').name).toBe('United States')
  })

  it('degrades gracefully on a malformed code', () => {
    const out = countryLabel('XYZ')
    expect(out.name).toBe('XYZ')
    expect(typeof out.flag).toBe('string')
  })
})

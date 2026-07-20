import { describe, it, expect } from 'vitest'
import {
  identityKey,
  sessionStats,
  visitorSplit,
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

import { describe, it, expect } from 'vitest'
import { buildAudience, type AudienceInput } from './aggregate'

const base = (): AudienceInput => ({
  ownHost: 'mygalli.com',
  events: [
    { sessionId: 's1', visitorId: 'v1', country: 'US', referrer: 'https://google.com/', utmSource: null, deviceType: 'desktop', browser: 'chrome', createdAt: new Date('2026-07-20T14:00:00Z'), eventType: 'view' },
    { sessionId: 's1', visitorId: 'v1', country: 'US', referrer: 'https://google.com/', utmSource: null, deviceType: 'desktop', browser: 'chrome', createdAt: new Date('2026-07-20T14:01:00Z'), eventType: 'interact' },
    { sessionId: 's2', visitorId: 'v2', country: 'DE', referrer: null, utmSource: null, deviceType: 'mobile', browser: 'safari', createdAt: new Date('2026-07-20T09:00:00Z'), eventType: 'view' },
  ],
  priorKeys: new Set(['v:v1']),
})

describe('buildAudience', () => {
  it('summarises visitors, sessions and returning split', () => {
    const out = buildAudience(base())
    expect(out.summary.visitors).toBe(2)
    expect(out.summary.sessions).toBe(2)
    expect(out.summary.returningVisitors).toBe(1)
    expect(out.summary.newVisitors).toBe(1)
  })

  it('reports average session length and bounce rate', () => {
    const out = buildAudience(base())
    expect(out.summary.avgSessionSeconds).toBe(60)
    expect(out.summary.bounceRate).toBeCloseTo(50)
  })

  it('flags the identity fallback only when an event lacks a visitorId', () => {
    expect(buildAudience(base()).identityFallback).toBe(false)

    const legacy = base()
    legacy.events[0].visitorId = null
    expect(buildAudience(legacy).identityFallback).toBe(true)
  })

  it('buckets events into 24 UTC hours, counting views only', () => {
    const out = buildAudience(base())
    expect(out.hourCountsUtc).toHaveLength(24)
    // e0 (view, 14:00) counts; e1 (interact, 14:01) does not.
    expect(out.hourCountsUtc[14]).toBe(1)
    expect(out.hourCountsUtc[9]).toBe(1)
  })

  it('ranks geography and reports how many events had no country, counting views only', () => {
    const input = base()
    input.events.push({ ...input.events[2], country: null, sessionId: 's3', visitorId: 'v3' })
    const out = buildAudience(input)
    expect(out.geography[0]).toEqual({ country: 'US', count: 1 })
    expect(out.unknownCountryEvents).toBe(1)
  })

  it('classifies sources, counting views only', () => {
    const out = buildAudience(base())
    const search = out.sources.find((s) => s.source === 'search')
    const direct = out.sources.find((s) => s.source === 'direct')
    expect(search?.count).toBe(1)
    expect(direct?.count).toBe(1)
  })

  it('counts devices and browsers, counting views only', () => {
    const out = buildAudience(base())
    expect(out.devices).toEqual({ desktop: 1, mobile: 1 })
    expect(out.browsers).toEqual({ chrome: 1, safari: 1 })
  })

  it('handles an empty window without dividing by zero', () => {
    const out = buildAudience({ ownHost: 'mygalli.com', events: [], priorKeys: new Set() })
    expect(out.summary.visitors).toBe(0)
    expect(out.summary.avgSessionSeconds).toBeNull()
    expect(out.geography).toEqual([])
    expect(out.hourCountsUtc).toHaveLength(24)
  })

  it('counts a visitor once per breakdown, not once per event — a single visitor clicking 40 times must not swamp geography/devices/browsers/sources', () => {
    const heavyClicker: AudienceInput = {
      ownHost: 'mygalli.com',
      events: [
        { sessionId: 's1', visitorId: 'v1', country: 'DE', referrer: null, utmSource: null, deviceType: 'mobile', browser: 'safari', createdAt: new Date('2026-07-20T10:00:00Z'), eventType: 'view' },
        ...Array.from({ length: 40 }, (_, i) => ({
          sessionId: 's1', visitorId: 'v1', country: 'DE', referrer: null, utmSource: null,
          deviceType: 'mobile', browser: 'safari',
          createdAt: new Date(`2026-07-20T10:${String(i % 60).padStart(2, '0')}:00Z`),
          eventType: 'interact',
        })),
      ],
      priorKeys: new Set(),
    }
    const out = buildAudience(heavyClicker)
    expect(out.geography).toEqual([{ country: 'DE', count: 1 }])
    expect(out.devices).toEqual({ mobile: 1 })
    expect(out.browsers).toEqual({ safari: 1 })
    expect(out.sources.find((s) => s.source === 'direct')?.count).toBe(1)
  })

  // Sanity check for the mutation-check step in the release review: if the
  // view-only filter is removed, this must fail (it would report count 41).
})

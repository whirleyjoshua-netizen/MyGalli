import { describe, it, expect } from 'vitest'
import { buildAudience, type AudienceInput } from './aggregate'

const base = (): AudienceInput => ({
  ownHost: 'mygalli.com',
  events: [
    { sessionId: 's1', visitorId: 'v1', country: 'US', referrer: 'https://google.com/', utmSource: null, deviceType: 'desktop', browser: 'chrome', createdAt: new Date('2026-07-20T14:00:00Z') },
    { sessionId: 's1', visitorId: 'v1', country: 'US', referrer: 'https://google.com/', utmSource: null, deviceType: 'desktop', browser: 'chrome', createdAt: new Date('2026-07-20T14:01:00Z') },
    { sessionId: 's2', visitorId: 'v2', country: 'DE', referrer: null, utmSource: null, deviceType: 'mobile', browser: 'safari', createdAt: new Date('2026-07-20T09:00:00Z') },
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

  it('buckets events into 24 UTC hours', () => {
    const out = buildAudience(base())
    expect(out.hourCountsUtc).toHaveLength(24)
    expect(out.hourCountsUtc[14]).toBe(2)
    expect(out.hourCountsUtc[9]).toBe(1)
  })

  it('ranks geography and reports how many events had no country', () => {
    const input = base()
    input.events.push({ ...input.events[2], country: null, sessionId: 's3', visitorId: 'v3' })
    const out = buildAudience(input)
    expect(out.geography[0]).toEqual({ country: 'US', count: 2 })
    expect(out.unknownCountryEvents).toBe(1)
  })

  it('classifies sources', () => {
    const out = buildAudience(base())
    const search = out.sources.find((s) => s.source === 'search')
    const direct = out.sources.find((s) => s.source === 'direct')
    expect(search?.count).toBe(2)
    expect(direct?.count).toBe(1)
  })

  it('counts devices and browsers', () => {
    const out = buildAudience(base())
    expect(out.devices).toEqual({ desktop: 2, mobile: 1 })
    expect(out.browsers).toEqual({ chrome: 2, safari: 1 })
  })

  it('handles an empty window without dividing by zero', () => {
    const out = buildAudience({ ownHost: 'mygalli.com', events: [], priorKeys: new Set() })
    expect(out.summary.visitors).toBe(0)
    expect(out.summary.avgSessionSeconds).toBeNull()
    expect(out.geography).toEqual([])
    expect(out.hourCountsUtc).toHaveLength(24)
  })
})

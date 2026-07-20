import { describe, it, expect } from 'vitest'
import { buildOverview, type OverviewInput } from './overview'
import { collectAllSections } from './route'

const baseInput = (): OverviewInput => ({
  currentEvents: [
    { eventType: 'view', sessionId: 's1', country: 'DE', metadata: null, createdAt: new Date('2026-07-18T10:00:00Z') },
    { eventType: 'view', sessionId: 's2', country: 'US', metadata: null, createdAt: new Date('2026-07-19T10:00:00Z') },
    { eventType: 'share', sessionId: 's1', country: 'DE', metadata: { channel: 'copy' }, createdAt: new Date('2026-07-19T10:05:00Z') },
    {
      eventType: 'interact', sessionId: 's2', country: 'US',
      metadata: { elementId: 'b', elementType: 'poll', action: 'vote' },
      createdAt: new Date('2026-07-19T10:06:00Z'),
    },
  ],
  previousEvents: [
    { eventType: 'view', sessionId: 'p1', country: null, metadata: null, createdAt: new Date('2026-06-19T10:00:00Z') },
  ],
  currentFollowers: 3,
  previousFollowers: 2,
  recentFollows: [{ createdAt: new Date('2026-07-19T09:00:00Z') }],
  sections: [
    { id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [{ id: 'b', type: 'poll' }] }] } as never,
  ],
})

describe('buildOverview', () => {
  it('counts each metric for the current window', () => {
    const out = buildOverview(baseInput())
    expect(out.summary).toEqual({ views: 2, uniqueVisitors: 2, interactions: 1, shares: 1, followers: 3 })
  })

  it('reports the previous window for delta math', () => {
    const out = buildOverview(baseInput())
    expect(out.previous).toEqual({ views: 1, uniqueVisitors: 1, interactions: 0, shares: 0, followers: 2 })
  })

  it('returns a health block flagged insufficient for a low-traffic page', () => {
    const out = buildOverview(baseInput())
    expect(out.health.insufficientData).toBe(true)
  })

  it('shapes live activity newest-first and merges follows in', () => {
    const out = buildOverview(baseInput())
    expect(out.liveActivity.length).toBe(5)
    expect(out.liveActivity[0].at >= out.liveActivity[1].at).toBe(true)
    expect(out.liveActivity.some((i) => i.label === 'Someone followed you')).toBe(true)
  })

  it('groups widget performance from interact metadata only', () => {
    const out = buildOverview(baseInput())
    expect(out.widgetPerformance).toHaveLength(1)
    expect(out.widgetPerformance[0].elementType).toBe('poll')
  })

  it('ranks section engagement using derived labels', () => {
    const out = buildOverview(baseInput())
    expect(out.sectionEngagement).toEqual([{ id: 's1', label: 'Poll', count: 1 }])
  })

  it('ignores interact events whose metadata is malformed', () => {
    const input = baseInput()
    input.currentEvents.push({
      eventType: 'interact', sessionId: 's3', country: null,
      metadata: { nonsense: true }, createdAt: new Date('2026-07-19T10:07:00Z'),
    })
    const out = buildOverview(input)
    expect(out.widgetPerformance).toHaveLength(1)
  })

  it('attributes an interaction on an element living inside a tab section', () => {
    // Mirrors what the route does: collectAllSections() merges display.sections
    // with each enabled tab's sections before buildOverview ever runs, so an
    // element that only exists inside a tab's Section[] must still be
    // attributed to that section's engagement row.
    const input = baseInput()
    const tabSections = collectAllSections(input.sections, {
      enabled: true,
      tabs: [
        {
          id: 't1',
          label: 'Tab 1',
          slug: 'tab-1',
          sections: [
            {
              id: 'tab-section-1',
              layout: 'full-width',
              columns: [{ id: 'tc1', elements: [{ id: 'tab-el', type: 'poll' }] }],
            },
          ],
        },
      ],
    } as never)
    input.sections = tabSections
    input.currentEvents.push({
      eventType: 'interact', sessionId: 's4', country: 'US',
      metadata: { elementId: 'tab-el', elementType: 'poll', action: 'vote' },
      createdAt: new Date('2026-07-19T10:08:00Z'),
    })

    const out = buildOverview(input)
    const tabRow = out.sectionEngagement.find((row) => row.id === 'tab-section-1')
    expect(tabRow).toBeDefined()
    expect(tabRow?.count).toBe(1)
  })

  it('caps live activity at 20 items', () => {
    const input = baseInput()
    for (let i = 0; i < 40; i++) {
      input.currentEvents.push({
        eventType: 'view', sessionId: `x${i}`, country: null, metadata: null,
        createdAt: new Date('2026-07-19T09:00:00Z'),
      })
    }
    expect(buildOverview(input).liveActivity).toHaveLength(20)
  })
})

const topSection = { id: 'top-1', layout: 'full-width', columns: [{ id: 'c1', elements: [] }] }
const tabSection = { id: 'tab-1', layout: 'full-width', columns: [{ id: 'tc1', elements: [] }] }

describe('collectAllSections', () => {
  it('returns only the top-level sections when there are no tabs', () => {
    expect(collectAllSections([topSection], null)).toEqual([topSection])
    expect(collectAllSections([topSection], undefined)).toEqual([topSection])
  })

  it('merges sections from an enabled tabs config object', () => {
    const tabs = { enabled: true, tabs: [{ id: 't1', label: 'Tab', slug: 'tab', sections: [tabSection] }] }
    expect(collectAllSections([topSection], tabs)).toEqual([topSection, tabSection])
  })

  it('parses tabs when it arrives as a JSON string', () => {
    const tabs = { enabled: true, tabs: [{ id: 't1', label: 'Tab', slug: 'tab', sections: [tabSection] }] }
    expect(collectAllSections([topSection], JSON.stringify(tabs))).toEqual([topSection, tabSection])
  })

  it('parses sections when it arrives as a JSON string', () => {
    expect(collectAllSections(JSON.stringify([topSection]), null)).toEqual([topSection])
  })

  it('treats malformed/unparseable tabs as no tabs, never throwing', () => {
    expect(collectAllSections([topSection], '{not valid json')).toEqual([topSection])
    expect(collectAllSections([topSection], 'just a string')).toEqual([topSection])
    expect(collectAllSections([topSection], 42)).toEqual([topSection])
  })

  it('treats malformed/unparseable sections as empty, never throwing', () => {
    expect(collectAllSections('{not valid json', null)).toEqual([])
    expect(collectAllSections(null, null)).toEqual([])
  })

  it('skips tab sections when tabs are disabled', () => {
    const tabs = { enabled: false, tabs: [{ id: 't1', label: 'Tab', slug: 'tab', sections: [tabSection] }] }
    expect(collectAllSections([topSection], tabs)).toEqual([topSection])
  })

  it('collects a tab section missing columns as-is, without throwing', () => {
    const brokenTabSection = { id: 'tab-broken', layout: 'full-width' } as never
    const tabs = { enabled: true, tabs: [{ id: 't1', label: 'Tab', slug: 'tab', sections: [brokenTabSection] }] }
    let result: unknown[] = []
    expect(() => {
      result = collectAllSections([topSection], tabs)
    }).not.toThrow()
    expect(result).toEqual([topSection, brokenTabSection])

    // Downstream, buildOverview's sectionEngagement (src/lib/data-overview.ts
    // elementsOf) must also tolerate the columns-less section rather than
    // throwing and 500ing the whole analytics route.
    const input = baseInput()
    input.sections = result as never
    expect(() => buildOverview(input)).not.toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import type { Section } from '@/lib/types/canvas'
import {
  deriveSectionLabel,
  liveActivityItems,
  sectionEngagement,
  widgetPerformance,
  type InteractionRecord,
  type RawActivity,
} from './data-overview'

// LayoutMode is 'full-width' | 'two-column' | 'three-column' — no other values exist.
function section(id: string, elements: { id: string; type: string; content?: string }[]): Section {
  return { id, layout: 'full-width', columns: [{ id: `${id}_c`, elements: elements as never }] } as Section
}

describe('deriveSectionLabel', () => {
  it('prefers the text of the first heading element', () => {
    const s = section('s1', [
      { id: 'e1', type: 'heading', content: 'Landing Hero' },
      { id: 'e2', type: 'gallery' },
    ])
    expect(deriveSectionLabel(s, 0)).toBe('Landing Hero')
  })

  it('truncates a very long heading', () => {
    const s = section('s1', [{ id: 'e1', type: 'heading', content: 'x'.repeat(80) }])
    expect(deriveSectionLabel(s, 0).length).toBeLessThanOrEqual(40)
  })

  it('falls back to a humanised dominant element type', () => {
    const s = section('s1', [
      { id: 'e1', type: 'gallery' },
      { id: 'e2', type: 'gallery' },
      { id: 'e3', type: 'text' },
    ])
    expect(deriveSectionLabel(s, 0)).toBe('Gallery')
  })

  it('humanises hyphenated element types', () => {
    const s = section('s1', [{ id: 'e1', type: 'link-hub' }])
    expect(deriveSectionLabel(s, 0)).toBe('Link Hub')
  })

  it('falls back to a positional name for an empty section', () => {
    expect(deriveSectionLabel(section('s1', []), 3)).toBe('Section 4')
  })

  it('ignores a heading whose content is blank', () => {
    const s = section('s1', [
      { id: 'e1', type: 'heading', content: '   ' },
      { id: 'e2', type: 'timeline' },
    ])
    expect(deriveSectionLabel(s, 0)).toBe('Timeline')
  })
})

describe('sectionEngagement', () => {
  it('attributes interactions to the section containing the element, ranked desc', () => {
    const sections = [
      section('s1', [{ id: 'a', type: 'heading', content: 'Hero' }, { id: 'b', type: 'poll' }]),
      section('s2', [{ id: 'c', type: 'heading', content: 'Contact' }]),
    ]
    const interactions: InteractionRecord[] = [
      { elementId: 'b', elementType: 'poll', at: '2026-07-19T10:00:00Z' },
      { elementId: 'b', elementType: 'poll', at: '2026-07-19T11:00:00Z' },
      { elementId: 'c', elementType: 'form', at: '2026-07-19T12:00:00Z' },
    ]
    expect(sectionEngagement(sections, interactions)).toEqual([
      { id: 's1', label: 'Hero', count: 2 },
      { id: 's2', label: 'Contact', count: 1 },
    ])
  })

  it('includes sections with zero interactions', () => {
    const sections = [section('s1', [{ id: 'a', type: 'poll' }])]
    expect(sectionEngagement(sections, [])).toEqual([{ id: 's1', label: 'Poll', count: 0 }])
  })

  it('ignores interactions whose element no longer exists', () => {
    const sections = [section('s1', [{ id: 'a', type: 'poll' }])]
    const rows = sectionEngagement(sections, [{ elementId: 'gone', elementType: 'poll', at: '2026-07-19T10:00:00Z' }])
    expect(rows).toEqual([{ id: 's1', label: 'Poll', count: 0 }])
  })
})

describe('widgetPerformance', () => {
  const interactions: InteractionRecord[] = [
    { elementId: 'p', elementType: 'poll', at: '2026-07-18T10:00:00Z' },
    { elementId: 'p', elementType: 'poll', at: '2026-07-19T10:00:00Z' },
    { elementId: 'f', elementType: 'form', at: '2026-07-19T10:00:00Z' },
  ]

  it('groups by element type, ranked by count desc', () => {
    const rows = widgetPerformance(interactions, 100)
    expect(rows.map((r) => r.elementType)).toEqual(['poll', 'form'])
    expect(rows[0].count).toBe(2)
  })

  it('uses the per-type primary stat wording', () => {
    const rows = widgetPerformance(interactions, 100)
    expect(rows.find((r) => r.elementType === 'poll')!.stat).toBe('2% of viewers voted')
    expect(rows.find((r) => r.elementType === 'form')!.stat).toBe('1 submission')
  })

  it('singularises and pluralises the stat correctly', () => {
    const rows = widgetPerformance(
      [
        { elementId: 'f', elementType: 'form', at: '2026-07-19T10:00:00Z' },
        { elementId: 'f', elementType: 'form', at: '2026-07-19T11:00:00Z' },
      ],
      10
    )
    expect(rows[0].stat).toBe('2 submissions')
  })

  it('falls back to a generic interaction stat for unmapped types', () => {
    const rows = widgetPerformance([{ elementId: 'x', elementType: 'mystery', at: '2026-07-19T10:00:00Z' }], 10)
    expect(rows[0].stat).toBe('1 interaction')
    expect(rows[0].label).toBe('Mystery')
  })

  it('avoids dividing by zero when there are no views', () => {
    const rows = widgetPerformance([{ elementId: 'p', elementType: 'poll', at: '2026-07-19T10:00:00Z' }], 0)
    expect(rows[0].stat).toBe('0% of viewers voted')
  })

  it('produces a per-day trend series', () => {
    const rows = widgetPerformance(interactions, 100)
    expect(rows.find((r) => r.elementType === 'poll')!.trend).toEqual([1, 1])
  })
})

describe('liveActivityItems', () => {
  it('shapes each event kind into human copy', () => {
    const raw: RawActivity[] = [
      { kind: 'view', country: 'DE', at: '2026-07-19T12:00:00Z' },
      { kind: 'interact', elementType: 'poll', action: 'vote', country: 'US', at: '2026-07-19T11:59:00Z' },
      { kind: 'share', country: null, at: '2026-07-19T11:58:00Z' },
      { kind: 'follow', country: null, at: '2026-07-19T11:57:00Z' },
    ]
    const items = liveActivityItems(raw)
    expect(items.map((i) => i.label)).toEqual([
      'Someone from Germany opened your page',
      'Someone from the United States voted in your poll',
      'Someone shared your page',
      'Someone followed you',
    ])
  })

  it('omits the country clause when geo is unknown', () => {
    const items = liveActivityItems([{ kind: 'view', country: null, at: '2026-07-19T12:00:00Z' }])
    expect(items[0].label).toBe('Someone opened your page')
  })

  it('falls back to the raw code for unrecognised countries', () => {
    const items = liveActivityItems([{ kind: 'view', country: 'ZZ', at: '2026-07-19T12:00:00Z' }])
    expect(items[0].label).toBe('Someone from ZZ opened your page')
  })

  it('assigns stable unique ids', () => {
    const items = liveActivityItems([
      { kind: 'view', country: 'DE', at: '2026-07-19T12:00:00Z' },
      { kind: 'view', country: 'DE', at: '2026-07-19T12:00:00Z' },
    ])
    expect(items[0].id).not.toBe(items[1].id)
  })
})

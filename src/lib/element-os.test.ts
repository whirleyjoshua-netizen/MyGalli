import { describe, it, expect } from 'vitest'
import { collectDataElements, elementTitle, pageElementKey, bulletinElementKey, deriveStatus, computeEngagement, MIN_VIEWERS_FOR_ENGAGEMENT } from './element-os'
import type { Section } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

const section = (id: string, elements: any[]): Section =>
  ({ id, layout: 'single', columns: [{ id: `${id}-c1`, elements }] }) as unknown as Section

describe('collectDataElements', () => {
  it('collects data-collecting elements with a 1-based section index', () => {
    const sections = [
      section('s1', [{ id: 'e1', type: 'poll', pollQuestion: 'Best player?' }]),
      section('s2', [{ id: 'e2', type: 'waitlist', waitlistTitle: 'Beta list' }]),
    ]
    const out = collectDataElements(sections, null, 'd1', 'Homepage')
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({
      key: 'd1:e1',
      elementId: 'e1',
      type: 'poll',
      title: 'Best player?',
      pageId: 'd1',
      pageTitle: 'Homepage',
      sectionIndex: 1,
    })
    expect(out[1].sectionIndex).toBe(2)
  })

  it('excludes elements with no response store', () => {
    const sections = [
      section('s1', [
        { id: 'e1', type: 'text' },
        { id: 'e2', type: 'gallery' },
        { id: 'e3', type: 'tip-jar' },
        { id: 'e4', type: 'tracker' },
        { id: 'e5', type: 'poll', pollQuestion: 'Kept' },
      ]),
    ]
    const out = collectDataElements(sections, null, 'd1', 'Homepage')
    expect(out.map((e) => e.elementId)).toEqual(['e5'])
  })

  it('walks tabbed pages and records the tab label', () => {
    const tabs = {
      tabs: [{ id: 't1', label: 'Reviews', sections: [section('s9', [{ id: 'e9', type: 'rating', ratingQuestion: 'How was it?' }])] }],
    } as unknown as TabsConfig
    const out = collectDataElements([], tabs, 'd1', 'Homepage')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ elementId: 'e9', tabLabel: 'Reviews', sectionIndex: 1 })
  })

  it('keeps elements from different pages distinct despite identical element ids', () => {
    const a = collectDataElements([section('s1', [{ id: 'block-1', type: 'poll' }])], null, 'd1', 'A')
    const b = collectDataElements([section('s1', [{ id: 'block-1', type: 'poll' }])], null, 'd2', 'B')
    expect(a[0].key).not.toBe(b[0].key)
  })

  it('tolerates malformed sections without throwing', () => {
    const out = collectDataElements(
      [{ id: 's1' } as unknown as Section, section('s2', [{ id: 'e1', type: 'poll' }])],
      null,
      'd1',
      'Homepage'
    )
    expect(out).toHaveLength(1)
  })
})

describe('elementTitle', () => {
  it.each([
    [{ id: 'e', type: 'poll', pollQuestion: 'P' }, 'P'],
    [{ id: 'e', type: 'mcq', mcqQuestion: 'M' }, 'M'],
    [{ id: 'e', type: 'rating', ratingQuestion: 'R' }, 'R'],
    [{ id: 'e', type: 'shortanswer', shortAnswerQuestion: 'S' }, 'S'],
    [{ id: 'e', type: 'comment', commentTitle: 'C' }, 'C'],
    [{ id: 'e', type: 'waitlist', waitlistTitle: 'W' }, 'W'],
    [{ id: 'e', type: 'mailbox', mailboxTitle: 'MB' }, 'MB'],
    [{ id: 'e', type: 'appointments', apptTitle: 'A' }, 'A'],
    [{ id: 'e', type: 'rsvp', rsvpSubject: 'RS' }, 'RS'],
    [{ id: 'e', type: 'wedding-rsvp', weddingRsvpTitle: 'WR' }, 'WR'],
    [{ id: 'e', type: 'business-review', bizReviewTitle: 'BR' }, 'BR'],
  ])('reads the per-type title field', (el, expected) => {
    expect(elementTitle(el as any)).toBe(expected)
  })

  it('falls back to a type label when the title is empty', () => {
    expect(elementTitle({ id: 'e', type: 'poll' } as any)).toBe('Untitled poll')
  })
})

describe('keys', () => {
  it('builds page and bulletin keys', () => {
    expect(pageElementKey('d1', 'e1')).toBe('d1:e1')
    expect(bulletinElementKey('p1', 'e1')).toBe('bulletin:p1:e1')
  })
})

const NOW = new Date('2026-07-21T12:00:00.000Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString()
const daysAgo = (d: number) => hoursAgo(d * 24)

const base = {
  published: true,
  lastResponseAt: null as string | null,
  unreadCount: 0,
  pendingCount: 0,
  lastSeenAt: null as string | null,
  now: NOW,
}

describe('deriveStatus', () => {
  it('flags unread mailbox messages as needs-attention', () => {
    expect(deriveStatus({ ...base, unreadCount: 3, lastResponseAt: hoursAgo(1) })).toBe('needs-attention')
  })

  it('flags pending RSVP/waitlist entries as needs-attention', () => {
    expect(deriveStatus({ ...base, pendingCount: 2 })).toBe('needs-attention')
  })

  it('flags responses newer than the last-seen stamp as needs-attention', () => {
    expect(deriveStatus({ ...base, lastResponseAt: hoursAgo(1), lastSeenAt: hoursAgo(5) })).toBe('needs-attention')
  })

  it('does not flag responses older than the last-seen stamp', () => {
    expect(deriveStatus({ ...base, lastResponseAt: hoursAgo(5), lastSeenAt: hoursAgo(1) })).toBe('live')
  })

  it('needs-attention outranks live', () => {
    expect(deriveStatus({ ...base, unreadCount: 1, lastResponseAt: hoursAgo(1) })).toBe('needs-attention')
  })

  it('is live when published with a response inside 24h', () => {
    expect(deriveStatus({ ...base, lastResponseAt: hoursAgo(23), lastSeenAt: NOW.toISOString() })).toBe('live')
  })

  it('is not live at exactly the 24h boundary', () => {
    // lastSeenAt newer than the response so `unseen` is false and the
    // live-window comparison is what decides the result.
    expect(deriveStatus({ ...base, lastResponseAt: hoursAgo(24), lastSeenAt: hoursAgo(1) })).toBe('idle')
  })

  it('is live just inside the 24h boundary', () => {
    expect(deriveStatus({ ...base, lastResponseAt: hoursAgo(23), lastSeenAt: hoursAgo(1) })).toBe('live')
  })

  it('flags unread messages on an unpublished page rather than hiding them as draft', () => {
    expect(deriveStatus({ ...base, published: false, unreadCount: 3 })).toBe('needs-attention')
  })

  it('flags pending entries on an unpublished page', () => {
    expect(deriveStatus({ ...base, published: false, pendingCount: 2 })).toBe('needs-attention')
  })

  it('is still draft when an unpublished page has nothing pending', () => {
    expect(deriveStatus({ ...base, published: false, lastResponseAt: null })).toBe('draft')
  })

  it('flags an unpublished page with unseen recent responses as needs-attention, not draft', () => {
    expect(deriveStatus({ ...base, published: false, lastResponseAt: hoursAgo(1), lastSeenAt: null })).toBe('needs-attention')
  })

  it('is idle when published with no response in 30 days', () => {
    expect(deriveStatus({ ...base, lastResponseAt: daysAgo(31), lastSeenAt: NOW.toISOString() })).toBe('idle')
  })

  it('is idle when published and never responded to', () => {
    expect(deriveStatus({ ...base, lastResponseAt: null })).toBe('idle')
  })
})

describe('computeEngagement', () => {
  it('returns a rounded percentage', () => {
    expect(computeEngagement({ responders: 42, pageViewers: 50 })).toBe(84)
  })

  it('returns null below the viewer floor so small samples cannot read 100%', () => {
    expect(computeEngagement({ responders: 3, pageViewers: MIN_VIEWERS_FOR_ENGAGEMENT - 1 })).toBeNull()
  })

  it('returns null when there are no viewers', () => {
    expect(computeEngagement({ responders: 0, pageViewers: 0 })).toBeNull()
  })

  it('clamps to 100 when responders exceed viewers', () => {
    expect(computeEngagement({ responders: 80, pageViewers: 40 })).toBe(100)
  })

  it('never returns a negative value', () => {
    expect(computeEngagement({ responders: -5, pageViewers: 40 })).toBe(0)
  })
})

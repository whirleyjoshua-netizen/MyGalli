import { describe, it, expect } from 'vitest'
import { collectDataElements, elementTitle, pageElementKey, bulletinElementKey } from './element-os'
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

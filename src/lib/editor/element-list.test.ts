import { describe, it, expect } from 'vitest'
import { buildElementList, elementTypeLabel, elementRowLabel } from './element-list'
import type { Section } from '@/lib/types/canvas'

const sections: Section[] = [
  {
    id: 's1', layout: 'full-width',
    columns: [{ id: 'c1', elements: [
      { id: 'e1', type: 'heading', content: 'Welcome' },
      { id: 'e2', type: 'image', url: 'https://x/hero.jpg' },
    ] }],
  },
  {
    id: 's2', layout: 'two-column',
    columns: [
      { id: 'c2', elements: [{ id: 'e3', type: 'kpi', kpiLabel: 'Revenue' }] },
      { id: 'c3', elements: [{ id: 'e4', type: 'button', buttonText: 'Buy' }] },
    ],
  },
]

describe('buildElementList', () => {
  it('groups elements by section with a 1-based index and layout', () => {
    const groups = buildElementList(sections)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ sectionId: 's1', layout: 'full-width', index: 1 })
    expect(groups[1]).toMatchObject({ sectionId: 's2', layout: 'two-column', index: 2 })
  })
  it('flattens columns into rows in column then element order, carrying columnId', () => {
    const groups = buildElementList(sections)
    expect(groups[0].rows.map(r => r.element.id)).toEqual(['e1', 'e2'])
    expect(groups[1].rows.map(r => r.element.id)).toEqual(['e3', 'e4'])
    expect(groups[1].rows[0]).toMatchObject({ sectionId: 's2', columnId: 'c2' })
    expect(groups[1].rows[1]).toMatchObject({ sectionId: 's2', columnId: 'c3' })
  })
})

describe('labels', () => {
  it('elementTypeLabel gives a human name', () => {
    expect(elementTypeLabel('image')).toBe('Image')
    expect(elementTypeLabel('kpi')).toBe('KPI')
    expect(elementTypeLabel('wedding-rsvp')).toBe('Wedding RSVP')
  })
  it('elementRowLabel appends a content hint when present', () => {
    expect(elementRowLabel({ id: 'e', type: 'heading', content: 'Welcome' })).toBe('Heading — Welcome')
    expect(elementRowLabel({ id: 'e', type: 'kpi', kpiLabel: 'Revenue' })).toBe('KPI — Revenue')
    expect(elementRowLabel({ id: 'e', type: 'image' })).toBe('Image')
  })
})

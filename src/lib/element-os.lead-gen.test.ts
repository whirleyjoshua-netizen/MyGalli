import { describe, it, expect } from 'vitest'
import {
  DATA_ELEMENT_TYPES,
  TYPE_GROUPS,
  collectDataElements,
  elementTitle,
  isDataElementType,
  isInstrumentedType,
} from './element-os'
import type { Section, CanvasElement } from '@/lib/types/canvas'

const sections = [
  {
    columns: [
      {
        elements: [
          { id: 'lg1', type: 'lead-gen', leadGenHeadline: 'Get my press kit' },
          { id: 'lg2', type: 'lead-gen' },
        ],
      },
    ],
  },
] as unknown as Section[]

describe('element-os — lead-gen', () => {
  it('is a recognised data element type', () => {
    expect(isDataElementType('lead-gen')).toBe(true)
    expect(DATA_ELEMENT_TYPES).toContain('lead-gen')
  })

  it('is instrumented, so engagement is a real number rather than null', () => {
    expect(isInstrumentedType('lead-gen')).toBe(true)
  })

  it('belongs to a display group (else it is invisible in the product)', () => {
    const group = TYPE_GROUPS.find((g) => (g.types as readonly string[]).includes('lead-gen'))
    expect(group?.label).toBe('Lead Gen')
  })

  it('is collected off a page canvas with its headline as the title', () => {
    const collected = collectDataElements(sections, null, 'd1', 'My page')
    expect(collected).toHaveLength(2)
    expect(collected[0]).toMatchObject({
      elementId: 'lg1',
      type: 'lead-gen',
      title: 'Get my press kit',
      pageId: 'd1',
    })
  })

  it('falls back to a readable placeholder when the headline is unset', () => {
    expect(elementTitle({ id: 'lg2', type: 'lead-gen' } as CanvasElement)).toBe('Untitled lead gen')
  })

  it('is collected from a tab canvas too', () => {
    const collected = collectDataElements(
      [],
      { tabs: [{ label: 'Freebies', sections }] } as never,
      'd1',
      'My page'
    )
    expect(collected.map((c) => c.elementId)).toEqual(['lg1', 'lg2'])
    expect(collected[0].tabLabel).toBe('Freebies')
  })
})

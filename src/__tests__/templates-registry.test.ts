import { describe, it, expect } from 'vitest'
import { listTemplates, TEMPLATE_REGISTRY } from '@/lib/templates/registry'

describe('template registry', () => {
  it('exposes the 5 starter templates', () => {
    const ids = listTemplates().map((t) => t.id)
    expect(ids).toEqual(
      expect.arrayContaining(['link-in-bio', 'travel-itinerary', 'reading-list', 'bucket-list', 'event-invite']),
    )
    expect(listTemplates()).toHaveLength(5)
  })
  it('every template has non-empty seed sections', () => {
    for (const t of listTemplates()) {
      expect(Array.isArray(t.seed.sections)).toBe(true)
      expect(t.seed.sections.length).toBeGreaterThan(0)
    }
  })
  it('starter templates are all free', () => {
    expect(listTemplates().every((t) => !t.pro)).toBe(true)
    expect(TEMPLATE_REGISTRY['link-in-bio'].pro).toBeUndefined()
  })
})

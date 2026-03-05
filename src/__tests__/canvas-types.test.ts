import { describe, it, expect } from 'vitest'
import { createElement } from '@/lib/types/canvas'

describe('createElement', () => {
  it('creates a text element with defaults', () => {
    const el = createElement('text')
    expect(el.type).toBe('text')
    expect(el.id).toBeTruthy()
    expect(el.content).toBeDefined()
  })

  it('creates a heading element', () => {
    const el = createElement('heading')
    expect(el.type).toBe('heading')
    expect(el.level).toBeDefined()
  })

  it('creates a business-menu element', () => {
    const el = createElement('business-menu')
    expect(el.type).toBe('business-menu')
    expect(el.bizMenuTitle).toBe('Our Menu')
    expect(el.bizMenuCurrency).toBe('$')
    expect(el.bizMenuCategories).toHaveLength(1)
  })

  it('creates a business-hours element', () => {
    const el = createElement('business-hours')
    expect(el.type).toBe('business-hours')
    expect(el.bizHoursSchedule).toHaveLength(7)
  })

  it('creates a business-review element', () => {
    const el = createElement('business-review')
    expect(el.type).toBe('business-review')
    expect(el.bizReviewAllowSubmissions).toBe(true)
  })

  it('creates a business-promo element', () => {
    const el = createElement('business-promo')
    expect(el.type).toBe('business-promo')
    expect(el.bizPromoItems).toHaveLength(1)
  })

  it('creates elements for all form types', () => {
    for (const type of ['mcq', 'rating', 'shortanswer'] as const) {
      const el = createElement(type)
      expect(el.type).toBe(type)
      expect(el.id).toBeTruthy()
    }
  })

  it('creates kit elements', () => {
    for (const type of ['tracker', 'kit-profile', 'game-schedule', 'jersey'] as const) {
      const el = createElement(type)
      expect(el.type).toBe(type)
    }
  })

  it('each element gets a unique id', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 50; i++) {
      ids.add(createElement('text').id)
    }
    expect(ids.size).toBe(50)
  })
})

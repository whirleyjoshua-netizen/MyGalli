import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe('checklist default', () => {
  it('creates a checklist with one unchecked item and progress on', () => {
    const el = createElement('checklist')
    expect(el.type).toBe('checklist')
    expect(el.checklistTitle).toBe('Checklist')
    expect(el.checklistItems).toHaveLength(1)
    expect(el.checklistItems![0].done).toBe(false)
    expect(el.checklistItems![0].text.length).toBeGreaterThan(0)
    expect(el.checklistItems![0].id).toBeTruthy()
    expect(el.checklistShowProgress).toBe(true)
  })
})

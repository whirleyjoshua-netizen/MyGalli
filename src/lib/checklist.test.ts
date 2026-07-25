import { describe, it, expect } from 'vitest'
import { checklistProgress } from './checklist'

describe('checklistProgress', () => {
  it('counts done and total and rounds the percentage', () => {
    expect(checklistProgress([{ done: true }, { done: false }, { done: true }, { done: false }]))
      .toEqual({ done: 2, total: 4, pct: 50 })
  })

  it('returns zeros for an empty list without dividing by zero', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, pct: 0 })
  })

  it('is 100 when everything is done', () => {
    expect(checklistProgress([{ done: true }, { done: true }])).toEqual({ done: 2, total: 2, pct: 100 })
  })

  it('is 0 when nothing is done', () => {
    expect(checklistProgress([{ done: false }, { done: false }])).toEqual({ done: 0, total: 2, pct: 0 })
  })

  it('rounds to the nearest whole percent', () => {
    // 1/3 = 33.33 → 33
    expect(checklistProgress([{ done: true }, { done: false }, { done: false }]).pct).toBe(33)
  })
})

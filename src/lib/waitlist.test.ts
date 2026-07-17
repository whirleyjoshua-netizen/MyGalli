import { describe, it, expect } from 'vitest'
import { spotsRemaining, isFull, progressPercent, waitlistCountdownParts, collectElements } from './waitlist'

describe('spotsRemaining', () => {
  it('is null with no capacity', () => {
    expect(spotsRemaining(5, null)).toBeNull()
    expect(spotsRemaining(5, undefined)).toBeNull()
  })
  it('is capacity minus count, floored at 0', () => {
    expect(spotsRemaining(3, 10)).toBe(7)
    expect(spotsRemaining(10, 10)).toBe(0)
    expect(spotsRemaining(12, 10)).toBe(0)
  })
})

describe('isFull', () => {
  it('is false with no capacity', () => {
    expect(isFull(999, null)).toBe(false)
  })
  it('is true only at or over capacity', () => {
    expect(isFull(9, 10)).toBe(false)
    expect(isFull(10, 10)).toBe(true)
    expect(isFull(11, 10)).toBe(true)
  })
})

describe('progressPercent', () => {
  it('is 0 with no capacity', () => {
    expect(progressPercent(5, null)).toBe(0)
  })
  it('is a clamped 0-100 integer', () => {
    expect(progressPercent(0, 10)).toBe(0)
    expect(progressPercent(5, 10)).toBe(50)
    expect(progressPercent(10, 10)).toBe(100)
    expect(progressPercent(15, 10)).toBe(100)
  })
})

describe('waitlistCountdownParts', () => {
  const now = new Date('2026-07-17T12:00:00.000Z')
  it('is null with no date', () => {
    expect(waitlistCountdownParts(null, now)).toBeNull()
  })
  it('breaks a future date into days/hours/minutes', () => {
    const r = waitlistCountdownParts('2026-07-20T15:30:00.000Z', now)
    expect(r).toEqual({ days: 3, hours: 3, minutes: 30, isPast: false })
  })
  it('flags a past date', () => {
    const r = waitlistCountdownParts('2026-07-16T12:00:00.000Z', now)
    expect(r?.isPast).toBe(true)
    expect(r?.days).toBe(0)
  })
})

describe('collectElements', () => {
  it('flattens sections -> columns -> elements', () => {
    const sections = [{ columns: [{ elements: [{ id: 'a' }, { id: 'b' }] }, { elements: [{ id: 'c' }] }] }]
    expect(collectElements(sections).map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })
  it('returns [] for malformed input', () => {
    expect(collectElements(null)).toEqual([])
    expect(collectElements('nope')).toEqual([])
    expect(collectElements([{ columns: null }])).toEqual([])
  })
})

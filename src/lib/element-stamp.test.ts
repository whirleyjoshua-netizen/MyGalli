import { describe, it, expect } from 'vitest'
import type { Section } from '@/lib/types/canvas'
import { isValidTimeZone, findElement, setStamp, clearStamp } from './element-stamp'

function sections(): Section[] {
  return [
    { id: 's1', layout: 'full-width', columns: [
      { id: 'c1', elements: [{ id: 'e1', type: 'text', content: 'hello' }] },
    ] },
    { id: 's2', layout: 'full-width', columns: [
      { id: 'c2', elements: [
        { id: 'e2', type: 'image', url: 'https://x/a.jpg' },
        { id: 'e3', type: 'heading', content: 'hi', stampedAt: '2026-01-01T00:00:00.000Z', stampedTz: 'UTC' },
      ] },
    ] },
  ]
}

describe('isValidTimeZone', () => {
  it('accepts a real IANA zone', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true)
  })
  it('rejects nonsense, non-strings and empty', () => {
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false)
    expect(isValidTimeZone(42)).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(undefined)).toBe(false)
  })
})

describe('findElement', () => {
  it('finds an element in a later section and column', () => {
    expect(findElement(sections(), 'e3')?.type).toBe('heading')
  })
  it('returns null for an unknown id', () => {
    expect(findElement(sections(), 'nope')).toBeNull()
  })
})

describe('setStamp', () => {
  it('sets both fields on the target element only', () => {
    const next = setStamp(sections(), 'e1', '2026-07-23T19:30:00.000Z', 'America/New_York')!
    expect(findElement(next, 'e1')).toMatchObject({
      stampedAt: '2026-07-23T19:30:00.000Z', stampedTz: 'America/New_York',
    })
    expect(findElement(next, 'e2')?.stampedAt).toBeUndefined()
  })

  it('overwrites an existing stamp (re-stamp)', () => {
    const next = setStamp(sections(), 'e3', '2026-07-23T19:30:00.000Z', 'Europe/London')!
    expect(findElement(next, 'e3')).toMatchObject({
      stampedAt: '2026-07-23T19:30:00.000Z', stampedTz: 'Europe/London',
    })
  })

  it('omits stampedTz when not supplied', () => {
    const next = setStamp(sections(), 'e1', '2026-07-23T19:30:00.000Z')!
    expect(findElement(next, 'e1')?.stampedTz).toBeUndefined()
  })

  it('does not mutate the input', () => {
    const input = sections()
    setStamp(input, 'e1', '2026-07-23T19:30:00.000Z', 'UTC')
    expect(findElement(input, 'e1')?.stampedAt).toBeUndefined()
  })

  it('preserves every other field of the target element', () => {
    const next = setStamp(sections(), 'e2', '2026-07-23T19:30:00.000Z', 'UTC')!
    expect(findElement(next, 'e2')).toMatchObject({ type: 'image', url: 'https://x/a.jpg' })
  })

  it('returns null for an unknown id', () => {
    expect(setStamp(sections(), 'nope', '2026-07-23T19:30:00.000Z', 'UTC')).toBeNull()
  })
})

describe('clearStamp', () => {
  it('removes both fields', () => {
    const next = clearStamp(sections(), 'e3')!
    const el = findElement(next, 'e3')!
    expect(el.stampedAt).toBeUndefined()
    expect(el.stampedTz).toBeUndefined()
    expect(el.content).toBe('hi')
  })
  it('returns null for an unknown id', () => {
    expect(clearStamp(sections(), 'nope')).toBeNull()
  })
})

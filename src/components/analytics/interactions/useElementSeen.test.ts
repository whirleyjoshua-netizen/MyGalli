import { describe, it, expect, beforeEach } from 'vitest'
import { readSeen, markSeen, SEEN_STORAGE_KEY } from './useElementSeen'

beforeEach(() => localStorage.clear())

describe('element last-seen stamps', () => {
  it('returns an empty map when nothing is stored', () => {
    expect(readSeen()).toEqual({})
  })

  it('stores a stamp per composite key', () => {
    markSeen('d1:e1', new Date('2026-07-21T00:00:00.000Z'))
    expect(readSeen()['d1:e1']).toBe('2026-07-21T00:00:00.000Z')
  })

  it('keeps stamps for other elements when marking one', () => {
    markSeen('d1:e1', new Date('2026-07-20T00:00:00.000Z'))
    markSeen('d2:e1', new Date('2026-07-21T00:00:00.000Z'))
    expect(Object.keys(readSeen()).sort()).toEqual(['d1:e1', 'd2:e1'])
  })

  it('survives corrupt storage without throwing', () => {
    localStorage.setItem(SEEN_STORAGE_KEY, 'not json')
    expect(readSeen()).toEqual({})
  })
})

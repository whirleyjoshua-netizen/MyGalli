import { describe, it, expect } from 'vitest'
import { isSelfFollow, deriveFriend } from '@/lib/social'

describe('isSelfFollow', () => {
  it('is true when ids are equal', () => {
    expect(isSelfFollow('u1', 'u1')).toBe(true)
  })
  it('is false for different ids', () => {
    expect(isSelfFollow('u1', 'u2')).toBe(false)
  })
})

describe('deriveFriend', () => {
  it('is true only when both directions follow', () => {
    expect(deriveFriend(true, true)).toBe(true)
    expect(deriveFriend(true, false)).toBe(false)
    expect(deriveFriend(false, true)).toBe(false)
    expect(deriveFriend(false, false)).toBe(false)
  })
})

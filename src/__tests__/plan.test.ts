import { describe, it, expect } from 'vitest'
import { isPro } from '@/lib/plan'

describe('isPro', () => {
  it('is false for null/undefined', () => {
    expect(isPro(null)).toBe(false)
    expect(isPro(undefined)).toBe(false)
  })
  it('is false for free or missing plan', () => {
    expect(isPro({ plan: 'free' })).toBe(false)
    expect(isPro({})).toBe(false)
    expect(isPro({ plan: null })).toBe(false)
  })
  it('is true only for pro', () => {
    expect(isPro({ plan: 'pro' })).toBe(true)
  })
})

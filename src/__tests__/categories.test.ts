import { describe, it, expect } from 'vitest'
import { isValidCategory, categoryLabel, CATEGORY_IDS } from '@/lib/categories'

describe('isValidCategory', () => {
  it('accepts known ids', () => {
    expect(isValidCategory('sports')).toBe(true)
    expect(isValidCategory('entertainment')).toBe(true)
  })
  it('rejects unknown ids', () => {
    expect(isValidCategory('nope')).toBe(false)
    expect(isValidCategory('')).toBe(false)
  })
})

describe('categoryLabel', () => {
  it('returns the label for a known id', () => {
    expect(categoryLabel('professional')).toBe('Professional & Resume')
  })
  it('falls back to Other for unknown', () => {
    expect(categoryLabel('zzz')).toBe('Other')
  })
})

describe('CATEGORY_IDS', () => {
  it('has the 8 categories', () => {
    expect(CATEGORY_IDS.length).toBe(8)
  })
})

import { describe, it, expect } from 'vitest'
import { consentTextFor } from './hub-consent'

describe('consentTextFor', () => {
  it('names the hub in the sentence', () => {
    expect(consentTextFor('Bella’s Kitchen')).toContain('Bella’s Kitchen')
  })
  it('is a non-empty single sentence', () => {
    const t = consentTextFor('X')
    expect(t.length).toBeGreaterThan(20)
    expect(t.trim()).toBe(t)
  })
})

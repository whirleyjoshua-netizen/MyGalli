import { describe, it, expect } from 'vitest'
import { deriveFieldKey } from './field-key'

describe('deriveFieldKey', () => {
  it('slugifies a label', () => {
    expect(deriveFieldKey('Final Grade', [])).toBe('final_grade')
  })
  it('lowercases and strips punctuation', () => {
    expect(deriveFieldKey('GPA (2026)!', [])).toBe('gpa_2026')
  })
  it('de-dupes against existing keys', () => {
    expect(deriveFieldKey('Grade', ['grade'])).toBe('grade_2')
    expect(deriveFieldKey('Grade', ['grade', 'grade_2'])).toBe('grade_3')
  })
  it('falls back to "field" for empty/symbol-only labels', () => {
    expect(deriveFieldKey('!!!', [])).toBe('field')
    expect(deriveFieldKey('!!!', ['field'])).toBe('field_2')
  })
})

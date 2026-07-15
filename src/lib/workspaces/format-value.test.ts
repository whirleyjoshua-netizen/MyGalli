import { describe, it, expect } from 'vitest'
import { formatFieldValue } from './format-value'

describe('formatFieldValue', () => {
  it('formats currency with symbol + thousands', () => {
    expect(formatFieldValue('currency', 1234.5, { symbol: '$' })).toBe('$1,234.5')
    expect(formatFieldValue('currency', 10, {})).toBe('$10')
  })
  it('formats percent', () => { expect(formatFieldValue('percent', 95)).toBe('95%') })
  it('passes through text/number/url', () => {
    expect(formatFieldValue('number', 42)).toBe('42')
    expect(formatFieldValue('url', 'x.com')).toBe('x.com')
  })
  it('empty/null -> empty string', () => {
    expect(formatFieldValue('currency', null)).toBe('')
    expect(formatFieldValue('text', '')).toBe('')
  })
})

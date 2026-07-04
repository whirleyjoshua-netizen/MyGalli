import { describe, it, expect } from 'vitest'
import { safeHref } from './safe-href'

describe('safeHref', () => {
  it('allows http, https, mailto, and root-relative', () => {
    expect(safeHref('https://a.com')).toBe('https://a.com')
    expect(safeHref('http://a.com')).toBe('http://a.com')
    expect(safeHref('mailto:me@a.com')).toBe('mailto:me@a.com')
    expect(safeHref('/explore')).toBe('/explore')
  })
  it('rejects javascript: and other schemes and empties', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined()
    expect(safeHref('data:text/html,x')).toBeUndefined()
    expect(safeHref('')).toBeUndefined()
    expect(safeHref(undefined)).toBeUndefined()
  })
})

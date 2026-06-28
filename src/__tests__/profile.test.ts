import { describe, it, expect } from 'vitest'
import { detectLinkProvider, sanitizeInterests, sanitizeLinks } from '@/lib/profile'

describe('detectLinkProvider', () => {
  it('detects known providers', () => {
    expect(detectLinkProvider('https://instagram.com/x')).toBe('instagram')
    expect(detectLinkProvider('https://x.com/x')).toBe('x')
    expect(detectLinkProvider('https://twitter.com/x')).toBe('x')
    expect(detectLinkProvider('https://youtube.com/@x')).toBe('youtube')
    expect(detectLinkProvider('https://tiktok.com/@x')).toBe('tiktok')
    expect(detectLinkProvider('https://linkedin.com/in/x')).toBe('linkedin')
    expect(detectLinkProvider('https://github.com/x')).toBe('github')
    expect(detectLinkProvider('https://example.com')).toBe('web')
  })
})

describe('sanitizeInterests', () => {
  it('trims, drops empties, dedupes, caps at 12', () => {
    expect(sanitizeInterests([' Soccer ', 'soccer', '', 'Art'])).toEqual(['Soccer', 'soccer', 'Art'])
    expect(sanitizeInterests(Array.from({ length: 20 }, (_, i) => `t${i}`)).length).toBe(12)
    expect(sanitizeInterests('not-an-array')).toEqual([])
  })
})

describe('sanitizeLinks', () => {
  it('keeps valid http(s) links with labels, caps at 10', () => {
    expect(sanitizeLinks([{ label: 'IG', url: 'https://instagram.com/x' }, { label: '', url: 'https://a.com' }, { label: 'bad', url: 'ftp://a' }]))
      .toEqual([{ label: 'IG', url: 'https://instagram.com/x' }])
    expect(sanitizeLinks('nope')).toEqual([])
  })
})

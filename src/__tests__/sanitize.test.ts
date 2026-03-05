import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '@/lib/sanitize'

describe('sanitizeHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('keeps allowed tags', () => {
    expect(sanitizeHtml('<b>bold</b>')).toBe('<b>bold</b>')
    expect(sanitizeHtml('<em>italic</em>')).toBe('<em>italic</em>')
    expect(sanitizeHtml('<p>text</p>')).toBe('<p>text</p>')
  })

  it('strips disallowed tags', () => {
    expect(sanitizeHtml('<div><img src="x.jpg">text</div>')).toBe('<div>text</div>')
  })

  it('removes script tags and content', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>safe')).toBe('safe')
  })

  it('removes iframe tags', () => {
    expect(sanitizeHtml('<iframe src="evil.com"></iframe>safe')).toBe('safe')
  })

  it('blocks javascript: URLs in href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    expect(result).not.toContain('javascript:')
  })

  it('allows safe href attributes', () => {
    const result = sanitizeHtml('<a href="https://example.com">link</a>')
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('rel="noopener noreferrer"')
  })

  it('blocks dangerous CSS in style', () => {
    const result = sanitizeHtml('<span style="background:expression(alert(1))">x</span>')
    expect(result).not.toContain('expression')
  })

  it('allows safe style attributes', () => {
    const result = sanitizeHtml('<p style="text-align: center;">text</p>')
    expect(result).toContain('style="text-align: center;"')
  })
})

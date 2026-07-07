import { describe, it, expect } from 'vitest'
import { escapeHtml, bookingReceivedEmail } from './email'

describe('escapeHtml', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
  })
})

describe('bookingReceivedEmail', () => {
  it('does not emit raw visitor-supplied tags', () => {
    const { html } = bookingReceivedEmail({ name: '<img src=x onerror=1>', when: 'Mon', meetingTitle: 'Call' })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })
})

import { describe, it, expect } from 'vitest'
import { buildShareText, xShareUrl, facebookShareUrl, linkedInShareUrl } from '@/lib/social-share'

const URL_ = 'https://mygalli.com/josh/my-page'

describe('buildShareText', () => {
  it('wraps a title', () => {
    expect(buildShareText('My Page')).toBe('Check out "My Page" on My Galli')
  })
  it('falls back on empty/whitespace title', () => {
    expect(buildShareText('   ')).toBe('Check out this page on My Galli')
    expect(buildShareText('')).toBe('Check out this page on My Galli')
  })
})

describe('share URL builders', () => {
  it('xShareUrl points at the intent endpoint with url + text params', () => {
    const u = new URL(xShareUrl(URL_, 'hello world'))
    expect(u.origin + u.pathname).toBe('https://twitter.com/intent/tweet')
    expect(u.searchParams.get('url')).toBe(URL_)
    expect(u.searchParams.get('text')).toBe('hello world')
  })
  it('facebookShareUrl points at sharer with u param', () => {
    const u = new URL(facebookShareUrl(URL_))
    expect(u.origin + u.pathname).toBe('https://www.facebook.com/sharer/sharer.php')
    expect(u.searchParams.get('u')).toBe(URL_)
  })
  it('linkedInShareUrl points at share-offsite with url param', () => {
    const u = new URL(linkedInShareUrl(URL_))
    expect(u.origin + u.pathname).toBe('https://www.linkedin.com/sharing/share-offsite/')
    expect(u.searchParams.get('url')).toBe(URL_)
  })
})

import { describe, it, expect } from 'vitest'
import { isAllowedMessageMedia } from './media-url'

describe('isAllowedMessageMedia', () => {
  it('allows empty (no media)', () => {
    expect(isAllowedMessageMedia('')).toBe(true)
  })
  it('allows the local dev upload path', () => {
    expect(isAllowedMessageMedia('/api/upload/messages/abc.webm')).toBe(true)
  })
  it('allows a Vercel Blob URL', () => {
    expect(isAllowedMessageMedia('https://xyz123.public.blob.vercel-storage.com/messages/a.webm')).toBe(true)
  })
  it('rejects an arbitrary external URL', () => {
    expect(isAllowedMessageMedia('https://evil.example.com/beacon.gif')).toBe(false)
  })
  it('rejects a look-alike host', () => {
    expect(isAllowedMessageMedia('https://public.blob.vercel-storage.com.evil.com/a')).toBe(false)
  })
  it('rejects http (non-https) blob', () => {
    expect(isAllowedMessageMedia('http://xyz.public.blob.vercel-storage.com/a')).toBe(false)
  })
  it('rejects a foreign root-relative path', () => {
    expect(isAllowedMessageMedia('/api/other/x')).toBe(false)
  })
  it('rejects garbage', () => {
    expect(isAllowedMessageMedia('javascript:alert(1)')).toBe(false)
  })
})

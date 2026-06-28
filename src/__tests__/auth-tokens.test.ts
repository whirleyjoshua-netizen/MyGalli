import { describe, it, expect } from 'vitest'
import { generateToken, tokenTtlMs, isExpired } from '@/lib/auth-tokens'

describe('generateToken', () => {
  it('returns a long url-safe token', () => {
    const t = generateToken()
    expect(t.length).toBeGreaterThanOrEqual(32)
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
  })
  it('returns unique values', () => {
    expect(generateToken()).not.toBe(generateToken())
  })
})

describe('tokenTtlMs', () => {
  it('verify is 24h, reset is 1h', () => {
    expect(tokenTtlMs('verify')).toBe(24 * 60 * 60 * 1000)
    expect(tokenTtlMs('reset')).toBe(60 * 60 * 1000)
  })
})

describe('isExpired', () => {
  it('true when expiry is in the past', () => {
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true)
  })
  it('false when expiry is in the future', () => {
    expect(isExpired(new Date(Date.now() + 60_000))).toBe(false)
  })
})

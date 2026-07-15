import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { rateLimit } from './rate-limit'

// Force the in-memory fallback path (no Redis configured).
vi.mock('./storage-env', () => ({ redisRestUrl: () => undefined, redisRestToken: () => undefined }))

function reqFrom(ip: string) {
  return new NextRequest('http://localhost/api/x', { headers: { 'x-forwarded-for': ip } })
}

describe('rateLimit keying', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shares one bucket across different IPs when the same identifier is passed', async () => {
    const opts = { limit: 1, windowMs: 60_000, prefix: `id-test-${Math.random()}`, identifier: 'user-1' }
    const first = await rateLimit(reqFrom('1.1.1.1'), opts)
    expect(first).toBeNull()
    // Same identifier, different IP: must still be limited — this is the
    // fix for Finding 1 (a per-IP key let one account spend from several
    // networks).
    const second = await rateLimit(reqFrom('2.2.2.2'), opts)
    expect(second).not.toBeNull()
    expect(second!.status).toBe(429)
  })

  it('keeps separate buckets for different identifiers from the same IP', async () => {
    const prefix = `id-test-${Math.random()}`
    const first = await rateLimit(reqFrom('9.9.9.9'), { limit: 1, windowMs: 60_000, prefix, identifier: 'user-a' })
    expect(first).toBeNull()
    const second = await rateLimit(reqFrom('9.9.9.9'), { limit: 1, windowMs: 60_000, prefix, identifier: 'user-b' })
    expect(second).toBeNull()
  })

  it('falls back to IP-keying when no identifier is passed (existing callers unaffected)', async () => {
    const prefix = `id-test-${Math.random()}`
    const first = await rateLimit(reqFrom('5.5.5.5'), { limit: 1, windowMs: 60_000, prefix })
    expect(first).toBeNull()
    const second = await rateLimit(reqFrom('5.5.5.5'), { limit: 1, windowMs: 60_000, prefix })
    expect(second).not.toBeNull()
    expect(second!.status).toBe(429)
  })
})

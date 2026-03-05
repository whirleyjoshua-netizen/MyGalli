import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

function makeRequest(ip = '127.0.0.1') {
  return new NextRequest('http://localhost:3000/api/test', {
    headers: { 'x-forwarded-for': ip },
  })
}

describe('rateLimit (in-memory fallback)', () => {
  it('allows requests under the limit', async () => {
    const req = makeRequest('10.0.0.1')
    const result = await rateLimit(req, { limit: 5, windowMs: 60_000, prefix: 'test-allow' })
    expect(result).toBeNull()
  })

  it('blocks requests over the limit', async () => {
    const ip = '10.0.0.2'
    const opts = { limit: 3, windowMs: 60_000, prefix: 'test-block' }

    for (let i = 0; i < 3; i++) {
      const result = await rateLimit(makeRequest(ip), opts)
      expect(result).toBeNull()
    }

    const blocked = await rateLimit(makeRequest(ip), opts)
    expect(blocked).not.toBeNull()
    expect(blocked!.status).toBe(429)
  })

  it('tracks different IPs separately', async () => {
    const opts = { limit: 1, windowMs: 60_000, prefix: 'test-ip' }

    const r1 = await rateLimit(makeRequest('10.0.0.3'), opts)
    expect(r1).toBeNull()

    const r2 = await rateLimit(makeRequest('10.0.0.4'), opts)
    expect(r2).toBeNull()
  })

  it('includes Retry-After header when limited', async () => {
    const ip = '10.0.0.5'
    const opts = { limit: 1, windowMs: 60_000, prefix: 'test-retry' }

    await rateLimit(makeRequest(ip), opts)
    const blocked = await rateLimit(makeRequest(ip), opts)

    expect(blocked).not.toBeNull()
    expect(blocked!.headers.get('Retry-After')).toBeTruthy()
  })
})

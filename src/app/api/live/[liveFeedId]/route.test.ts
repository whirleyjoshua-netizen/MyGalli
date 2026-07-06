import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { liveFeed: { findUnique: vi.fn(), update: vi.fn() } },
}))

import { GET, POST } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const ctx = (liveFeedId: string) => ({ params: Promise.resolve({ liveFeedId }) })
const req = (body?: unknown) =>
  new NextRequest('http://localhost/api/live/el-1', {
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
  })

beforeEach(() => vi.clearAllMocks())

describe('GET /api/live/[liveFeedId]', () => {
  it('returns idle default when no row exists', async () => {
    ;(db.liveFeed.findUnique as any).mockResolvedValue(null)
    const res = await GET(req(), ctx('el-1'))
    const json = await res.json()
    expect(json).toMatchObject({ isLive: false, valueA: 0, valueB: 0, startedAt: null })
  })

  it('returns the stored state when a row exists', async () => {
    ;(db.liveFeed.findUnique as any).mockResolvedValue({
      isLive: true, valueA: 3, valueB: 1, startedAt: new Date('2026-07-06T00:00:00Z'),
      lastUpdatedAt: new Date('2026-07-06T00:01:00Z'),
    })
    const res = await GET(req(), ctx('el-1'))
    const json = await res.json()
    expect(json).toMatchObject({ isLive: true, valueA: 3, valueB: 1 })
  })
})

describe('POST /api/live/[liveFeedId]', () => {
  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(req({ action: 'start' }), ctx('el-1'))
    expect(res.status).toBe(401)
  })

  it('404 when the row does not exist yet', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.liveFeed.findUnique as any).mockResolvedValue(null)
    const res = await POST(req({ action: 'start' }), ctx('el-1'))
    expect(res.status).toBe(404)
  })

  it('403 when the requester is not the owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.liveFeed.findUnique as any).mockResolvedValue({
      id: 'el-1', isLive: false, valueA: 0, valueB: 0, startedAt: null, display: { userId: 'someone-else' },
    })
    const res = await POST(req({ action: 'bump', delta: 1 }), ctx('el-1'))
    expect(res.status).toBe(403)
  })

  it('applies the action for the owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.liveFeed.findUnique as any).mockResolvedValue({
      id: 'el-1', isLive: false, valueA: 0, valueB: 0, startedAt: null, display: { userId: 'u1' },
    })
    ;(db.liveFeed.update as any).mockResolvedValue({
      isLive: false, valueA: 1, valueB: 0, startedAt: null, lastUpdatedAt: new Date('2026-07-06T00:00:00Z'),
    })
    const res = await POST(req({ action: 'bump', delta: 1 }), ctx('el-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.valueA).toBe(1)
    expect(db.liveFeed.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'el-1' }, data: expect.objectContaining({ valueA: 1 }) })
    )
  })
})

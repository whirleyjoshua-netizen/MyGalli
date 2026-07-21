import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    acknowledgment: { create: vi.fn() },
    acknowledgmentRound: { findUnique: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'

const post = (b: unknown) =>
  new Request('http://localhost/api/acknowledgments', { method: 'POST', body: JSON.stringify(b) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue({ id: 'u1' })
  ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue(null)
  ;(db.acknowledgment.create as any).mockResolvedValue({ id: 'a1' })
})

describe('POST /api/acknowledgments', () => {
  it('401 when signed out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(post({ elementId: 'el-1', displayId: 'd1' }))
    expect(res.status).toBe(401)
    expect(db.acknowledgment.create).not.toHaveBeenCalled()
  })

  it('400 when no context is given', async () => {
    const res = await POST(post({ elementId: 'el-1' }))
    expect(res.status).toBe(400)
    expect(db.acknowledgment.create).not.toHaveBeenCalled()
  })

  it('400 when both contexts are given', async () => {
    const res = await POST(post({ elementId: 'el-1', displayId: 'd1', hubPostId: 'p1' }))
    expect(res.status).toBe(400)
  })

  it('400 when elementId is missing', async () => {
    const res = await POST(post({ displayId: 'd1' }))
    expect(res.status).toBe(400)
  })

  it('201 records at round 0 when no reset has happened', async () => {
    const res = await POST(post({ elementId: 'el-1', displayId: 'd1' }))
    expect(res.status).toBe(201)
    expect(db.acknowledgment.create).toHaveBeenCalledWith({
      data: {
        scopeKey: 'display:d1:el-1',
        elementId: 'el-1',
        displayId: 'd1',
        hubPostId: null,
        userId: 'u1',
        round: 0,
      },
    })
  })

  it('records at the current round after a reset', async () => {
    ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue({ scopeKey: 'display:d1:el-1', round: 3 })
    const res = await POST(post({ elementId: 'el-1', displayId: 'd1' }))
    expect(res.status).toBe(201)
    expect((db.acknowledgment.create as any).mock.calls[0][0].data.round).toBe(3)
  })

  it('scopes a hub post acknowledgment by post id', async () => {
    await POST(post({ elementId: 'blk-acknowledgment-7', hubPostId: 'p1' }))
    expect((db.acknowledgment.create as any).mock.calls[0][0].data).toMatchObject({
      scopeKey: 'hubpost:p1:blk-acknowledgment-7',
      displayId: null,
      hubPostId: 'p1',
    })
  })

  it('200 and no duplicate row when already acknowledged this round', async () => {
    const err: any = new Error('unique violation')
    err.code = 'P2002'
    ;(db.acknowledgment.create as any).mockRejectedValue(err)
    const res = await POST(post({ elementId: 'el-1', displayId: 'd1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

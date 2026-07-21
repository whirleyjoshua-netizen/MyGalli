import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    acknowledgmentRound: { findUnique: vi.fn(), upsert: vi.fn() },
    acknowledgment: { deleteMany: vi.fn() },
    display: { findUnique: vi.fn() },
    hubPost: { findUnique: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'

const ctx = { params: Promise.resolve({ elementId: 'el-1' }) }
const post = (qs = 'displayId=d1') =>
  new Request(`http://localhost/api/acknowledgments/el-1/reset?${qs}`, { method: 'POST' }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as any).mockResolvedValue({ userId: 'owner' })
  ;(db.hubPost.findUnique as any).mockResolvedValue({ hub: { userId: 'owner' } })
  ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue(null)
  ;(db.acknowledgmentRound.upsert as any).mockResolvedValue({ scopeKey: 'display:d1:el-1', round: 1 })
  ;(getUser as any).mockResolvedValue({ id: 'owner', plan: 'pro' })
})

describe('POST /api/acknowledgments/[elementId]/reset', () => {
  it('401 when signed out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(post(), ctx)
    expect(res.status).toBe(401)
    expect(db.acknowledgmentRound.upsert).not.toHaveBeenCalled()
  })

  it('400 without a context param', async () => {
    const res = await POST(post(''), ctx)
    expect(res.status).toBe(400)
    expect(db.acknowledgmentRound.upsert).not.toHaveBeenCalled()
  })

  it('403 for a non-owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'someone-else', plan: 'pro' })
    const res = await POST(post(), ctx)
    expect(res.status).toBe(403)
    expect(db.acknowledgmentRound.upsert).not.toHaveBeenCalled()
  })

  it('404 when the display does not exist', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(null)
    const res = await POST(post(), ctx)
    expect(res.status).toBe(404)
    expect(db.acknowledgmentRound.upsert).not.toHaveBeenCalled()
  })

  // Pro gating deferred by decision — ownership alone authorizes the reset for
  // now. See RESET GATE in route.ts for the single place to add isPro().
  it('allows a free owner while the Pro gate is deferred', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', plan: 'free' })
    const res = await POST(post(), ctx)
    expect(res.status).toBe(200)
    expect(db.acknowledgmentRound.upsert).toHaveBeenCalled()
  })

  it('bumps round 0 to 1 for an owner', async () => {
    const res = await POST(post(), ctx)
    expect(res.status).toBe(200)
    expect(db.acknowledgmentRound.upsert).toHaveBeenCalledWith({
      where: { scopeKey: 'display:d1:el-1' },
      create: { scopeKey: 'display:d1:el-1', round: 1 },
      update: { round: 1 },
    })
  })

  it('bumps an existing round', async () => {
    ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue({ round: 4 })
    await POST(post(), ctx)
    expect((db.acknowledgmentRound.upsert as any).mock.calls[0][0].update).toEqual({ round: 5 })
  })

  it('scopes a hub post reset by post id', async () => {
    await POST(post('hubPostId=p1'), ctx)
    expect((db.acknowledgmentRound.upsert as any).mock.calls[0][0].where).toEqual({
      scopeKey: 'hubpost:p1:el-1',
    })
  })

  it('never deletes prior acknowledgments', async () => {
    await POST(post(), ctx)
    expect(db.acknowledgment.deleteMany).not.toHaveBeenCalled()
  })
})

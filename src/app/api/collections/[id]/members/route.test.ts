import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findFirst: vi.fn(), findUnique: vi.fn() },
    collectionMember: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'

function req(body: unknown) {
  return new Request('http://localhost/api/collections/b1/members', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as any
}
const ctx = { params: Promise.resolve({ id: 'b1' }) }

beforeEach(() => vi.clearAllMocks())

describe('POST members guards', () => {
  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(req({ memberId: 'm1' }), ctx)
    expect(res.status).toBe(401)
  })

  it('lets a free user past the (removed) Pro gate — 404 when the board is missing, not 403', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'free' })
    ;(db.display.findFirst as any).mockResolvedValueOnce(null)
    const res = await POST(req({ memberId: 'm1' }), ctx)
    expect(res.status).toBe(404)
  })

  it('404 when the board does not exist', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'pro' })
    ;(db.display.findFirst as any).mockResolvedValueOnce(null)
    const res = await POST(req({ memberId: 'm1' }), ctx)
    expect(res.status).toBe(404)
  })

  it('404 — not 403 — when the board belongs to someone else', async () => {
    // Previously 403 "Not your board". Answering 403 for a real id and 404 for
    // a fake one told a caller which board ids exist, including unpublished
    // ones. The lookup is now scoped to the caller, so a stranger's board is
    // indistinguishable from a missing one.
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'pro' })
    ;(db.display.findFirst as any).mockResolvedValueOnce(null)
    const res = await POST(req({ memberId: 'm1' }), ctx)
    expect(res.status).toBe(404)
  })

  it('appends after the last position, so a removal cannot cause a collision', async () => {
    // Positions {1} after the member at 0 was removed. count() would say 1 and
    // collide; the new row must land at 2.
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'free' })
    ;(db.display.findFirst as any).mockResolvedValueOnce({ userId: 'u1' })
    ;(db.display.findUnique as any).mockResolvedValueOnce({ userId: 'u1', kind: 'page' })
    ;(db.collectionMember.findFirst as any).mockResolvedValueOnce({ position: 1 })
    ;(db.collectionMember.create as any).mockResolvedValueOnce({})

    await POST(req({ memberId: 'm1' }), ctx)

    expect(db.collectionMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 2 }),
    })
  })

  it('starts an empty board at position 0', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'free' })
    ;(db.display.findFirst as any).mockResolvedValueOnce({ userId: 'u1' })
    ;(db.display.findUnique as any).mockResolvedValueOnce({ userId: 'u1', kind: 'page' })
    ;(db.collectionMember.findFirst as any).mockResolvedValueOnce(null)
    ;(db.collectionMember.create as any).mockResolvedValueOnce({})

    await POST(req({ memberId: 'm1' }), ctx)

    expect(db.collectionMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 0 }),
    })
  })

  it('scopes the board lookup to the caller', async () => {
    // Pin the argument: an unscoped lookup plus a separate ownership branch is
    // exactly what produced the oracle.
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'free' })
    ;(db.display.findFirst as any).mockResolvedValueOnce(null)
    await POST(req({ memberId: 'm1' }), ctx)
    expect(db.display.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'b1', userId: 'u1', kind: 'collection' }),
      })
    )
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    collectionMember: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
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
    ;(db.display.findUnique as any).mockResolvedValueOnce(null)
    const res = await POST(req({ memberId: 'm1' }), ctx)
    expect(res.status).toBe(404)
  })

  it('404 when the board does not exist', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'pro' })
    ;(db.display.findUnique as any).mockResolvedValueOnce(null)
    const res = await POST(req({ memberId: 'm1' }), ctx)
    expect(res.status).toBe(404)
  })

  it('403 when the board is owned by someone else', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'pro' })
    ;(db.display.findUnique as any).mockResolvedValueOnce({ userId: 'other', kind: 'collection' })
    const res = await POST(req({ memberId: 'm1' }), ctx)
    expect(res.status).toBe(403)
  })
})

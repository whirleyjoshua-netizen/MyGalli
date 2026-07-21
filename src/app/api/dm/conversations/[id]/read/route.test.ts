import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    conversationParticipant: { updateMany: vi.fn() },
  },
}))

import { POST } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const post = () =>
  new NextRequest('http://localhost/api/dm/conversations/c1/read', { method: 'POST' })

beforeEach(() => vi.clearAllMocks())

describe('POST /api/dm/conversations/[id]/read', () => {
  it('401 unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(post(), ctx('c1'))
    expect(res.status).toBe(401)
    expect(db.conversationParticipant.updateMany).not.toHaveBeenCalled()
  })

  it('scopes the write to the caller\'s own participant row', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.updateMany as any).mockResolvedValue({ count: 1 })
    const res = await POST(post(), ctx('c1'))
    expect(res.status).toBe(200)
    expect(db.conversationParticipant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'c1', userId: 'me' },
        data: expect.objectContaining({ lastReadAt: expect.any(Date) }),
      })
    )
  })

  it('404 when zero rows are updated (non-participant)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    ;(db.conversationParticipant.updateMany as any).mockResolvedValue({ count: 0 })
    const res = await POST(post(), ctx('c1'))
    expect(res.status).toBe(404)
  })
})

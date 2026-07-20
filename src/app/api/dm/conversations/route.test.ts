import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    user: { update: vi.fn().mockResolvedValue({}), findUnique: vi.fn() },
    conversationParticipant: { findMany: vi.fn().mockResolvedValue([]) },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    follow: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    directMessage: { count: vi.fn().mockResolvedValue(0) },
  },
}))

import { GET, POST } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const get = (url = 'http://localhost/api/dm/conversations') => new NextRequest(url)
const post = (body: unknown) =>
  new NextRequest('http://localhost/api/dm/conversations', {
    method: 'POST',
    body: JSON.stringify(body),
  })

beforeEach(() => vi.clearAllMocks())

describe('GET /api/dm/conversations', () => {
  it('401 unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(get())).status).toBe(401)
  })

  it('stamps lastSeenAt as the presence heartbeat', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(get())
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'me' } })
    )
  })

  it('lists accepted conversations by default', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(get())
    expect(db.conversationParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'me', state: 'accepted' }),
      })
    )
  })

  it('lists requested conversations for filter=requests', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(get('http://localhost/api/dm/conversations?filter=requests'))
    expect(db.conversationParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'me', state: 'requested' }),
      })
    )
  })

  it('resolves follows-you for the whole page in one query', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findMany as any).mockResolvedValue([
      {
        conversationId: 'c1',
        state: 'accepted',
        starred: false,
        muted: false,
        lastReadAt: null,
        conversation: {
          lastMessageAt: new Date('2026-07-20T10:00:00Z'),
          participants: [
            {
              userId: 'them',
              user: { id: 'them', username: 'sarah', name: 'Sarah', avatar: null, lastSeenAt: null },
            },
          ],
          messages: [],
        },
      },
    ])
    ;(db.follow.findMany as any).mockResolvedValue([{ followerId: 'them' }])

    const res = await GET(get())
    const data = await res.json()
    expect(db.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { followingId: 'me', followerId: { in: ['them'] } },
      })
    )
    expect(data.conversations[0].other.followsYou).toBe(true)
  })
})

describe('POST /api/dm/conversations', () => {
  it('401 unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await POST(post({ username: 'sarah' }))).status).toBe(401)
  })

  it('404 for an unknown username', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue(null)
    expect((await POST(post({ username: 'nobody' }))).status).toBe(404)
  })

  it('400 when messaging yourself', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue({ id: 'me' })
    expect((await POST(post({ username: 'me' }))).status).toBe(400)
  })

  it('returns the existing conversation instead of creating a duplicate', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue({ id: 'them' })
    ;(db.conversation.findUnique as any).mockResolvedValue({ id: 'c1' })
    const res = await POST(post({ username: 'sarah' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'c1' })
    expect(db.conversation.create).not.toHaveBeenCalled()
  })

  it("marks a stranger's first message as a request for the recipient only", async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue({ id: 'them' })
    ;(db.conversation.findUnique as any).mockResolvedValue(null)
    ;(db.follow.findFirst as any).mockResolvedValue(null)
    ;(db.conversation.create as any).mockResolvedValue({ id: 'c2' })
    await POST(post({ username: 'sarah' }))
    const arg = (db.conversation.create as any).mock.calls[0][0]
    const rows = arg.data.participants.create
    expect(rows).toEqual(
      expect.arrayContaining([
        { userId: 'me', state: 'accepted' },
        { userId: 'them', state: 'requested' },
      ])
    )
  })

  it('accepts immediately when the recipient already follows the sender', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue({ id: 'them' })
    ;(db.conversation.findUnique as any).mockResolvedValue(null)
    ;(db.follow.findFirst as any).mockResolvedValue({ id: 'f1' })
    ;(db.conversation.create as any).mockResolvedValue({ id: 'c3' })
    await POST(post({ username: 'sarah' }))
    const rows = (db.conversation.create as any).mock.calls[0][0].data.participants.create
    expect(rows).toEqual(
      expect.arrayContaining([{ userId: 'them', state: 'accepted' }])
    )
  })

  it('recovers from the unique-key race by returning the winner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue({ id: 'them' })
    ;(db.conversation.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'winner' })
    ;(db.conversation.create as any).mockRejectedValue({ code: 'P2002' })
    const res = await POST(post({ username: 'sarah' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'winner' })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/db', () => ({
  db: {
    conversationParticipant: { findUnique: vi.fn(), findFirst: vi.fn() },
    directMessage: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), count: vi.fn().mockResolvedValue(1) },
    conversation: { update: vi.fn().mockResolvedValue({}) },
  },
}))

import { GET, POST } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const get = (url = 'http://localhost/api/dm/conversations/c1/messages') => new NextRequest(url)
const post = (body: unknown) =>
  new NextRequest('http://localhost/api/dm/conversations/c1/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  })

const meParticipant = { id: 'p1', conversationId: 'c1', userId: 'me', state: 'accepted', lastReadAt: null }

beforeEach(() => vi.clearAllMocks())

describe('GET messages', () => {
  it('401 unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(get(), ctx('c1'))).status).toBe(401)
  })

  it('404 (not 403) for a non-participant, so ids cannot be probed', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(null)
    const res = await GET(get(), ctx('c1'))
    expect(res.status).toBe(404)
    expect(db.directMessage.findMany).not.toHaveBeenCalled()
  })

  it('verifies participation against the database before reading', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(meParticipant)
    await GET(get(), ctx('c1'))
    expect(db.conversationParticipant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId_userId: { conversationId: 'c1', userId: 'me' } },
      })
    )
  })

  it('excludes soft-deleted messages', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(meParticipant)
    await GET(get(), ctx('c1'))
    expect(db.directMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ conversationId: 'c1', deletedAt: null }),
      })
    )
  })

  it('400 for an invalid after value', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(meParticipant)
    const res = await GET(get('http://localhost/api/dm/conversations/c1/messages?after=garbage'), ctx('c1'))
    expect(res.status).toBe(400)
    expect(db.directMessage.findMany).not.toHaveBeenCalled()
  })

  it('400 for an invalid cursor value', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(meParticipant)
    const res = await GET(get('http://localhost/api/dm/conversations/c1/messages?cursor=garbage'), ctx('c1'))
    expect(res.status).toBe(400)
    expect(db.directMessage.findMany).not.toHaveBeenCalled()
  })

  it('200 and ascending order for a valid after', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(meParticipant)
    const res = await GET(
      get('http://localhost/api/dm/conversations/c1/messages?after=2026-07-20T10:00:00Z'),
      ctx('c1')
    )
    expect(res.status).toBe(200)
    expect(db.directMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } })
    )
  })

  it('poll mode wins when both after and cursor are supplied (no lt filter)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(meParticipant)
    await GET(
      get(
        'http://localhost/api/dm/conversations/c1/messages?after=2026-07-20T10:00:00Z&cursor=2026-07-19T10:00:00Z'
      ),
      ctx('c1')
    )
    const call = (db.directMessage.findMany as any).mock.calls[0][0]
    expect(call.where.createdAt).not.toHaveProperty('lt')
    expect(call.where.createdAt).toHaveProperty('gt')
    expect(call.orderBy).toEqual({ createdAt: 'asc' })
  })
})

describe('POST message', () => {
  const ok = () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(meParticipant)
    ;(db.conversationParticipant.findFirst as any).mockResolvedValue({
      userId: 'them', state: 'accepted', muted: false, lastReadAt: null,
    })
    ;(db.directMessage.create as any).mockResolvedValue({
      id: 'm1', conversationId: 'c1', senderId: 'me', kind: 'text',
      body: 'hi', mediaUrl: null, createdAt: new Date('2026-07-20T10:00:00Z'),
    })
  }

  it('404 for a non-participant', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(null)
    const res = await POST(post({ body: 'hi' }), ctx('c1'))
    expect(res.status).toBe(404)
    expect(db.directMessage.create).not.toHaveBeenCalled()
  })

  it('403 when the sender has been blocked by the other participant', async () => {
    ok()
    ;(db.conversationParticipant.findFirst as any).mockResolvedValue({
      userId: 'them', state: 'blocked', muted: false, lastReadAt: null,
    })
    const res = await POST(post({ body: 'hi' }), ctx('c1'))
    expect(res.status).toBe(403)
    expect(db.directMessage.create).not.toHaveBeenCalled()
  })

  it('400 for an empty body', async () => {
    ok()
    expect((await POST(post({ body: '   ' }), ctx('c1'))).status).toBe(400)
  })

  it('400 for a body over 4000 characters', async () => {
    ok()
    expect((await POST(post({ body: 'x'.repeat(4001) }), ctx('c1'))).status).toBe(400)
  })

  it('creates the message and bumps lastMessageAt', async () => {
    ok()
    const res = await POST(post({ body: 'hi' }), ctx('c1'))
    expect(res.status).toBe(201)
    expect(db.directMessage.create).toHaveBeenCalled()
    expect(db.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' } })
    )
  })

  it('notifies on the first unread message in a thread', async () => {
    ok()
    ;(db.directMessage.count as any).mockResolvedValue(1)
    await POST(post({ body: 'hi' }), ctx('c1'))
    expect(createNotification).toHaveBeenCalled()
  })

  it('does not notify again while the thread is already unread', async () => {
    ok()
    ;(db.directMessage.count as any).mockResolvedValue(4)
    await POST(post({ body: 'hi' }), ctx('c1'))
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('does not notify a muted recipient', async () => {
    ok()
    ;(db.conversationParticipant.findFirst as any).mockResolvedValue({
      userId: 'them', state: 'accepted', muted: true, lastReadAt: null,
    })
    ;(db.directMessage.count as any).mockResolvedValue(1)
    await POST(post({ body: 'hi' }), ctx('c1'))
    expect(createNotification).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubPost: { findFirst: vi.fn() },
    hubMember: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubBan: { findUnique: vi.fn() },
    hubPostReaction: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST, DELETE } from './route'

const ctx = { params: Promise.resolve({ id: 'h1', postId: 'p1' }) }
const req = (body: unknown) => new Request('http://localhost/api/hubs/h1/posts/p1/reactions', { method: 'POST', body: JSON.stringify(body) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true })
  ;(db.hubPost.findFirst as any).mockResolvedValue({ id: 'p1' })
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm' })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubBan.findUnique as any).mockResolvedValue(null)
  ;(db.hubPostReaction.upsert as any).mockResolvedValue({})
  ;(db.hubPostReaction.deleteMany as any).mockResolvedValue({})
  ;(db.hubPostReaction.findMany as any).mockResolvedValue([{ emoji: '❤️', userId: 'me' }])
})

describe('POST reactions', () => {
  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await POST(req({ emoji: '❤️' }), ctx)).status).toBe(401)
  })
  it('400 on invalid emoji', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    expect((await POST(req({ emoji: '🐸' }), ctx)).status).toBe(400)
  })
  it('404 on non-community hub', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: false })
    expect((await POST(req({ emoji: '❤️' }), ctx)).status).toBe(404)
  })
  it('403 when not a participant', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    ;(db.hubMember.findUnique as any).mockResolvedValue(null)
    expect((await POST(req({ emoji: '❤️' }), ctx)).status).toBe(403)
  })
  it('adds a reaction and returns the summary', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    const res = await POST(req({ emoji: '❤️' }), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ counts: { '❤️': 1 }, mine: ['❤️'] })
    expect(db.hubPostReaction.upsert).toHaveBeenCalled()
  })
})

describe('DELETE reactions', () => {
  it('removes the caller\'s reaction', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.hubPostReaction.findMany as any).mockResolvedValue([])
    const del = new Request('http://localhost/api/hubs/h1/posts/p1/reactions', { method: 'DELETE', body: JSON.stringify({ emoji: '❤️' }) }) as any
    const res = await DELETE(del, ctx)
    expect(res.status).toBe(200)
    expect(db.hubPostReaction.deleteMany).toHaveBeenCalledWith({ where: { postId: 'p1', userId: 'me', emoji: '❤️' } })
  })
})

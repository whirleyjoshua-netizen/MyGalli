import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/notifications', () => ({ notifyHubMembers: vi.fn(), createNotification: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubMember: { findUnique: vi.fn(), findMany: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubBan: { findUnique: vi.fn() },
    hubPost: { findFirst: vi.fn() },
    hubPostComment: { create: vi.fn(), findMany: vi.fn() },
    display: { findUnique: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { GET, POST } from './route'

const HUB = { id: 'h1', userId: 'owner', community: true, title: 'Smoke Hub', slug: 'smoke-hub', user: { username: 'hubowner' } }
const POST_ROW = { id: 'p1', authorId: 'm1' }
const ctx = { params: Promise.resolve({ id: 'h1', postId: 'p1' }) }
const req = (body: unknown) =>
  new Request('http://localhost/api/hubs/h1/posts/p1/comments', { method: 'POST', body: JSON.stringify(body) }) as any
const getReq = () => new Request('http://localhost/api/hubs/h1/posts/p1/comments', { method: 'GET' }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue(HUB)
  ;(db.hubPost.findFirst as any).mockResolvedValue(POST_ROW)
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem' })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubBan.findUnique as any).mockResolvedValue(null)
  ;(db.hubPostComment.create as any).mockResolvedValue({
    id: 'c1',
    text: 'nice',
    createdAt: new Date(),
    author: { id: 'm2', name: 'M2', username: 'm2', avatar: null },
  })
})

describe('POST comments — notifications', () => {
  it('notifies the post author', async () => {
    // post authored by 'm1'; comment POST as 'm2'
    ;(getUser as any).mockResolvedValue({ id: 'm2', name: 'M2', username: 'm2', avatar: null })
    await POST(req({ text: 'nice' }), ctx)
    expect((createNotification as any).mock.calls[0][0]).toMatchObject({ userId: 'm1', type: 'hub_comment' })
  })

  it('commenting on your own post notifies nobody', async () => {
    // post authored by 'm1'; comment POST as 'm1'
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    ;(db.hubPostComment.create as any).mockResolvedValue({
      id: 'c2',
      text: 'self',
      createdAt: new Date(),
      author: { id: 'm1', name: 'M1', username: 'm1', avatar: null },
    })
    await POST(req({ text: 'self' }), ctx)
    expect(createNotification).not.toHaveBeenCalled()
  })
})

describe('GET comments — read gate', () => {
  it('404s an anonymous/non-privileged viewer on a draft (unpublished) community', async () => {
    ;(db.hub.findUnique as any).mockResolvedValue({ ...HUB, published: false })
    ;(getUser as any).mockResolvedValue(null)
    const res = await GET(getReq(), ctx)
    expect(res.status).toBe(404)
  })

  it('200s the owner (privileged) for the same draft hub', async () => {
    ;(db.hub.findUnique as any).mockResolvedValue({ ...HUB, published: false })
    ;(db.hubPostComment.findMany as any).mockResolvedValue([])
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    const res = await GET(getReq(), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.comments).toEqual([])
  })

  it('200s the public for a published community', async () => {
    ;(db.hub.findUnique as any).mockResolvedValue({ ...HUB, published: true })
    ;(db.hubPostComment.findMany as any).mockResolvedValue([])
    ;(getUser as any).mockResolvedValue(null)
    const res = await GET(getReq(), ctx)
    expect(res.status).toBe(200)
  })
})

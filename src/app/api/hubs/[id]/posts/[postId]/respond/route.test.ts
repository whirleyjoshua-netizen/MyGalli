import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubMember: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubBan: { findUnique: vi.fn() },
    hubPost: { findFirst: vi.fn() },
    hubPostResponse: { upsert: vi.fn(), findMany: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'

const HUB = { id: 'h1', userId: 'owner', community: true }
const POST_ROW = { id: 'p1', blocks: [{ id: 'b1', type: 'poll', props: {} }] }
const ctx = { params: Promise.resolve({ id: 'h1', postId: 'p1' }) }
const req = (body: unknown) =>
  new Request('http://localhost/api/hubs/h1/posts/p1/respond', { method: 'POST', body: JSON.stringify(body) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue(HUB)
  ;(db.hubPost.findFirst as any).mockResolvedValue(POST_ROW)
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem' }) // caller is a member
  ;(db.hubBan.findUnique as any).mockResolvedValue(null)
  ;(db.hubPostResponse.upsert as any).mockResolvedValue({})
  ;(db.hubPostResponse.findMany as any).mockResolvedValue([])
})

describe('POST /api/hubs/[id]/posts/[postId]/respond', () => {
  it('401s when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(req({ responses: { b1: 'yes' } }), ctx)
    expect(res.status).toBe(401)
  })

  it('400s when responses is missing or not an object', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1' })
    const res = await POST(req({}), ctx)
    expect(res.status).toBe(400)
  })

  it('404s for a post id belonging to a different hub (IDOR)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1' })
    ;(db.hubPost.findFirst as any).mockResolvedValue(null)
    const res = await POST(req({ responses: { b1: 'yes' } }), ctx)
    expect(res.status).toBe(404)
    expect(db.hubPost.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', hubId: 'h1' }, select: { id: true, blocks: true } })
  })

  it('403s for a non-participant (not owner, collaborator, or member)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    ;(db.hubMember.findUnique as any).mockResolvedValue(null)
    const res = await POST(req({ responses: { b1: 'yes' } }), ctx)
    expect(res.status).toBe(403)
  })

  it('upserts: answering twice leaves one row, updated', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1' })
    await POST(req({ responses: { b1: 'yes' } }), ctx)
    await POST(req({ responses: { b1: 'no' } }), ctx)
    expect(db.hubPostResponse.upsert).toHaveBeenCalledTimes(2)
    expect(db.hubPostResponse.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { postId_userId: { postId: 'p1', userId: 'm1' } } }),
    )
  })

  it('returns the recomputed aggregate for the block', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1' })
    ;(db.hubPostResponse.findMany as any).mockResolvedValue([
      { userId: 'm1', responses: { b1: 'yes' }, createdAt: new Date(), user: { name: 'M1', username: 'm1', avatar: null } },
    ])
    const res = await POST(req({ responses: { b1: 'yes' } }), ctx)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.results).not.toBeNull()
  })
})

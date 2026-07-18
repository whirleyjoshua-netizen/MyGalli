import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/notifications', () => ({ notifyHubMembers: vi.fn(), createNotification: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubMember: { findUnique: vi.fn(), findMany: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubPost: { create: vi.fn(), findMany: vi.fn() },
    hubPostResponse: { findMany: vi.fn() },
    hubPostReaction: { findMany: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyHubMembers } from '@/lib/notifications'
import { GET, POST } from './route'

const HUB = { id: 'h1', userId: 'owner', community: true, published: true, title: 'Smoke Hub', slug: 'smoke-hub', user: { username: 'hubowner' } }
const ctx = { params: Promise.resolve({ id: 'h1' }) }
const req = (body: unknown) =>
  new Request('http://localhost/api/hubs/h1/posts', { method: 'POST', body: JSON.stringify(body) }) as any
const getReq = () => new Request('http://localhost/api/hubs/h1/posts', { method: 'GET' }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue(HUB)
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem' }) // caller is a member
  ;(db.hubMember.findMany as any).mockResolvedValue([{ userId: 'm1' }, { userId: 'm2' }])
  ;(db.hubPost.create as any).mockResolvedValue({ id: 'p1' })
  ;(db.hubPostResponse.findMany as any).mockResolvedValue([])
  ;(db.hubPostReaction.findMany as any).mockResolvedValue([])
})

describe('POST /api/hubs/[id]/posts — notifications', () => {
  it('owner posting notifies every member except the author', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    const res = await POST(req({ text: 'hello' }), ctx)
    expect(res.status).toBe(201)
    const [targets, input] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets].sort()).toEqual(['m1', 'm2'])
    expect(input.type).toBe('hub_post')
    expect(input.entityUrl).toBe('/hubowner/hub/smoke-hub')
    expect(input.contextText).toBe('Smoke Hub')
  })

  it('member posting notifies the owner, not other members', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    await POST(req({ text: 'hi' }), ctx)
    const [targets] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets].sort()).toEqual(['owner'])
  })

  it('collaborator posting notifies all members', async () => {
    ;(db.hubCollaborator.findMany as any).mockResolvedValue([{ userId: 'collab' }])
    ;(getUser as any).mockResolvedValue({ id: 'collab', name: 'Collab', username: 'collab', avatar: null })
    await POST(req({ text: 'hi' }), ctx)
    const [targets] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets].sort()).toEqual(['m1', 'm2'])
  })

  it('member posting notifies the owner and collaborators', async () => {
    ;(db.hubCollaborator.findMany as any).mockResolvedValue([{ userId: 'collab' }])
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    await POST(req({ text: 'hi' }), ctx)
    const [targets] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets].sort()).toEqual(['collab', 'owner'])
  })

  it('creates the post before notifying (notification is not a precondition)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    await POST(req({ text: 'hello' }), ctx)
    expect(db.hubPost.create).toHaveBeenCalled()
    expect(notifyHubMembers).toHaveBeenCalled()
  })
})

const POST_WITH_BLOCK = {
  id: 'p1',
  authorId: 'owner',
  author: { id: 'owner', name: 'Owner', username: 'hubowner', avatar: null },
  text: 'hi',
  imageUrl: null,
  blocks: [{ id: 'b1', type: 'poll', pollQuestion: 'Q', pollOptions: ['A', 'B'], pollAllowMultiple: false }],
  settings: { revealAfterAnswer: true, liveTally: false },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  likes: [],
  _count: { comments: 0 },
}

const POST_NO_BLOCK = {
  id: 'p2',
  authorId: 'owner',
  author: { id: 'owner', name: 'Owner', username: 'hubowner', avatar: null },
  text: 'no block here',
  imageUrl: null,
  blocks: [],
  settings: { revealAfterAnswer: false, liveTally: false },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  likes: [],
  _count: { comments: 0 },
}

const M1_RESPONSE = {
  postId: 'p1',
  userId: 'm1',
  responses: { b1: { type: 'poll', answer: 'A' } },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  user: { name: 'M1', username: 'm1', avatar: null },
}

describe('POST /api/hubs/[id]/posts — blocks', () => {
  it('persists an attached block into blocks[] and normalizes settings', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    const block = { id: 'b1', type: 'poll', pollQuestion: 'Q', pollOptions: ['a', 'b'] }
    const res = await POST(req({ text: '', block, settings: { revealAfterAnswer: true } }), ctx)
    expect(res.status).toBe(201)
    const createArgs = (db.hubPost.create as any).mock.calls[0][0]
    expect(createArgs.data.blocks).toEqual([block])
    expect(createArgs.data.settings).toEqual({ revealAfterAnswer: true, liveTally: false })
  })

  it('400s on an unsupported block type', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    const res = await POST(req({ block: { id: 'b1', type: 'malicious' } }), ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Unsupported block type')
  })

  it('allows a block-only post with no text', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    const block = { id: 'b1', type: 'poll', pollQuestion: 'Q', pollOptions: ['a', 'b'] }
    const res = await POST(req({ text: '', block }), ctx)
    expect(res.status).toBe(201)
  })

  it('still 400s on a truly empty post', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    const res = await POST(req({ text: '', imageUrl: null }), ctx)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/hubs/[id]/posts — block/settings/myResponse/results', () => {
  it('returns the post block and normalized settings', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hubPost.findMany as any).mockResolvedValue([POST_WITH_BLOCK])
    const res = await GET(getReq(), ctx)
    const body = await res.json()
    expect(body.posts[0].block.id).toBe('b1')
    expect(body.posts[0].settings.revealAfterAnswer).toBe(true)
  })

  it('returns myResponse for the requesting user only', async () => {
    ;(db.hubPost.findMany as any).mockResolvedValue([POST_WITH_BLOCK])
    ;(db.hubPostResponse.findMany as any).mockResolvedValue([M1_RESPONSE])

    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    const asM1 = await (await GET(getReq(), ctx)).json()
    expect(asM1.posts[0].myResponse).toEqual({ b1: { type: 'poll', answer: 'A' } })

    ;(getUser as any).mockResolvedValue({ id: 'm2', name: 'M2', username: 'm2', avatar: null })
    const asM2 = await (await GET(getReq(), ctx)).json()
    expect(asM2.posts[0].myResponse).toBeNull()
  })

  it('hides results from a non-responder when revealAfterAnswer is true', async () => {
    ;(db.hubPost.findMany as any).mockResolvedValue([POST_WITH_BLOCK])
    ;(db.hubPostResponse.findMany as any).mockResolvedValue([M1_RESPONSE])
    ;(getUser as any).mockResolvedValue({ id: 'm2', name: 'M2', username: 'm2', avatar: null })
    const body = await (await GET(getReq(), ctx)).json()
    expect(body.posts[0].results).toBeNull()
  })

  it('shows results to a responder when revealAfterAnswer is true', async () => {
    ;(db.hubPost.findMany as any).mockResolvedValue([POST_WITH_BLOCK])
    ;(db.hubPostResponse.findMany as any).mockResolvedValue([M1_RESPONSE])
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    const body = await (await GET(getReq(), ctx)).json()
    expect(body.posts[0].results).not.toBeNull()
  })

  it('shows results to the post author regardless', async () => {
    ;(db.hubPost.findMany as any).mockResolvedValue([POST_WITH_BLOCK])
    ;(db.hubPostResponse.findMany as any).mockResolvedValue([])
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    const body = await (await GET(getReq(), ctx)).json()
    expect(body.posts[0].results).not.toBeNull()
  })

  it('returns block null for a post with no block', async () => {
    ;(db.hubPost.findMany as any).mockResolvedValue([POST_NO_BLOCK])
    ;(db.hubPostResponse.findMany as any).mockResolvedValue([])
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    const body = await (await GET(getReq(), ctx)).json()
    expect(body.posts[0].block).toBeNull()
    expect(body.posts[0].results).toBeNull()
  })
})

describe('POST /api/hubs/[id]/posts — who-can-post', () => {
  it('403 when community is owner-only and caller is a plain member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({ ...HUB, config: { access: { whoCanPost: 'owner-only' } } })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem' }) // is a member
    ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
    const res = await POST(req({ text: 'hi' }), ctx)
    expect(res.status).toBe(403)
  })
  it('owner can still post to an owner-only community', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'O', username: 'hubowner', avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({ ...HUB, config: { access: { whoCanPost: 'owner-only' } } })
    const res = await POST(req({ text: 'hi' }), ctx)
    expect(res.status).toBe(201)
  })
})

describe('GET /api/hubs/[id]/posts — reactions', () => {
  it('includes a reaction summary per post', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    ;(db.hubPost.findMany as any).mockResolvedValue([
      { id: 'p1', author: { id: 'a', name: 'A', username: 'a', avatar: null }, text: 'hi', imageUrl: null, blocks: [], settings: {}, createdAt: new Date(), authorId: 'a', _count: { comments: 0 } },
    ])
    ;(db.hubPostReaction.findMany as any).mockResolvedValue([
      { postId: 'p1', emoji: '❤️', userId: 'm1' },
      { postId: 'p1', emoji: '❤️', userId: 'z' },
    ])
    const res = await GET(getReq(), ctx)
    const body = await res.json()
    expect(body.posts[0].reactions).toEqual({ counts: { '❤️': 2 }, mine: ['❤️'] })
  })
})

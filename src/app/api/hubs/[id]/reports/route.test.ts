import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/notifications', () => ({ notifyHubMembers: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubMember: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    hubBan: { findUnique: vi.fn() },
    hubPost: { findFirst: vi.fn() },
    hubPostComment: { findFirst: vi.fn() },
    hubDrop: { findFirst: vi.fn() },
    hubReport: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyHubMembers } from '@/lib/notifications'
import { GET, POST } from './route'
import { PATCH } from './[reportId]/route'

const ctx = { params: Promise.resolve({ id: 'h1' }) }
const reportCtx = { params: Promise.resolve({ id: 'h1', reportId: 'r1' }) }
const post = (b: unknown) => new Request('http://localhost/api/hubs/h1/reports', { method: 'POST', body: JSON.stringify(b) }) as any
const get = () => new Request('http://localhost/api/hubs/h1/reports', { method: 'GET' }) as any
const patch = (b: unknown) => new Request('http://localhost/api/hubs/h1/reports/r1', { method: 'PATCH', body: JSON.stringify(b) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true, title: 'Club', slug: 'club', user: { username: 'o' } })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
  ;(db.hubMember.findMany as any).mockResolvedValue([{ userId: 'm1' }])
  ;(db.hubBan.findUnique as any).mockResolvedValue(null)
  ;(db.hubPost.findFirst as any).mockResolvedValue({ id: 'p1' })
  ;(db.hubPostComment.findFirst as any).mockResolvedValue({ id: 'c1' })
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'd1' })
  ;(db.hubReport.create as any).mockResolvedValue({ id: 'rep1' })
  ;(db.hubReport.findMany as any).mockResolvedValue([])
  ;(db.hubReport.findFirst as any).mockResolvedValue(null)
})

const validBody = { targetType: 'post', targetId: 'p1', reason: 'spam' }

describe('POST /reports', () => {
  it('401 when logged out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(post(validBody), ctx)
    expect(res.status).toBe(401)
  })

  it('403 for a non-member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger', username: 's', name: null, avatar: null })
    ;(db.hubMember.findUnique as any).mockResolvedValue(null)
    const res = await POST(post(validBody), ctx)
    expect(res.status).toBe(403)
  })

  it('403 for a banned member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    ;(db.hubBan.findUnique as any).mockResolvedValue({ id: 'ban1' })
    const res = await POST(post(validBody), ctx)
    expect(res.status).toBe(403)
  })

  it('404 when the target belongs to another hub', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    ;(db.hubPost.findFirst as any).mockResolvedValue(null)
    const res = await POST(post(validBody), ctx)
    expect(res.status).toBe(404)
  })

  it('404 when the target does not exist', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    ;(db.hubPost.findFirst as any).mockResolvedValue(null)
    const res = await POST(post({ targetType: 'post', targetId: 'nope', reason: 'spam' }), ctx)
    expect(res.status).toBe(404)
  })

  it('400 on an invalid reason', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    const res = await POST(post({ targetType: 'post', targetId: 'p1', reason: 'nonsense' }), ctx)
    expect(res.status).toBe(400)
  })

  it('201 for a valid report + notifies moderators', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: 'M', avatar: null })
    const res = await POST(post(validBody), ctx)
    expect(res.status).toBe(201)
    expect(db.hubReport.create).toHaveBeenCalled()
    const [targets, input] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets]).toEqual(['owner'])
    expect(input.type).toBe('hub_report')
  })

  it('200 no-op on a duplicate report', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: 'M', avatar: null })
    const err: any = new Error('unique violation')
    err.code = 'P2002'
    ;(db.hubReport.create as any).mockRejectedValue(err)
    const res = await POST(post(validBody), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(notifyHubMembers).not.toHaveBeenCalled()
  })
})

describe('GET /reports', () => {
  it('403 for a member (moderators only)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    const res = await GET(get(), ctx)
    expect(res.status).toBe(403)
  })

  it('returns open reports for a moderator', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: null, avatar: null })
    ;(db.hubReport.findMany as any).mockResolvedValue([{ id: 'rep1', hubId: 'h1', reporterId: 'member', targetType: 'post', targetId: 'p1', reason: 'spam', note: null, status: 'open', createdAt: new Date(), resolvedAt: null, resolvedById: null }])
    const res = await GET(get(), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reports).toHaveLength(1)
  })
})

describe('PATCH /reports/[reportId]', () => {
  it('403 for a non-moderator', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    const res = await PATCH(patch({ status: 'resolved' }), reportCtx)
    expect(res.status).toBe(403)
  })

  it('404 for a report belonging to another hub', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: null, avatar: null })
    ;(db.hubReport.findFirst as any).mockResolvedValue(null)
    const res = await PATCH(patch({ status: 'resolved' }), reportCtx)
    expect(res.status).toBe(404)
  })

  it('sets status and stamps resolvedAt/resolvedById', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: null, avatar: null })
    ;(db.hubReport.findFirst as any).mockResolvedValue({ id: 'r1', hubId: 'h1', status: 'open' })
    ;(db.hubReport.update as any).mockResolvedValue({ id: 'r1', status: 'resolved' })
    const res = await PATCH(patch({ status: 'resolved' }), reportCtx)
    expect(res.status).toBe(200)
    const call = (db.hubReport.update as any).mock.calls[0][0]
    expect(call.where).toEqual({ id: 'r1' })
    expect(call.data.status).toBe('resolved')
    expect(call.data.resolvedById).toBe('owner')
    expect(call.data.resolvedAt).toBeInstanceOf(Date)
  })
})

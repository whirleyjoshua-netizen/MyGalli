import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/notifications', () => ({ notifyHubMembers: vi.fn(), createNotification: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubMember: { findUnique: vi.fn(), findMany: vi.fn() },
    hubBan: { findUnique: vi.fn() },
    hubDrop: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyHubMembers } from '@/lib/notifications'
import { GET, POST } from './route'

const ctx = { params: Promise.resolve({ id: 'h1' }) }
const post = (b: unknown) => new Request('http://localhost/api/hubs/h1/drops', { method: 'POST', body: JSON.stringify(b) }) as any
const get = (qs = '') => new Request(`http://localhost/api/hubs/h1/drops${qs}`, { method: 'GET' }) as any
const OWN_URL = 'https://abc123.public.blob.vercel-storage.com/hub-drops/h1/y.jpg'

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true, title: 'Club', slug: 'club', config: null, user: { username: 'o' } })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubMember.findUnique as any).mockResolvedValue(null)
  ;(db.hubMember.findMany as any).mockResolvedValue([{ userId: 'm1' }])
  ;(db.hubBan.findUnique as any).mockResolvedValue(null)
  ;(db.hubDrop.create as any).mockResolvedValue({ id: 'd1' })
  ;(db.hubDrop.findMany as any).mockResolvedValue([])
  ;(db.hubDrop.findFirst as any).mockResolvedValue(null)
})

describe('POST /drops', () => {
  it('401 when logged out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(post({ type: 'image', url: 'https://abc123.public.blob.vercel-storage.com/hub-drops/h1/y.jpg' }), ctx)
    expect(res.status).toBe(401)
  })

  it('403 for a non-member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger', username: 's', name: null, avatar: null })
    ;(db.hubMember.findUnique as any).mockResolvedValue(null)
    const res = await POST(post({ type: 'image', url: 'https://abc123.public.blob.vercel-storage.com/hub-drops/h1/y.jpg' }), ctx)
    expect(res.status).toBe(403)
  })

  it('403 in owner-only mode for a plain member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true, title: 'Club', slug: 'club', config: { kollab: { enabled: true, whoCanDrop: 'owner-only' } }, user: { username: 'o' } })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    const res = await POST(post({ type: 'image', url: 'https://abc123.public.blob.vercel-storage.com/hub-drops/h1/y.jpg' }), ctx)
    expect(res.status).toBe(403)
  })

  it('403 for a plain member when the pool is disabled', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true, title: 'Club', slug: 'club', config: { kollab: { enabled: false, whoCanDrop: 'members' } }, user: { username: 'o' } })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    const res = await POST(post({ type: 'image', url: 'https://abc123.public.blob.vercel-storage.com/hub-drops/h1/y.jpg' }), ctx)
    expect(res.status).toBe(403)
  })

  it('201 for a member drop + notifies moderators (pending, unseen by the pool)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: 'M', avatar: null })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    const res = await POST(post({ type: 'image', url: 'https://abc123.public.blob.vercel-storage.com/hub-drops/h1/y.jpg', caption: 'hi' }), ctx)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'd1', status: 'pending' })
    expect(db.hubDrop.create).toHaveBeenCalled()
    const [targets, input] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets]).toEqual(['owner'])
    expect(input.type).toBe('hub_drop_pending')
  })

  // A member can skip the Blob token route and POST here directly; an off-host
  // url would then render as <img src> for every visitor.
  it('400 for a drop url outside our Blob store', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: 'M', avatar: null })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    const res = await POST(post({ type: 'image', url: 'https://attacker.example/tracker.gif' }), ctx)
    expect(res.status).toBe(400)
    expect(db.hubDrop.create).not.toHaveBeenCalled()
  })

  // Filing someone else's blob as a drop would let the author then delete it,
  // since DELETE hard-deletes the row's url with the app-wide RW token.
  it('400 for a blob url outside this hub namespace', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: 'M', avatar: null })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    const res = await POST(post({ type: 'image', url: 'https://abc123.public.blob.vercel-storage.com/avatars/victim.jpg' }), ctx)
    expect(res.status).toBe(400)
    expect(db.hubDrop.create).not.toHaveBeenCalled()
  })

  it('POST holds a member drop for review regardless of config', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: 'M', avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({
      id: 'h1', userId: 'owner', community: true, published: true, title: 'Club', slug: 'club',
      config: { kollab: { enabled: true, whoCanDrop: 'members', requireApproval: false } },
      user: { username: 'o' },
    })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    ;(db.hubDrop.create as any).mockResolvedValue({ id: 'drop1' })
    const res = await POST(post({ type: 'image', url: OWN_URL }), ctx)
    expect(res.status).toBe(201)
    expect((db.hubDrop.create as any).mock.calls[0][0].data.status).toBe('pending')
    expect((db.hubDrop.create as any).mock.calls[0][0].data.hidden).toBe(true)
    const created = (db.hubDrop.create as any).mock.calls[0][0].data
    expect(created.consentText).toEqual(expect.stringContaining('Club'))
  })

  it('POST auto-approves a privileged uploader', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({
      id: 'h1', userId: 'owner', community: true, published: true, title: 'Club', slug: 'club',
      config: { kollab: { enabled: true, whoCanDrop: 'members' } }, user: { username: 'o' },
    })
    ;(db.hubMember.findUnique as any).mockResolvedValue(null)
    ;(db.hubDrop.create as any).mockResolvedValue({ id: 'drop2' })
    const res = await POST(post({ type: 'image', url: OWN_URL }), ctx)
    expect(res.status).toBe(201)
    expect((db.hubDrop.create as any).mock.calls[0][0].data.status).toBe('approved')
  })

  it('POST does not notify the hub about a drop nobody can see', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: 'M', avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({
      id: 'h1', userId: 'owner', community: true, published: true, title: 'Club', slug: 'club',
      config: { kollab: { enabled: true, whoCanDrop: 'members' } }, user: { username: 'o' },
    })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    ;(db.hubDrop.create as any).mockResolvedValue({ id: 'drop3' })
    await POST(post({ type: 'image', url: OWN_URL }), ctx)
    const types = (notifyHubMembers as any).mock.calls.map((c: any[]) => c[1].type)
    expect(types).toContain('hub_drop_pending')
    expect(types).not.toContain('hub_drop')
  })

  it('400 on invalid type', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    const res = await POST(post({ type: 'link', url: 'https://x' }), ctx)
    expect(res.status).toBe(400)
  })
})

describe('GET /drops', () => {
  it('404 for a draft community to anon', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: false })
    const res = await GET(get(), ctx)
    expect(res.status).toBe(404)
  })

  it('excludes non-approved drops for the public', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true })
    ;(db.hubDrop.findMany as any).mockResolvedValue([])
    await GET(get(), ctx)
    const call = (db.hubDrop.findMany as any).mock.calls[0][0]
    expect(call.where).toMatchObject({ hubId: 'h1', status: 'approved' })
  })

  it('GET 403s a pending request from a non-privileged viewer', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true })
    const res = await GET(get('?status=pending'), ctx)
    expect(res.status).toBe(403)
  })

  it('GET defaults to approved only, even for the owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner' })
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true })
    ;(db.hubDrop.findMany as any).mockResolvedValue([])
    await GET(get(''), ctx)
    expect((db.hubDrop.findMany as any).mock.calls[0][0].where).toEqual({ hubId: 'h1', status: 'approved' })
  })

  // Same-millisecond drops (the picker uploads a selection in a loop) share a
  // createdAt, so the ordering must be total or a page boundary drops one.
  it('orders by createdAt then id', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true })
    ;(db.hubDrop.findMany as any).mockResolvedValue([])
    await GET(get(), ctx)
    expect((db.hubDrop.findMany as any).mock.calls[0][0].orderBy)
      .toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
  })

  it('paginates from a cursor scoped to this hub', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true })
    ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'd9' })
    ;(db.hubDrop.findMany as any).mockResolvedValue([])
    await GET(get('?cursor=d9'), ctx)
    expect((db.hubDrop.findFirst as any).mock.calls[0][0].where).toMatchObject({ id: 'd9', hubId: 'h1' })
    const call = (db.hubDrop.findMany as any).mock.calls[0][0]
    expect(call.cursor).toEqual({ id: 'd9' })
    expect(call.skip).toBe(1)
  })

  it('ignores a cursor belonging to another hub', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true })
    ;(db.hubDrop.findFirst as any).mockResolvedValue(null)
    ;(db.hubDrop.findMany as any).mockResolvedValue([])
    await GET(get('?cursor=someone-elses-drop'), ctx)
    const call = (db.hubDrop.findMany as any).mock.calls[0][0]
    expect(call.cursor).toBeUndefined()
    expect(call.skip).toBeUndefined()
  })
})

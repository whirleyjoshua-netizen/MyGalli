import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/kollab/director', async () => {
  const actual = await vi.importActual<any>('@/lib/kollab/director')
  return { ...actual, directReel: vi.fn() }
})
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubMember: { findUnique: vi.fn() },
    hubBan: { findUnique: vi.fn() },
    hubDrop: { findMany: vi.fn() },
    kollabReel: { create: vi.fn(), findMany: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { directReel, DirectorError } from '@/lib/kollab/director'
import { POST, GET } from './route'

const ctx = { params: Promise.resolve({ id: 'h1' }) }
const post = (b: unknown) =>
  new Request('http://localhost/api/hubs/h1/kollab/reels', { method: 'POST', body: JSON.stringify(b) }) as any

const drop = (id: string) => ({
  id, type: 'video', caption: null, durationSec: 10, createdAt: new Date('2026-07-21'),
  aiTags: null, url: `https://blob/${id}.mp4`, thumbnailUrl: `https://blob/${id}.jpg`,
  author: { username: 'maria' },
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true, config: null })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
  ;(db.hubBan.findUnique as any).mockResolvedValue(null)
  ;(db.hubDrop.findMany as any).mockResolvedValue([drop('d1'), drop('d2'), drop('d3')])
  ;(db.kollabReel.create as any).mockResolvedValue({ id: 'r1', createdAt: new Date('2026-07-22') })
  ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
  ;(directReel as any).mockResolvedValue({
    title: 'Saturday',
    clips: [{ dropId: 'd1', in: 0, out: 3 }, { dropId: 'd2', in: 0, out: 3 }],
  })
})

describe('POST /kollab/reels', () => {
  it('401 when logged out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await POST(post({ preset: 'recent' }), ctx)).status).toBe(401)
  })

  it('404 for a non-community hub', async () => {
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: false, published: true, config: null })
    expect((await POST(post({ preset: 'recent' }), ctx)).status).toBe(404)
  })

  it('403 for a non-member', async () => {
    ;(db.hubMember.findUnique as any).mockResolvedValue(null)
    expect((await POST(post({ preset: 'recent' }), ctx)).status).toBe(403)
  })

  it('403 for a plain member when whoCanStitch is owner-only', async () => {
    ;(db.hub.findUnique as any).mockResolvedValue({
      id: 'h1', userId: 'owner', community: true, published: true,
      config: { kollab: { enabled: true, whoCanStitch: 'owner-only' } },
    })
    expect((await POST(post({ preset: 'recent' }), ctx)).status).toBe(403)
  })

  it('201 for the owner when whoCanStitch is owner-only', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: null, avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({
      id: 'h1', userId: 'owner', community: true, published: true,
      config: { kollab: { enabled: true, whoCanStitch: 'owner-only' } },
    })
    expect((await POST(post({ preset: 'recent' }), ctx)).status).toBe(201)
  })

  it('400 on an unknown preset', async () => {
    expect((await POST(post({ preset: 'wat' }), ctx)).status).toBe(400)
  })

  it('400 with fewer than 3 candidates, without calling the model', async () => {
    ;(db.hubDrop.findMany as any).mockResolvedValue([drop('d1')])
    expect((await POST(post({ preset: 'recent' }), ctx)).status).toBe(400)
    expect(directReel).not.toHaveBeenCalled()
  })

  it('queries only approved drops', async () => {
    await POST(post({ preset: 'everyone' }), ctx)
    expect((db.hubDrop.findMany as any).mock.calls[0][0].where.status).toBe('approved')
  })

  it('caps the candidate query at 120', async () => {
    await POST(post({ preset: 'everyone' }), ctx)
    expect((db.hubDrop.findMany as any).mock.calls[0][0].take).toBe(120)
  })

  it('persists a draft and returns the hydrated reel', async () => {
    const res = await POST(post({ preset: 'recent' }), ctx)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('r1')
    expect(body.title).toBe('Saturday')
    expect(body.clips).toHaveLength(2)
    expect(body.runtimeSec).toBeCloseTo(6)
    // Must be shape-compatible with a GET row — the client prepends it directly
    // into its list and the Reels tab reads both of these.
    expect(body.creator.username).toBe('m')
    expect(typeof body.createdAt).toBe('string')
    expect(body.clips[0].url).toBe('https://blob/d1.mp4')
    expect(body.clips[0].author).toBe('maria')
    const data = (db.kollabReel.create as any).mock.calls[0][0].data
    expect(data.status).toBe('draft')
    expect(data.creatorId).toBe('member')
    expect(data.edl).toEqual([{ dropId: 'd1', in: 0, out: 3 }, { dropId: 'd2', in: 0, out: 3 }])
  })

  it('422 when the model references an unknown drop, and persists nothing', async () => {
    ;(directReel as any).mockResolvedValue({ title: 'x', clips: [{ dropId: 'evil', in: 0, out: 3 }] })
    expect((await POST(post({ preset: 'recent' }), ctx)).status).toBe(422)
    expect(db.kollabReel.create).not.toHaveBeenCalled()
  })

  it('passes a DirectorError status through', async () => {
    ;(directReel as any).mockRejectedValue(new DirectorError('busy', 429))
    expect((await POST(post({ preset: 'recent' }), ctx)).status).toBe(429)
  })

  it('400 on an overlong prompt', async () => {
    expect((await POST(post({ preset: 'recent', prompt: 'x'.repeat(300) }), ctx)).status).toBe(400)
  })
})

const get = () => new Request('http://localhost/api/hubs/h1/kollab/reels', { method: 'GET' }) as any

const reelRow = (over: any = {}) => ({
  id: 'r1', title: 'Saturday', status: 'published', createdAt: new Date('2026-07-22'),
  edl: [{ dropId: 'd1', in: 0, out: 3 }, { dropId: 'gone', in: 0, out: 3 }],
  creatorId: 'member', creator: { username: 'm' }, ...over,
})

describe('GET /kollab/reels', () => {
  beforeEach(() => {
    ;(db.kollabReel.findMany as any).mockResolvedValue([reelRow()])
    ;(db.hubDrop.findMany as any).mockResolvedValue([
      { id: 'd1', type: 'video', url: 'https://blob/x.mp4', thumbnailUrl: 'https://blob/x.jpg', caption: null, durationSec: 10, status: 'approved', author: { username: 'maria' } },
    ])
  })

  it('drops clips whose drop no longer exists', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const body = await (await GET(get(), ctx)).json()
    expect(body.reels[0].clips).toHaveLength(1)
    expect(body.reels[0].clips[0].dropId).toBe('d1')
    expect(body.reels[0].clips[0].url).toBe('https://blob/x.mp4')
  })

  it('recomputes runtime from the surviving clips', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const body = await (await GET(get(), ctx)).json()
    expect(body.reels[0].runtimeSec).toBeCloseTo(3)
  })

  it('hydrates only approved drops', async () => {
    ;(getUser as any).mockResolvedValue(null)
    await GET(get(), ctx)
    const call = (db.hubDrop.findMany as any).mock.calls.at(-1)[0]
    expect(call.where.status).toBe('approved')
  })

  it('shows anonymous visitors published reels only', async () => {
    ;(getUser as any).mockResolvedValue(null)
    await GET(get(), ctx)
    expect((db.kollabReel.findMany as any).mock.calls[0][0].where.status).toBe('published')
  })

  it('shows a creator their own drafts too', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    await GET(get(), ctx)
    const where = (db.kollabReel.findMany as any).mock.calls[0][0].where
    expect(where.OR).toEqual([{ status: 'published' }, { creatorId: 'member' }])
  })

  it('shows a moderator everything', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: null, avatar: null })
    await GET(get(), ctx)
    const where = (db.kollabReel.findMany as any).mock.calls[0][0].where
    expect(where.status).toBeUndefined()
    expect(where.OR).toBeUndefined()
  })

  it('404s on a draft community for an anonymous visitor', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: false, config: null })
    expect((await GET(get(), ctx)).status).toBe(404)
  })

  it('survives a malformed edl blob', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.kollabReel.findMany as any).mockResolvedValue([reelRow({ edl: 'garbage' })])
    const res = await GET(get(), ctx)
    expect(res.status).toBe(200)
    expect((await res.json()).reels[0].clips).toEqual([])
  })
})

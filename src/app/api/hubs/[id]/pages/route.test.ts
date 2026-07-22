import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubMember: { findUnique: vi.fn(async () => null) },
    display: { findUnique: vi.fn() },
    hubPage: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({ id: 'hp1', status: 'pending' })) },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET, POST } from './route'

const params = { params: Promise.resolve({ id: 'hub1' }) }
const req = (body?: any) => ({ json: async () => body, url: 'http://localhost/api/hubs/hub1/pages' } as any)
beforeEach(() => vi.resetAllMocks())

const hub = { id: 'hub1', userId: 'owner', community: true, published: true }
const ownedPage = { id: 'd1', userId: 'member', published: true, kind: 'page' }

it('GET 404 when the hub is not a community hub', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue({ ...hub, community: false })
  expect((await GET(req(), params)).status).toBe(404)
})

it('GET returns approved pages for a public viewer', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findMany as any).mockResolvedValue([
    { id: 'hp1', displayId: 'd1', status: 'approved', addedById: 'member', createdAt: new Date('2026-07-22T00:00:00Z'),
      display: { title: 'P', slug: 'p', coverImage: null, user: { username: 'jo' } } },
  ])
  const res = await GET(req(), params)
  expect(res.status).toBe(200)
  expect((await res.json()).pages[0].title).toBe('P')
})

it('POST 401 when logged out', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(401)
})

it('POST 403 for a non-member', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue(null)
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(403)
})

it('POST 404 when the Display is not the caller own', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.display.findUnique as any).mockResolvedValue({ ...ownedPage, userId: 'someone-else' })
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(404)
})

it('POST 422 for a Board', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.display.findUnique as any).mockResolvedValue({ ...ownedPage, kind: 'collection' })
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(422)
})

it('POST 422 for an unpublished Page', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.display.findUnique as any).mockResolvedValue({ ...ownedPage, published: false })
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(422)
})

it('POST 409 on a duplicate attach', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.display.findUnique as any).mockResolvedValue(ownedPage)
  ;(db.hubPage.create as any).mockRejectedValue({ code: 'P2002' })
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(409)
})

it('POST by a member lands pending', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.display.findUnique as any).mockResolvedValue(ownedPage)
  const res = await POST(req({ displayId: 'd1' }), params)
  expect(res.status).toBe(201)
  expect((db.hubPage.create as any).mock.calls[0][0].data.status).toBe('pending')
})

it('POST by the owner lands approved', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.display.findUnique as any).mockResolvedValue({ ...ownedPage, userId: 'owner' })
  const res = await POST(req({ displayId: 'd1' }), params)
  expect(res.status).toBe(201)
  expect((db.hubPage.create as any).mock.calls[0][0].data.status).toBe('approved')
})

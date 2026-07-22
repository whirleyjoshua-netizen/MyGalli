import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubAnnouncement: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({ id: 'new1' })) },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET, POST } from './route'

const params = { params: Promise.resolve({ id: 'hub1' }) }
const req = (body?: any) => ({ json: async () => body, url: 'http://localhost/api/hubs/hub1/announcements' } as any)
beforeEach(() => vi.clearAllMocks())

const publishedHub = { id: 'hub1', userId: 'owner', community: true, published: true }

it('GET 404 when the hub is not a community hub', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: false, published: true })
  const res = await GET(req(), params)
  expect(res.status).toBe(404)
})

it('GET returns announcements for a public viewer', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue(publishedHub)
  ;(db.hubAnnouncement.findMany as any).mockResolvedValue([
    { id: 'a1', body: 'hello', createdAt: new Date('2026-07-22T00:00:00Z'), author: { username: 'o', name: 'O', avatar: null } },
  ])
  const res = await GET(req(), params)
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.announcements).toHaveLength(1)
  expect(data.announcements[0].body).toBe('hello')
})

it('POST 401 when logged out', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue(publishedHub)
  const res = await POST(req({ body: 'hi' }), params)
  expect(res.status).toBe(401)
})

it('POST 403 for a plain member (not a moderator)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(publishedHub)
  const res = await POST(req({ body: 'hi' }), params)
  expect(res.status).toBe(403)
})

it('POST 400 on an empty body', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(publishedHub)
  const res = await POST(req({ body: '   ' }), params)
  expect(res.status).toBe(400)
})

it('POST 201 for the owner and writes the trimmed body', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(publishedHub)
  const res = await POST(req({ body: '  hi there  ' }), params)
  expect(res.status).toBe(201)
  expect((db.hubAnnouncement.create as any).mock.calls[0][0].data.body).toBe('hi there')
  expect((db.hubAnnouncement.create as any).mock.calls[0][0].data.authorId).toBe('owner')
})

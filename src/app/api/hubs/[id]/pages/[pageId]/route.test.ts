import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubPage: { findUnique: vi.fn(), update: vi.fn(async () => ({ id: 'hp1', status: 'approved' })), delete: vi.fn(async () => ({})) },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { PATCH, DELETE } from './route'

const params = { params: Promise.resolve({ id: 'hub1', pageId: 'hp1' }) }
const req = (body?: any) => ({ json: async () => body, url: 'http://localhost/api/hubs/hub1/pages/hp1' } as any)
beforeEach(() => vi.clearAllMocks())

const hub = { id: 'hub1', userId: 'owner', community: true, published: true }
const row = { id: 'hp1', hubId: 'hub1', addedById: 'member', status: 'pending' }

it('PATCH 403 for a plain member', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue(row)
  expect((await PATCH(req({ status: 'approved' }), params)).status).toBe(403)
})

it('PATCH 400 on an invalid status', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue(row)
  expect((await PATCH(req({ status: 'banana' }), params)).status).toBe(400)
})

it('PATCH approves and stamps the reviewer', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue(row)
  const res = await PATCH(req({ status: 'approved' }), params)
  expect(res.status).toBe(200)
  const data = (db.hubPage.update as any).mock.calls[0][0].data
  expect(data.status).toBe('approved')
  expect(data.reviewedById).toBe('owner')
})

it('PATCH 404 when the row belongs to another hub', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue({ ...row, hubId: 'other' })
  expect((await PATCH(req({ status: 'approved' }), params)).status).toBe(404)
})

it('DELETE allows the attacher', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue(row)
  expect((await DELETE(req(), params)).status).toBe(200)
})

it('DELETE 403 for an unrelated member', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue(row)
  expect((await DELETE(req(), params)).status).toBe(403)
})

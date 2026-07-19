import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubDrop: { findFirst: vi.fn(), delete: vi.fn(async () => ({})), update: vi.fn(async () => ({})) },
  },
}))

import { DELETE, PATCH } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

const params = { params: Promise.resolve({ id: 'hub1', dropId: 'drop1' }) }
const req = (body?: any) => ({ json: async () => body } as any)
beforeEach(() => vi.clearAllMocks())

it('DELETE 404 when drop not in this hub (IDOR scope)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubDrop.findFirst as any).mockResolvedValue(null)
  const res = await DELETE(req(), params)
  expect(res.status).toBe(404)
})

it('DELETE 403 when neither author nor moderator', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'someoneElse', hubId: 'hub1' })
  const res = await DELETE(req(), params)
  expect(res.status).toBe(403)
})

it('DELETE 200 for the author', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'author' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1' })
  const res = await DELETE(req(), params)
  expect(res.status).toBe(200)
  expect(db.hubDrop.delete).toHaveBeenCalledWith({ where: { id: 'drop1' } })
})

it('PATCH 403 hide by a plain author (not moderator)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'author' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1' })
  const res = await PATCH(req({ hidden: true }), params)
  expect(res.status).toBe(403)
})

it('PATCH 200 hide by owner', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1' })
  const res = await PATCH(req({ hidden: true }), params)
  expect(res.status).toBe(200)
  expect(db.hubDrop.update).toHaveBeenCalledWith({ where: { id: 'drop1' }, data: { hidden: true } })
})

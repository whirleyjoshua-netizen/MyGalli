import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubAnnouncement: { findFirst: vi.fn(), delete: vi.fn(async () => ({})) },
  },
}))

import { DELETE } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

const params = { params: Promise.resolve({ id: 'hub1', announcementId: 'a1' }) }
const req = () => ({} as any)
beforeEach(() => vi.clearAllMocks())

it('401 when logged out', async () => {
  ;(getUser as any).mockResolvedValue(null)
  const res = await DELETE(req(), params)
  expect(res.status).toBe(401)
})

it('404 when the announcement is not in this hub (IDOR scope)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubAnnouncement.findFirst as any).mockResolvedValue(null)
  const res = await DELETE(req(), params)
  expect(res.status).toBe(404)
})

it('403 for a plain member', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubAnnouncement.findFirst as any).mockResolvedValue({ id: 'a1', hubId: 'hub1' })
  const res = await DELETE(req(), params)
  expect(res.status).toBe(403)
})

it('200 for the owner and deletes by id', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubAnnouncement.findFirst as any).mockResolvedValue({ id: 'a1', hubId: 'hub1' })
  const res = await DELETE(req(), params)
  expect(res.status).toBe(200)
  expect(db.hubAnnouncement.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
})

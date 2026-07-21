import { it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted above every top-level const, so the shared spy must be
// created with vi.hoisted or the factory closes over a TDZ binding.
const { del } = vi.hoisted(() => ({ del: vi.fn(async () => {}) }))
vi.mock('@vercel/blob', () => ({ del }))
vi.mock('@/lib/storage-env', () => ({ blobReadWriteToken: () => 'tok' }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn(), notifyHubMembers: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubDrop: {
      findFirst: vi.fn(),
      delete: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    hubMember: { findMany: vi.fn(async () => []) },
  },
}))

import { DELETE, PATCH } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotification, notifyHubMembers } from '@/lib/notifications'

const params = { params: Promise.resolve({ id: 'hub1', dropId: 'drop1' }) }
const req = (body?: any) => ({ json: async () => body } as any)
beforeEach(() => {
  vi.clearAllMocks()
  del.mockResolvedValue(undefined)
})

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

const OWN = 'https://x.public.blob.vercel-storage.com/hub-drops/hub1/a.jpg'
const hub = { id: 'hub1', userId: 'owner', community: true, title: 'Frog Club', slug: 'frog', user: { username: 'owner' } }

it('PATCH 403 review by a plain author (not moderator)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'author', username: 'a', name: 'A', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  const res = await PATCH(req({ action: 'approve' }), params)
  expect(res.status).toBe(403)
})

it('PATCH 400 on an unknown action', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  const res = await PATCH(req({ hidden: true }), params)
  expect(res.status).toBe(400)
})

it('PATCH approve stamps the reviewer and notifies the author', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  const res = await PATCH(req({ action: 'approve' }), params)
  expect(res.status).toBe(200)
  const call = (db.hubDrop.updateMany as any).mock.calls[0][0]
  expect(call.where).toEqual({ id: 'drop1', status: 'pending' })
  expect(call.data.status).toBe('approved')
  expect(call.data.hidden).toBe(false)
  expect(call.data.reviewedById).toBe('owner')
  expect(call.data.reviewedAt).toBeInstanceOf(Date)
  expect(db.hubDrop.update).not.toHaveBeenCalled()
  expect(del).not.toHaveBeenCalled()
  expect((createNotification as any).mock.calls[0][0].type).toBe('hub_drop_approved')
})

it('PATCH reject purges only this hub-s own assets', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({
    id: 'drop1', authorId: 'author', hubId: 'hub1', status: 'pending',
    url: OWN, thumbnailUrl: 'https://x.public.blob.vercel-storage.com/hub-drops/OTHERHUB/t.jpg',
  })
  const res = await PATCH(req({ action: 'reject' }), params)
  expect(res.status).toBe(200)
  expect(del).toHaveBeenCalledWith([OWN], { token: 'tok' })
  // The atomic conditional write persists the rejection itself; only after the
  // purge succeeds does a second, small write record assetDeleted — so a
  // mid-flight failure between the two never leaves a row claiming
  // pending/undeleted over a gone file.
  const firstCall = (db.hubDrop.updateMany as any).mock.calls[0][0]
  expect(firstCall.where).toEqual({ id: 'drop1', status: 'pending' })
  expect(firstCall.data.status).toBe('rejected')
  expect((db.hubDrop.update as any).mock.calls[0][0]).toEqual({ where: { id: 'drop1' }, data: { assetDeleted: true } })
  expect((createNotification as any).mock.calls[0][0].type).toBe('hub_drop_rejected')
})

it('PATCH reject still succeeds when the blob purge throws', async () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  del.mockRejectedValueOnce(new Error('blob down'))
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  const res = await PATCH(req({ action: 'reject' }), params)
  expect(res.status).toBe(200)
  // Row is still rejected via the atomic write, but no follow-up write claims
  // the purge succeeded.
  expect((db.hubDrop.updateMany as any).mock.calls[0][0].data.status).toBe('rejected')
  expect(db.hubDrop.update).not.toHaveBeenCalled()
  expect(warnSpy).toHaveBeenCalled()
  warnSpy.mockRestore()
})

it('PATCH approve on an already-approved drop returns 409 and fires no notification', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'approved' })
  const res = await PATCH(req({ action: 'approve' }), params)
  expect(res.status).toBe(409)
  expect(db.hubDrop.update).not.toHaveBeenCalled()
  expect(db.hubDrop.updateMany).not.toHaveBeenCalled()
  expect(createNotification).not.toHaveBeenCalled()
  expect(notifyHubMembers).not.toHaveBeenCalled()
})

it('PATCH approve on a rejected drop returns 409 (resurrection guard)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'rejected' })
  const res = await PATCH(req({ action: 'approve' }), params)
  expect(res.status).toBe(409)
  expect(db.hubDrop.update).not.toHaveBeenCalled()
  expect(db.hubDrop.updateMany).not.toHaveBeenCalled()
})

it('PATCH returns 409 and purges nothing when the atomic transition matches no row (lost race)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  // The read-based guard sees `pending` (another moderator hasn't committed
  // yet), but the conditional write itself matches nothing because the other
  // request already flipped the row.
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  ;(db.hubDrop.updateMany as any).mockResolvedValueOnce({ count: 0 })
  const res = await PATCH(req({ action: 'reject' }), params)
  expect(res.status).toBe(409)
  expect(del).not.toHaveBeenCalled()
  expect(db.hubDrop.update).not.toHaveBeenCalled()
  expect(createNotification).not.toHaveBeenCalled()
})

it('PATCH reject on a pending drop still succeeds (regression guard)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  const res = await PATCH(req({ action: 'reject' }), params)
  expect(res.status).toBe(200)
})

it('PATCH approve notifies members but excludes the author from the hub-wide ping', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  ;(db.hubMember.findMany as any).mockResolvedValue([{ userId: 'member1' }, { userId: 'author' }])
  const res = await PATCH(req({ action: 'approve' }), params)
  expect(res.status).toBe(200)
  const call = (notifyHubMembers as any).mock.calls.find((c: any) => c[1].type === 'hub_drop')
  expect(call[0]).toEqual(expect.arrayContaining(['member1']))
  expect(call[0]).not.toContain('author')
})

it('PATCH approve excludes the acting moderator from the hub-wide "new clips" ping', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  // owner (the acting moderator) is also a hub member.
  ;(db.hubMember.findMany as any).mockResolvedValue([{ userId: 'member1' }, { userId: 'owner' }])
  const res = await PATCH(req({ action: 'approve' }), params)
  expect(res.status).toBe(200)
  const call = (notifyHubMembers as any).mock.calls.find((c: any) => c[1].type === 'hub_drop')
  expect(call[0]).toEqual(expect.arrayContaining(['member1']))
  expect(call[0]).not.toContain('owner')
})

it('PATCH approve dedupes a user who is both a collaborator and a member', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([{ userId: 'collab1' }])
  ;(db.hubMember.findMany as any).mockResolvedValue([{ userId: 'collab1' }, { userId: 'member1' }])
  const res = await PATCH(req({ action: 'approve' }), params)
  expect(res.status).toBe(200)
  const call = (notifyHubMembers as any).mock.calls.find((c: any) => c[1].type === 'hub_drop')
  expect(call[0].filter((u: string) => u === 'collab1').length).toBe(1)
  expect(call[0]).toEqual(expect.arrayContaining(['collab1', 'member1']))
})

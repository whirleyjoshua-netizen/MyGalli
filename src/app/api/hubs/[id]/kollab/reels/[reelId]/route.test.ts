import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    kollabReel: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { PATCH, DELETE } from './route'

const ctx = { params: Promise.resolve({ id: 'h1', reelId: 'r1' }) }
const patch = (b: unknown) =>
  new Request('http://localhost/api/hubs/h1/kollab/reels/r1', { method: 'PATCH', body: JSON.stringify(b) }) as any
const del = () => new Request('http://localhost/api/hubs/h1/kollab/reels/r1', { method: 'DELETE' }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.kollabReel.findFirst as any).mockResolvedValue({ id: 'r1', hubId: 'h1', creatorId: 'member', status: 'draft' })
  ;(db.kollabReel.update as any).mockResolvedValue({ id: 'r1', status: 'published' })
  ;(db.kollabReel.delete as any).mockResolvedValue({ id: 'r1' })
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: null, avatar: null })
})

describe('PATCH', () => {
  it('401 when logged out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await PATCH(patch({ action: 'publish' }), ctx)).status).toBe(401)
  })

  it('publishes for the owner', async () => {
    const res = await PATCH(patch({ action: 'publish' }), ctx)
    expect(res.status).toBe(200)
    expect((db.kollabReel.update as any).mock.calls[0][0].data.status).toBe('published')
  })

  it('unpublishes for the owner', async () => {
    await PATCH(patch({ action: 'unpublish' }), ctx)
    expect((db.kollabReel.update as any).mock.calls[0][0].data.status).toBe('draft')
  })

  it('403 for the creator when not a moderator', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    expect((await PATCH(patch({ action: 'publish' }), ctx)).status).toBe(403)
  })

  it('400 on an unknown action', async () => {
    expect((await PATCH(patch({ action: 'destroy' }), ctx)).status).toBe(400)
  })

  it('404 for another hub\'s reel', async () => {
    ;(db.kollabReel.findFirst as any).mockResolvedValue(null)
    expect((await PATCH(patch({ action: 'publish' }), ctx)).status).toBe(404)
  })

  it('scopes the lookup by hubId', async () => {
    await PATCH(patch({ action: 'publish' }), ctx)
    expect((db.kollabReel.findFirst as any).mock.calls[0][0].where).toEqual({ id: 'r1', hubId: 'h1' })
  })
})

describe('DELETE', () => {
  it('lets the creator delete their own reel', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    expect((await DELETE(del(), ctx)).status).toBe(200)
    expect(db.kollabReel.delete).toHaveBeenCalled()
  })

  it('lets a moderator delete anyone\'s reel', async () => {
    expect((await DELETE(del(), ctx)).status).toBe(200)
  })

  it('403 for an unrelated member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger', username: 's', name: null, avatar: null })
    expect((await DELETE(del(), ctx)).status).toBe(403)
    expect(db.kollabReel.delete).not.toHaveBeenCalled()
  })

  it('404 for another hub\'s reel', async () => {
    ;(db.kollabReel.findFirst as any).mockResolvedValue(null)
    expect((await DELETE(del(), ctx)).status).toBe(404)
  })
})

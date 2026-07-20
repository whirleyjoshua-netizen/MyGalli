import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubBan: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    hubMember: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'
import { DELETE } from './[userId]/route'

const ctx = { params: Promise.resolve({ id: 'h1' }) }
const delCtx = { params: Promise.resolve({ id: 'h1', userId: 'target' }) }
const post = (b: unknown) => new Request('http://localhost/api/hubs/h1/bans', { method: 'POST', body: JSON.stringify(b) }) as any
const del = () => new Request('http://localhost/api/hubs/h1/bans/target', { method: 'DELETE' }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([{ userId: 'collab1' }])
  ;(db.$transaction as any).mockResolvedValue([{ id: 'ban1' }, { count: 1 }])
  ;(db.hubBan.findFirst as any).mockResolvedValue({ id: 'ban1', hubId: 'h1', userId: 'target' })
  ;(db.hubBan.delete as any).mockResolvedValue({ id: 'ban1' })
})

describe('POST /bans', () => {
  it('401 when logged out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(post({ userId: 'target' }), ctx)
    expect(res.status).toBe(401)
  })

  it('403 for a plain member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member' })
    const res = await POST(post({ userId: 'target' }), ctx)
    expect(res.status).toBe(403)
  })

  it('403 when a collaborator tries to ban the owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'collab1' })
    const res = await POST(post({ userId: 'owner' }), ctx)
    expect(res.status).toBe(403)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('403 when banning another collaborator', async () => {
    ;(db.hubCollaborator.findMany as any).mockResolvedValue([{ userId: 'collab1' }, { userId: 'collab2' }])
    ;(getUser as any).mockResolvedValue({ id: 'collab1' })
    const res = await POST(post({ userId: 'collab2' }), ctx)
    expect(res.status).toBe(403)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('400 on self-ban', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'collab1' })
    const res = await POST(post({ userId: 'collab1' }), ctx)
    expect(res.status).toBe(400)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('201 bans a member and removes their membership in one transaction', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner' })
    const res = await POST(post({ userId: 'target', reason: 'spam' }), ctx)
    expect(res.status).toBe(201)
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    const calledWith = (db.$transaction as any).mock.calls[0][0]
    expect(calledWith).toHaveLength(2)
    expect(db.hubBan.create).toHaveBeenCalledWith({
      data: { hubId: 'h1', userId: 'target', bannedById: 'owner', reason: 'spam' },
    })
    expect(db.hubMember.deleteMany).toHaveBeenCalledWith({ where: { hubId: 'h1', userId: 'target' } })
  })

  it('200 no-op when already banned', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner' })
    const err: any = new Error('unique violation')
    err.code = 'P2002'
    ;(db.$transaction as any).mockRejectedValue(err)
    const res = await POST(post({ userId: 'target' }), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

describe('DELETE /bans/[userId]', () => {
  it('401 when logged out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await DELETE(del(), delCtx)
    expect(res.status).toBe(401)
  })

  it('403 for a plain member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member' })
    const res = await DELETE(del(), delCtx)
    expect(res.status).toBe(403)
  })

  it('lifts the ban and does not restore membership', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner' })
    const res = await DELETE(del(), delCtx)
    expect(res.status).toBe(200)
    expect(db.hubBan.delete).toHaveBeenCalledWith({ where: { id: 'ban1' } })
    expect(db.hubMember.deleteMany).not.toHaveBeenCalled()
  })

  it('404 for a ban in another hub', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner' })
    ;(db.hubBan.findFirst as any).mockResolvedValue(null)
    const res = await DELETE(del(), delCtx)
    expect(res.status).toBe(404)
    expect(db.hubBan.delete).not.toHaveBeenCalled()
  })
})

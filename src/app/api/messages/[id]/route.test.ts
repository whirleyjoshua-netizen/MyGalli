import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { message: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) } },
}))

import { PATCH, DELETE } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
beforeEach(() => vi.clearAllMocks())

describe('PATCH /api/messages/[id]', () => {
  it('401 unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await PATCH(new NextRequest('http://localhost/api/messages/m1', { method: 'PATCH', body: '{"read":true}' }), ctx('m1'))
    expect(res.status).toBe(401)
  })
  it('scopes the update to the caller (ownerId in where) so non-owners cannot touch it', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner1' })
    await PATCH(new NextRequest('http://localhost/api/messages/m1', { method: 'PATCH', body: '{"read":true}' }), ctx('m1'))
    expect(db.message.updateMany).toHaveBeenCalledWith({ where: { id: 'm1', ownerId: 'owner1' }, data: { read: true } })
  })
})

describe('DELETE /api/messages/[id]', () => {
  it('scopes the delete to the caller', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner1' })
    await DELETE(new NextRequest('http://localhost/api/messages/m1', { method: 'DELETE' }), ctx('m1'))
    expect(db.message.deleteMany).toHaveBeenCalledWith({ where: { id: 'm1', ownerId: 'owner1' } })
  })
})

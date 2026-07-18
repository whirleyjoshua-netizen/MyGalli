import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubEvent: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { PATCH, DELETE } from './route'

const ctx = { params: Promise.resolve({ id: 'h1', eventId: 'e1' }) }
const patch = (b: unknown) => new Request('http://localhost/api/hubs/h1/events/e1', { method: 'PATCH', body: JSON.stringify(b) }) as any
const del = () => new Request('http://localhost/api/hubs/h1/events/e1', { method: 'DELETE' }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubEvent.findFirst as any).mockResolvedValue({ id: 'e1' })
  ;(db.hubEvent.update as any).mockResolvedValue({ id: 'e1' })
  ;(db.hubEvent.delete as any).mockResolvedValue({ id: 'e1' })
})

describe('PATCH /events/[eventId]', () => {
  it('403 for a non-privileged member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M', username: 'm1', avatar: null })
    const res = await PATCH(patch({ title: 'X', startsAt: '2026-08-01T19:00:00Z' }), ctx)
    expect(res.status).toBe(403)
  })

  it('404 when the event does not belong to the hub (IDOR)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'O', username: 'o', avatar: null })
    ;(db.hubEvent.findFirst as any).mockResolvedValue(null)
    const res = await PATCH(patch({ title: 'X', startsAt: '2026-08-01T19:00:00Z' }), ctx)
    expect(res.status).toBe(404)
  })

  it('200 for owner update', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'O', username: 'o', avatar: null })
    const res = await PATCH(patch({ title: 'New', startsAt: '2026-08-01T19:00:00Z' }), ctx)
    expect(res.status).toBe(200)
    expect(db.hubEvent.update).toHaveBeenCalled()
  })
})

describe('DELETE /events/[eventId]', () => {
  it('200 for owner delete', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'O', username: 'o', avatar: null })
    const res = await DELETE(del(), ctx)
    expect(res.status).toBe(200)
    expect(db.hubEvent.delete).toHaveBeenCalledWith({ where: { id: 'e1' } })
  })
})

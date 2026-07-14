import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { display: { findUnique: vi.fn(), create: vi.fn() } } }))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'

function req(body: unknown) {
  return new Request('http://localhost/api/displays', { method: 'POST', body: JSON.stringify(body) }) as any
}
beforeEach(() => { vi.clearAllMocks(); (db.display.findUnique as any).mockResolvedValue(null) })

describe('POST /api/displays kind=collection', () => {
  it('allows a free user to create a board (boards are no longer Pro-gated)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'coach', name: 'Coach', plan: 'free' })
    ;(db.display.create as any).mockImplementation(({ data }: any) => Promise.resolve({ id: 'b1', ...data }))
    const res = await POST(req({ title: 'Roster', kind: 'collection' }))
    expect(res.status).toBe(201)
    const created = (db.display.create as any).mock.calls[0][0].data
    expect(created.kind).toBe('collection')
  })

  it('creates a collection seeded with a collection-view element for a Pro user', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'coach', name: 'Coach', plan: 'pro' })
    ;(db.display.create as any).mockImplementation(({ data }: any) => Promise.resolve({ id: 'b1', ...data }))
    const res = await POST(req({ title: 'Roster', kind: 'collection' }))
    expect(res.status).toBe(201)
    const created = (db.display.create as any).mock.calls[0][0].data
    expect(created.kind).toBe('collection')
    expect(created.sections[0].columns[0].elements[0].type).toBe('collection-view')
  })
})

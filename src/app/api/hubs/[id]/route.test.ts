import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { hub: { findUnique: vi.fn(), update: vi.fn() } } }))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { PATCH } from './route'

const ctx = { params: Promise.resolve({ id: 'h1' }) }
const req = (body: unknown) => new Request('http://localhost/api/hubs/h1', { method: 'PATCH', body: JSON.stringify(body) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', version: 3 })
  ;(db.hub.update as any).mockImplementation(async ({ data }: any) => ({ id: 'h1', ...data }))
})

describe('PATCH /api/hubs/[id] — config + version', () => {
  it('409 when version is stale', async () => {
    const res = await PATCH(req({ config: {}, version: 2 }), ctx)
    expect(res.status).toBe(409)
    expect(db.hub.update).not.toHaveBeenCalled()
  })
  it('sanitizes config, bumps version, returns updated hub', async () => {
    const res = await PATCH(req({ config: { access: { whoCanPost: 'owner-only' } }, version: 3 }), ctx)
    expect(res.status).toBe(200)
    const arg = (db.hub.update as any).mock.calls[0][0]
    expect(arg.data.version).toBe(4)
    expect(arg.data.config.access.whoCanPost).toBe('owner-only')
    expect(arg.data.config.sidebar).toHaveLength(3) // sanitized to full widget set
  })
  it('404 for non-owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    expect((await PATCH(req({ config: {} }), ctx)).status).toBe(404)
  })
})

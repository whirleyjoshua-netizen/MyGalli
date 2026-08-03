import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/crm/stages', () => ({ ensureStages: vi.fn(), deleteStage: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { crmStage: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() } },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureStages, deleteStage } from '@/lib/crm/stages'
import { GET, POST } from './route'
import { DELETE, PATCH } from './[id]/route'

const req = (body?: unknown) =>
  new Request('http://localhost/api/crm/stages', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  }) as any

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'free' })
  ;(ensureStages as any).mockResolvedValue([{ id: 's1', name: 'New', order: 0 }])
  ;(db.crmStage.findFirst as any).mockResolvedValue({ id: 's1', ownerId: 'u1' })
  ;(db.crmStage.count as any).mockResolvedValue(1)
  ;(db.crmStage.create as any).mockResolvedValue({ id: 's2' })
  ;(db.crmStage.update as any).mockResolvedValue({ id: 's1', name: 'Renamed' })
})

describe('GET /api/crm/stages', () => {
  it('401 when signed out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('a free-plan user has full access', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(ensureStages).toHaveBeenCalledWith('u1')
  })
})

describe('POST /api/crm/stages', () => {
  it('rejects an empty name', async () => {
    const res = await POST(req({ name: '   ' }))
    expect(res.status).toBe(400)
    expect(db.crmStage.create).not.toHaveBeenCalled()
  })

  it('appends the new stage at the end', async () => {
    ;(db.crmStage.findFirst as any).mockResolvedValue({ order: 3 })
    const res = await POST(req({ name: 'Lost', color: '#ef4444' }))
    expect(res.status).toBe(201)
    expect(db.crmStage.create).toHaveBeenCalledWith({
      data: { ownerId: 'u1', name: 'Lost', color: '#ef4444', order: 4 },
    })
  })

  it('derives order from the max, not the count, so a mid-board gap does not collide', async () => {
    // Only 3 stages remain (e.g. one was deleted), but the highest surviving
    // order is 7 — a count-based order of 3 would collide with an existing stage.
    ;(db.crmStage.findFirst as any).mockResolvedValue({ order: 7 })
    const res = await POST(req({ name: 'Lost', color: '#ef4444' }))
    expect(res.status).toBe(201)
    expect(db.crmStage.create).toHaveBeenCalledWith({
      data: { ownerId: 'u1', name: 'Lost', color: '#ef4444', order: 8 },
    })
  })

  it('starts the first stage at order 0 when none exist', async () => {
    ;(db.crmStage.findFirst as any).mockResolvedValue(null)
    const res = await POST(req({ name: 'New' }))
    expect(res.status).toBe(201)
    expect(db.crmStage.create).toHaveBeenCalledWith({
      data: { ownerId: 'u1', name: 'New', color: '#39D98A', order: 0 },
    })
  })
})

describe('PATCH /api/crm/stages/[id]', () => {
  it('404s a stage owned by someone else', async () => {
    ;(db.crmStage.findFirst as any).mockResolvedValue(null)
    const res = await PATCH(req({ name: 'Nope' }), ctx('theirs'))
    expect(res.status).toBe(404)
    expect(db.crmStage.findFirst).toHaveBeenCalledWith({ where: { id: 'theirs', ownerId: 'u1' } })
    expect(db.crmStage.update).not.toHaveBeenCalled()
  })

  it('scopes the update to the owner', async () => {
    const res = await PATCH(req({ name: 'Renamed' }), ctx('s1'))
    expect(res.status).toBe(200)
    expect(db.crmStage.update).toHaveBeenCalledWith({
      where: { id: 's1', ownerId: 'u1' },
      data: { name: 'Renamed' },
    })
  })

  it('409s a rename that collides with an existing stage name', async () => {
    ;(db.crmStage.update as any).mockRejectedValue({ code: 'P2002' })
    const res = await PATCH(req({ name: 'Won' }), ctx('s1'))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'You already have a stage with that name' })
  })

  it('rethrows a non-P2002 error from the update', async () => {
    ;(db.crmStage.update as any).mockRejectedValue(new Error('db down'))
    await expect(PATCH(req({ name: 'Renamed' }), ctx('s1'))).rejects.toThrow('db down')
  })
})

describe('DELETE /api/crm/stages/[id]', () => {
  it('reports where the contacts went', async () => {
    ;(deleteStage as any).mockResolvedValue({ ok: true, movedTo: 'a', moved: 3 })
    const res = await DELETE(req(), ctx('s1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ movedTo: 'a', moved: 3 })
  })

  it('409s on the last remaining stage', async () => {
    ;(deleteStage as any).mockResolvedValue({ ok: false, reason: 'last-stage' })
    const res = await DELETE(req(), ctx('s1'))
    expect(res.status).toBe(409)
  })

  it('404s a stage owned by someone else', async () => {
    ;(deleteStage as any).mockResolvedValue({ ok: false, reason: 'not-found' })
    const res = await DELETE(req(), ctx('theirs'))
    expect(res.status).toBe(404)
  })
})

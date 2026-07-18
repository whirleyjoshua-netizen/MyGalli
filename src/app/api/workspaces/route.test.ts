import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspace: { create: vi.fn(), findMany: vi.fn() },
  },
}))

describe('POST /api/workspaces', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a workspace', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.create as any).mockResolvedValue({ id: 'w1', name: 'Test' })
    
    const req = new Request('http://localhost/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    })
    
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    expect(db.workspace.create).toHaveBeenCalledWith({
      data: { name: 'Test', ownerId: 'u1' }
    })
  })
})

describe('GET /api/workspaces (enriched)', () => {
  beforeEach(() => vi.clearAllMocks())
  const req = () => ({} as any)

  it('401 unauth', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
  })

  it('maps counts, primary view, and lastActivity (max of workspace + latest record)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    const wsUpdated = new Date('2026-07-10T00:00:00Z')
    const recUpdated = new Date('2026-07-15T00:00:00Z') // newer than workspace
    ;(db.workspace.findMany as any).mockResolvedValue([
      {
        id: 'w1', name: 'Students', description: 'roster', icon: '🎓', updatedAt: wsUpdated,
        _count: { records: 12, fields: 4 },
        views: [{ type: 'grid' }],
        records: [{ updatedAt: recUpdated }],
      },
      {
        id: 'w2', name: 'Empty', description: null, icon: null, updatedAt: wsUpdated,
        _count: { records: 0, fields: 1 },
        views: [],
        records: [],
      },
    ])
    const body = await (await GET(req())).json()
    expect(body[0]).toEqual({
      id: 'w1', name: 'Students', description: 'roster', icon: '🎓',
      recordCount: 12, fieldCount: 4, primaryView: 'grid',
      lastActivity: recUpdated.toISOString(), // record newer than workspace
    })
    expect(body[1]).toMatchObject({ recordCount: 0, primaryView: null, lastActivity: wsUpdated.toISOString() })
  })

  it('scopes to the caller and requests active records only', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findMany as any).mockResolvedValue([])
    await GET(req())
    const arg = (db.workspace.findMany as any).mock.calls[0][0]
    expect(arg.where).toEqual({ ownerId: 'u1' })
    // active-only record count + latest active record
    expect(arg.select._count.select.records.where).toEqual({ status: 'active' })
    expect(arg.select.records.where).toEqual({ status: 'active' })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspace: { findUnique: vi.fn() },
    workspaceField: { findMany: vi.fn() },
    workspaceView: { create: vi.fn(), count: vi.fn() },
  },
}))

describe('POST /api/workspaces/[id]/views', () => {
  beforeEach(() => vi.clearAllMocks())

  const ctx = { params: Promise.resolve({ id: 'w1' }) }

  it('creates a valid grid view', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ key: 'field1' }])
    ;(db.workspaceView.count as any).mockResolvedValue(0)
    ;(db.workspaceView.create as any).mockResolvedValue({ id: 'v1' })

    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({ name: 'View 1', type: 'grid', config: { visibleFields: ['field1'] } }),
    })

    const res = await POST(req as any, ctx)
    expect(res.status).toBe(201)
    expect(db.workspaceView.create).toHaveBeenCalledWith({
      data: { workspaceId: 'w1', name: 'View 1', type: 'grid', config: { visibleFields: ['field1'] }, position: 0 }
    })
  })

  it('rejects unknown field keys', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ key: 'field1' }])

    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({ name: 'View 1', type: 'grid', config: { visibleFields: ['unknown'] } }),
    })

    const res = await POST(req as any, ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Unknown fields: unknown')
  })

  it('rejects an unsupported view type', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ key: 'field1' }])

    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({ name: 'View 1', type: 'table' }),
    })

    const res = await POST(req as any, ctx)
    expect(res.status).toBe(400)
  })

  it('creates a valid gallery view', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ key: 'field1' }])
    ;(db.workspaceView.count as any).mockResolvedValue(0)
    ;(db.workspaceView.create as any).mockResolvedValue({ id: 'v2' })

    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({ name: 'Gallery 1', type: 'gallery' }),
    })

    const res = await POST(req as any, ctx)
    expect(res.status).toBe(201)
  })

  it('rejects kanban without a choice groupByField', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ key: 'field1', type: 'text' }])

    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({ name: 'Board', type: 'kanban', config: { groupByField: 'field1' } }),
    })

    const res = await POST(req as any, ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Kanban needs a single-select field')
  })

  it('creates a valid kanban view when groupByField is a choice field', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ key: 'status', type: 'choice' }])
    ;(db.workspaceView.count as any).mockResolvedValue(0)
    ;(db.workspaceView.create as any).mockResolvedValue({ id: 'v3' })

    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({ name: 'Board', type: 'kanban', config: { groupByField: 'status' } }),
    })

    const res = await POST(req as any, ctx)
    expect(res.status).toBe(201)
  })

  it('accepts a valid config.filter and stores the normalized spec', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([
      { id: 'f1', key: 'fee', label: 'Fee', type: 'currency', config: { symbol: '$' } },
    ])
    ;(db.workspaceView.count as any).mockResolvedValue(1)
    ;(db.workspaceView.create as any).mockResolvedValue({ id: 'v9' })

    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Big Fees',
        type: 'grid',
        // "1200" arrives as a string; it must be stored coerced to a number
        config: { filter: { op: 'and', conditions: [{ field: 'fee', cmp: 'gt', value: '1200' }] } },
      }),
    })

    const res = await POST(req as any, ctx)
    expect(res.status).toBe(201)

    const stored = (db.workspaceView.create as any).mock.calls[0][0].data.config
    expect(stored.filter.conditions[0].value).toBe(1200)
  })

  it('400s on a filter naming an unknown field', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([
      { id: 'f1', key: 'fee', label: 'Fee', type: 'currency', config: {} },
    ])

    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bad',
        type: 'grid',
        config: { filter: { op: 'and', conditions: [{ field: 'ghost', cmp: 'eq', value: 'x' }] } },
      }),
    })

    const res = await POST(req as any, ctx)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Unknown field/)
  })
})

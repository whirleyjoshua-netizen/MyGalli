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

  it('creates a valid table view', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ key: 'field1' }])
    ;(db.workspaceView.count as any).mockResolvedValue(0)
    ;(db.workspaceView.create as any).mockResolvedValue({ id: 'v1' })
    
    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({ name: 'View 1', type: 'table', config: { visibleFields: ['field1'] } }),
    })
    
    const res = await POST(req as any, ctx)
    expect(res.status).toBe(201)
    expect(db.workspaceView.create).toHaveBeenCalledWith({
      data: { workspaceId: 'w1', name: 'View 1', type: 'table', config: { visibleFields: ['field1'] }, position: 0 }
    })
  })

  it('rejects unknown field keys', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ key: 'field1' }])
    
    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({ name: 'View 1', type: 'table', config: { visibleFields: ['unknown'] } }),
    })
    
    const res = await POST(req as any, ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Unknown fields: unknown')
  })
})

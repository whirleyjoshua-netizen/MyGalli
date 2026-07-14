import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspace: { findUnique: vi.fn() },
    workspaceField: { create: vi.fn(), count: vi.fn() },
  },
}))

describe('POST /api/workspaces/[id]/fields', () => {
  beforeEach(() => vi.clearAllMocks())

  const ctx = { params: Promise.resolve({ id: 'w1' }) }

  it('adds a field', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.count as any).mockResolvedValue(0)
    ;(db.workspaceField.create as any).mockResolvedValue({ id: 'f1' })
    
    const req = new Request('http://localhost/api/workspaces/w1/fields', {
      method: 'POST',
      body: JSON.stringify({ key: 'age', label: 'Age', type: 'number' }),
    })
    
    const res = await POST(req as any, ctx)
    expect(res.status).toBe(201)
    expect(db.workspaceField.create).toHaveBeenCalledWith({
      data: { workspaceId: 'w1', key: 'age', label: 'Age', type: 'number', required: false, position: 0 }
    })
  })
})

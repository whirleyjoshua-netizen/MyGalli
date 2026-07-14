import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
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

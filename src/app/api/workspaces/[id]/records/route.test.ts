import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getUser } from '@/lib/auth'
import { createWorkspaceRecord } from '@/lib/workspaces/service'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/service', () => ({ createWorkspaceRecord: vi.fn() }))

describe('POST /api/workspaces/[id]/records', () => {
  beforeEach(() => vi.clearAllMocks())

  const ctx = { params: Promise.resolve({ id: 'w1' }) }

  it('creates a record', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(createWorkspaceRecord as any).mockResolvedValue({ id: 'r1' })
    
    const req = new Request('http://localhost/api/workspaces/w1/records', {
      method: 'POST',
      body: JSON.stringify({ data: { field: 'val' } }),
    })
    
    const res = await POST(req as any, ctx)
    expect(res.status).toBe(201)
    expect(createWorkspaceRecord).toHaveBeenCalledWith({
      workspaceId: 'w1',
      userId: 'u1',
      input: { field: 'val' },
      displayId: undefined
    })
  })

  it('returns 422 on validation failure', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(createWorkspaceRecord as any).mockRejectedValue({ 
      type: 'VALIDATION_ERROR', 
      errors: { field: 'invalid' } 
    })
    
    const req = new Request('http://localhost/api/workspaces/w1/records', {
      method: 'POST',
      body: JSON.stringify({ data: {} }),
    })
    
    const res = await POST(req as any, ctx)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.fields).toEqual({ field: 'invalid' })
  })
})

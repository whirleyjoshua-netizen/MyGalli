import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { getUser } from '@/lib/auth'
import { queryWorkspaceView } from '@/lib/workspaces/query-view'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/query-view', () => ({ queryWorkspaceView: vi.fn() }))

describe('GET /api/workspaces/[id]/views/[viewId]/records', () => {
  beforeEach(() => vi.clearAllMocks())

  const ctx = { params: Promise.resolve({ id: 'w1', viewId: 'v1' }) }

  it('queries records', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    const updatedAt = new Date('2026-07-11T12:00:00.000Z')
    const mockResult = {
      view: { id: 'v1', name: 'Test View', type: 'table' },
      fields: [{ key: 'field1', label: 'Field 1', type: 'text' }],
      records: [{ id: 'r1', data: { field1: 'val' }, updatedAt: updatedAt.toISOString() }],
      pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 }
    }
    ;(queryWorkspaceView as any).mockResolvedValue(mockResult)
    
    const req = {
      nextUrl: new URL('http://localhost/api/workspaces/w1/views/v1/records')
    } as unknown as NextRequest
    
    const res = await GET(req as any, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(mockResult)
    expect(queryWorkspaceView).toHaveBeenCalledWith({
      workspaceId: 'w1',
      viewId: 'v1',
      userId: 'u1',
      page: 1,
      pageSize: 25
    })
  })
})

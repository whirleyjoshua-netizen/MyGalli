import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH, DELETE } from './route'
import { getUser } from '@/lib/auth'
import { updateWorkspaceRecord, deleteWorkspaceRecord } from '@/lib/workspaces/service'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/service', () => ({
  updateWorkspaceRecord: vi.fn(),
  deleteWorkspaceRecord: vi.fn(),
}))

describe('records/[recordId] route', () => {
  beforeEach(() => vi.clearAllMocks())
  const ctx = { params: Promise.resolve({ id: 'w1', recordId: 'r1' }) }

  it('PATCH updates a cell', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(updateWorkspaceRecord as any).mockResolvedValue({ id: 'r1', data: { grade: 95 } })
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ data: { grade: 95 } }) })
    const res = await PATCH(req as any, ctx)
    expect(res.status).toBe(200)
    expect(updateWorkspaceRecord).toHaveBeenCalledWith({ userId: 'u1', workspaceId: 'w1', recordId: 'r1', patch: { grade: 95 } })
  })

  it('PATCH returns 422 on validation error', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(updateWorkspaceRecord as any).mockRejectedValue({ type: 'VALIDATION_ERROR', errors: { grade: 'Must be a number' } })
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ data: { grade: 'x' } }) })
    const res = await PATCH(req as any, ctx)
    expect(res.status).toBe(422)
  })

  it('DELETE removes a row', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(deleteWorkspaceRecord as any).mockResolvedValue(undefined)
    const req = new Request('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req as any, ctx)
    expect(res.status).toBe(200)
  })

  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const req = new Request('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req as any, ctx)
    expect(res.status).toBe(401)
  })
})

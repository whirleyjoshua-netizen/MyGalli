import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH, DELETE } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspace: { findUnique: vi.fn() },
    workspaceField: { updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}))

describe('fields/[fieldId] route', () => {
  beforeEach(() => vi.clearAllMocks())
  const ctx = { params: Promise.resolve({ id: 'w1', fieldId: 'f1' }) }

  it('PATCH updates label only (never key/type)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.updateMany as any).mockResolvedValue({ count: 1 })
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ label: 'New', key: 'hax', type: 'number' }) })
    const res = await PATCH(req as any, ctx)
    expect(res.status).toBe(200)
    const call = (db.workspaceField.updateMany as any).mock.calls[0][0]
    expect(call.data).toEqual({ label: 'New' }) // key/type stripped
    expect(call.where).toEqual({ id: 'f1', workspaceId: 'w1' })
  })

  it('DELETE removes the column', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.deleteMany as any).mockResolvedValue({ count: 1 })
    const req = new Request('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req as any, ctx)
    expect(res.status).toBe(200)
  })

  it('404 when not owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u2' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    const req = new Request('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req as any, ctx)
    expect(res.status).toBe(404)
  })
})

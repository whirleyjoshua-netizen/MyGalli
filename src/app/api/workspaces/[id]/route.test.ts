import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH, DELETE } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspace: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    workspaceField: { findMany: vi.fn() },
    workspaceRecord: { findMany: vi.fn(), count: vi.fn() },
    workspaceView: { findMany: vi.fn(), create: vi.fn() },
  },
}))

describe('workspaces/[id] route', () => {
  beforeEach(() => vi.clearAllMocks())
  const ctx = { params: Promise.resolve({ id: 'w1' }) }
  const req = (method: string, body?: any) =>
    ({ method, nextUrl: new URL('http://localhost/api/workspaces/w1'), json: async () => body } as any)

  it('GET returns workspace + fields + records', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1', name: 'S', description: null, icon: null })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ id: 'f1', key: 'grade' }])
    ;(db.workspaceRecord.findMany as any).mockResolvedValue([{ id: 'r1', data: { grade: 90 }, updatedAt: new Date('2026-07-14') }])
    ;(db.workspaceRecord.count as any).mockResolvedValue(1)
    ;(db.workspaceView.findMany as any).mockResolvedValue([{ id: 'v1', name: 'Grid', type: 'grid', config: {}, position: 0 }])

    const res = await GET(req('GET'), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.workspace.name).toBe('S')
    expect(body.fields).toHaveLength(1)
    expect(body.records[0].data).toEqual({ grade: 90 })
    expect(body.pagination.total).toBe(1)
    expect(body.views).toHaveLength(1)
    expect(body.views[0].type).toBe('grid')
  })

  it('GET auto-creates a default grid view when none exist', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1', name: 'S', description: null, icon: null })
    ;(db.workspaceField.findMany as any).mockResolvedValue([])
    ;(db.workspaceRecord.findMany as any).mockResolvedValue([])
    ;(db.workspaceRecord.count as any).mockResolvedValue(0)
    ;(db.workspaceView.findMany as any).mockResolvedValue([])
    ;(db.workspaceView.create as any).mockResolvedValue({ id: 'vDef', name: 'Grid', type: 'grid', config: {}, position: 0 })
    const res = await GET(req('GET'), ctx)
    const body = await res.json()
    expect(db.workspaceView.create).toHaveBeenCalled()
    expect(body.views[0].id).toBe('vDef')
  })

  it('GET 404 when not owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u2' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    const res = await GET(req('GET'), ctx)
    expect(res.status).toBe(404)
  })

  it('PATCH renames the workspace', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    ;(db.workspace.update as any).mockResolvedValue({ id: 'w1', name: 'New' })
    const res = await PATCH(req('PATCH', { name: 'New' }), ctx)
    expect(res.status).toBe(200)
    expect(db.workspace.update).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { name: 'New' } })
  })

  it('DELETE removes the workspace', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    ;(db.workspace.delete as any).mockResolvedValue({ id: 'w1' })
    const res = await DELETE(req('DELETE'), ctx)
    expect(res.status).toBe(200)
  })
})

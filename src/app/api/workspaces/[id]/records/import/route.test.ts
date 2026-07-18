import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { workspaceField: { findMany: vi.fn() }, workspaceRecord: { createMany: vi.fn() } } }))

const ctx = { params: Promise.resolve({ id: 'w1' }) }
const req = (body: any) => ({ json: async () => body }) as any
const FIELDS = [
  { id: 'f1', key: 'name', label: 'Name', type: 'text' },
  { id: 'f2', key: 'gpa', label: 'GPA', type: 'number' },
]

describe('POST records/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1', schemaVersion: 1 })
    ;(db.workspaceField.findMany as any).mockResolvedValue(FIELDS)
    ;(db.workspaceRecord.createMany as any).mockResolvedValue({ count: 0 })
  })

  it('401 unauth', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await POST(req({ rows: [] }), ctx)).status).toBe(401)
  })

  it('404 foreign workspace', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockRejectedValue(new Error('Unauthorized or Workspace not found'))
    expect((await POST(req({ rows: [{ name: 'A' }] }), ctx)).status).toBe(404)
  })

  it('400 over the 5000-row cap', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    const rows = Array.from({ length: 5001 }, () => ({ name: 'A' }))
    expect((await POST(req({ rows }), ctx)).status).toBe(400)
  })

  it('dryRun returns the report and does NOT insert', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    const res = await POST(req({ dryRun: true, rows: [{ name: 'A', gpa: '3.5' }, { name: 'B', gpa: 'nope' }] }), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.validCount).toBe(1)
    expect(body.skippedCount).toBe(1)
    expect(body.errors[0]).toMatchObject({ row: 2, field: 'gpa' })
    expect(db.workspaceRecord.createMany).not.toHaveBeenCalled()
  })

  it('real import inserts only valid coerced rows via createMany', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspaceRecord.createMany as any).mockResolvedValue({ count: 1 })
    const res = await POST(req({ rows: [{ name: 'A', gpa: '3.5' }, { name: 'B', gpa: 'nope' }] }), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inserted).toBe(1)
    expect(body.skipped).toBe(1)
    const arg = (db.workspaceRecord.createMany as any).mock.calls[0][0].data
    expect(arg).toHaveLength(1)
    expect(arg[0]).toMatchObject({ workspaceId: 'w1', schemaVersion: 1, createdById: 'u1', status: 'active' })
    expect(arg[0].data).toEqual({ name: 'A', gpa: 3.5 }) // coerced
  })
})

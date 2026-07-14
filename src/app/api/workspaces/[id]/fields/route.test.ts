import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspace: { findUnique: vi.fn() },
    workspaceField: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
}))

describe('POST /api/workspaces/[id]/fields', () => {
  beforeEach(() => vi.clearAllMocks())
  const ctx = { params: Promise.resolve({ id: 'w1' }) }

  it('derives a stable key from the label', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ key: 'final_grade' }])
    ;(db.workspaceField.count as any).mockResolvedValue(1)
    ;(db.workspaceField.create as any).mockImplementation(({ data }: any) => ({ id: 'f2', ...data }))

    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ label: 'Final Grade', type: 'number' }) })
    const res = await POST(req as any, ctx)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.key).toBe('final_grade_2') // de-duped against existing
    expect(body.label).toBe('Final Grade')
    expect(body.position).toBe(1)
  })

  it('400 when label or type missing', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ type: 'text' }) })
    const res = await POST(req as any, ctx)
    expect(res.status).toBe(400)
  })
})

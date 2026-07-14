import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { workspaceField: { findFirst: vi.fn() }, workspaceRecord: { findMany: vi.fn() } } }))

const ctx = { params: Promise.resolve({ id: 'w1' }) }
const req = (qs: string) => ({ nextUrl: new URL(`http://localhost/api/workspaces/w1/aggregate?${qs}`) } as any)

describe('GET aggregate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await GET(req('field=grade&op=avg'), ctx)
    expect(res.status).toBe(401)
  })

  it('404 when not owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockRejectedValue(new Error('Unauthorized or Workspace not found'))
    const res = await GET(req('field=grade&op=avg'), ctx)
    expect(res.status).toBe(404)
  })

  it('400 on bad op', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    const res = await GET(req('field=grade&op=median'), ctx)
    expect(res.status).toBe(400)
  })

  it('400 on unknown field', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    ;(db.workspaceField.findFirst as any).mockResolvedValue(null)
    const res = await GET(req('field=ghost&op=avg'), ctx)
    expect(res.status).toBe(400)
  })

  it('200 returns computed value', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    ;(db.workspaceField.findFirst as any).mockResolvedValue({ key: 'grade' })
    ;(db.workspaceRecord.findMany as any).mockResolvedValue([{ data: { grade: 80 } }, { data: { grade: 100 } }])
    const res = await GET(req('field=grade&op=avg'), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ value: 90 })
  })
})

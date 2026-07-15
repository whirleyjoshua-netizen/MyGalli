import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DELETE } from './route'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { workspaceView: { count: vi.fn(), deleteMany: vi.fn() } } }))

const ctx = { params: Promise.resolve({ id: 'w1', viewId: 'v2' }) }
const req = () => ({} as any)

describe('DELETE view', () => {
  beforeEach(() => vi.clearAllMocks())
  it('401 unauth', async () => { ;(getUser as any).mockResolvedValue(null); expect((await DELETE(req(), ctx)).status).toBe(401) })
  it('400 on the last view', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' }); ;(authorizeWorkspace as any).mockResolvedValue({})
    ;(db.workspaceView.count as any).mockResolvedValue(1)
    expect((await DELETE(req(), ctx)).status).toBe(400)
  })
  it('200 deletes a non-last view', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' }); ;(authorizeWorkspace as any).mockResolvedValue({})
    ;(db.workspaceView.count as any).mockResolvedValue(2)
    ;(db.workspaceView.deleteMany as any).mockResolvedValue({ count: 1 })
    expect((await DELETE(req(), ctx)).status).toBe(200)
  })
})

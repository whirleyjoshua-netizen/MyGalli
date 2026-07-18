import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH, DELETE } from './route'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspaceView: { count: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
    workspaceField: { findMany: vi.fn() },
  },
}))

const ctx = { params: Promise.resolve({ id: 'w1', viewId: 'v2' }) }
const req = () => ({} as any)
const patchReq = (body: any) => ({ json: async () => body }) as any

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

describe('PATCH view (Finding: config.filter persisted with no validation)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 unauth', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await PATCH(patchReq({ config: {} }), ctx)).status).toBe(401)
  })

  it('validates + normalizes config.filter, mirroring POST /views', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockResolvedValue({})
    ;(db.workspaceField.findMany as any).mockResolvedValue([
      { id: 'f1', key: 'fee', label: 'Fee', type: 'currency', config: { symbol: '$' } },
    ])
    ;(db.workspaceView.update as any).mockResolvedValue({ id: 'v2' })

    const res = await PATCH(
      patchReq({ config: { filter: { op: 'and', conditions: [{ field: 'fee', cmp: 'gt', value: '1200' }] } } }),
      ctx
    )
    expect(res.status).toBe(200)
    const stored = (db.workspaceView.update as any).mock.calls[0][0].data.config
    expect(stored.filter.conditions[0].value).toBe(1200)
  })

  it('400s on a filter naming a deleted/unknown field, instead of persisting it', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockResolvedValue({})
    ;(db.workspaceField.findMany as any).mockResolvedValue([
      { id: 'f1', key: 'fee', label: 'Fee', type: 'currency', config: {} },
    ])

    const res = await PATCH(
      patchReq({ config: { filter: { op: 'and', conditions: [{ field: 'ghost', cmp: 'eq', value: 'x' }] } } }),
      ctx
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Unknown field/)
    expect(db.workspaceView.update).not.toHaveBeenCalled()
  })

  it('allows clearing a filter (config with no filter key)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockResolvedValue({})
    ;(db.workspaceField.findMany as any).mockResolvedValue([
      { id: 'f1', key: 'fee', label: 'Fee', type: 'currency', config: {} },
    ])
    ;(db.workspaceView.update as any).mockResolvedValue({ id: 'v2' })

    const res = await PATCH(patchReq({ config: { visibleFields: ['fee'] } }), ctx)
    expect(res.status).toBe(200)
    const stored = (db.workspaceView.update as any).mock.calls[0][0].data.config
    expect(stored.filter).toBeUndefined()
  })
})

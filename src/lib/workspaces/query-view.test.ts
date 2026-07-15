import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryWorkspaceView } from './query-view'
import { authorizeWorkspace } from './authorize'
import { db } from '@/lib/db'

vi.mock('./authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspaceView: { findUnique: vi.fn() },
    workspaceField: { findMany: vi.fn() },
    workspaceRecord: { findMany: vi.fn(), count: vi.fn() },
  },
}))

const FIELDS = [
  { id: 'f1', key: 'sport', label: 'Sport', type: 'choice', position: 0, config: { options: ['Soccer', 'Tennis'] } },
  { id: 'f2', key: 'fee', label: 'Fee', type: 'currency', position: 1, config: { symbol: '$' } },
]

function setup(config: any) {
  ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1' })
  ;(db.workspaceView.findUnique as any).mockResolvedValue({ id: 'v1', name: 'V', type: 'grid', config })
  ;(db.workspaceField.findMany as any).mockResolvedValue(FIELDS)
  ;(db.workspaceRecord.findMany as any).mockResolvedValue([])
  ;(db.workspaceRecord.count as any).mockResolvedValue(0)
}

const ARGS = { workspaceId: 'w1', viewId: 'v1', userId: 'u1' }

describe('queryWorkspaceView filtering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies the view filter to BOTH findMany and count', async () => {
    setup({ filter: { op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] } })
    await queryWorkspaceView(ARGS)

    const expected = { AND: [{ data: { path: ['sport'], equals: 'Soccer' } }] }
    expect((db.workspaceRecord.findMany as any).mock.calls[0][0].where).toMatchObject({
      workspaceId: 'w1',
      status: 'active',
      ...expected,
    })
    expect((db.workspaceRecord.count as any).mock.calls[0][0].where).toMatchObject({
      workspaceId: 'w1',
      status: 'active',
      ...expected,
    })
  })

  it('queries unfiltered when the view has no filter', async () => {
    setup({})
    await queryWorkspaceView(ARGS)
    const where = (db.workspaceRecord.findMany as any).mock.calls[0][0].where
    expect(where).toEqual({ workspaceId: 'w1', status: 'active' })
    expect(where.AND).toBeUndefined()
  })

  it('ignores a stale filter naming a field that no longer exists', async () => {
    setup({ filter: { op: 'and', conditions: [{ field: 'deleted_col', cmp: 'eq', value: 'x' }] } })
    const result = await queryWorkspaceView(ARGS)
    // Must not throw and must not silently filter on garbage
    expect((db.workspaceRecord.findMany as any).mock.calls[0][0].where).toEqual({
      workspaceId: 'w1',
      status: 'active',
    })
    expect(result.filterError).toMatch(/Unknown field/)
  })

  it('defaults pageSize to 100 (matching the main GET)', async () => {
    setup({})
    const result = await queryWorkspaceView(ARGS)
    expect((db.workspaceRecord.findMany as any).mock.calls[0][0].take).toBe(100)
    expect(result.pagination.pageSize).toBe(100)
  })

  it('orders by createdAt asc, matching the main GET /api/workspaces/[id] (Finding: row order silently flipped)', async () => {
    setup({})
    await queryWorkspaceView(ARGS)
    expect((db.workspaceRecord.findMany as any).mock.calls[0][0].orderBy).toEqual({ createdAt: 'asc' })
  })
})

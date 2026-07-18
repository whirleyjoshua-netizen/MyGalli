import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryWorkspaceView } from './query-view'
import { authorizeWorkspace } from './authorize'
import { db } from '@/lib/db'

vi.mock('./authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspaceView: { findUnique: vi.fn() },
    workspaceField: { findMany: vi.fn() },
    $queryRawUnsafe: vi.fn(),
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
  ;(db.$queryRawUnsafe as any).mockReset()
  ;(db.$queryRawUnsafe as any)
    .mockResolvedValueOnce([{ id: 'r1', data: { sport: 'Soccer' }, updatedAt: new Date(0) }]) // records
    .mockResolvedValueOnce([{ count: 1 }])                                                     // count
}

const ARGS = { workspaceId: 'w1', viewId: 'v1', userId: 'u1' }

describe('queryWorkspaceView filtering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('runs the built SQL for records and the count SQL for the total', async () => {
    setup({}) // existing helper that mocks view + fields
    const res = await queryWorkspaceView(ARGS)
    const calls = (db.$queryRawUnsafe as any).mock.calls
    expect(calls[0][0]).toMatch(/SELECT id, data, "updatedAt" FROM "WorkspaceRecord"/)
    expect(calls[1][0]).toMatch(/SELECT count\(\*\)::int AS count/)
    expect(res.pagination.total).toBe(1)
  })

  it('drops a stale sort (unknown field) and surfaces sortError without throwing', async () => {
    setup({ sort: { field: 'deleted_col', dir: 'asc' } })
    const res = await queryWorkspaceView(ARGS)
    expect(res.sort).toBeNull()
    expect(res.sortError).toMatch(/Unknown field/)
    // still queried (unsorted), no throw:
    expect((db.$queryRawUnsafe as any).mock.calls.length).toBe(2)
  })

  it('passes a valid sort + search through to the query', async () => {
    setup({ sort: { field: 'fee', dir: 'desc' } })
    await queryWorkspaceView({ ...ARGS, search: 'carter' })
    const recordsSql = (db.$queryRawUnsafe as any).mock.calls[0][0]
    expect(recordsSql).toContain('::numeric DESC')
    expect(recordsSql).toContain('jsonb_each_text')
  })

  it('ignores a stale filter naming a field that no longer exists', async () => {
    setup({ filter: { op: 'and', conditions: [{ field: 'deleted_col', cmp: 'eq', value: 'x' }] } })
    const result = await queryWorkspaceView(ARGS)
    expect(result.filterError).toMatch(/Unknown field/)
  })

  it('defaults pageSize to 100 (matching the main GET)', async () => {
    setup({})
    const result = await queryWorkspaceView(ARGS)
    expect(result.pagination.pageSize).toBe(100)
  })
})

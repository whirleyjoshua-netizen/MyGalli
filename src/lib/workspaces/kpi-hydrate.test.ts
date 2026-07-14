import { describe, it, expect, vi } from 'vitest'
import { hydrateWorkspaceKpis } from './kpi-hydrate'

const sections = () => [{
  id: 's1',
  columns: [{ id: 'c1', elements: [
    { id: 'e1', type: 'workspace-kpi', workspaceKpiWorkspaceId: 'w1', workspaceKpiFieldKey: 'grade', workspaceKpiAgg: 'avg' },
    { id: 'e2', type: 'text', text: 'hi' },
    { id: 'e3', type: 'workspace-kpi', workspaceKpiWorkspaceId: 'wForeign', workspaceKpiFieldKey: 'grade', workspaceKpiAgg: 'avg' },
  ] }],
}]

describe('hydrateWorkspaceKpis', () => {
  it('computes owned KPI, nulls foreign KPI, leaves other elements untouched', async () => {
    const deps = {
      getWorkspaceOwnerId: vi.fn(async (id: string) => (id === 'w1' ? 'owner1' : 'someoneElse')),
      getActiveRecords: vi.fn(async () => [{ data: { grade: 80 } }, { data: { grade: 100 } }]),
    }
    const out = await hydrateWorkspaceKpis(sections() as any, 'owner1', deps)
    const els = out[0].columns[0].elements
    expect(els[0].workspaceKpiValue).toBe(90) // owned -> computed
    expect(els[1]).toEqual({ id: 'e2', type: 'text', text: 'hi' }) // untouched
    expect(els[2].workspaceKpiValue).toBeNull() // foreign workspace -> null
    expect(deps.getActiveRecords).toHaveBeenCalledTimes(1) // only the owned one
  })

  it('nulls a KPI with no binding', async () => {
    const secs = [{ id: 's', columns: [{ id: 'c', elements: [{ id: 'e', type: 'workspace-kpi', workspaceKpiAgg: 'avg' }] }] }]
    const deps = { getWorkspaceOwnerId: vi.fn(), getActiveRecords: vi.fn() }
    const out = await hydrateWorkspaceKpis(secs as any, 'owner1', deps)
    expect(out[0].columns[0].elements[0].workspaceKpiValue).toBeNull()
    expect(deps.getWorkspaceOwnerId).not.toHaveBeenCalled()
  })
})

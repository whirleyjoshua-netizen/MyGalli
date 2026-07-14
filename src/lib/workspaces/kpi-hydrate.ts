import { computeAggregate, WorkspaceAgg } from './aggregate'

type Deps = {
  getWorkspaceOwnerId: (workspaceId: string) => Promise<string | null>
  getActiveRecords: (workspaceId: string) => Promise<Array<{ data: Record<string, any> }>>
}

/**
 * Returns a deep-copied sections array where every `workspace-kpi` element has
 * workspaceKpiValue computed server-side — but ONLY when the bound workspace is
 * owned by `ownerId` (the page owner). Foreign/missing/unbound -> null.
 */
export async function hydrateWorkspaceKpis(sections: any[], ownerId: string, deps: Deps): Promise<any[]> {
  if (!Array.isArray(sections)) return sections
  return Promise.all(
    sections.map(async (section) => ({
      ...section,
      columns: await Promise.all(
        (section.columns || []).map(async (column: any) => ({
          ...column,
          elements: await Promise.all(
            (column.elements || []).map(async (el: any) => {
              if (el?.type !== 'workspace-kpi') return el
              const wsId = el.workspaceKpiWorkspaceId
              const agg = (el.workspaceKpiAgg || 'avg') as WorkspaceAgg
              if (!wsId || (agg !== 'count' && !el.workspaceKpiFieldKey)) {
                return { ...el, workspaceKpiValue: null }
              }
              const owner = await deps.getWorkspaceOwnerId(wsId)
              if (owner !== ownerId) return { ...el, workspaceKpiValue: null }
              const records = await deps.getActiveRecords(wsId)
              return { ...el, workspaceKpiValue: computeAggregate(records, el.workspaceKpiFieldKey || '', agg) }
            })
          ),
        }))
      ),
    }))
  )
}

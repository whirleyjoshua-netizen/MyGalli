import { db } from '@/lib/db'
import { authorizeWorkspace } from './authorize'
import { validateFilter, validateSort, FilterError, type FilterSpec, type SortSpec } from './filter'
import { buildRecordsQuery } from './records-query'

type QueryOptions = {
  workspaceId: string
  viewId: string
  userId: string
  page?: number
  pageSize?: number
  search?: string
}

export async function queryWorkspaceView({
  workspaceId,
  viewId,
  userId,
  page = 1,
  pageSize = 100,
  search,
}: QueryOptions) {
  // 1. Authorize
  await authorizeWorkspace(userId, workspaceId)

  // 2. Load View config
  const view = await db.workspaceView.findUnique({
    where: { id: viewId, workspaceId },
  })
  if (!view) throw new Error('View not found')

  // 3. Load Schema (for visible fields)
  const fields = await db.workspaceField.findMany({
    where: { workspaceId },
    orderBy: { position: 'asc' },
  })

  // 4. Validate the view's saved filter + sort (untrusted: columns can change
  //    after they were saved), then build one parameterized SQL query.
  const config = view.config as { visibleFields?: string[]; filter?: unknown; sort?: unknown }

  let filterSpec: FilterSpec | null = null
  let filterError: string | undefined
  if (config?.filter) {
    try {
      // Re-validate on every read: columns can be deleted or retyped after a
      // filter is saved, so a stored filter is untrusted input like any other.
      filterSpec = validateFilter(config.filter, fields)
    } catch (e: any) {
      if (!(e instanceof FilterError)) throw e
      // A stale filter degrades to "show everything" + a surfaced message,
      // rather than 500ing a view the user can still otherwise use.
      filterError = e.message
    }
  }

  let sortSpec: SortSpec | null = null
  let sortError: string | undefined
  if (config?.sort) {
    try {
      sortSpec = validateSort(config.sort, fields)
    } catch (e: any) {
      if (!(e instanceof FilterError)) throw e
      sortError = e.message
    }
  }

  const built = buildRecordsQuery({
    workspaceId, fields, filter: filterSpec, search, sort: sortSpec, page, pageSize,
  })

  const [records, countRows] = await Promise.all([
    db.$queryRawUnsafe(built.sql, ...built.params) as Promise<Array<{ id: string; data: any; updatedAt: Date }>>,
    db.$queryRawUnsafe(built.countSql, ...built.countParams) as Promise<Array<{ count: number }>>,
  ])
  const total = countRows[0]?.count ?? 0

  // 5. Projection (strip non-visible fields if defined in config)
  const visibleFields = config?.visibleFields || fields.map(f => f.key)
  
  const projectedRecords = records.map(record => {
    const data: Record<string, any> = {}
    for (const key of visibleFields) {
      data[key] = (record.data as Record<string, any>)[key]
    }
    return { ...record, data }
  })

  return {
    view: { id: view.id, name: view.name, type: view.type, config: view.config },
    fields: fields.filter(f => visibleFields.includes(f.key)),
    records: projectedRecords,
    filterError,
    sort: sortSpec,
    sortError,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  }
}

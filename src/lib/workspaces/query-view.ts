import { db } from '@/lib/db'
import { authorizeWorkspace } from './authorize'
import { validateFilter, filterToPrismaWhere, FilterError } from './filter'

type QueryOptions = {
  workspaceId: string
  viewId: string
  userId: string
  page?: number
  pageSize?: number
}

export async function queryWorkspaceView({
  workspaceId,
  viewId,
  userId,
  page = 1,
  pageSize = 100,
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

  // 4. Build query — apply the view's saved filter, if any.
  const skip = (page - 1) * pageSize
  const config = view.config as { visibleFields?: string[]; filter?: unknown }

  let filterWhere: Record<string, any> = {}
  let filterError: string | undefined
  if (config?.filter) {
    try {
      // Re-validate on every read: columns can be deleted or retyped after a
      // filter is saved, so a stored filter is untrusted input like any other.
      const spec = validateFilter(config.filter, fields)
      filterWhere = filterToPrismaWhere(spec)
    } catch (e: any) {
      if (!(e instanceof FilterError)) throw e
      // A stale filter degrades to "show everything" + a surfaced message,
      // rather than 500ing a view the user can still otherwise use.
      filterError = e.message
    }
  }

  const where = { workspaceId, status: 'active', ...filterWhere }

  const [records, total] = await Promise.all([
    db.workspaceRecord.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: { id: true, data: true, updatedAt: true }
    }),
    db.workspaceRecord.count({ where })
  ])

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
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  }
}

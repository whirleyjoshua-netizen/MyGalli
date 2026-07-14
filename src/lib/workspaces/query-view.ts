import { db } from '@/lib/db'
import { authorizeWorkspace } from './authorize'

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
  pageSize = 25,
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

  // 4. Build Query (basic implementation for POC)
  const skip = (page - 1) * pageSize
  
  // NOTE: Filtering and sorting logic would be built here incrementally as requested.
  // Currently focusing on pagination and fetching.
  const [records, total] = await Promise.all([
    db.workspaceRecord.findMany({
      where: { workspaceId, status: 'active' },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: { id: true, data: true, updatedAt: true }
    }),
    db.workspaceRecord.count({ where: { workspaceId, status: 'active' } })
  ])

  // 5. Projection (strip non-visible fields if defined in config)
  const config = view.config as { visibleFields?: string[] }
  const visibleFields = config?.visibleFields || fields.map(f => f.key)
  
  const projectedRecords = records.map(record => {
    const data: Record<string, any> = {}
    for (const key of visibleFields) {
      data[key] = (record.data as Record<string, any>)[key]
    }
    return { ...record, data }
  })

  return {
    view: { id: view.id, name: view.name, type: view.type },
    fields: fields.filter(f => visibleFields.includes(f.key)),
    records: projectedRecords,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  }
}

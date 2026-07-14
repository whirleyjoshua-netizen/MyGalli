import { db } from '@/lib/db'
import { authorizeWorkspace } from './authorize'
import { validateWorkspaceRecord } from './validator'

/**
 * Orchestrates record creation in a workspace
 */
export async function createWorkspaceRecord(params: {
  userId: string
  workspaceId: string
  input: Record<string, any>
  displayId?: string
}) {
  const { userId, workspaceId, input, displayId } = params

  // 1. Authorize
  const workspace = await authorizeWorkspace(userId, workspaceId)

  // 2. Validate
  const validation = await validateWorkspaceRecord(workspaceId, input)
  if (!validation.success) {
    throw { type: 'VALIDATION_ERROR', errors: validation.errors }
  }

  // 3. Persist
  try {
    return await db.workspaceRecord.create({
      data: {
        workspaceId,
        displayId,
        data: validation.data!,
        schemaVersion: workspace.schemaVersion,
        createdById: userId,
      },
    })
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw { type: 'CONFLICT_ERROR', message: 'Display already linked to a record' }
    }
    throw error
  }
}

export async function updateWorkspaceRecord(params: {
  userId: string
  workspaceId: string
  recordId: string
  patch: Record<string, any>
}) {
  const { userId, workspaceId, recordId, patch } = params

  await authorizeWorkspace(userId, workspaceId)

  const record = await db.workspaceRecord.findFirst({
    where: { id: recordId, workspaceId },
  })
  if (!record) throw { type: 'NOT_FOUND', message: 'Record not found' }

  const validation = await validateWorkspaceRecord(workspaceId, patch, { partial: true })
  if (!validation.success) {
    throw { type: 'VALIDATION_ERROR', errors: validation.errors }
  }

  const mergedData = { ...(record.data as Record<string, any>), ...validation.data }

  return db.workspaceRecord.update({
    where: { id: recordId },
    data: { data: mergedData, updatedById: userId },
  })
}

export async function deleteWorkspaceRecord(params: {
  userId: string
  workspaceId: string
  recordId: string
}) {
  const { userId, workspaceId, recordId } = params
  await authorizeWorkspace(userId, workspaceId)
  const { count } = await db.workspaceRecord.deleteMany({
    where: { id: recordId, workspaceId },
  })
  if (count === 0) throw { type: 'NOT_FOUND', message: 'Record not found' }
}

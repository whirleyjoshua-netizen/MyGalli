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

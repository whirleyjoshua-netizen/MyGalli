import { db } from '@/lib/db'

/**
 * Authorizes that a user is the owner of a specific workspace.
 * Returns the workspace if authorized, otherwise throws.
 */
export async function authorizeWorkspace(userId: string, workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true, schemaVersion: true },
  })

  if (!workspace || workspace.ownerId !== userId) {
    throw new Error('Unauthorized or Workspace not found')
  }

  return workspace
}

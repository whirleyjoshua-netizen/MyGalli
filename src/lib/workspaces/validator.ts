import { WorkspaceField } from '@prisma/client'
import { db } from '@/lib/db'
import { validateWorkspaceRecord as validate } from '../workspace-validator'

/**
 * Validates record data against the workspace schema.
 * Orchestrates fetching fields + validation.
 */
export async function validateWorkspaceRecord(
  workspaceId: string,
  input: Record<string, any>,
  strict: boolean = true
) {
  // Fetch fields once for validation
  const fields = await db.workspaceField.findMany({
    where: { workspaceId },
  })
  
  return validate(fields, input, strict)
}

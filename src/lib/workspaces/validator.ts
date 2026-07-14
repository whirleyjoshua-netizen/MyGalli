import { db } from '@/lib/db'
import { validateWorkspaceRecord as validate, ValidateOptions } from '../workspace-validator'

/**
 * Validates record data against the workspace schema.
 * Orchestrates fetching fields + validation.
 */
export async function validateWorkspaceRecord(
  workspaceId: string,
  input: Record<string, any>,
  opts: ValidateOptions = {}
) {
  // Fetch fields once for validation
  const fields = await db.workspaceField.findMany({
    where: { workspaceId },
  })

  return validate(fields, input, opts)
}

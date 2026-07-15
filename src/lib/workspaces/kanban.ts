import type { GridRecord } from '@/components/workspaces/useWorkspaceGrid'

export const UNCATEGORIZED = '__uncategorized'

export function groupRecordsByField(
  records: GridRecord[],
  fieldKey: string,
  options: string[]
): Record<string, GridRecord[]> {
  const groups: Record<string, GridRecord[]> = {}
  for (const opt of options) groups[opt] = []
  groups[UNCATEGORIZED] = []
  for (const rec of records) {
    const v = rec.data?.[fieldKey]
    if (v != null && options.includes(v)) groups[v].push(rec)
    else groups[UNCATEGORIZED].push(rec)
  }
  return groups
}

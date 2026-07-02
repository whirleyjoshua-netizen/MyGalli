export const COLLAB_FIELDS = ['sections', 'background', 'spacing', 'headerCard', 'tabs'] as const

export function canEdit(userId: string | null, ownerId: string, collaboratorIds: string[]): boolean {
  if (!userId) return false
  return userId === ownerId || collaboratorIds.includes(userId)
}

export function splitUpdate(
  updates: Record<string, unknown>,
  isOwner: boolean,
): { data: Record<string, unknown>; rejected: string[] } {
  if (isOwner) return { data: { ...updates }, rejected: [] }
  const data: Record<string, unknown> = {}
  const rejected: string[] = []
  for (const [k, v] of Object.entries(updates)) {
    if ((COLLAB_FIELDS as readonly string[]).includes(k)) data[k] = v
    else rejected.push(k)
  }
  return { data, rejected }
}

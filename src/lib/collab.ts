export const COLLAB_FIELDS = ['sections', 'background', 'spacing', 'headerCard', 'tabs'] as const

/**
 * Fields a visitor can actually see rendered on the public page body. Editing
 * any of them is what "last updated" means to a reader.
 *
 * Wider than COLLAB_FIELDS (which governs who may edit and optimistic
 * concurrency) because title and description are visible too — but narrower
 * than "every field": `published` and `category` change nothing a visitor
 * sees, and `coverImage` is likewise excluded because it is never rendered in
 * the page body — it only appears in `generateMetadata` as the OG/share
 * image, not on the page itself.
 */
export const VISIBLE_FIELDS = [
  ...COLLAB_FIELDS,
  'title',
  'description',
] as const

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

import { safeHref } from '@/lib/editor/safe-href'

export const LINKABLE_ITEM_TYPES = new Set(['file', 'link', 'embed'])

export function linkableItems<T extends { type: string }>(items: T[]): T[] {
  return items.filter((i) => LINKABLE_ITEM_TYPES.has(i.type))
}

export function visibleNotes<T extends { visibility: string }>(notes: T[], isOwner: boolean): T[] {
  return isOwner ? notes : notes.filter((n) => n.visibility === 'public')
}

export function resolveNoteLink(
  note: { linkedItemId: string | null },
  items: { id: string; url: string | null }[]
): string | null {
  if (!note.linkedItemId) return null
  const item = items.find((i) => i.id === note.linkedItemId)
  if (!item) return null
  return safeHref(item.url ?? undefined) ?? null
}

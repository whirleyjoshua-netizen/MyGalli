import type { IndexEntry } from './types/canvas'

// Case-insensitive filter across label, subtitle, and tags.
// Empty/whitespace query returns all entries in original order.
export function filterEntries(entries: IndexEntry[], query: string): IndexEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries
  return entries.filter((e) => {
    const hay = [
      e.label,
      e.subtitle ?? '',
      ...(e.tags ?? []),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

// Group entries by category, preserving entry order within a group and
// first-seen order of categories. Ungrouped entries (''/undefined) collapse
// into a single group keyed by '' (rendered without a header).
export function groupByCategory(
  entries: IndexEntry[],
): { category: string; entries: IndexEntry[] }[] {
  const order: string[] = []
  const map = new Map<string, IndexEntry[]>()
  for (const e of entries) {
    const cat = e.category ?? ''
    if (!map.has(cat)) {
      map.set(cat, [])
      order.push(cat)
    }
    map.get(cat)!.push(e)
  }
  return order.map((category) => ({ category, entries: map.get(category)! }))
}

// 0-based index → 1-based, zero-padded to 3 digits ("001"); plain past 999.
export function displayNumber(index: number): string {
  return String(index + 1).padStart(3, '0')
}

// Stable-enough unique id for a new entry (editor/client runtime only).
export function newEntryId(): string {
  return `idx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

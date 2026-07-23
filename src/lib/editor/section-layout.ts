import type { Section, LayoutMode, Column } from '@/lib/types/canvas'

const COLUMN_COUNT: Record<LayoutMode, number> = {
  'single': 1,
  'full-width': 1,
  'two-column': 2,
  'three-column': 3,
}

// Change a section's layout (column count), redistributing existing elements
// without loss. Pure: returns a new section, never mutates the input.
export function applySectionLayout(section: Section, layout: LayoutMode): Section {
  const target = COLUMN_COUNT[layout]
  const cols = section.columns

  if (target === cols.length) {
    return { ...section, layout, columns: cols.map((c) => ({ ...c })) }
  }

  if (target < cols.length) {
    const kept: Column[] = cols.slice(0, target).map((c) => ({ ...c, elements: [...c.elements] }))
    const overflow = cols.slice(target).flatMap((c) => c.elements)
    const last = kept[target - 1]
    kept[target - 1] = { ...last, elements: [...last.elements, ...overflow] }
    return { ...section, layout, columns: kept }
  }

  // target > current: keep existing columns, append empty deterministic ones
  const added: Column[] = Array.from({ length: target - cols.length }, (_, i) => ({
    id: `${section.id}-c${cols.length + i}`,
    elements: [],
  }))
  return { ...section, layout, columns: [...cols.map((c) => ({ ...c })), ...added] }
}

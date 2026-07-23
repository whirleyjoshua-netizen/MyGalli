import type { CanvasElement, Section } from '@/lib/types/canvas'

/**
 * True only for zones this runtime actually knows. The tz is the sole
 * client-supplied input to stamping, so it is validated rather than trusted;
 * an unknown zone would throw inside Intl at render time on every viewer.
 */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function findElement(sections: Section[], elementId: string): CanvasElement | null {
  for (const section of sections) {
    for (const column of section.columns) {
      for (const element of column.elements) {
        if (element.id === elementId) return element
      }
    }
  }
  return null
}

/** Rebuild `sections` with `mutate` applied to one element. Null if absent. */
function mapElement(
  sections: Section[],
  elementId: string,
  mutate: (el: CanvasElement) => CanvasElement,
): Section[] | null {
  let found = false
  const next = sections.map((section) => ({
    ...section,
    columns: section.columns.map((column) => ({
      ...column,
      elements: column.elements.map((element) => {
        if (element.id !== elementId) return element
        found = true
        return mutate(element)
      }),
    })),
  }))
  return found ? next : null
}

export function setStamp(
  sections: Section[],
  elementId: string,
  stampedAt: string,
  stampedTz?: string,
): Section[] | null {
  return mapElement(sections, elementId, (el) => {
    const next: CanvasElement = { ...el, stampedAt }
    if (stampedTz) next.stampedTz = stampedTz
    else delete next.stampedTz
    return next
  })
}

export function clearStamp(sections: Section[], elementId: string): Section[] | null {
  return mapElement(sections, elementId, (el) => {
    const next = { ...el }
    delete next.stampedAt
    delete next.stampedTz
    return next
  })
}

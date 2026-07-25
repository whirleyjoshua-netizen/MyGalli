import type { CanvasElement, Section } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

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

/**
 * A page's elements live either directly under `sections` or, when tabs are
 * enabled, split across `tabs.tabs[i].sections` — the same split the RSVP
 * route's `findElement` already scans for reads. `setStamp`/`clearStamp` only
 * ever see one `Section[]` at a time, so this tries the top-level sections
 * first, then each tab's sections in turn, and reports back which one (if
 * either) actually changed.
 */
export interface StampTarget {
  sections: Section[]
  tabs: TabsConfig | null
}

function mutateWherever(
  target: StampTarget,
  mutate: (sections: Section[]) => Section[] | null,
): StampTarget | null {
  const nextSections = mutate(target.sections)
  if (nextSections) return { sections: nextSections, tabs: target.tabs }

  const tabsConfig = target.tabs
  if (!tabsConfig) return null

  for (let i = 0; i < tabsConfig.tabs.length; i++) {
    const nextTabSections = mutate(tabsConfig.tabs[i].sections)
    if (!nextTabSections) continue
    return {
      sections: target.sections,
      tabs: {
        ...tabsConfig,
        tabs: tabsConfig.tabs.map((tab, idx) => (idx === i ? { ...tab, sections: nextTabSections } : tab)),
      },
    }
  }
  return null
}

/** Like `setStamp`, but reaches into tabs too. Null if the id is absent from both. */
export function setStampAnywhere(
  target: StampTarget,
  elementId: string,
  stampedAt: string,
  stampedTz?: string,
): StampTarget | null {
  return mutateWherever(target, (sections) => setStamp(sections, elementId, stampedAt, stampedTz))
}

/** Like `clearStamp`, but reaches into tabs too. Null if the id is absent from both. */
export function clearStampAnywhere(target: StampTarget, elementId: string): StampTarget | null {
  return mutateWherever(target, (sections) => clearStamp(sections, elementId))
}

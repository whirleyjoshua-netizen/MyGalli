import type { Section, CanvasElement, LayoutMode, ElementType } from '@/lib/types/canvas'

export interface ElementListRow {
  sectionId: string
  columnId: string
  element: CanvasElement
}

export interface ElementListGroup {
  sectionId: string
  layout: LayoutMode
  index: number
  rows: ElementListRow[]
}

export function buildElementList(sections: Section[]): ElementListGroup[] {
  return sections.map((section, i) => ({
    sectionId: section.id,
    layout: section.layout,
    index: i + 1,
    rows: section.columns.flatMap((column) =>
      column.elements.map((element) => ({
        sectionId: section.id,
        columnId: column.id,
        element,
      })),
    ),
  }))
}

// Turn an element type slug into a human label: 'wedding-rsvp' -> 'Wedding RSVP'.
const ACRONYMS = new Set(['kpi', 'mcq', 'gpa', 'rsvp', 'id'])

export function elementTypeLabel(type: ElementType): string {
  return type
    .split('-')
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

// A short content hint per element, when one is readily available.
function contentHint(element: CanvasElement): string | undefined {
  switch (element.type) {
    case 'heading':
    case 'text':
      return element.content || undefined
    case 'kpi':
      return element.kpiLabel || undefined
    case 'button':
      return element.buttonText || undefined
    case 'image':
      return element.url ? element.url.split('/').pop() : undefined
    case 'quote':
      return element.quoteText || undefined
    case 'rsvp':
      return element.rsvpSubject || undefined
    default:
      return undefined
  }
}

export function elementRowLabel(element: CanvasElement): string {
  const base = elementTypeLabel(element.type)
  const hint = contentHint(element)
  return hint ? `${base} — ${hint}` : base
}

export type EditorSelection =
  | { kind: 'element'; sectionId: string; columnId: string; elementId: string }
  | { kind: 'section'; sectionId: string }
  | null

export function selectedElementId(sel: EditorSelection): string | null {
  return sel && sel.kind === 'element' ? sel.elementId : null
}

export function isElementSelected(sel: EditorSelection, elementId: string): boolean {
  return selectedElementId(sel) === elementId
}

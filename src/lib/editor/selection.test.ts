import { describe, it, expect } from 'vitest'
import { isElementSelected, selectedElementId, type EditorSelection } from './selection'

describe('selection helpers', () => {
  const elSel: EditorSelection = { kind: 'element', sectionId: 's1', columnId: 'c1', elementId: 'e1' }

  it('selectedElementId returns the id for an element selection', () => {
    expect(selectedElementId(elSel)).toBe('e1')
  })
  it('selectedElementId returns null for a section or empty selection', () => {
    expect(selectedElementId({ kind: 'section', sectionId: 's1' })).toBeNull()
    expect(selectedElementId(null)).toBeNull()
  })
  it('isElementSelected matches only the selected element id', () => {
    expect(isElementSelected(elSel, 'e1')).toBe(true)
    expect(isElementSelected(elSel, 'e2')).toBe(false)
    expect(isElementSelected(null, 'e1')).toBe(false)
  })
})

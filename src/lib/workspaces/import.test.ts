import { describe, it, expect } from 'vitest'
import { autoMatchColumns, validateImportRows, type ImportField } from './import'

const fields: ImportField[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'gpa', label: 'GPA', type: 'number' },
  { key: 'grade', label: 'Grade', type: 'choice', config: { options: ['9', '10', '11', '12'] } },
]

describe('autoMatchColumns', () => {
  it('matches on label case-insensitively, then on key', () => {
    expect(autoMatchColumns(['Name', 'gpa', 'GRADE'], fields)).toEqual({ Name: 'name', gpa: 'gpa', GRADE: 'grade' })
  })
  it('returns null for an unmatched header', () => {
    expect(autoMatchColumns(['Nickname'], fields)).toEqual({ Nickname: null })
  })
  it('gives a field to the first header only when two headers match the same field', () => {
    const m = autoMatchColumns(['Name', 'name'], fields)
    expect(m.Name).toBe('name')
    expect(m.name).toBeNull()
  })
})

describe('validateImportRows', () => {
  it('coerces valid rows and returns them ready to insert', () => {
    const r = validateImportRows(fields, [{ name: 'Ava', gpa: '3.8', grade: '11' }])
    expect(r.valid).toEqual([{ name: 'Ava', gpa: 3.8, grade: '11' }]) // gpa coerced to number
    expect(r.validCount).toBe(1)
    expect(r.skippedCount).toBe(0)
    expect(r.errors).toEqual([])
  })
  it('skips a row with a bad cell and reports it with a 1-based row number', () => {
    const r = validateImportRows(fields, [
      { name: 'Ava', gpa: '3.8', grade: '11' },
      { name: 'Bad', gpa: 'N/A', grade: '11' },
    ])
    expect(r.validCount).toBe(1)
    expect(r.skippedCount).toBe(1)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatchObject({ row: 2, field: 'gpa' })
    expect(r.errors[0].message).toBeTruthy()
  })
  it('reports a value not in a choice field options', () => {
    const r = validateImportRows(fields, [{ name: 'X', gpa: '3', grade: '13' }])
    expect(r.skippedCount).toBe(1)
    expect(r.errors[0]).toMatchObject({ row: 1, field: 'grade' })
  })
  it('handles an empty rows list', () => {
    expect(validateImportRows(fields, [])).toEqual({ valid: [], errors: [], validCount: 0, skippedCount: 0 })
  })
})

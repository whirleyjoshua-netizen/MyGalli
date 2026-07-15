import { describe, it, expect } from 'vitest'
import { validateFilter, FilterError, type FilterField } from './filter'

const fields: FilterField[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'sport', label: 'Sport', type: 'choice', config: { options: ['Soccer', 'Tennis'] } },
  { key: 'fee', label: 'Fee', type: 'currency', config: { symbol: '$' } },
  { key: 'active', label: 'Active', type: 'checkbox' },
]

describe('validateFilter', () => {
  it('accepts a valid and-filter', () => {
    const spec = { op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] }
    expect(validateFilter(spec, fields)).toEqual({
      op: 'and',
      conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }],
    })
  })

  it('coerces a numeric string to a number for a currency field', () => {
    const spec = { op: 'and', conditions: [{ field: 'fee', cmp: 'gt', value: '1200' }] }
    expect(validateFilter(spec, fields).conditions[0].value).toBe(1200)
  })

  it('coerces to boolean for a checkbox field', () => {
    const spec = { op: 'and', conditions: [{ field: 'active', cmp: 'eq', value: 'true' }] }
    expect(validateFilter(spec, fields).conditions[0].value).toBe(true)
  })

  it('rejects an unknown field', () => {
    const spec = { op: 'and', conditions: [{ field: 'ghost', cmp: 'eq', value: 'x' }] }
    expect(() => validateFilter(spec, fields)).toThrow(FilterError)
    expect(() => validateFilter(spec, fields)).toThrow(/Unknown field: ghost/)
  })

  it('rejects a comparator illegal for the field type', () => {
    const spec = { op: 'and', conditions: [{ field: 'sport', cmp: 'gt', value: 'Soccer' }] }
    expect(() => validateFilter(spec, fields)).toThrow(/cannot use "gt"/)
  })

  it('rejects a choice value that is not an option', () => {
    const spec = { op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Cricket' }] }
    expect(() => validateFilter(spec, fields)).toThrow(/not an option/)
  })

  it('rejects a non-numeric value for a number field', () => {
    const spec = { op: 'and', conditions: [{ field: 'fee', cmp: 'gt', value: 'lots' }] }
    expect(() => validateFilter(spec, fields)).toThrow(/not a number/)
  })

  it('rejects a bad op, empty conditions, and non-objects', () => {
    expect(() => validateFilter({ op: 'xor', conditions: [] }, fields)).toThrow(/op must be/)
    expect(() => validateFilter({ op: 'and', conditions: [] }, fields)).toThrow(/at least one condition/)
    expect(() => validateFilter(null, fields)).toThrow(FilterError)
  })
})

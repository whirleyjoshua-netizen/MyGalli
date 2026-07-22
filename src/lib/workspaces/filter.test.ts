import { describe, it, expect } from 'vitest'
import { validateFilter, validateSort, FilterError, describeFilter, allowedCmps, type FilterField } from './filter'

const fields: FilterField[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'sport', label: 'Sport', type: 'choice', config: { options: ['Soccer', 'Tennis'] } },
  { key: 'fee', label: 'Fee', type: 'currency', config: { symbol: '$' } },
  { key: 'active', label: 'Active', type: 'checkbox' },
  { key: 'startDate', label: 'Start Date', type: 'date' },
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

  it('rejects an array value for a currency field instead of coercing it', () => {
    const spec = { op: 'and', conditions: [{ field: 'fee', cmp: 'gt', value: ['1', '2'] }] }
    expect(() => validateFilter(spec, fields)).toThrow(FilterError)
  })

  it('rejects an object value for a text field', () => {
    const spec = { op: 'and', conditions: [{ field: 'name', cmp: 'eq', value: {} }] }
    expect(() => validateFilter(spec, fields)).toThrow(FilterError)
  })

  it('rejects a non-date string for a date field', () => {
    const spec = { op: 'and', conditions: [{ field: 'startDate', cmp: 'gt', value: 'banana' }] }
    expect(() => validateFilter(spec, fields)).toThrow(/YYYY-MM-DD/)
  })

  it('accepts a valid date string for a date field and returns it unchanged', () => {
    const spec = { op: 'and', conditions: [{ field: 'startDate', cmp: 'gt', value: '2026-01-15' }] }
    expect(validateFilter(spec, fields).conditions[0].value).toBe('2026-01-15')
  })

  it('rejects a non-ISO date format like MM/DD/YYYY (Finding: ambiguous date format matches every row)', () => {
    // Dates compare lexicographically as raw JSONB strings, so a format like
    // "07/01/2026" would be lexicographically greater than every "2026-…"
    // stored value — silently matching every row for a "gt" filter.
    const spec = { op: 'and', conditions: [{ field: 'startDate', cmp: 'gt', value: '07/01/2026' }] }
    expect(() => validateFilter(spec, fields)).toThrow(FilterError)
    expect(() => validateFilter(spec, fields)).toThrow(/YYYY-MM-DD/)
  })

  it('accepts a well-formed ISO date and returns it unchanged', () => {
    const spec = { op: 'and', conditions: [{ field: 'startDate', cmp: 'gt', value: '2026-07-01' }] }
    expect(validateFilter(spec, fields).conditions[0].value).toBe('2026-07-01')
  })

  it('rejects an ISO-shaped but invalid calendar date', () => {
    const spec = { op: 'and', conditions: [{ field: 'startDate', cmp: 'gt', value: '2026-13-45' }] }
    expect(() => validateFilter(spec, fields)).toThrow(FilterError)
  })
})

describe('is_empty / is_not_empty', () => {
  it('offers both comparators for every field type', () => {
    for (const type of ['text', 'number', 'currency', 'date', 'choice', 'checkbox', 'url', 'email']) {
      expect(allowedCmps(type)).toContain('is_empty')
      expect(allowedCmps(type)).toContain('is_not_empty')
    }
  })

  it('accepts a condition with no value at all', () => {
    const spec = { op: 'and', conditions: [{ field: 'startDate', cmp: 'is_empty' }] }
    expect(validateFilter(spec, fields)).toEqual({
      op: 'and',
      conditions: [{ field: 'startDate', cmp: 'is_empty' }],
    })
  })

  it('strips a value the caller supplied anyway', () => {
    // The AI path's structured-output schema forces a `value` property, so the
    // model always sends one. It must never reach the SQL builder.
    const spec = { op: 'and', conditions: [{ field: 'startDate', cmp: 'is_not_empty', value: 'ignored' }] }
    const out = validateFilter(spec, fields)
    expect(out.conditions[0]).toEqual({ field: 'startDate', cmp: 'is_not_empty' })
    expect(out.conditions[0]).not.toHaveProperty('value')
  })

  it('does not run type coercion on a value-less condition', () => {
    // 'not-a-date' would throw for a date field under the normal value path.
    const spec = { op: 'and', conditions: [{ field: 'startDate', cmp: 'is_empty', value: 'not-a-date' }] }
    expect(() => validateFilter(spec, fields)).not.toThrow()
  })

  it('still rejects an unknown field for a value-less comparator', () => {
    const spec = { op: 'and', conditions: [{ field: 'nope', cmp: 'is_empty' }] }
    expect(() => validateFilter(spec, fields)).toThrow(FilterError)
  })

  it('describes them without a trailing value', () => {
    const spec = validateFilter({ op: 'and', conditions: [{ field: 'startDate', cmp: 'is_empty' }] }, fields)
    expect(describeFilter(spec, fields)).toBe('Start Date is empty')
  })

  it('describes them alongside a valued condition', () => {
    const spec = validateFilter(
      { op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }, { field: 'startDate', cmp: 'is_empty' }] },
      fields
    )
    expect(describeFilter(spec, fields)).toBe('Sport is Soccer and Start Date is empty')
  })
})

describe('describeFilter', () => {
  it('renders labels and formatted values, not raw keys', () => {
    const spec = validateFilter(
      { op: 'and', conditions: [
        { field: 'sport', cmp: 'eq', value: 'Soccer' },
        { field: 'fee', cmp: 'gt', value: 1200 },
      ] },
      fields
    )
    expect(describeFilter(spec, fields)).toBe('Sport is Soccer and Fee > $1,200')
  })

  it('joins or-conditions with "or"', () => {
    const spec = validateFilter(
      { op: 'or', conditions: [
        { field: 'sport', cmp: 'eq', value: 'Soccer' },
        { field: 'sport', cmp: 'eq', value: 'Tennis' },
      ] },
      fields
    )
    expect(describeFilter(spec, fields)).toBe('Sport is Soccer or Sport is Tennis')
  })
})

describe('validateSort', () => {
  it('accepts a valid sort and returns it normalized', () => {
    expect(validateSort({ field: 'fee', dir: 'desc' }, fields)).toEqual({ field: 'fee', dir: 'desc' })
  })
  it('rejects an unknown field', () => {
    expect(() => validateSort({ field: 'ghost', dir: 'asc' }, fields)).toThrow(FilterError)
    expect(() => validateSort({ field: 'ghost', dir: 'asc' }, fields)).toThrow(/Unknown field/)
  })
  it('rejects a bad direction', () => {
    expect(() => validateSort({ field: 'fee', dir: 'sideways' }, fields)).toThrow(/direction/)
  })
  it('rejects a non-object', () => {
    expect(() => validateSort(null, fields)).toThrow(FilterError)
  })
})

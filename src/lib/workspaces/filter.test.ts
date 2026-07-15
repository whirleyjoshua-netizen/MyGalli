import { describe, it, expect } from 'vitest'
import { validateFilter, FilterError, filterToPrismaWhere, describeFilter, type FilterField } from './filter'

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

describe('filterToPrismaWhere', () => {
  it('maps an and-filter to Prisma JSONB path conditions', () => {
    const spec = validateFilter(
      { op: 'and', conditions: [
        { field: 'sport', cmp: 'eq', value: 'Soccer' },
        { field: 'fee', cmp: 'gt', value: 1200 },
      ] },
      fields
    )
    expect(filterToPrismaWhere(spec)).toEqual({
      AND: [
        { data: { path: ['sport'], equals: 'Soccer' } },
        { data: { path: ['fee'], gt: 1200 } },
      ],
    })
  })

  it('maps an or-filter to OR', () => {
    const spec = validateFilter(
      { op: 'or', conditions: [{ field: 'sport', cmp: 'eq', value: 'Tennis' }] },
      fields
    )
    expect(filterToPrismaWhere(spec)).toEqual({
      OR: [{ data: { path: ['sport'], equals: 'Tennis' } }],
    })
  })

  it('maps neq to a negated equals and contains to string_contains', () => {
    const spec = validateFilter(
      { op: 'and', conditions: [
        { field: 'sport', cmp: 'neq', value: 'Soccer' },
        { field: 'name', cmp: 'contains', value: 'jord' },
      ] },
      fields
    )
    expect(filterToPrismaWhere(spec)).toEqual({
      AND: [
        { NOT: { data: { path: ['sport'], equals: 'Soccer' } } },
        { data: { path: ['name'], string_contains: 'jord' } },
      ],
    })
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

export type Cmp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'
export type Condition = { field: string; cmp: Cmp; value: string | number | boolean }
export type FilterSpec = { op: 'and' | 'or'; conditions: Condition[] }
export type FilterField = { key: string; label: string; type: string; config?: any }

export class FilterError extends Error {}

const TEXTUAL = ['text', 'url', 'email']
const NUMERIC = ['number', 'currency', 'percent', 'rating']
const ORDERED = [...NUMERIC, 'date']

/** Comparators each field type is allowed to use. */
export function allowedCmps(type: string): Cmp[] {
  if (TEXTUAL.includes(type)) return ['eq', 'neq', 'contains']
  if (ORDERED.includes(type)) return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte']
  if (type === 'choice') return ['eq', 'neq']
  if (type === 'checkbox') return ['eq', 'neq']
  return []
}

/**
 * Validates an untrusted filter spec (typically model output) against the real
 * workspace schema, returning a normalized spec with values coerced to the
 * field's type. Throws FilterError on anything it cannot vouch for — this is
 * what stops an invented field name from reaching a JSONB path query.
 */
export function validateFilter(spec: unknown, fields: FilterField[]): FilterSpec {
  if (!spec || typeof spec !== 'object') throw new FilterError('Filter must be an object')
  const { op, conditions } = spec as any

  if (op !== 'and' && op !== 'or') throw new FilterError('Filter op must be "and" or "or"')
  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new FilterError('Filter needs at least one condition')
  }

  const out: Condition[] = conditions.map((c: any) => {
    if (!c || typeof c !== 'object') throw new FilterError('Each condition must be an object')
    const field = fields.find((f) => f.key === c.field)
    if (!field) throw new FilterError(`Unknown field: ${c.field}`)

    const legal = allowedCmps(field.type)
    if (!legal.includes(c.cmp)) {
      throw new FilterError(`"${field.label}" cannot use "${c.cmp}"`)
    }

    return { field: field.key, cmp: c.cmp, value: coerce(field, c.value) }
  })

  return { op, conditions: out }
}

function coerce(field: FilterField, value: unknown): string | number | boolean {
  if (value === null || value === undefined) {
    throw new FilterError(`"${field.label}" needs a value`)
  }
  if (NUMERIC.includes(field.type)) {
    const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,%\s]/g, ''))
    if (!Number.isFinite(n)) throw new FilterError(`"${field.label}" is not a number: ${value}`)
    return n
  }
  if (field.type === 'checkbox') {
    if (typeof value === 'boolean') return value
    const s = String(value).toLowerCase()
    if (s === 'true') return true
    if (s === 'false') return false
    throw new FilterError(`"${field.label}" is not a boolean: ${value}`)
  }
  if (field.type === 'choice') {
    const options: string[] = field.config?.options ?? []
    const s = String(value)
    const match = options.find((o) => o.toLowerCase() === s.toLowerCase())
    if (!match) throw new FilterError(`"${s}" is not an option for "${field.label}"`)
    return match
  }
  return String(value)
}

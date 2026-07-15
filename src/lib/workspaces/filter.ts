import { formatFieldValue } from './format-value'

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
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    throw new FilterError(`"${field.label}" has an invalid value`)
  }
  if (field.type === 'date') {
    // Dates are stored as yyyy-MM-dd strings and compared lexicographically
    // via a raw JSONB string comparison (see filterToPrismaWhere) — that
    // ordering is only correct for ISO form. Accepting anything Date.parse
    // swallows (e.g. "07/01/2026") and passing it through verbatim would let
    // an ambiguous format compare lexicographically against every ISO row,
    // matching (or excluding) far more than intended. So we reject rather
    // than reformat: reformatting a parsed date risks timezone bugs, and
    // rejecting is honest about what the comparison actually does.
    const s = String(value).trim()
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
    if (!ISO_DATE.test(s) || Number.isNaN(Date.parse(s))) {
      throw new FilterError(`"${field.label}" needs a date in YYYY-MM-DD form, got: ${value}`)
    }
    return s
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

/**
 * Translates a VALIDATED spec into a Prisma where-fragment over the JSONB
 * `data` column. Only ever call this with the output of validateFilter — it
 * trusts field keys and value types to have been checked already.
 */
export function filterToPrismaWhere(spec: FilterSpec): Record<string, any> {
  const clauses = spec.conditions.map((c) => conditionToPrisma(c))
  return spec.op === 'or' ? { OR: clauses } : { AND: clauses }
}

function conditionToPrisma(c: Condition): Record<string, any> {
  const path = [c.field]
  switch (c.cmp) {
    case 'eq':
      return { data: { path, equals: c.value } }
    case 'neq':
      return { NOT: { data: { path, equals: c.value } } }
    case 'contains':
      return { data: { path, string_contains: c.value } }
    case 'gt':
      return { data: { path, gt: c.value } }
    case 'gte':
      return { data: { path, gte: c.value } }
    case 'lt':
      return { data: { path, lt: c.value } }
    case 'lte':
      return { data: { path, lte: c.value } }
  }
}

const CMP_WORDS: Record<Cmp, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
}

/** Plain-language rendering of a filter, for the confirmation chips. */
export function describeFilter(spec: FilterSpec, fields: FilterField[]): string {
  const parts = spec.conditions.map((c) => {
    const field = fields.find((f) => f.key === c.field)
    const label = field?.label ?? c.field
    const shown = field ? formatFieldValue(field.type, c.value, field.config) : String(c.value)
    return `${label} ${CMP_WORDS[c.cmp]} ${shown || String(c.value)}`
  })
  return parts.join(spec.op === 'or' ? ' or ' : ' and ')
}

import type { FilterSpec, FilterField, Condition, SortSpec } from './filter'

export type BuildInput = {
  workspaceId: string
  fields: FilterField[]
  filter?: FilterSpec | null
  search?: string | null
  sort?: SortSpec | null
  page: number
  pageSize: number
}
export type BuiltQuery = { sql: string; params: any[]; countSql: string; countParams: any[] }

const NUMERIC = ['number', 'currency', 'percent', 'rating']

/** Escape LIKE/ILIKE metacharacters so they are matched literally. */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => '\\' + c)
}

/**
 * Builds a parameterized records query + matching count query over the JSONB
 * `data` column. INPUT MUST ALREADY BE VALIDATED (validateFilter / validateSort):
 * this function trusts field keys and value types and only ever emits bound
 * parameters for user data. See records-query.test.ts for the injection guarantee.
 */
export function buildRecordsQuery(input: BuildInput): BuiltQuery {
  const { workspaceId, fields, filter, search, sort, page, pageSize } = input

  // ---- WHERE (shared by records + count) ----
  const whereParams: any[] = []
  const wp = (v: any) => { whereParams.push(v); return `$${whereParams.length}` }

  const wheres: string[] = [`"workspaceId" = ${wp(workspaceId)}`, `status = 'active'`]

  if (filter && filter.conditions.length) {
    const clauses = filter.conditions.map((c) => conditionSql(c, fields, wp))
    wheres.push(`(${clauses.join(filter.op === 'or' ? ' OR ' : ' AND ')})`)
  }

  if (search && search.trim()) {
    const term = '%' + escapeLike(search.trim()) + '%'
    wheres.push(`EXISTS (SELECT 1 FROM jsonb_each_text(data) WHERE value ILIKE ${wp(term)})`)
  }

  const whereSql = wheres.join(' AND ')
  const countSql = `SELECT count(*)::int AS count FROM "WorkspaceRecord" WHERE ${whereSql}`
  const countParams = [...whereParams]

  // ---- records: WHERE + ORDER BY + LIMIT/OFFSET (params continue numbering) ----
  const params = [...whereParams]
  const rp = (v: any) => { params.push(v); return `$${params.length}` }

  const orderSql = sortSql(sort, fields, rp)
  const offset = (page - 1) * pageSize
  const sql =
    `SELECT id, data, "updatedAt" FROM "WorkspaceRecord" WHERE ${whereSql} ` +
    `${orderSql} LIMIT ${rp(pageSize)} OFFSET ${rp(offset)}`

  return { sql, params, countSql, countParams }
}

function conditionSql(c: Condition, fields: FilterField[], p: (v: any) => string): string {
  const field = fields.find((f) => f.key === c.field)!
  const numeric = NUMERIC.includes(field.type)
  const lhs = `data->>${p(c.field)}`
  switch (c.cmp) {
    case 'eq': return `${lhs} = ${p(c.value)}`
    case 'neq': return `NOT (${lhs} = ${p(c.value)})`
    // Match E's string_contains (case-sensitive, %/_ in the value act as wildcards
    // exactly as Prisma's string_contains does — so wrap WITHOUT escaping).
    case 'contains': return `${lhs} LIKE ${p('%' + c.value + '%')}`
    case 'gt': return numeric ? `(${lhs})::numeric > ${p(c.value)}` : `${lhs} > ${p(c.value)}`
    case 'gte': return numeric ? `(${lhs})::numeric >= ${p(c.value)}` : `${lhs} >= ${p(c.value)}`
    case 'lt': return numeric ? `(${lhs})::numeric < ${p(c.value)}` : `${lhs} < ${p(c.value)}`
    case 'lte': return numeric ? `(${lhs})::numeric <= ${p(c.value)}` : `${lhs} <= ${p(c.value)}`
  }
}

function sortSql(sort: SortSpec | null | undefined, fields: FilterField[], p: (v: any) => string): string {
  if (!sort) return `ORDER BY "createdAt" ASC`
  const field = fields.find((f) => f.key === sort.field)!
  const dir = sort.dir === 'desc' ? 'DESC' : 'ASC'
  const keyP = p(sort.field)
  const expr = NUMERIC.includes(field.type) ? `(data->>${keyP})::numeric` : `data->>${keyP}`
  return `ORDER BY ${expr} ${dir} NULLS LAST, "createdAt" ASC`
}

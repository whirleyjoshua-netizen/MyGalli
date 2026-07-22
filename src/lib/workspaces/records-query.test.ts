import { describe, it, expect } from 'vitest'
import { buildRecordsQuery } from './records-query'
import type { FilterField } from './filter'

const fields: FilterField[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'sport', label: 'Sport', type: 'choice', config: { options: ['Soccer', 'Tennis'] } },
  { key: 'fee', label: 'Fee', type: 'currency', config: { symbol: '$' } },
  { key: 'due', label: 'Due', type: 'date' },
]
const base = { workspaceId: 'w1', fields, page: 1, pageSize: 100 }

describe('buildRecordsQuery', () => {
  it('base query: workspace + active status, default createdAt asc, LIMIT/OFFSET', () => {
    const q = buildRecordsQuery({ ...base })
    expect(q.sql).toBe(
      'SELECT id, data, "updatedAt" FROM "WorkspaceRecord" WHERE "workspaceId" = $1 AND status = \'active\' ' +
      'ORDER BY "createdAt" ASC LIMIT $2 OFFSET $3'
    )
    expect(q.params).toEqual(['w1', 100, 0])
    expect(q.countSql).toBe('SELECT count(*)::int AS count FROM "WorkspaceRecord" WHERE "workspaceId" = $1 AND status = \'active\'')
    expect(q.countParams).toEqual(['w1'])
  })

  it('numeric sort desc casts ::numeric, NULLS LAST, createdAt tiebreaker', () => {
    const q = buildRecordsQuery({ ...base, sort: { field: 'fee', dir: 'desc' } })
    expect(q.sql).toContain('ORDER BY (data->>$2)::numeric DESC NULLS LAST, "createdAt" ASC')
    // key is a param, not interpolated:
    expect(q.params).toEqual(['w1', 'fee', 100, 0])
  })

  it('text sort asc does not cast', () => {
    const q = buildRecordsQuery({ ...base, sort: { field: 'name', dir: 'asc' } })
    expect(q.sql).toContain('ORDER BY data->>$2 ASC NULLS LAST, "createdAt" ASC')
  })

  it('date sort is text (ISO lexicographic), no ::date cast', () => {
    const q = buildRecordsQuery({ ...base, sort: { field: 'due', dir: 'asc' } })
    expect(q.sql).toContain('ORDER BY data->>$2 ASC NULLS LAST')
    expect(q.sql).not.toContain('::date')
  })

  it('search adds a value-only ILIKE EXISTS with an escaped, wrapped param', () => {
    const q = buildRecordsQuery({ ...base, search: '50%_off' })
    expect(q.sql).toContain("EXISTS (SELECT 1 FROM jsonb_each_text(data) WHERE value ILIKE $2)")
    // %, _ and \ in the term are escaped so they are literal; wrapped in %...%
    expect(q.countParams).toEqual(['w1', '%50\\%\\_off%'])
  })

  it('filter: eq/neq/contains/numeric map to E-equivalent SQL, every value a param', () => {
    const q = buildRecordsQuery({
      ...base,
      filter: { op: 'and', conditions: [
        { field: 'sport', cmp: 'eq', value: 'Soccer' },
        { field: 'fee', cmp: 'gt', value: 1200 },
        { field: 'name', cmp: 'contains', value: 'jo' },
        { field: 'sport', cmp: 'neq', value: 'Tennis' },
      ] },
    })
    expect(q.sql).toContain(
      '(data->>$2 = $3 AND (data->>$4)::numeric > $5 AND data->>$6 LIKE $7 AND (data->>$8 IS NULL OR NOT (data->>$8 = $9)))'
    )
    // keys and values are all params; count shares them
    expect(q.countParams).toEqual(['w1', 'sport', 'Soccer', 'fee', 1200, 'name', '%jo%', 'sport', 'Tennis'])
  })

  it('numeric eq casts data->>key to ::numeric before comparison', () => {
    const q = buildRecordsQuery({
      ...base,
      filter: { op: 'and', conditions: [{ field: 'fee', cmp: 'eq', value: 1200 }] },
    })
    expect(q.sql).toContain('(data->>$2)::numeric = $3')
  })

  it('numeric neq casts data->>key to ::numeric before comparison', () => {
    const q = buildRecordsQuery({
      ...base,
      filter: { op: 'and', conditions: [{ field: 'fee', cmp: 'neq', value: 1200 }] },
    })
    expect(q.sql).toContain('NOT ((data->>$2)::numeric = $3)')
  })

  it('text/choice eq does not cast (plain text comparison)', () => {
    const q = buildRecordsQuery({
      ...base,
      filter: { op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] },
    })
    expect(q.sql).toContain('data->>$2 = $3')
    expect(q.sql).not.toContain('::numeric')
  })

  it('numeric gte/lte cast to ::numeric', () => {
    const q = buildRecordsQuery({
      ...base,
      filter: { op: 'and', conditions: [
        { field: 'fee', cmp: 'gte', value: 100 },
        { field: 'fee', cmp: 'lte', value: 500 },
      ] },
    })
    expect(q.sql).toContain('(data->>$2)::numeric >= $3')
    expect(q.sql).toContain('(data->>$4)::numeric <= $5')
  })

  it('or-filter joins with OR', () => {
    const q = buildRecordsQuery({
      ...base,
      filter: { op: 'or', conditions: [
        { field: 'sport', cmp: 'eq', value: 'Soccer' },
        { field: 'sport', cmp: 'eq', value: 'Tennis' },
      ] },
    })
    expect(q.sql).toContain('(data->>$2 = $3 OR data->>$4 = $5)')
  })

  it('pagination: page 2 offsets by pageSize', () => {
    const q = buildRecordsQuery({ ...base, page: 2, pageSize: 100 })
    expect(q.params.slice(-2)).toEqual([100, 100]) // LIMIT 100 OFFSET 100
  })

  it('INJECTION GUARANTEE: no user value appears in the SQL string', () => {
    const q = buildRecordsQuery({
      ...base,
      filter: { op: 'and', conditions: [{ field: 'name', cmp: 'eq', value: "'; DROP TABLE x; --" }] },
      search: "'; DROP TABLE y; --",
      sort: { field: 'fee', dir: 'desc' },
    })
    expect(q.sql).not.toContain('DROP TABLE')
    expect(q.countSql).not.toContain('DROP TABLE')
    // the malicious strings live only in params
    expect(q.params).toContain("'; DROP TABLE x; --")
  })
})

describe('is_empty / is_not_empty', () => {
  it('is_empty covers missing key, JSON null and empty string in one clause', () => {
    const q = buildRecordsQuery({ ...base, filter: { op: 'and', conditions: [{ field: 'due', cmp: 'is_empty' }] } })
    expect(q.countSql).toContain('(data->>$2 IS NULL OR data->>$2 = \'\')')
    // the field key is bound ONCE and referenced twice
    expect(q.countParams).toEqual(['w1', 'due'])
  })

  it('is_not_empty is the exact negation', () => {
    const q = buildRecordsQuery({ ...base, filter: { op: 'and', conditions: [{ field: 'due', cmp: 'is_not_empty' }] } })
    expect(q.countSql).toContain('(data->>$2 IS NOT NULL AND data->>$2 <> \'\')')
    expect(q.countParams).toEqual(['w1', 'due'])
  })

  it('binds no value parameter for a value-less comparator', () => {
    const q = buildRecordsQuery({ ...base, filter: { op: 'and', conditions: [{ field: 'name', cmp: 'is_empty' }] } })
    expect(q.countParams).toHaveLength(2) // workspaceId + field key only
  })
})

describe('neq includes empty cells', () => {
  it('text neq also matches rows where the field is absent', () => {
    const q = buildRecordsQuery({ ...base, filter: { op: 'and', conditions: [{ field: 'sport', cmp: 'neq', value: 'Soccer' }] } })
    expect(q.countSql).toContain('(data->>$2 IS NULL OR NOT (data->>$2 = $3))')
  })

  it('numeric neq also matches rows where the field is absent', () => {
    const q = buildRecordsQuery({ ...base, filter: { op: 'and', conditions: [{ field: 'fee', cmp: 'neq', value: 100 }] } })
    expect(q.countSql).toContain('(data->>$2 IS NULL OR NOT ((data->>$2)::numeric = $3))')
  })
})

describe('contains matches literally', () => {
  it('escapes LIKE metacharacters so % is not a wildcard', () => {
    const q = buildRecordsQuery({ ...base, filter: { op: 'and', conditions: [{ field: 'name', cmp: 'contains', value: '50%' }] } })
    expect(q.countParams).toEqual(['w1', 'name', '%50\\%%'])
  })

  it('escapes underscores too', () => {
    const q = buildRecordsQuery({ ...base, filter: { op: 'and', conditions: [{ field: 'name', cmp: 'contains', value: 'a_b' }] } })
    expect(q.countParams).toEqual(['w1', 'name', '%a\\_b%'])
  })
})

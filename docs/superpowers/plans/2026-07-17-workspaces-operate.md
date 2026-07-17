# Workspaces F1 — Operate the Grid (Sort / Search / Pager) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the workspace grid operable — sort by any column (whole dataset), search records by value, and page through all records past the first 100.

**Architecture:** Because Prisma cannot `orderBy` a JSONB path (verified), the per-view records read moves to a single **parameterized raw-SQL query** built by a new pure module `buildRecordsQuery`. Sort persists on `view.config.sort`; search is an ephemeral query param; the pager uses the already-clamped `page`/`pageSize` the endpoint returns a `total` for. `validateFilter` / `validateSort` remain the security boundary and run before any SQL is built.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Prisma/PostgreSQL, Vitest.

**Design ref:** `docs/superpowers/specs/2026-07-17-workspaces-operate-design.md`

## Global Constraints
- **Working directory is the WORKTREE:** `C:/Users/whirl/pages-mvp/.claude/worktrees/e-ai-filter`. `cd` there first. The main checkout at `C:/Users/whirl/pages-mvp` is on `main` and belongs to other agents — never edit it.
- Branch MUST be `workspaces-e-ai-filter`. Run `git branch --show-current` before every commit; if it's anything else, STOP and report BLOCKED (concurrent sessions share this repo).
- Running the suite in this worktree needs `JWT_SECRET` exported first (worktree vitest doesn't load `.env`): `export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"`.
- **Injection rule (non-negotiable):** every user-supplied value — field keys, condition values, search terms, page/size — goes into SQL as a **bound parameter** (`$n`), never string-interpolated. The only things placed into the SQL string from code are fixed operators, the sort direction (from the `'asc'|'desc'` enum → `ASC`/`DESC`), and the sort cast (`::numeric` or none, from a fixed branch on field type).
- Sort/search must reproduce E's filter semantics unchanged: `neq` **excludes** records missing the key; `contains` stays **case-sensitive** (only the new search box is case-insensitive); numeric fields compare/sort numerically, dates as ISO text.
- DB for live checks: `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (127.0.0.1, not localhost), set inline.
- Field type groups (verbatim from `filter.ts`): NUMERIC = `number`,`currency`,`percent`,`rating`; date = `date`; textual = `text`,`url`,`email`; plus `choice`,`checkbox`.
- Never commit: `Documents/`, `Images/`, `g1t.json`, `nul`, `.claude/settings*`, `.env`. tsc + lint + tests must pass.

---

### Task 1: `validateSort` + `SortSpec` in filter.ts (TDD)

The schema-validation boundary for sort, mirroring `validateFilter`.

**Files:**
- Modify: `src/lib/workspaces/filter.ts` (append)
- Modify: `src/lib/workspaces/filter.test.ts` (append)

**Interfaces:**
- Consumes: `FilterField`, `FilterError` (already in `filter.ts`).
- Produces: `export type SortSpec = { field: string; dir: 'asc' | 'desc' }` and `export function validateSort(sort: unknown, fields: FilterField[]): SortSpec` (throws `FilterError` on unknown field or bad dir).

- [ ] **Step 1: Write the failing test** — append to `src/lib/workspaces/filter.test.ts`:

```ts
import { validateSort } from './filter'

describe('validateSort', () => {
  const f = fields // reuse the file's existing `fields` fixture (name/sport/fee/... )
  it('accepts a valid sort and returns it normalized', () => {
    expect(validateSort({ field: 'fee', dir: 'desc' }, f)).toEqual({ field: 'fee', dir: 'desc' })
  })
  it('rejects an unknown field', () => {
    expect(() => validateSort({ field: 'ghost', dir: 'asc' }, f)).toThrow(FilterError)
    expect(() => validateSort({ field: 'ghost', dir: 'asc' }, f)).toThrow(/Unknown field/)
  })
  it('rejects a bad direction', () => {
    expect(() => validateSort({ field: 'fee', dir: 'sideways' }, f)).toThrow(/direction/)
  })
  it('rejects a non-object', () => {
    expect(() => validateSort(null, f)).toThrow(FilterError)
  })
})
```

(If the existing `fields` fixture isn't in scope where you append, reference it as the test file already does — it is declared at module top.)

- [ ] **Step 2: Run → fail**

Run: `export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"; npx vitest run src/lib/workspaces/filter.test.ts`
Expected: FAIL — `validateSort is not a function`.

- [ ] **Step 3: Implement** — append to `src/lib/workspaces/filter.ts`:

```ts
export type SortSpec = { field: string; dir: 'asc' | 'desc' }

/** Validates an untrusted sort spec against the real schema. Throws FilterError. */
export function validateSort(sort: unknown, fields: FilterField[]): SortSpec {
  if (!sort || typeof sort !== 'object') throw new FilterError('Sort must be an object')
  const { field, dir } = sort as any
  if (!fields.find((f) => f.key === field)) throw new FilterError(`Unknown field: ${field}`)
  if (dir !== 'asc' && dir !== 'desc') throw new FilterError('Sort direction must be "asc" or "desc"')
  return { field, dir }
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run src/lib/workspaces/filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must be workspaces-e-ai-filter
git add src/lib/workspaces/filter.ts src/lib/workspaces/filter.test.ts
git commit -m "feat(workspaces): validateSort + SortSpec (schema-checked sort validation)"
```

---

### Task 2: `buildRecordsQuery` pure SQL builder (TDD) — the core

**Files:**
- Create: `src/lib/workspaces/records-query.ts`
- Test: `src/lib/workspaces/records-query.test.ts`

**Interfaces:**
- Consumes: `FilterSpec`, `FilterField`, `Condition`, `SortSpec` from `./filter`.
- Produces:
```ts
export type BuildInput = {
  workspaceId: string
  fields: FilterField[]
  filter?: FilterSpec | null   // already validated
  search?: string | null
  sort?: SortSpec | null       // already validated
  page: number
  pageSize: number
}
export type BuiltQuery = { sql: string; params: any[]; countSql: string; countParams: any[] }
export function buildRecordsQuery(input: BuildInput): BuiltQuery
```
Note: **two param arrays** — `countParams` is the WHERE params only; `params` is WHERE params plus the ORDER BY / LIMIT / OFFSET extras (Postgres rejects binding params a query doesn't reference).

- [ ] **Step 1: Write the failing test** — create `src/lib/workspaces/records-query.test.ts`:

```ts
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
      '(data->>$2 = $3 AND (data->>$4)::numeric > $5 AND data->>$6 LIKE $7 AND NOT (data->>$8 = $9))'
    )
    // keys and values are all params; count shares them
    expect(q.countParams).toEqual(['w1', 'sport', 'Soccer', 'fee', 1200, 'name', '%jo%', 'sport', 'Tennis'])
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
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run src/lib/workspaces/records-query.test.ts`
Expected: FAIL — cannot find module `./records-query`.

- [ ] **Step 3: Implement** — create `src/lib/workspaces/records-query.ts`:

```ts
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
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run src/lib/workspaces/records-query.test.ts`
Expected: PASS — all cases including the injection guarantee.

If the `contains` test expects `%jo%` but your escaping wraps differently, note: filter-`contains` does NOT escape (matches E); only *search* escapes. Keep them distinct as written.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add src/lib/workspaces/records-query.ts src/lib/workspaces/records-query.test.ts
git commit -m "feat(workspaces): buildRecordsQuery — parameterized raw SQL for filter+search+sort+page"
```

---

### Task 3: Rewire `queryWorkspaceView` to raw SQL (TDD)

**Files:**
- Modify: `src/lib/workspaces/query-view.ts`
- Modify: `src/lib/workspaces/query-view.test.ts`

**Interfaces:**
- Consumes: `buildRecordsQuery` (Task 2), `validateFilter`, `validateSort`, `FilterError`.
- Produces: `queryWorkspaceView` gains a `search?: string` option; return adds `sort: SortSpec | null` and `sortError?: string`. Existing return keys unchanged.

- [ ] **Step 1: Update the test** — in `src/lib/workspaces/query-view.test.ts`, change the `@/lib/db` mock so `workspaceRecord` exposes `$queryRawUnsafe`, and add the new assertions. The db mock becomes:

```ts
vi.mock('@/lib/db', () => ({
  db: {
    workspaceView: { findUnique: vi.fn() },
    workspaceField: { findMany: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  },
}))
```
Import `db` and set, in a shared `beforeEach`, a default that returns records then count across the two calls:
```ts
;(db.$queryRawUnsafe as any).mockReset()
;(db.$queryRawUnsafe as any)
  .mockResolvedValueOnce([{ id: 'r1', data: { sport: 'Soccer' }, updatedAt: new Date(0) }]) // records
  .mockResolvedValueOnce([{ count: 1 }])                                                     // count
```
Replace the old `findMany`/`count` based tests. Add these:
```ts
it('runs the built SQL for records and the count SQL for the total', async () => {
  setup({}) // existing helper that mocks view + fields
  const res = await queryWorkspaceView(ARGS)
  const calls = (db.$queryRawUnsafe as any).mock.calls
  expect(calls[0][0]).toMatch(/SELECT id, data, "updatedAt" FROM "WorkspaceRecord"/)
  expect(calls[1][0]).toMatch(/SELECT count\(\*\)::int AS count/)
  expect(res.pagination.total).toBe(1)
})

it('drops a stale sort (unknown field) and surfaces sortError without throwing', async () => {
  setup({ sort: { field: 'deleted_col', dir: 'asc' } })
  const res = await queryWorkspaceView(ARGS)
  expect(res.sort).toBeNull()
  expect(res.sortError).toMatch(/Unknown field/)
  // still queried (unsorted), no throw:
  expect((db.$queryRawUnsafe as any).mock.calls.length).toBe(2)
})

it('passes a valid sort + search through to the query', async () => {
  setup({ sort: { field: 'fee', dir: 'desc' } })
  await queryWorkspaceView({ ...ARGS, search: 'carter' })
  const recordsSql = (db.$queryRawUnsafe as any).mock.calls[0][0]
  expect(recordsSql).toContain('::numeric DESC')
  expect(recordsSql).toContain('jsonb_each_text')
})
```
Adapt `setup(config)` to the file's existing helper shape (it already mocks `workspaceView.findUnique` with a `config` and `workspaceField.findMany`). If `setup` doesn't exist by that name, mirror the file's existing per-test mock style.

- [ ] **Step 2: Run → fail**

Run: `npx vitest run src/lib/workspaces/query-view.test.ts`
Expected: FAIL — `$queryRawUnsafe` not used / `res.sort` undefined.

- [ ] **Step 3: Implement** — in `src/lib/workspaces/query-view.ts`:

Replace the imports line:
```ts
import { validateFilter, validateSort, FilterError, type FilterSpec, type SortSpec } from './filter'
import { buildRecordsQuery } from './records-query'
```
Add `search` to the options type and signature:
```ts
type QueryOptions = {
  workspaceId: string
  viewId: string
  userId: string
  page?: number
  pageSize?: number
  search?: string
}
```
```ts
export async function queryWorkspaceView({
  workspaceId, viewId, userId, page = 1, pageSize = 100, search,
}: QueryOptions) {
```
Replace step 4 (the filter-building + `Promise.all(findMany,count)` block) with:
```ts
  // 4. Validate the view's saved filter + sort (untrusted: columns can change
  //    after they were saved), then build one parameterized SQL query.
  const config = view.config as { visibleFields?: string[]; filter?: unknown; sort?: unknown }

  let filterSpec: FilterSpec | null = null
  let filterError: string | undefined
  if (config?.filter) {
    try { filterSpec = validateFilter(config.filter, fields) }
    catch (e: any) { if (!(e instanceof FilterError)) throw e; filterError = e.message }
  }

  let sortSpec: SortSpec | null = null
  let sortError: string | undefined
  if (config?.sort) {
    try { sortSpec = validateSort(config.sort, fields) }
    catch (e: any) { if (!(e instanceof FilterError)) throw e; sortError = e.message }
  }

  const built = buildRecordsQuery({
    workspaceId, fields, filter: filterSpec, search, sort: sortSpec, page, pageSize,
  })

  const [records, countRows] = await Promise.all([
    db.$queryRawUnsafe(built.sql, ...built.params) as Promise<Array<{ id: string; data: any; updatedAt: Date }>>,
    db.$queryRawUnsafe(built.countSql, ...built.countParams) as Promise<Array<{ count: number }>>,
  ])
  const total = countRows[0]?.count ?? 0
```
Keep step 5 (projection) exactly as-is — it maps `records` and reads `.data`. Then add `sort`/`sortError` to the return object (alongside `filterError`):
```ts
    filterError,
    sort: sortSpec,
    sortError,
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run src/lib/workspaces/query-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add src/lib/workspaces/query-view.ts src/lib/workspaces/query-view.test.ts
git commit -m "feat(workspaces): queryWorkspaceView executes buildRecordsQuery via raw SQL; sort + search"
```

---

### Task 4: Views validate `config.sort`; records route passes `search` (TDD)

**Files:**
- Modify: `src/app/api/workspaces/[id]/views/route.ts` (POST)
- Modify: `src/app/api/workspaces/[id]/views/[viewId]/route.ts` (PATCH)
- Modify: `src/app/api/workspaces/[id]/views/[viewId]/records/route.ts` (search passthrough)
- Modify: `src/app/api/workspaces/[id]/views/route.test.ts`

**Interfaces:**
- Consumes: `validateSort`, `FilterError` from `@/lib/workspaces/filter`.

- [ ] **Step 1: Write the failing test** — append to `src/app/api/workspaces/[id]/views/route.test.ts` (inside the top-level `describe`, matching the file's inline `new Request(...)` + `db.workspace.findUnique` style — do NOT mock `authorizeWorkspace`):

```ts
it('accepts a valid config.sort and stores it', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'u1' })
  ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
  ;(db.workspaceField.findMany as any).mockResolvedValue([{ id: 'f1', key: 'fee', label: 'Fee', type: 'currency' }])
  ;(db.workspaceView.count as any).mockResolvedValue(1)
  ;(db.workspaceView.create as any).mockResolvedValue({ id: 'v9' })
  const req = new Request('http://localhost/api/workspaces/w1/views', {
    method: 'POST',
    body: JSON.stringify({ name: 'Sorted', type: 'grid', config: { sort: { field: 'fee', dir: 'desc' } } }),
  })
  const res = await POST(req as any, ctx)
  expect(res.status).toBe(201)
  expect((db.workspaceView.create as any).mock.calls[0][0].data.config.sort).toEqual({ field: 'fee', dir: 'desc' })
})

it('400s on a sort naming an unknown field', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'u1' })
  ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
  ;(db.workspaceField.findMany as any).mockResolvedValue([{ id: 'f1', key: 'fee', label: 'Fee', type: 'currency' }])
  const req = new Request('http://localhost/api/workspaces/w1/views', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bad', type: 'grid', config: { sort: { field: 'ghost', dir: 'asc' } } }),
  })
  const res = await POST(req as any, ctx)
  expect(res.status).toBe(400)
  expect((await res.json()).error).toMatch(/Unknown field/)
})
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run "src/app/api/workspaces/[id]/views/route.test.ts"`
Expected: FAIL — unknown-field sort returns 201 (sort stored unvalidated).

- [ ] **Step 3: Implement.**

In `src/app/api/workspaces/[id]/views/route.ts`, extend the import:
```ts
import { validateFilter, validateSort, FilterError, type FilterField } from '@/lib/workspaces/filter'
```
Immediately after the existing `storedConfig.filter` validation block (before `// 4. Determine position` / the create), add:
```ts
    if (storedConfig.sort) {
      try {
        storedConfig = { ...storedConfig, sort: validateSort(storedConfig.sort, fields as unknown as FilterField[]) }
      } catch (e: any) {
        if (e instanceof FilterError) return NextResponse.json({ error: e.message }, { status: 400 })
        throw e
      }
    }
```

In `src/app/api/workspaces/[id]/views/[viewId]/route.ts` (PATCH), extend the import the same way and add the identical `storedConfig.sort` block right after its existing `storedConfig.filter` validation block.

In `src/app/api/workspaces/[id]/views/[viewId]/records/route.ts`, read and pass `search`:
```ts
  const search = (searchParams.get('search') || '').slice(0, 200)
```
and add `search` to the `queryWorkspaceView({ ... })` call.

- [ ] **Step 4: Run → pass**

Run: `npx vitest run "src/app/api/workspaces/[id]/views"`
Expected: PASS (existing view + records tests plus the 2 new).

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add "src/app/api/workspaces/[id]/views"
git commit -m "feat(workspaces): validate config.sort on view save; records route search passthrough"
```

---

### Task 5: Hook — page / search / sort state + wiring

**Files:**
- Modify: `src/components/workspaces/useWorkspaceGrid.ts`

**Interfaces:**
- Consumes: existing `updateView(viewId, config)`, `loadViewRecords`, `activeViewId`, `views`.
- Produces: hook return gains `page`, `search`, `setSearch(v)`, `setSort(fieldKey)`, and `sortError`. Records requests include `?page=&search=`; changing view/filter/search resets `page` to 1.

- [ ] **Step 1: Add state.** Alongside the existing `useState`s add:
```ts
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortError, setSortError] = useState<string | null>(null)
```

- [ ] **Step 2: Send page + search in the records fetch, and reset page on view switch.** In `loadViewRecords`, change the fetch URL to include them and capture `sortError`:
```ts
      const qs = new URLSearchParams({ page: String(page), search })
      const res = await fetch(`/api/workspaces/${workspaceId}/views/${viewId}/records?${qs}`)
```
and, in the success branch after the stale-guard, add:
```ts
      setSortError(body.sortError ?? null)
```
Add `page` and `search` to `loadViewRecords`'s dependency array (so it refetches when they change).

Then make the active-view effect reset the page when the *view* changes. The existing per-view effect keys on `[activeViewId, loadViewRecords, viewRecordsNonce]`; add a small effect that resets page to 1 whenever `activeViewId` changes:
```ts
  useEffect(() => { setPage(1) }, [activeViewId])
```
And reset page to 1 whenever `search` changes (so a new search starts at page 1):
```ts
  useEffect(() => { setPage(1) }, [search])
```
(Both are cheap; a redundant setPage(1) is a no-op if already 1.)

- [ ] **Step 3: `setSort` cycles the active view's persisted sort.** Add before the return:
```ts
  const setSort = useCallback((fieldKey: string) => {
    const view = views.find((v) => v.id === activeViewId)
    if (!view) return
    const cur = (view.config as any)?.sort as { field: string; dir: 'asc' | 'desc' } | undefined
    let next: { field: string; dir: 'asc' | 'desc' } | undefined
    if (!cur || cur.field !== fieldKey) next = { field: fieldKey, dir: 'asc' }
    else if (cur.dir === 'asc') next = { field: fieldKey, dir: 'desc' }
    else next = undefined // third click clears
    const nextConfig = { ...(view.config as any) }
    if (next) nextConfig.sort = next
    else delete nextConfig.sort
    updateView(view.id, nextConfig)
  }, [views, activeViewId, updateView])
```

- [ ] **Step 4: Derive `activeSort` and export the new surface.** Before the return, derive the active view's sort so the grid headers can show it:
```ts
  const activeSort = ((views.find((v) => v.id === activeViewId)?.config as any)?.sort ?? null) as
    { field: string; dir: 'asc' | 'desc' } | null
```
Add `page, setPage, search, setSearch, setSort, sortError, activeSort` to the returned object.

- [ ] **Step 5: Verify + commit.**

```bash
export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"
npx tsc --noEmit 2>&1 | grep -iE 'useWorkspaceGrid|workspace' || echo clean
npx vitest run src/components/workspaces
```
Expected: tsc clean for the hook; existing component tests still pass.
```bash
git branch --show-current
git add src/components/workspaces/useWorkspaceGrid.ts
git commit -m "feat(workspaces): hook page/search/sort state + persisted-sort cycling"
```

---

### Task 6: UI — sortable headers, search box, pager

**Files:**
- Modify: `src/components/workspaces/views/GridView.tsx`
- Modify: `src/components/workspaces/WorkspaceViews.tsx`
- Test: `src/components/workspaces/views/GridView.test.tsx` (extend or create)

**Interfaces:**
- Consumes: the hook's `setSort`, active view `config.sort`, `page`, `setPage`, `search`, `setSearch`, `total`, `sortError`.

- [ ] **Step 1: Write a failing component test** — in `src/components/workspaces/views/GridView.test.tsx` add a test that clicking a header calls `grid.setSort` with that field key:

```ts
import { render, screen, fireEvent } from '@testing-library/react'
import { GridView } from './GridView'

function gridStub(over: any = {}) {
  return {
    fields: [{ id: 'f1', key: 'fee', label: 'Fee', type: 'currency', position: 0 }],
    records: [], addRow: vi.fn(), updateCell: vi.fn(), deleteRow: vi.fn(),
    addField: vi.fn(), deleteField: vi.fn(), setSort: vi.fn(),
    activeSort: null, ...over,
  } as any
}

it('clicking a column header calls setSort with the field key', () => {
  const grid = gridStub()
  render(<GridView grid={grid} />)
  fireEvent.click(screen.getByRole('button', { name: /sort by Fee/i }))
  expect(grid.setSort).toHaveBeenCalledWith('fee')
})
```
(Match the actual `GridView` props shape the file uses — it takes `grid`. Pass whatever the current component reads; only add `setSort`/`activeSort`.)

- [ ] **Step 2: Run → fail**

Run: `npx vitest run src/components/workspaces/views/GridView.test.tsx`
Expected: FAIL — no such button / setSort not called.

- [ ] **Step 3: Make headers sortable in `GridView.tsx`.** Each field header label becomes a button that calls `grid.setSort(f.key)` and shows a ▲/▼ when it's the active sort. Read the active sort from the hook as `grid.activeSort` (exposed in Task 5) — no new prop threading. In the header cell:
```tsx
<button
  onClick={() => grid.setSort(f.key)}
  title={`Sort by ${f.label}`}
  className="flex items-center gap-1"
>
  {f.label}
  {grid.activeSort?.field === f.key && (grid.activeSort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
</button>
```
Import `ChevronUp, ChevronDown` from `lucide-react`. Keep the existing delete-column and add-column controls.

- [ ] **Step 4: Run → pass**

Run: `npx vitest run src/components/workspaces/views/GridView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Search box + pager in `WorkspaceViews.tsx`.** Above the active view (near the filter chips) add a search input bound to the hook:
```tsx
<input
  value={grid.search}
  onChange={(e) => grid.setSearch(e.target.value)}
  placeholder="Search records…"
  className="mb-3 w-full max-w-xs rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
/>
```
Add a `sortError` amber notice next to the existing `filterError` one:
```tsx
{grid.sortError && <p className="mb-3 text-sm text-amber-600">This view's sort no longer matches the columns — showing default order.</p>}
```
Below the grid, render the pager when there's a total:
```tsx
{typeof grid.total === 'number' && grid.total > 0 && (() => {
  const from = (grid.page - 1) * 100 + 1
  const to = Math.min(grid.page * 100, grid.total)
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>Showing {from}–{to} of {grid.total}</span>
      <div className="flex gap-2">
        <button disabled={grid.page <= 1} onClick={() => grid.setPage(grid.page - 1)}
          className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">‹ Prev</button>
        <button disabled={to >= grid.total} onClick={() => grid.setPage(grid.page + 1)}
          className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">Next ›</button>
      </div>
    </div>
  )
})()}
```
(The page size is 100 — the endpoint's default. Keep the literal `100` in sync with the fetch; it is the fixed page size for F1.)

- [ ] **Step 6: Verify + commit.**

```bash
export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"
npx tsc --noEmit 2>&1 | grep -iE 'workspace' || echo clean
npx vitest run src/components/workspaces
```
Expected: tsc clean; component tests green.
```bash
git branch --show-current
git add src/components/workspaces
git commit -m "feat(workspaces): sortable grid headers + search box + pager UI"
```

---

### Task 7: Full gate + live-DB smoke

- [ ] **Step 1: Full gate** (in the worktree):
```bash
export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"
npx tsc --noEmit
npx next lint 2>&1 | grep -iE "Error:" || echo "no lint errors"
npx vitest run
```
Expected: tsc 0; no lint errors (pre-existing `<img>`/exhaustive-deps warnings OK); all tests green.

- [ ] **Step 2: Live-DB smoke — the SQL has never met Postgres in tests (Prisma mocked).**

Confirm which checkout owns the dev port before serving (`Get-NetTCPConnection -LocalPort 3200`); start your own if needed:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx next dev -p 3200
```
Reseed the Students workspace with >100 rows (owner `hubowner@test.local`; a `date` field; a null-GPA row). Mint a `galli-auth` cookie for the owner (sign `{userId}` with `.env` JWT_SECRET). Then, hitting `/api/workspaces/[id]/views/[viewId]/records`:
1. **Sort by GPA desc** (save `config.sort` via PATCH view, then GET records): the first rows are the highest GPAs across the WHOLE set (not just a page), numeric order (3.95, 3.82, …), and the null-GPA row is last.
2. **Search "carter"**: returns only the records whose values contain "carter" (case-insensitive), and does NOT match on a field *key* named e.g. "homeroom".
3. **Pager**: `?page=1` returns 100 with `total` = the real count; `?page=2` returns the remainder in stable order (no row repeats or vanishes between pages).
4. **Injection probe**: `?search=%27%3B DROP TABLE` returns 200 with 0–N rows and the table still exists — proof params are bound, not interpolated.
Screenshot or log each result.

- [ ] **Step 3: Record results** in `.superpowers/sdd/progress.md` (what the DB actually returned for each), then STOP — F1 rides the C+E stack; there is no separate PR here. Report completion to the controller.

## Out of scope
Multi-column sort, saved searches, fuzzy search, CSV import (F2), record→page UI (F3), infinite scroll, a configurable page size.

## Success criteria
On the Students workspace: clicking GPA sorts all 126 students numerically and the sort persists across a reload; typing "carter" narrows by value; the pager reaches 101–126. tsc/lint/tests green; the live smoke confirms the SQL executes and returns correct rows, and the injection probe leaves the table intact.

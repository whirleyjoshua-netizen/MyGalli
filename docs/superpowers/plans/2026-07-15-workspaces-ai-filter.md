# Workspaces AI Filter (Sub-project E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user describe what they want to see in plain English and save it as a filtered view — Claude turns the sentence into a structured filter, Postgres executes it, and C's existing renderers display the matches.

**Architecture:** The AI is the thinnest layer: one Claude call converts English → `FilterSpec`, seeing only the field schema and never any records. Everything downstream is deterministic — `validateFilter` rejects anything the model invented, `filterToPrismaWhere` turns the spec into JSONB conditions, and `queryWorkspaceView` (dormant until now) runs them in Postgres before pagination. The filter persists in `WorkspaceView.config.filter` and re-runs live.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Prisma/PostgreSQL, Vitest, Anthropic SDK 0.80.

**Design ref:** `docs/superpowers/specs/2026-07-15-workspaces-ai-filter-design.md`

## Global Constraints
- Branch: `workspaces-e-ai-filter` (already created, off `workspaces-c-views`). **Verify with `git branch --show-current` before every commit** — this repo has concurrent sessions sharing one checkout.
- Model string is exactly `claude-opus-4-8`. No date suffix.
- **No records are ever sent to Anthropic.** Only field `key`, `label`, `type`, and `choice` options.
- Comparators (verbatim): `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`. No `is_empty` — deferred.
- Field types (verbatim, all 10): `text`, `number`, `date`, `choice`, `checkbox`, `currency`, `percent`, `rating`, `url`, `email`.
- Filter is flat: one top-level `and`/`or` over conditions. No nesting (structured outputs cannot express recursive schemas).
- `zod` is NOT installed. Use raw JSON Schema.
- Never commit: `Documents/`, `Images/`, `g1t.json`, `nul`, `.claude/`. tsc + lint + tests must pass.
- DB commands need `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` set inline (127.0.0.1, not localhost).

---

### Task 1: Filter types + `validateFilter` (TDD)

The security boundary. Everything the model returns passes through here before touching a query.

**Files:**
- Create: `src/lib/workspaces/filter.ts`
- Test: `src/lib/workspaces/filter.test.ts`

**Interfaces:**
- Consumes: `GridField` shape from `src/components/workspaces/useWorkspaceGrid.ts` — `{ id, key, label, type, position, required?, config? }`. Do NOT import it (that file is `'use client'`); declare a structural `FilterField` type in `filter.ts` instead.
- Produces: `type Cmp`, `type Condition`, `type FilterSpec`, `type FilterField`, `class FilterError`, `validateFilter(spec: unknown, fields: FilterField[]): FilterSpec`.

- [ ] **Step 1: Write the failing test** — create `src/lib/workspaces/filter.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/workspaces/filter.test.ts`
Expected: FAIL — cannot find module `./filter`.

- [ ] **Step 3: Write minimal implementation** — create `src/lib/workspaces/filter.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/workspaces/filter.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: workspaces-e-ai-filter
git add src/lib/workspaces/filter.ts src/lib/workspaces/filter.test.ts
git commit -m "feat(workspaces): filter spec types + validateFilter (schema-checked, type-coercing)"
```

---

### Task 2: `filterToPrismaWhere` + `describeFilter` (TDD)

Turns a validated spec into JSONB conditions, and into the plain-language chips the user reads.

**Files:**
- Modify: `src/lib/workspaces/filter.ts` (append)
- Modify: `src/lib/workspaces/filter.test.ts` (append)

**Interfaces:**
- Consumes: `FilterSpec`, `FilterField`, `Condition` from Task 1.
- Produces: `filterToPrismaWhere(spec: FilterSpec): Record<string, any>` returning `{ AND: [...] }` or `{ OR: [...] }`; `describeFilter(spec: FilterSpec, fields: FilterField[]): string`.

- [ ] **Step 1: Write the failing test** — append to `src/lib/workspaces/filter.test.ts`:

```ts
import { filterToPrismaWhere, describeFilter } from './filter'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/workspaces/filter.test.ts`
Expected: FAIL — `filterToPrismaWhere is not a function`.

- [ ] **Step 3: Write minimal implementation** — append to `src/lib/workspaces/filter.ts`:

```ts
import { formatFieldValue } from './format-value'

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/workspaces/filter.test.ts`
Expected: PASS — 13 tests.

(The currency expectation is verified against the real formatter: `format-value.ts` renders currency as `` `${symbol}${n.toLocaleString('en-US')}` ``, so `1200` with `{ symbol: '$' }` → `$1,200`.)

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: workspaces-e-ai-filter
git add src/lib/workspaces/filter.ts src/lib/workspaces/filter.test.ts
git commit -m "feat(workspaces): filter -> Prisma JSONB where + plain-language describeFilter"
```

---

### Task 3: JSON Schema + prompt builder (TDD)

What Claude sees. Built per-workspace so the model can only name fields that exist.

**Files:**
- Create: `src/lib/workspaces/filter-schema.ts`
- Test: `src/lib/workspaces/filter-schema.test.ts`

**Interfaces:**
- Consumes: `FilterField`, `allowedCmps` from `./filter`.
- Produces: `buildFilterJsonSchema(fields: FilterField[]): Record<string, unknown>`; `describeSchemaForPrompt(fields: FilterField[]): string`.

- [ ] **Step 1: Write the failing test** — create `src/lib/workspaces/filter-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildFilterJsonSchema, describeSchemaForPrompt } from './filter-schema'
import type { FilterField } from './filter'

const fields: FilterField[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'sport', label: 'Sport', type: 'choice', config: { options: ['Soccer', 'Tennis'] } },
  { key: 'fee', label: 'Fee', type: 'currency', config: { symbol: '$' } },
]

describe('buildFilterJsonSchema', () => {
  it('enumerates only real field keys', () => {
    const schema: any = buildFilterJsonSchema(fields)
    const cond = schema.properties.conditions.items
    expect(cond.properties.field.enum).toEqual(['name', 'sport', 'fee'])
  })

  it('is closed and requires op + conditions', () => {
    const schema: any = buildFilterJsonSchema(fields)
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual(['op', 'conditions'])
    expect(schema.properties.op.enum).toEqual(['and', 'or'])
    expect(schema.properties.conditions.items.additionalProperties).toBe(false)
  })

  it('is not recursive — conditions are flat', () => {
    const json = JSON.stringify(buildFilterJsonSchema(fields))
    expect(json).not.toContain('$ref')
  })
})

describe('describeSchemaForPrompt', () => {
  it('lists key, label, type and choice options', () => {
    const text = describeSchemaForPrompt(fields)
    expect(text).toContain('sport (Sport) — choice; options: Soccer, Tennis')
    expect(text).toContain('fee (Fee) — currency')
  })

  it('states the comparators each field may use', () => {
    const text = describeSchemaForPrompt(fields)
    expect(text).toContain('eq, neq, contains')       // name (text)
    expect(text).toContain('eq, neq, gt, gte, lt, lte') // fee (currency)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/workspaces/filter-schema.test.ts`
Expected: FAIL — cannot find module `./filter-schema`.

- [ ] **Step 3: Write minimal implementation** — create `src/lib/workspaces/filter-schema.ts`:

```ts
import { allowedCmps, type FilterField } from './filter'

const ALL_CMPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains']

/**
 * The JSON Schema handed to output_config.format. Flat by necessity —
 * structured outputs do not support recursive schemas, so there is exactly one
 * top-level and/or over a list of conditions.
 */
export function buildFilterJsonSchema(fields: FilterField[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['op', 'conditions'],
    properties: {
      op: { type: 'string', enum: ['and', 'or'] },
      conditions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['field', 'cmp', 'value'],
          properties: {
            field: { type: 'string', enum: fields.map((f) => f.key) },
            cmp: { type: 'string', enum: ALL_CMPS },
            value: { type: ['string', 'number', 'boolean'] },
          },
        },
      },
    },
  }
}

/** The field list the model sees. Schema only — never any record values. */
export function describeSchemaForPrompt(fields: FilterField[]): string {
  return fields
    .map((f) => {
      const opts =
        f.type === 'choice' && f.config?.options?.length
          ? `; options: ${f.config.options.join(', ')}`
          : ''
      return `- ${f.key} (${f.label}) — ${f.type}${opts}; may use: ${allowedCmps(f.type).join(', ')}`
    })
    .join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/workspaces/filter-schema.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: workspaces-e-ai-filter
git add src/lib/workspaces/filter-schema.ts src/lib/workspaces/filter-schema.test.ts
git commit -m "feat(workspaces): per-workspace filter JSON Schema + schema-only prompt builder"
```

---

### Task 4: Execute the filter in `queryWorkspaceView` (TDD)

Fills the slot the original build left open, and activates the dormant endpoint.

**Files:**
- Modify: `src/lib/workspaces/query-view.ts`
- Test: `src/lib/workspaces/query-view.test.ts` (new — this file has never had unit tests)
- Modify: `src/app/api/workspaces/[id]/views/[viewId]/records/route.ts` (page size only)

**Interfaces:**
- Consumes: `validateFilter`, `filterToPrismaWhere` from `./filter`.
- Produces: `queryWorkspaceView` keeps its existing signature and return shape; records + count are now filtered when `view.config.filter` is present.

- [ ] **Step 1: Write the failing test** — create `src/lib/workspaces/query-view.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryWorkspaceView } from './query-view'
import { authorizeWorkspace } from './authorize'
import { db } from '@/lib/db'

vi.mock('./authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspaceView: { findUnique: vi.fn() },
    workspaceField: { findMany: vi.fn() },
    workspaceRecord: { findMany: vi.fn(), count: vi.fn() },
  },
}))

const FIELDS = [
  { id: 'f1', key: 'sport', label: 'Sport', type: 'choice', position: 0, config: { options: ['Soccer', 'Tennis'] } },
  { id: 'f2', key: 'fee', label: 'Fee', type: 'currency', position: 1, config: { symbol: '$' } },
]

function setup(config: any) {
  ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1' })
  ;(db.workspaceView.findUnique as any).mockResolvedValue({ id: 'v1', name: 'V', type: 'grid', config })
  ;(db.workspaceField.findMany as any).mockResolvedValue(FIELDS)
  ;(db.workspaceRecord.findMany as any).mockResolvedValue([])
  ;(db.workspaceRecord.count as any).mockResolvedValue(0)
}

const ARGS = { workspaceId: 'w1', viewId: 'v1', userId: 'u1' }

describe('queryWorkspaceView filtering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies the view filter to BOTH findMany and count', async () => {
    setup({ filter: { op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] } })
    await queryWorkspaceView(ARGS)

    const expected = { AND: [{ data: { path: ['sport'], equals: 'Soccer' } }] }
    expect((db.workspaceRecord.findMany as any).mock.calls[0][0].where).toMatchObject({
      workspaceId: 'w1',
      status: 'active',
      ...expected,
    })
    expect((db.workspaceRecord.count as any).mock.calls[0][0].where).toMatchObject({
      workspaceId: 'w1',
      status: 'active',
      ...expected,
    })
  })

  it('queries unfiltered when the view has no filter', async () => {
    setup({})
    await queryWorkspaceView(ARGS)
    const where = (db.workspaceRecord.findMany as any).mock.calls[0][0].where
    expect(where).toEqual({ workspaceId: 'w1', status: 'active' })
    expect(where.AND).toBeUndefined()
  })

  it('ignores a stale filter naming a field that no longer exists', async () => {
    setup({ filter: { op: 'and', conditions: [{ field: 'deleted_col', cmp: 'eq', value: 'x' }] } })
    const result = await queryWorkspaceView(ARGS)
    // Must not throw and must not silently filter on garbage
    expect((db.workspaceRecord.findMany as any).mock.calls[0][0].where).toEqual({
      workspaceId: 'w1',
      status: 'active',
    })
    expect(result.filterError).toMatch(/Unknown field/)
  })

  it('defaults pageSize to 100 (matching the main GET)', async () => {
    setup({})
    const result = await queryWorkspaceView(ARGS)
    expect((db.workspaceRecord.findMany as any).mock.calls[0][0].take).toBe(100)
    expect(result.pagination.pageSize).toBe(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/workspaces/query-view.test.ts`
Expected: FAIL — filter is not applied; `take` is 25, not 100.

- [ ] **Step 3: Write minimal implementation** — in `src/lib/workspaces/query-view.ts`, add the import, change the `pageSize` default, and replace the step-4 block:

Add at the top:
```ts
import { validateFilter, filterToPrismaWhere, FilterError } from './filter'
```

Change the signature default from `pageSize = 25` to:
```ts
  pageSize = 100,
```

Replace the step-4 block (the `// NOTE: Filtering and sorting logic...` comment and the `Promise.all` beneath it) with:

```ts
  // 4. Build query — apply the view's saved filter, if any.
  const skip = (page - 1) * pageSize
  const config = view.config as { visibleFields?: string[]; filter?: unknown }

  let filterWhere: Record<string, any> = {}
  let filterError: string | undefined
  if (config?.filter) {
    try {
      // Re-validate on every read: columns can be deleted or retyped after a
      // filter is saved, so a stored filter is untrusted input like any other.
      const spec = validateFilter(config.filter, fields)
      filterWhere = filterToPrismaWhere(spec)
    } catch (e: any) {
      if (!(e instanceof FilterError)) throw e
      // A stale filter degrades to "show everything" + a surfaced message,
      // rather than 500ing a view the user can still otherwise use.
      filterError = e.message
    }
  }

  const where = { workspaceId, status: 'active', ...filterWhere }

  const [records, total] = await Promise.all([
    db.workspaceRecord.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: { id: true, data: true, updatedAt: true },
    }),
    db.workspaceRecord.count({ where }),
  ])
```

Then add `filterError` to the returned object (alongside `view`, `fields`, `records`, `pagination`):

```ts
  return {
    view: { id: view.id, name: view.name, type: view.type, config: view.config },
    fields: fields.filter(f => visibleFields.includes(f.key)),
    records: projectedRecords,
    filterError,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  }
```

Note: `view.config` is added to the returned `view` object for parity with the main GET's `views` array (the chips actually read config from there, not from this endpoint) — it costs nothing and keeps the two shapes consistent. The existing `visibleFields` projection below stays exactly as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/workspaces/query-view.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Pin the route's page size**

In `src/app/api/workspaces/[id]/views/[viewId]/records/route.ts`, change:
```ts
  const pageSize = parseInt(searchParams.get('pageSize') || '25')
```
to:
```ts
  const pageSize = parseInt(searchParams.get('pageSize') || '100')
```

Run: `npx vitest run "src/app/api/workspaces/[id]/views"`
Expected: PASS — the existing route test mocks `queryWorkspaceView`, so it still passes. If it asserts `pageSize: 25`, update that assertion to `100`.

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # must print: workspaces-e-ai-filter
git add src/lib/workspaces/query-view.ts src/lib/workspaces/query-view.test.ts "src/app/api/workspaces/[id]/views/[viewId]/records/route.ts"
git commit -m "feat(workspaces): execute saved view filters in Postgres pre-pagination; pin pageSize to 100"
```

---

### Task 5: `POST /api/workspaces/[id]/filter-suggest` (TDD)

The one Claude call. Suggests a filter; never saves one.

**Files:**
- Create: `src/app/api/workspaces/[id]/filter-suggest/route.ts`
- Test: `src/app/api/workspaces/[id]/filter-suggest/route.test.ts`

**Interfaces:**
- Consumes: `getUser`, `authorizeWorkspace`, `rateLimit(request, { limit, windowMs, prefix })`, `buildFilterJsonSchema`, `describeSchemaForPrompt`, `validateFilter`, `describeFilter`.
- Produces: `POST` → `{ filter: FilterSpec, summary: string }` on 200.

- [ ] **Step 1: Write the failing test** — create `src/app/api/workspaces/[id]/filter-suggest/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { rateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { workspaceField: { findMany: vi.fn() } } }))

const createMock = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock }
  },
}))

const ctx = { params: Promise.resolve({ id: 'w1' }) }
const req = (body: any) => ({ json: async () => body, headers: new Headers() }) as any

const FIELDS = [
  { id: 'f1', key: 'sport', label: 'Sport', type: 'choice', position: 0, config: { options: ['Soccer', 'Tennis'] } },
  { id: 'f2', key: 'fee', label: 'Fee', type: 'currency', position: 1, config: { symbol: '$' } },
]

function modelReturns(obj: any) {
  createMock.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(obj) }] })
}

describe('POST filter-suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    ;(rateLimit as any).mockResolvedValue(null)
    ;(db.workspaceField.findMany as any).mockResolvedValue(FIELDS)
    ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1' })
  })

  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await POST(req({ question: 'soccer' }), ctx)).status).toBe(401)
  })

  it('404 for a workspace the user does not own', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockRejectedValue(new Error('Unauthorized or Workspace not found'))
    expect((await POST(req({ question: 'soccer' }), ctx)).status).toBe(404)
  })

  it('400 on a missing or too-short question', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    expect((await POST(req({ question: 'a' }), ctx)).status).toBe(400)
  })

  it('200 returns a validated filter and a human summary', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    modelReturns({ op: 'and', conditions: [
      { field: 'sport', cmp: 'eq', value: 'Soccer' },
      { field: 'fee', cmp: 'gt', value: 1200 },
    ] })
    const res = await POST(req({ question: 'soccer players with a fee over 1200' }), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.filter.conditions).toHaveLength(2)
    expect(body.summary).toContain('Sport is Soccer')
  })

  it('422 when the model invents a field', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    modelReturns({ op: 'and', conditions: [{ field: 'ghost', cmp: 'eq', value: 'x' }] })
    const res = await POST(req({ question: 'anything' }), ctx)
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/Unknown field/)
  })

  it('never sends record data to the model — only the schema', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    modelReturns({ op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] })
    await POST(req({ question: 'soccer' }), ctx)
    const sent = JSON.stringify(createMock.mock.calls[0][0])
    expect(sent).toContain('sport')      // schema: yes
    expect(sent).not.toContain('Jordan') // records: never
    expect(createMock.mock.calls[0][0].model).toBe('claude-opus-4-8')
  })

  it('429 passthrough when rate limited', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(rateLimit as any).mockResolvedValue(new Response('rate limited', { status: 429 }))
    expect((await POST(req({ question: 'soccer' }), ctx)).status).toBe(429)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/workspaces/[id]/filter-suggest"`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Write minimal implementation** — create `src/app/api/workspaces/[id]/filter-suggest/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { validateFilter, describeFilter, FilterError, type FilterField } from '@/lib/workspaces/filter'
import { buildFilterJsonSchema, describeSchemaForPrompt } from '@/lib/workspaces/filter-schema'

const SYSTEM = `You translate a plain-English request into a filter over a table.

You are given ONLY the table's column schema — never its rows. Return a filter
that selects the rows the user described.

Rules:
- Use only the column keys listed. Never invent a column.
- Use only the comparators each column lists.
- For choice columns the value must be exactly one of that column's options.
- Strip currency symbols and separators from numbers: "$1,200" -> 1200.
- The filter is flat: one top-level "and"/"or" over conditions. There is no nesting.
- If the request maps to a single condition, still return the {op, conditions} shape.`

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'ws-filter-ai' })
  if (limited) return limited

  const { id: workspaceId } = await params

  let question: string
  try {
    question = (await request.json()).question
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return NextResponse.json({ error: 'Describe what you want to see (at least 3 characters)' }, { status: 400 })
  }
  if (question.length > 500) {
    return NextResponse.json({ error: 'Description must be under 500 characters' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI filtering is not configured. Set ANTHROPIC_API_KEY.' },
      { status: 500 }
    )
  }

  try {
    await authorizeWorkspace(user.id, workspaceId)

    const fields = (await db.workspaceField.findMany({
      where: { workspaceId },
      orderBy: { position: 'asc' },
    })) as unknown as FilterField[]

    if (fields.length === 0) {
      return NextResponse.json({ error: 'Add a column before filtering' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Schema only. Record values never enter this request.
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: SYSTEM,
      output_config: {
        format: { type: 'json_schema', schema: buildFilterJsonSchema(fields) as any },
      },
      messages: [
        {
          role: 'user',
          content: `Columns:\n${describeSchemaForPrompt(fields)}\n\nRequest: ${question.trim()}`,
        },
      ],
    } as any)

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    if (!raw) {
      return NextResponse.json({ error: 'The model returned nothing. Try rephrasing.' }, { status: 502 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'The model did not return a valid filter. Try rephrasing.' }, { status: 422 })
    }

    // The model is untrusted input. This is the boundary.
    const filter = validateFilter(parsed, fields)

    return NextResponse.json({ filter, summary: describeFilter(filter, fields) })
  } catch (error: any) {
    if (error instanceof FilterError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    if (error.message === 'Unauthorized or Workspace not found') {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    if (error?.status === 429) {
      return NextResponse.json({ error: 'AI service is busy. Please wait a moment.' }, { status: 429 })
    }
    if (error?.status >= 500) {
      return NextResponse.json({ error: 'AI service is temporarily unavailable.' }, { status: 502 })
    }
    console.error('Filter suggest error:', error)
    return NextResponse.json({ error: 'Could not build that filter. Try rephrasing.' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/workspaces/[id]/filter-suggest"`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: workspaces-e-ai-filter
git add "src/app/api/workspaces/[id]/filter-suggest"
git commit -m "feat(workspaces): POST filter-suggest — NL -> validated filter, schema-only, rate-limited"
```

---

### Task 6: Views POST validates `config.filter` (TDD)

A filter can only be saved if it survives validation.

**Files:**
- Modify: `src/app/api/workspaces/[id]/views/route.ts`
- Modify: `src/app/api/workspaces/[id]/views/route.test.ts`

**Interfaces:**
- Consumes: `validateFilter`, `FilterError`, `FilterField` from `@/lib/workspaces/filter`.
- Produces: no signature change; POST now 400s on an invalid `config.filter` and stores the normalized spec.

- [ ] **Step 1: Write the failing test** — append to `src/app/api/workspaces/[id]/views/route.test.ts` (inside the existing top-level `describe`, which already defines `ctx`).

**Match the existing file's style exactly:** it does NOT mock `authorizeWorkspace` (that helper reads `db.workspace.findUnique` directly, which the file already mocks), and it builds requests inline with `new Request(...)`. Do not add an `authorizeWorkspace` mock or a request helper.

```ts
  it('accepts a valid config.filter and stores the normalized spec', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([
      { id: 'f1', key: 'fee', label: 'Fee', type: 'currency', config: { symbol: '$' } },
    ])
    ;(db.workspaceView.count as any).mockResolvedValue(1)
    ;(db.workspaceView.create as any).mockResolvedValue({ id: 'v9' })

    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Big Fees',
        type: 'grid',
        // "1200" arrives as a string; it must be stored coerced to a number
        config: { filter: { op: 'and', conditions: [{ field: 'fee', cmp: 'gt', value: '1200' }] } },
      }),
    })

    const res = await POST(req as any, ctx)
    expect(res.status).toBe(201)

    const stored = (db.workspaceView.create as any).mock.calls[0][0].data.config
    expect(stored.filter.conditions[0].value).toBe(1200)
  })

  it('400s on a filter naming an unknown field', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([
      { id: 'f1', key: 'fee', label: 'Fee', type: 'currency', config: {} },
    ])

    const req = new Request('http://localhost/api/workspaces/w1/views', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bad',
        type: 'grid',
        config: { filter: { op: 'and', conditions: [{ field: 'ghost', cmp: 'eq', value: 'x' }] } },
      }),
    })

    const res = await POST(req as any, ctx)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Unknown field/)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/workspaces/[id]/views/route.test.ts"`
Expected: FAIL — the unknown-field case returns 201 instead of 400 (the filter is stored unvalidated).

- [ ] **Step 3: Write minimal implementation** — in `src/app/api/workspaces/[id]/views/route.ts`:

Add the import:
```ts
import { validateFilter, FilterError, type FilterField } from '@/lib/workspaces/filter'
```

Then, inside the `try`, immediately after the existing `visibleFields` check and before `// 4. Determine position`, insert:

```ts
    // Validate + normalize any saved filter against the real schema. A filter
    // is only ever persisted in its coerced form.
    let storedConfig = config || {}
    if (storedConfig.filter) {
      try {
        storedConfig = {
          ...storedConfig,
          filter: validateFilter(storedConfig.filter, fields as unknown as FilterField[]),
        }
      } catch (e: any) {
        if (e instanceof FilterError) {
          return NextResponse.json({ error: e.message }, { status: 400 })
        }
        throw e
      }
    }
```

Then change the create call to persist `storedConfig`:
```ts
        config: storedConfig,
```
(replacing `config: config || {}`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/workspaces/[id]/views"`
Expected: PASS — the existing view tests plus the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: workspaces-e-ai-filter
git add "src/app/api/workspaces/[id]/views/route.ts" "src/app/api/workspaces/[id]/views/route.test.ts"
git commit -m "feat(workspaces): validate + normalize config.filter when saving a view"
```

---

### Task 7: Hook fetches per-view records; UI describes and confirms the filter

**Files:**
- Modify: `src/components/workspaces/useWorkspaceGrid.ts`
- Modify: `src/components/workspaces/WorkspaceViews.tsx`
- Modify: `src/components/workspaces/AddViewModal.tsx`
- Create: `src/components/workspaces/FilterChips.tsx`
- Test: `src/components/workspaces/FilterChips.test.tsx`

**Interfaces:**
- Consumes: `describeFilter` from `@/lib/workspaces/filter`; `POST /api/workspaces/[id]/filter-suggest` → `{ filter, summary }`.
- Produces: hook gains `activeViewId: string | null`, `setActiveViewId(id)`, `filterError: string | null`; `AddViewModal`'s `onSubmit(name, type, config)` is unchanged — the filter simply rides inside `config`.

- [ ] **Step 1: Write the failing test** — create `src/components/workspaces/FilterChips.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterChips } from './FilterChips'

const fields = [
  { id: 'f1', key: 'sport', label: 'Sport', type: 'choice', position: 0, config: { options: ['Soccer'] } },
  { id: 'f2', key: 'fee', label: 'Fee', type: 'currency', position: 1, config: { symbol: '$' } },
] as any

const filter = {
  op: 'and',
  conditions: [
    { field: 'sport', cmp: 'eq', value: 'Soccer' },
    { field: 'fee', cmp: 'gt', value: 1200 },
  ],
}

describe('FilterChips', () => {
  it('shows the filter in plain language with labels, not keys', () => {
    render(<FilterChips filter={filter} fields={fields} />)
    expect(screen.getByText(/Sport is Soccer/)).toBeInTheDocument()
    expect(screen.queryByText(/"sport"/)).not.toBeInTheDocument()
  })

  it('renders nothing when there is no filter', () => {
    const { container } = render(<FilterChips filter={null} fields={fields} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn()
    render(<FilterChips filter={filter} fields={fields} onRemove={onRemove} />)
    fireEvent.click(screen.getByTitle('Remove filter'))
    expect(onRemove).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/workspaces/FilterChips.test.tsx`
Expected: FAIL — cannot find module `./FilterChips`.

- [ ] **Step 3: Create `src/components/workspaces/FilterChips.tsx`**

```tsx
'use client'

import { X, Filter } from 'lucide-react'
import { describeFilter, type FilterSpec, type FilterField } from '@/lib/workspaces/filter'
import type { GridField } from './useWorkspaceGrid'

export function FilterChips({
  filter,
  fields,
  count,
  onRemove,
}: {
  filter: FilterSpec | null
  fields: GridField[]
  count?: number
  onRemove?: () => void
}) {
  if (!filter) return null
  let text: string
  try {
    text = describeFilter(filter, fields as unknown as FilterField[])
  } catch {
    return null
  }

  return (
    <div className="mb-3 flex items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-galli/10 px-3 py-1 font-medium text-galli">
        <Filter size={12} />
        {text}
      </span>
      {typeof count === 'number' && (
        <span className="text-muted-foreground">{count} matching</span>
      )}
      {onRemove && (
        <button onClick={onRemove} title="Remove filter" className="text-muted-foreground hover:text-red-500">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/workspaces/FilterChips.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Point the hook at the per-view records endpoint**

In `src/components/workspaces/useWorkspaceGrid.ts`:

Add state alongside the existing state:
```ts
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
```

In `reload()`, after `setViews(body.views ?? [])`, default the active view:
```ts
      const viewList = body.views ?? []
      setViews(viewList)
      setActiveViewId((cur) => cur ?? viewList[0]?.id ?? null)
```

Add a records loader and an effect that re-runs on view switch (place before the `return`):
```ts
  const loadViewRecords = useCallback(async (viewId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/views/${viewId}/records`)
      if (!res.ok) throw new Error('Failed to load records')
      const body = await res.json()
      commitRecords(body.records ?? [])
      setFilterError(body.filterError ?? null)
    } catch (e: any) {
      setError(e.message || 'Failed to load records')
    }
  }, [workspaceId, commitRecords])

  useEffect(() => {
    if (activeViewId) loadViewRecords(activeViewId)
  }, [activeViewId, loadViewRecords])
```

Add `activeViewId, setActiveViewId, filterError, loadViewRecords` to the returned object.

**Do not remove** `records` from the main `GET /api/workspaces/[id]` response or stop reading `body.fields`/`body.views` from it — that route's shape is depended on by D's KPI hydration and its existing tests.

- [ ] **Step 6: Wire the switcher and chips into `WorkspaceViews.tsx`**

Import at the top:
```ts
import { FilterChips } from './FilterChips'
```

Replace the `switchTo` function so it drives hook state as well as the URL:
```ts
  function switchTo(id: string) {
    grid.setActiveViewId(id)
    router.replace(`/workspaces/${workspaceId}?view=${id}`)
  }
```

Change the active-view resolution to prefer hook state, falling back to the URL param:
```ts
  const activeId = grid.activeViewId ?? params.get('view')
  const active = views.find((v) => v.id === activeId) ?? views[0]
```

Render the chips and any stale-filter warning directly above the active view block:
```tsx
      <FilterChips
        filter={active?.config?.filter ?? null}
        fields={grid.fields}
        count={grid.records.length}
      />
      {grid.filterError && (
        <p className="mb-3 text-sm text-amber-600">
          This view&apos;s filter no longer matches the columns ({grid.filterError}) — showing all records.
        </p>
      )}
```

- [ ] **Step 7: Add the natural-language box to `AddViewModal.tsx`**

Add these props to the component signature:
```ts
  workspaceId: string
```

Add state:
```ts
  const [ask, setAsk] = useState('')
  const [filter, setFilter] = useState<any>(null)
  const [summary, setSummary] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')
```

Add the suggest call:
```ts
  async function suggest() {
    if (ask.trim().length < 3) return
    setAsking(true)
    setAskError('')
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/filter-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: ask.trim() }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not build that filter')
      setFilter(body.filter)
      setSummary(body.summary)
    } catch (e: any) {
      setAskError(e.message)
      setFilter(null)
      setSummary('')
    } finally {
      setAsking(false)
    }
  }
```

Include the filter in the submitted config — change the `submit()` config line to:
```ts
    const base = type === 'kanban' ? { groupByField } : type === 'gallery' ? { titleField: titleField || undefined } : {}
    const config = filter ? { ...base, filter } : base
```

Add the UI block above the footer buttons:
```tsx
        <div className="mb-3 rounded-lg border border-border p-3">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Describe what you want to see (optional)
          </label>
          <div className="flex gap-2">
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="soccer players with a fee over 1200"
              className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
            <button
              onClick={suggest}
              disabled={asking || ask.trim().length < 3}
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
            >
              {asking ? '…' : 'Build'}
            </button>
          </div>
          {summary && (
            <p className="mt-2 text-xs">
              <span className="text-muted-foreground">Filter: </span>
              <span className="font-medium text-galli">{summary}</span>
            </p>
          )}
          {askError && <p className="mt-2 text-xs text-red-500">{askError}</p>}
        </div>
```

Finally, pass `workspaceId` where `WorkspaceViews.tsx` renders `<AddViewModal … />`.

- [ ] **Step 8: Verify the whole workspaces surface compiles and passes**

```bash
npx tsc --noEmit 2>&1 | grep -iE 'workspace|filter' || echo clean
npx vitest run src/components/workspaces src/lib/workspaces src/app/api/workspaces
```
Expected: no tsc output for these paths; all tests green.

- [ ] **Step 9: Commit**

```bash
git branch --show-current   # must print: workspaces-e-ai-filter
git add src/components/workspaces src/lib/workspaces
git commit -m "feat(workspaces): per-view record fetch + NL filter box + plain-language filter chips"
```

---

### Task 8: Full gate, browser smoke, PR

- [ ] **Step 1: Full gate**

```bash
npx tsc --noEmit
npx next lint 2>&1 | grep -iE "Error:" || echo "no lint errors"
npx vitest run
```
Expected: tsc 0 errors; no lint **errors** (pre-existing `<img>` / exhaustive-deps warnings are fine); all tests green.

- [ ] **Step 2: Browser smoke — the JSONB shapes are only truly proven here**

Unit tests mock Prisma, so `filterToPrismaWhere`'s output has never met Postgres. This step is what validates it.

Per the `shared-worktree-hazard` memory: **port 3000 may belong to another worktree's dev server**. Confirm ownership first, and start your own on 3100 if so:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx next dev -p 3100
```

Then, with the Chrome plugin (inject the `galli-auth` cookie via CDP, use long waits — dev compiles routes on first hit):
1. Seed or reuse a workspace with a `choice` field, a `currency` field, and ≥5 records across ≥2 choice options.
2. Open the workspace → **+ View** → type `soccer players with a fee over 1200` → **Build**.
3. Confirm the summary reads as expected (e.g. `Sport is Soccer and Fee > $1,200`) — screenshot.
4. Save the view. Confirm **only matching records render**, the chips show the filter, and the count is right — screenshot.
5. Switch to an unfiltered view and back; confirm records change accordingly.
6. Confirm in the DB that `WorkspaceView.config.filter` persisted with the **coerced number** (1200, not "1200").
7. Delete the filtered field's column, reload the view: confirm the amber stale-filter message appears and all records render (no 500).

- [ ] **Step 3: Push and open the PR**

```bash
git branch --show-current   # must print: workspaces-e-ai-filter
git push -u origin workspaces-e-ai-filter
```

Open the PR. **Base it on `workspaces-c-views`, not `main`** — E builds on C, and C is not yet merged. Say so explicitly in the PR body, and note: no migration; filter runs in Postgres pre-pagination; Claude sees schema only; free/ungated at 10 req/min.

## Out of scope
Manual filter builder, sort, nested `(A and B) or C`, `is_empty`/`is_not_empty` (Prisma JSONB null semantics — needs a live-DB assertion), AI over record contents, AI-summary field type, filters on public/shared pages. Separately: `/api/generate` is pinned to the stale `claude-sonnet-4-20250514` and hand-parses JSON — worth its own cleanup.

# Workspaces Manual Filter Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Workspaces a manual filter builder — a toolbar button that builds and edits the active view's filter without AI — plus the `is_empty`/`is_not_empty` comparators and two correctness fixes the builder would otherwise expose.

**Architecture:** A presentational `FilterBuilder` popover holds a draft spec in local state and emits a `FilterSpec` on Apply, which `WorkspaceViews` persists through the existing `grid.updateView`. All validation reuses `validateFilter` from `lib/workspaces/filter.ts` (pure, already the server's trust boundary); all execution reuses `buildRecordsQuery` from `lib/workspaces/records-query.ts` (raw parameterised SQL). No new API routes, no schema change, no migration.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest + @testing-library/react, Tailwind, PostgreSQL via Prisma `$queryRawUnsafe`.

## Global Constraints

- Branch MUST be `feat/workspaces-filter-builder`. Run `git branch --show-current` before every commit; if it is anything else, STOP and report BLOCKED.
- Comparator slugs verbatim: `is_empty`, `is_not_empty`. UI labels verbatim: "is empty", "is not empty". Toolbar button label verbatim: "Filter".
- Flat `and`/`or` only — one `op` across all conditions. Do NOT introduce nested boolean logic.
- Every field key and every user value reaching SQL MUST go through the `p()` parameter binder in `records-query.ts`. Never interpolate either into the SQL string.
- `validateFilter` stays the single source of validation truth. The client calls it for feedback; the server keeps calling it authoritatively. Do not add a second validation path.
- Tests: `pnpm exec vitest run <path>` to scope a run (`pnpm test` ignores path arguments and runs everything). Node is v24; the suite has ONE pre-existing unrelated failure, `src/app/api/messages/upload/route.test.ts > 400 when the file is not audio`. Baseline is "1 failed, rest passing" — do not chase it, do not "fix" it.
- Commit after each green task. Every commit message ends with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Local Postgres must be running for Task 6: `~/.local/pgsetup/node_modules/@embedded-postgres/darwin-arm64/native/bin/pg_ctl -D ~/.local/pgdata -o "-p 5434 -k /tmp" -l ~/.local/pgdata/server.log start`

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/workspaces/filter.ts` | Types, `allowedCmps`, `validateFilter`, `describeFilter`. Gains two comparators; loses dead `filterToPrismaWhere`. |
| `src/lib/workspaces/records-query.ts` | Spec → parameterised SQL. Gains two cases; fixes `neq` and `contains`. |
| `src/lib/workspaces/filter-schema.ts` | JSON Schema handed to the model. Gains the two comparators so AI and manual share one vocabulary. |
| `src/components/workspaces/FilterBuilder.tsx` | **New.** Presentational popover. Knows nothing about views, grids or fetching. |
| `src/components/workspaces/WorkspaceViews.tsx` | Toolbar button + wiring to `grid.updateView`. |

---

### Task 1: Comparators and validation (`filter.ts`)

**Files:**
- Modify: `src/lib/workspaces/filter.ts`
- Modify: `src/lib/workspaces/filter.test.ts` (add cases; delete the `filterToPrismaWhere` describe block at lines 98–140 and the import at line 2)

**Interfaces:**
- Produces: `Cmp` gains `'is_empty' | 'is_not_empty'`; `Condition.value` becomes optional; `isValueless(cmp: Cmp): boolean`; `allowedCmps(type: string): Cmp[]` now returns the two extra comparators for every type.
- Removes: `filterToPrismaWhere` and `conditionToPrisma` (dead since F1 moved execution to raw SQL — verified: no non-test importer).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/workspaces/filter.test.ts` (keep the existing `fields` fixture at the top):

```ts
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
```

Update the import on line 2 to drop `filterToPrismaWhere` and add `allowedCmps`:

```ts
import { validateFilter, validateSort, FilterError, describeFilter, allowedCmps, type FilterField } from './filter'
```

Delete the whole `describe('filterToPrismaWhere', ...)` block (lines 98–140).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/workspaces/filter.test.ts`
Expected: FAIL — `allowedCmps` does not include `is_empty`; validating a value-less condition throws `"startDate" needs a value`.

- [ ] **Step 3: Widen the types**

In `src/lib/workspaces/filter.ts`, replace lines 3–4:

```ts
export type Cmp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'is_empty' | 'is_not_empty'
export type Condition = { field: string; cmp: Cmp; value?: string | number | boolean }
```

- [ ] **Step 4: Add the valueless helper and widen `allowedCmps`**

Replace the existing `allowedCmps` function (lines 14–21) with:

```ts
/** Comparators that take no operand — emptiness is a property of the cell alone. */
const VALUELESS: Cmp[] = ['is_empty', 'is_not_empty']

export function isValueless(cmp: Cmp): boolean {
  return VALUELESS.includes(cmp)
}

function baseCmps(type: string): Cmp[] {
  if (TEXTUAL.includes(type)) return ['eq', 'neq', 'contains']
  if (ORDERED.includes(type)) return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte']
  if (type === 'choice') return ['eq', 'neq']
  if (type === 'checkbox') return ['eq', 'neq']
  return []
}

/**
 * Comparators each field type is allowed to use. Emptiness is meaningful for
 * every type — including ones with no ordering or equality story — so the two
 * value-less comparators are appended unconditionally.
 */
export function allowedCmps(type: string): Cmp[] {
  return [...baseCmps(type), ...VALUELESS]
}
```

- [ ] **Step 5: Skip coercion for value-less conditions**

In `validateFilter`, find the final statement of the `conditions.map` callback — the single line reading exactly:

```ts
    return { field: field.key, cmp: c.cmp, value: coerce(field, c.value) }
```

Replace that one line with:

```ts
    if (isValueless(c.cmp)) {
      // Deliberately drops any value the caller sent. The structured-output
      // schema forces the model to emit a `value` property, and a stray value
      // must never reach conditionSql — which binds no parameter for these.
      return { field: field.key, cmp: c.cmp }
    }

    return { field: field.key, cmp: c.cmp, value: coerce(field, c.value) }
```

- [ ] **Step 6: Teach `describeFilter` and `CMP_WORDS` about them**

Add to `CMP_WORDS` (after `lte: '≤',`):

```ts
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
```

In `describeFilter`, insert immediately after the `label` line inside the map callback:

```ts
    if (isValueless(c.cmp)) return `${label} ${CMP_WORDS[c.cmp]}`
```

- [ ] **Step 7: Delete the dead Prisma translator**

Delete two whole functions plus the doc comment above the first: `export function filterToPrismaWhere(spec: FilterSpec)` (and the `/** Translates a VALIDATED spec … */` block above it) and `function conditionToPrisma(c: Condition)`. They sit between `coerce` and the `CMP_WORDS` constant — everything from that doc comment down to the closing brace of `conditionToPrisma` goes. Confirm nothing imports them:

Run: `grep -rn 'filterToPrismaWhere\|conditionToPrisma' src/`
Expected: no output.

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/workspaces/filter.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 9: Commit**

```bash
git add src/lib/workspaces/filter.ts src/lib/workspaces/filter.test.ts
git commit -m "$(cat <<'EOF'
feat(workspaces): is_empty/is_not_empty comparators; drop dead Prisma translator

filterToPrismaWhere has had no non-test caller since F1 moved filter execution
onto raw SQL. Two translations of one spec is a correctness trap, so it goes.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: SQL generation and two correctness fixes (`records-query.ts`)

**Files:**
- Modify: `src/lib/workspaces/records-query.ts` (`conditionSql`, lines 63–78)
- Modify: `src/lib/workspaces/records-query.test.ts`

**Interfaces:**
- Consumes: `Cmp`, `Condition`, `isValueless` from Task 1.
- Produces: `conditionSql` handles all nine comparators; `neq` includes empty cells; `contains` matches `%`/`_` literally.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/workspaces/records-query.test.ts` (the file already defines `fields` and `base` at the top):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/workspaces/records-query.test.ts`
Expected: FAIL — `is_empty` falls through the switch and returns `undefined`; `neq` lacks the `IS NULL` disjunct; `contains` param is `%50%%` unescaped.

- [ ] **Step 3: Rewrite `conditionSql`**

Replace the whole function (lines 63–78) with:

```ts
function conditionSql(c: Condition, fields: FilterField[], p: (v: any) => string): string {
  const field = fields.find((f) => f.key === c.field)!
  const numeric = NUMERIC.includes(field.type)
  // Bound ONCE; `$n` may be referenced repeatedly in the SQL text.
  const lhs = `data->>${p(c.field)}`

  // `data->>key` yields SQL NULL for BOTH a missing key and a JSON null, so a
  // single IS NULL test covers two of the three empty states and the '' test
  // covers the third. Handled before the switch so no value param is bound.
  if (c.cmp === 'is_empty') return `(${lhs} IS NULL OR ${lhs} = '')`
  if (c.cmp === 'is_not_empty') return `(${lhs} IS NOT NULL AND ${lhs} <> '')`

  const value = c.value as string | number | boolean

  switch (c.cmp) {
    case 'eq': return numeric ? `(${lhs})::numeric = ${p(value)}` : `${lhs} = ${p(value)}`
    // An empty cell is NOT equal to anything, so "is not X" must match it.
    // Without the IS NULL disjunct, `NOT (NULL = 'x')` is NULL and Postgres
    // drops the row — "Status is not Done" would hide every record with no
    // Status at all, which is three-valued logic behaving as specified and
    // not at all as anyone reading the filter expects.
    case 'neq': return numeric
      ? `(${lhs} IS NULL OR NOT ((${lhs})::numeric = ${p(value)}))`
      : `(${lhs} IS NULL OR NOT (${lhs} = ${p(value)}))`
    // Escaped, unlike E's Prisma string_contains: a person typing "50%" into
    // the manual builder means a literal percent sign, not a wildcard.
    case 'contains': return `${lhs} LIKE ${p('%' + escapeLike(String(value)) + '%')}`
    case 'gt': return numeric ? `(${lhs})::numeric > ${p(value)}` : `${lhs} > ${p(value)}`
    case 'gte': return numeric ? `(${lhs})::numeric >= ${p(value)}` : `${lhs} >= ${p(value)}`
    case 'lt': return numeric ? `(${lhs})::numeric < ${p(value)}` : `${lhs} < ${p(value)}`
    case 'lte': return numeric ? `(${lhs})::numeric <= ${p(value)}` : `${lhs} <= ${p(value)}`
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/workspaces/records-query.test.ts`
Expected: PASS — including the pre-existing injection-guarantee tests, which must still hold.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0. (If `c.value` is flagged as possibly undefined anywhere else, the `Condition.value` optionality from Task 1 has found a real caller — fix it there, do not widen the type back.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/workspaces/records-query.ts src/lib/workspaces/records-query.test.ts
git commit -m "$(cat <<'EOF'
feat(workspaces): is_empty/is_not_empty SQL; fix neq dropping empty cells

neq emitted NOT (data->>k = $n), so an empty cell made the comparison NULL and
Postgres excluded the row — "Status is not Done" hid every record with no
Status. contains now escapes LIKE metacharacters so a typed "50%" is literal.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Share the comparator vocabulary with the AI path (`filter-schema.ts`)

**Files:**
- Modify: `src/lib/workspaces/filter-schema.ts` (line 3)
- Modify: `src/lib/workspaces/filter-schema.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: the model may now emit `is_empty`/`is_not_empty`, which `validateFilter` (Task 1) already accepts and strips the forced `value` from.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/workspaces/filter-schema.test.ts`:

```ts
it('offers the value-less comparators to the model', () => {
  const schema = buildFilterJsonSchema([{ key: 'due', label: 'Due', type: 'date' }]) as any
  const cmps = schema.properties.conditions.items.properties.cmp.enum
  expect(cmps).toContain('is_empty')
  expect(cmps).toContain('is_not_empty')
})

it('still requires a value property, which validateFilter strips', () => {
  // Structured outputs cannot express "required only for some enum values", so
  // `value` stays required and validateFilter drops it for the value-less pair.
  const schema = buildFilterJsonSchema([{ key: 'due', label: 'Due', type: 'date' }]) as any
  expect(schema.properties.conditions.items.required).toContain('value')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/workspaces/filter-schema.test.ts`
Expected: FAIL — enum lacks `is_empty`.

- [ ] **Step 3: Widen `ALL_CMPS`**

In `src/lib/workspaces/filter-schema.ts`, replace line 3:

```ts
const ALL_CMPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'is_empty', 'is_not_empty']
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/workspaces/filter-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workspaces/filter-schema.ts src/lib/workspaces/filter-schema.test.ts
git commit -m "$(cat <<'EOF'
feat(workspaces): let the AI filter emit is_empty/is_not_empty too

Keeps the manual builder and the model on one comparator vocabulary instead of
letting them drift.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The `FilterBuilder` popover

**Files:**
- Create: `src/components/workspaces/FilterBuilder.tsx`
- Test: `src/components/workspaces/FilterBuilder.test.tsx`

**Interfaces:**
- Consumes: `allowedCmps`, `validateFilter`, `isValueless`, `FilterError`, `Cmp`, `FilterSpec`, `FilterField` (Task 1); `GridField` from `./useWorkspaceGrid` (`{ id, key, label, type, position, required?, config? }`).
- Produces: `export function FilterBuilder(props: { fields: GridField[]; value: FilterSpec | null; onApply: (next: FilterSpec | null) => void; onClose: () => void })`. Presentational only — no fetching, no knowledge of views.

- [ ] **Step 1: Write the failing tests**

Create `src/components/workspaces/FilterBuilder.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBuilder } from './FilterBuilder'
import type { GridField } from './useWorkspaceGrid'

const fields: GridField[] = [
  { id: 'f1', key: 'name', label: 'Name', type: 'text', position: 0 },
  { id: 'f2', key: 'status', label: 'Status', type: 'choice', position: 1, config: { options: ['Todo', 'Done'] } },
  { id: 'f3', key: 'fee', label: 'Fee', type: 'currency', position: 2 },
  { id: 'f4', key: 'due', label: 'Due', type: 'date', position: 3 },
]

let onApply: ReturnType<typeof vi.fn>
let onClose: ReturnType<typeof vi.fn>
beforeEach(() => {
  onApply = vi.fn()
  onClose = vi.fn()
})

const open = (value = null as any) =>
  render(<FilterBuilder fields={fields} value={value} onApply={onApply} onClose={onClose} />)

describe('FilterBuilder', () => {
  it('starts empty with a single add-condition affordance', () => {
    open()
    expect(screen.getByRole('button', { name: /add condition/i })).toBeTruthy()
    expect(screen.queryByLabelText('Field 1')).toBeNull()
  })

  it('adds a row seeded with the first field and its first legal comparator', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    expect((screen.getByLabelText('Field 1') as HTMLSelectElement).value).toBe('name')
    expect((screen.getByLabelText('Comparator 1') as HTMLSelectElement).value).toBe('eq')
  })

  it('offers only the comparators legal for the chosen field type', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'status' } })
    const opts = Array.from((screen.getByLabelText('Comparator 1') as HTMLSelectElement).options).map((o) => o.value)
    // choice: eq, neq + the two value-less ones. No ordering comparators.
    expect(opts).toEqual(['eq', 'neq', 'is_empty', 'is_not_empty'])
  })

  it('resets a comparator that is illegal for the newly chosen field', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'fee' } })
    fireEvent.change(screen.getByLabelText('Comparator 1'), { target: { value: 'gt' } })
    // 'gt' is not legal for a choice field — it must fall back, not persist.
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'status' } })
    expect((screen.getByLabelText('Comparator 1') as HTMLSelectElement).value).toBe('eq')
  })

  it('renders a dropdown of options for a choice field', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'status' } })
    const opts = Array.from((screen.getByLabelText('Value 1') as HTMLSelectElement).options).map((o) => o.value)
    expect(opts).toEqual(['', 'Todo', 'Done'])
  })

  it('hides the value control for a value-less comparator', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'due' } })
    fireEvent.change(screen.getByLabelText('Comparator 1'), { target: { value: 'is_empty' } })
    expect(screen.queryByLabelText('Value 1')).toBeNull()
  })

  it('applies a validated spec and closes', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'status' } })
    fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'Done' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(onApply).toHaveBeenCalledWith({ op: 'and', conditions: [{ field: 'status', cmp: 'eq', value: 'Done' }] })
    expect(onClose).toHaveBeenCalled()
  })

  it('omits the value key entirely for a value-less condition', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'due' } })
    fireEvent.change(screen.getByLabelText('Comparator 1'), { target: { value: 'is_empty' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(onApply).toHaveBeenCalledWith({ op: 'and', conditions: [{ field: 'due', cmp: 'is_empty' }] })
  })

  it('shows the and/or toggle only once there are two conditions', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    expect(screen.queryByLabelText('Match')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    expect(screen.getByLabelText('Match')).toBeTruthy()
  })

  it('applies an or-filter when the toggle is switched', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'a' } })
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Value 2'), { target: { value: 'b' } })
    fireEvent.change(screen.getByLabelText('Match'), { target: { value: 'or' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(onApply).toHaveBeenCalledWith({
      op: 'or',
      conditions: [
        { field: 'name', cmp: 'eq', value: 'a' },
        { field: 'name', cmp: 'eq', value: 'b' },
      ],
    })
  })

  it('surfaces the validator message inline instead of applying', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Field 1'), { target: { value: 'due' } })
    fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: '07/01/2026' } })
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByText(/YYYY-MM-DD/)).toBeTruthy()
  })

  it('applies null when every row is removed', () => {
    open({ op: 'and', conditions: [{ field: 'name', cmp: 'eq', value: 'x' }] })
    fireEvent.click(screen.getByRole('button', { name: /remove condition 1/i }))
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))
    expect(onApply).toHaveBeenCalledWith(null)
  })

  it('hydrates from an existing filter so it can be edited', () => {
    open({ op: 'or', conditions: [{ field: 'status', cmp: 'neq', value: 'Done' }, { field: 'due', cmp: 'is_empty' }] })
    expect((screen.getByLabelText('Field 1') as HTMLSelectElement).value).toBe('status')
    expect((screen.getByLabelText('Comparator 1') as HTMLSelectElement).value).toBe('neq')
    expect((screen.getByLabelText('Comparator 2') as HTMLSelectElement).value).toBe('is_empty')
    expect((screen.getByLabelText('Match') as HTMLSelectElement).value).toBe('or')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/workspaces/FilterBuilder.test.tsx`
Expected: FAIL — cannot resolve `./FilterBuilder`.

- [ ] **Step 3: Write the component**

Create `src/components/workspaces/FilterBuilder.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import {
  allowedCmps,
  isValueless,
  validateFilter,
  FilterError,
  type Cmp,
  type FilterSpec,
  type FilterField,
} from '@/lib/workspaces/filter'
import type { GridField } from './useWorkspaceGrid'

const CMP_LABELS: Record<Cmp, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
}

const NUMERIC = ['number', 'currency', 'percent', 'rating']

// The draft keeps every value as a string — that is what form controls give us,
// and validateFilter's coerce() is the single place that turns strings into the
// field's real type. Parsing here as well would be a second, divergent coercion.
type Row = { field: string; cmp: Cmp; value: string }

const control = 'rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm'

export function FilterBuilder({
  fields,
  value,
  onApply,
  onClose,
}: {
  fields: GridField[]
  value: FilterSpec | null
  onApply: (next: FilterSpec | null) => void
  onClose: () => void
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    (value?.conditions ?? []).map((c) => ({
      field: c.field,
      cmp: c.cmp,
      value: c.value == null ? '' : String(c.value),
    }))
  )
  const [op, setOp] = useState<'and' | 'or'>(value?.op ?? 'and')
  const [error, setError] = useState('')

  const fieldFor = (key: string) => fields.find((f) => f.key === key)

  function addRow() {
    const first = fields[0]
    if (!first) return
    setRows((rs) => [...rs, { field: first.key, cmp: allowedCmps(first.type)[0], value: '' }])
  }

  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i))
  }

  function changeField(i: number, key: string) {
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r
        const legal = allowedCmps(fieldFor(key)?.type ?? 'text')
        const keep = legal.includes(r.cmp)
        // A comparator legal for the old type may be illegal for the new one
        // (fee > 100 → status > 100). Fall back rather than carry it over.
        return { field: key, cmp: keep ? r.cmp : legal[0], value: keep ? r.value : '' }
      })
    )
  }

  function changeCmp(i: number, cmp: Cmp) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, cmp, value: isValueless(cmp) ? '' : r.value } : r)))
  }

  function changeValue(i: number, v: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, value: v } : r)))
  }

  function apply() {
    if (rows.length === 0) {
      onApply(null)
      onClose()
      return
    }
    const draft = {
      op,
      conditions: rows.map((r) =>
        isValueless(r.cmp) ? { field: r.field, cmp: r.cmp } : { field: r.field, cmp: r.cmp, value: r.value }
      ),
    }
    try {
      // Same validator the server runs. Here it is only for instant feedback —
      // query-view.ts re-validates authoritatively on every read.
      const spec = validateFilter(draft, fields as unknown as FilterField[])
      setError('')
      onApply(spec)
      onClose()
    } catch (e) {
      setError(e instanceof FilterError ? e.message : 'That filter is not valid')
    }
  }

  function renderValue(row: Row, i: number) {
    if (isValueless(row.cmp)) return null
    const field = fieldFor(row.field)
    const label = `Value ${i + 1}`
    const common = { 'aria-label': label, className: `${control} min-w-0 flex-1`, value: row.value }

    if (field?.type === 'choice') {
      const options: string[] = field.config?.options ?? []
      return (
        <select {...common} onChange={(e) => changeValue(i, e.target.value)}>
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )
    }
    if (field?.type === 'checkbox') {
      return (
        <select {...common} onChange={(e) => changeValue(i, e.target.value)}>
          <option value="">Choose…</option>
          <option value="true">checked</option>
          <option value="false">unchecked</option>
        </select>
      )
    }
    // type=date yields the YYYY-MM-DD form coerce() demands, so an ambiguous
    // format can never be typed in the first place.
    const inputType = field?.type === 'date' ? 'date' : NUMERIC.includes(field?.type ?? '') ? 'number' : 'text'
    return <input {...common} type={inputType} onChange={(e) => changeValue(i, e.target.value)} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Filter</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show records where</span>
          {rows.length > 1 && (
            <select aria-label="Match" value={op} onChange={(e) => setOp(e.target.value as 'and' | 'or')} className={control}>
              <option value="and">all match</option>
              <option value="or">any match</option>
            </select>
          )}
        </div>

        {rows.length === 0 && (
          <p className="mb-3 text-sm text-muted-foreground">No conditions — this view shows every record.</p>
        )}

        <div className="mb-3 space-y-2">
          {rows.map((row, i) => {
            const legal = allowedCmps(fieldFor(row.field)?.type ?? 'text')
            return (
              <div key={i} className="flex items-center gap-2">
                <select aria-label={`Field ${i + 1}`} value={row.field} onChange={(e) => changeField(i, e.target.value)} className={`${control} min-w-0 flex-1`}>
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
                <select aria-label={`Comparator ${i + 1}`} value={row.cmp} onChange={(e) => changeCmp(i, e.target.value as Cmp)} className={control}>
                  {legal.map((c) => (
                    <option key={c} value={c}>{CMP_LABELS[c]}</option>
                  ))}
                </select>
                {renderValue(row, i)}
                <button onClick={() => removeRow(i)} aria-label={`Remove condition ${i + 1}`} className="text-muted-foreground hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>

        <button onClick={addRow} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-galli">
          <Plus size={14} /> Add condition
        </button>

        {error && <p className="mb-3 text-sm text-amber-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button onClick={apply} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-105">
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/workspaces/FilterBuilder.test.tsx`
Expected: PASS, all 13 tests.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/workspaces/FilterBuilder.tsx src/components/workspaces/FilterBuilder.test.tsx
git commit -m "$(cat <<'EOF'
feat(workspaces): FilterBuilder popover — build a filter without AI

Comparator lists come from allowedCmps(), so an illegal field/comparator pair
is unrepresentable in the UI rather than merely rejected after the fact.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire the Filter button into the toolbar

**Files:**
- Modify: `src/components/workspaces/WorkspaceViews.tsx` (imports at lines 5 + 11; search input at lines ~89–94; new render near the modals)

**Interfaces:**
- Consumes: `FilterBuilder` (Task 4); `grid.updateView(viewId: string, config: Record<string, any>): Promise<void>` (existing).
- Produces: nothing further tasks depend on.

- [ ] **Step 1: Add the imports**

In `src/components/workspaces/WorkspaceViews.tsx`, replace the lucide import on line 5:

```tsx
import { Plus, X, Upload, Filter } from 'lucide-react'
```

And add after the `FilterChips` import on line 11:

```tsx
import { FilterBuilder } from './FilterBuilder'
```

- [ ] **Step 2: Add the open/closed state**

After the `const [importing, setImporting] = useState(false)` line, add:

```tsx
  const [filtering, setFiltering] = useState(false)
```

- [ ] **Step 3: Put the button beside the search box**

Replace the standalone search `<input>` (the element with `placeholder="Search records…"`, including its `mb-3` class) with this wrapper:

```tsx
      <div className="mb-3 flex items-center gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search records…"
          className="w-full max-w-xs rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
        />
        {active && (
          <button
            onClick={() => setFiltering(true)}
            title="Filter records"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-galli"
          >
            <Filter size={14} /> Filter
            {active.config?.filter?.conditions?.length > 0 && (
              <span className="rounded-full bg-galli/10 px-1.5 text-xs font-semibold text-galli">
                {active.config.filter.conditions.length}
              </span>
            )}
          </button>
        )}
      </div>
```

- [ ] **Step 4: Render the builder**

At the end of the component's JSX, immediately after the closing `)}` of the `{importing && ( <ImportCsvModal … /> )}` block and before the final `</div>`, add:

```tsx
      {filtering && active && (
        <FilterBuilder
          fields={grid.fields}
          value={active.config?.filter ?? null}
          onClose={() => setFiltering(false)}
          onApply={(next) => {
            // Strip the old filter key first so clearing writes a config with no
            // `filter` at all, exactly like the chip's X already does.
            const { filter: _drop, ...rest } = active.config ?? {}
            grid.updateView(active.id, next ? { ...rest, filter: next } : rest)
          }}
        />
      )}
```

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc --noEmit && pnpm exec next lint`
Expected: tsc exit 0; lint reports no **errors** (pre-existing warnings elsewhere are fine, but none in the files you touched).

- [ ] **Step 6: Run the workspaces suite**

Run: `pnpm exec vitest run src/components/workspaces src/lib/workspaces`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/workspaces/WorkspaceViews.tsx
git commit -m "$(cat <<'EOF'
feat(workspaces): Filter button — build and edit the active view's filter

Filters were previously write-once at view creation and only via the AI path,
so an unset ANTHROPIC_API_KEY meant no filtering at all.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Live-DB verification, browser smoke, full green

**Files:**
- Create (temporary, NOT committed): `/private/tmp/claude-501/-Users-jenniferjordan/8a1d03b7-b732-4db0-8319-ea84effb5f33/scratchpad/verify-empty-sql.js`

**Interfaces:** none — verification only.

This is the assertion E deferred the comparators for. It must be **run**, not reasoned about. The unit tests prove `buildRecordsQuery` emits a given SQL string; this proves that string returns the right rows from real Postgres.

- [ ] **Step 1: Confirm Postgres is up**

Run:
```bash
~/.local/pgsetup/node_modules/@embedded-postgres/darwin-arm64/native/bin/pg_ctl -D ~/.local/pgdata status
```
Expected: `pg_ctl: server is running`. If not, start it with the command in Global Constraints.

- [ ] **Step 2: Write the verification script**

Create the scratchpad file above with:

```js
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  const user = (await db.user.findFirst()) ||
    (await db.user.create({ data: { email: 'verify@local.test', username: 'verifier', password: 'x' } }))

  const ws = await db.workspace.create({
    data: { ownerId: user.id, name: `verify-empty-${Date.now()}` },
  })

  // The four states emptiness has to distinguish.
  await db.workspaceRecord.createMany({
    data: [
      { workspaceId: ws.id, schemaVersion: 1, createdById: user.id, data: { other: 1 } },        // key absent
      { workspaceId: ws.id, schemaVersion: 1, createdById: user.id, data: { due: null } },       // JSON null
      { workspaceId: ws.id, schemaVersion: 1, createdById: user.id, data: { due: '' } },         // empty string
      { workspaceId: ws.id, schemaVersion: 1, createdById: user.id, data: { due: '2026-08-01' } }, // populated
    ],
  })

  const count = async (label, clause, params) => {
    const rows = await db.$queryRawUnsafe(
      `SELECT count(*)::int AS count FROM "WorkspaceRecord" WHERE "workspaceId" = $1 AND status = 'active' AND (${clause})`,
      ws.id, ...params
    )
    console.log(`${label}: ${rows[0].count}`)
    return rows[0].count
  }

  const isEmpty = await count('is_empty        ', `data->>$2 IS NULL OR data->>$2 = ''`, ['due'])
  const isNotEmpty = await count('is_not_empty    ', `data->>$2 IS NOT NULL AND data->>$2 <> ''`, ['due'])
  const neqNew = await count('neq (fixed)     ', `data->>$2 IS NULL OR NOT (data->>$2 = $3)`, ['due', '2026-08-01'])
  const neqOld = await count('neq (old, buggy)', `NOT (data->>$2 = $3)`, ['due', '2026-08-01'])

  await db.workspace.delete({ where: { id: ws.id } })

  const ok = isEmpty === 3 && isNotEmpty === 1 && neqNew === 3 && neqOld === 0
  console.log(ok ? '\nPASS — all four counts as expected' : '\nFAIL — unexpected counts')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 3: Run it**

Run:
```bash
cd /Users/jenniferjordan/joshwhirley/MyGalli && node /private/tmp/claude-501/-Users-jenniferjordan/8a1d03b7-b732-4db0-8319-ea84effb5f33/scratchpad/verify-empty-sql.js
```

Expected, exactly:
```
is_empty        : 3
is_not_empty    : 1
neq (fixed)     : 3
neq (old, buggy): 0

PASS — all four counts as expected
```

`is_empty` = 3 proves one clause catches missing key + JSON null + empty string. `neq (old, buggy)` = 0 is the bug reproduced: the old SQL matched *nothing*, because every row was either equal to the value or NULL. Record these numbers in the commit message.

- [ ] **Step 4: Full suite, typecheck, lint, build**

Run: `pnpm exec vitest run`
Expected: "1 failed" — and confirm the single failure is `src/app/api/messages/upload/route.test.ts`. Any other failure is yours.

Run: `pnpm exec tsc --noEmit && pnpm exec next lint && pnpm build`
Expected: tsc exit 0; no lint errors; build compiles successfully.

- [ ] **Step 5: Browser smoke**

Start the dev server (`pnpm dev`) and drive it with the `superpowers-chrome:browsing` skill. Log in as `owner@smoke.test` / `SmokeTest123!`, create a workspace with a `choice` column (`Status`: Todo/Done) and a `date` column (`Due`), add four records mirroring the four states above, then:

1. Click **Filter** — the popover opens with no conditions.
2. Add `Status is Done` → **Apply**. Chip reads "Status is Done"; the count matches.
3. Reopen **Filter** — the existing condition is hydrated, not blank. This is the edit path that did not previously exist.
4. Add a second condition, switch **Match** to "any match" → **Apply**. Chip reads "… or …".
5. Change one row to `Due is empty` — the value control disappears; Apply returns the records with no due date.
6. Reload the page — the filter is still applied (it persisted to the view).
7. Remove every row → **Apply** — the chip disappears and all records return.
8. Confirm the button shows a condition-count badge while a filter is active.

All eight must pass. Capture a screenshot of the open builder and of the applied chip.

- [ ] **Step 6: Commit the verification record**

The scratchpad script is NOT committed. Record the outcome:

```bash
git commit --allow-empty -m "$(cat <<'EOF'
test(workspaces): live-DB verification of empty/neq semantics

Ran against local Postgres over four records (key absent, JSON null, empty
string, populated):
  is_empty         3
  is_not_empty     1
  neq (fixed)      3
  neq (old, buggy) 0

is_empty=3 confirms one clause covers missing key, JSON null and empty string.
neq(old)=0 reproduces the bug the fix removes. This is the assertion the AI
filter spec deferred these comparators for.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Finish the branch**

Invoke `superpowers:finishing-a-development-branch` to choose merge vs PR.

---

## Notes / deferred (out of scope)

- Nested boolean logic `(A and B) or C`, and `is any of` for choice fields — both need a `FilterSpec` shape change that ripples through validation, SQL and the model's schema.
- Reusing `FilterBuilder` inside `AddViewModal` beside the AI box. The component is deliberately context-free so this is a later drop-in.
- Filters on public/shared pages; cross-workspace filters; saved filter presets; per-column header filter chips.
- `/api/generate` is pinned to the stale model `claude-sonnet-4-20250514` while `filter-suggest` uses a current one. Unrelated to filtering; worth its own cleanup.

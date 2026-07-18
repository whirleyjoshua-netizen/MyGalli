# Workspaces F1 — Operate the Grid: Sort, Search, Pager (Design)

**Date:** 2026-07-17
**Status:** Approved design (lead-authored), pre-implementation
**Depends on:** A + B + D (live in prod), C (views), E (AI filter) — all present on `workspaces-e-ai-filter`, reconciled onto current main.

## Context
The Workspaces feature can define typed data and display it (grid/gallery/kanban + KPI + record→page). What a real user can't yet do is **operate** a table day to day: there is no sort, no search, and no way to reach records past the first 100 (the grid renders only the fetched page; E made the count honest, so the UI now truthfully says "126" while showing 100). F1 closes those three, turning the grid from a viewer into a working table.

## Scope (lead call)
- **Sort** — click a column header to sort the whole dataset; persisted on the view.
- **Search** — a case-insensitive find box across record values; ephemeral.
- **Pager** — Prev/Next + "Showing X–Y of N" to reach every record.

Deferred: multi-column sort, saved searches, per-column filter chips (E covers filtering), infinite scroll.

## The pivotal constraint (verified against the dev DB)
**Prisma cannot `orderBy` a JSONB field path** — confirmed empirically (`orderBy: { data: { path: ['gpa'], sort: 'desc' } }` returns nothing). Server-side sort therefore **requires raw SQL**. Verified working:
- `ORDER BY (data->>'gpa')::numeric DESC` → correct numeric order (Priya 3.95, Ava 3.82, Marcus 3.48), not the lexicographic trap.
- Value-only case-insensitive search: `EXISTS (SELECT 1 FROM jsonb_each_text(data) WHERE value ILIKE $term)` → matches record *values* only, never field keys.

So F1 moves the per-view records+count read from Prisma `findMany` onto **one parameterized raw-SQL query** that does filter + search + sort + pagination together.

## Architecture

### New pure module: `src/lib/workspaces/records-query.ts`
```ts
type SortSpec = { field: string; dir: 'asc' | 'desc' }
type BuildInput = {
  workspaceId: string
  fields: FilterField[]         // from filter.ts — the real schema
  filter?: FilterSpec | null    // already validated by validateFilter
  search?: string | null
  sort?: SortSpec | null        // already validated (field exists)
  page: number
  pageSize: number
}
type BuiltQuery = { sql: string; countSql: string; params: any[] }
export function buildRecordsQuery(input: BuildInput): BuiltQuery
```
- **Pure** — no DB. Returns the exact parameterized SQL strings + param array. This makes the SQL *itself* unit-testable (assert the string + params for representative inputs); the live smoke proves it executes.
- **Injection-safe by construction:**
  - Field keys go in as **query parameters** (`data->>$n`), never string-interpolated. (Postgres accepts a parameter as the `->>` right operand.)
  - Condition values are parameters.
  - The only things placed into the SQL string from code are: comparison operators (fixed per `Cmp`), the sort **direction** (from the `'asc'|'desc'` enum → `ASC`/`DESC`), and the sort **cast type** (from a fixed branch on the field's type → `::numeric`, `::date`, or none). None of these derive from raw user text.
- **Type-aware ordering** — numeric-family fields (`number`/`currency`/`percent`/`rating`) cast `::numeric`; `date` casts `::date`; everything else orders as text. Ordering uses `NULLS LAST` in both directions so records missing the sorted value sink to the bottom. A `"createdAt" ASC` tiebreaker follows every sort so pagination is **stable** (no row shifting between pages on ties).
- **Filter → SQL** — a local `filterConditionSql(condition)` reproduces `filterToPrismaWhere`'s exact semantics so filter results are identical whether executed via Prisma or SQL. Mapping: `eq`→`data->>$k = $v`; `neq`→`NOT (data->>$k = $v)` (which, like E's Prisma `NOT { equals }`, **excludes** records where the key is absent — `NULL = v` is `NULL`, `NOT NULL` is `NULL` → row dropped); `contains`→`data->>$k LIKE $v` (E's `string_contains`, case-sensitive — unchanged here; case-insensitivity is the *search* box's job, not filter's); numeric comparisons (`gt`/`gte`/`lt`/`lte`) cast both sides `(data->>$k)::numeric </<= $v::numeric`. `and`/`or` join the conditions. `validateFilter` is still the security boundary and runs *before* this (in `queryWorkspaceView`), unchanged — F1 does not touch `filter.ts`'s validation.
- **Search → SQL** — `search` (trimmed, non-empty) adds `AND EXISTS (SELECT 1 FROM jsonb_each_text(data) WHERE value ILIKE $n)` with param `%term%` (ILIKE special chars `%`/`_` in the term escaped). Applied on top of the filter.

### `src/lib/workspaces/query-view.ts` (rewire, keep the shape)
- Keep steps 1–3 (authorize, load view, load fields) and step 5 (visibleFields projection) exactly as they are.
- Step 4 becomes: re-validate `config.filter` (unchanged, still degrades to `filterError` on a stale filter) **and** re-validate `config.sort` the same way — if `sort.field` is not a current field key, drop the sort and surface a `sortError` (a retyped/deleted column shouldn't 500 the view). Then call `buildRecordsQuery(...)`, run `db.$queryRawUnsafe(sql, ...params)` for records and `db.$queryRawUnsafe(countSql, ...params)` for the total.
- Return shape adds `sort: SortSpec | null` (the effective sort, for the UI to show the active header) and `sortError?: string`. `pagination` already carries `total`.

### API: `src/app/api/workspaces/[id]/views/[viewId]/records/route.ts`
- Already clamps `page`/`pageSize` (E). Add `search` passthrough: read `?search=` (cap length, e.g. 200 chars) → `queryWorkspaceView({ ..., search })`.
- Sort is **not** a query param — it lives on the view config (persisted), read inside `queryWorkspaceView`.

### Views POST/PATCH (`.../views/route.ts`, `.../views/[viewId]/route.ts`)
- Validate `config.sort` when a view is created or updated: `{ field, dir }` where `field` is a real key and `dir ∈ {asc,desc}`; else 400. Mirror exactly how E validates `config.filter` (POST 400, whole-config normalize). Store as-is.

### Hook + UI (`useWorkspaceGrid`, `GridView`, `WorkspaceViews`)
- **Hook** gains: `page` + `setPage`; `search` + `setSearch` (debounced ~300ms); and `setSort(field)` which cycles the active view's `config.sort` for that field **asc → desc → none**, PATCHes the view (reusing the existing `updateView`), and reloads. `loadViewRecords` sends `?page=&search=`. Changing view, filter, or search **resets `page` to 1**. `total`/`recordsViewId` gating from E is preserved.
- **GridView headers** become sort controls: click cycles asc/desc/none; the active column shows a ▲/▼ affordance. Only the header's sort control is added — the existing add/delete column/row stays.
- **WorkspaceViews** renders the search box (near the filter chips) and, below the grid, the pager: `‹ Prev  Showing 1–100 of 126  Next ›` (buttons disabled at the ends). A `sortError`/`filterError` shows the same amber degraded-notice E already uses.

## Testing
- **`records-query.test.ts` (pure, TDD, no DB):** assert exact `sql`/`countSql`/`params` for: filter-only; search-only (ILIKE param + escaping); sort numeric (`::numeric ... DESC NULLS LAST` + `createdAt` tiebreaker); sort text; filter+search+sort combined; pagination `LIMIT/OFFSET`. Assert **every** user value (keys, condition values, search term) appears in `params`, never in the SQL string — this is the injection guarantee, checked mechanically.
- **`query-view.test.ts`:** `$queryRawUnsafe` mocked — assert it's called with the builder's sql+params; a stale `config.sort` (unknown field) drops sort and sets `sortError` without throwing; no-sort/no-search behaves as today.
- **Route + views validation:** `?search=` reaches `queryWorkspaceView`; POST/PATCH 400 on a sort naming an unknown field or a bad dir; sort persists normalized.
- **Component:** clicking a header cycles the persisted sort; the pager disables at both ends; search input is debounced.
- **Live DB smoke (load-bearing — mocked Prisma cannot prove SQL runs):** against the seeded Students set (>100 rows): sort by GPA desc returns true numeric order across the *whole* set (not just the page); search "carter" finds the Ms. Carter students by value; the pager walks 1–100 then 101–126 with stable order; a numeric sort excludes/positions the null-GPA row last.

## Risks
- **Raw SQL injection** — mitigated structurally (params for all user data, enums/fixed branches for the rest) and checked by the "every value is a param" test. This is the primary risk and the reason the builder is pure and exhaustively asserted.
- **Non-castable numeric cell** — `(data->>'gpa')::numeric` throws if a corrupt non-numeric value was stored. The write path already coerces number cells, so clean data is castable; a pre-existing bad cell could break sort-by-that-column. Documented; defensive `try_cast` is a follow-up, not v1.
- **`neq` + missing key** (inherited from E, confirmed) — keep E's exact semantics in the SQL translation so filter behavior is identical whether Prisma- or SQL-executed; do not "fix" it here (out of scope, tracked).

## Out of scope
Multi-column sort, saved/named searches, fuzzy search, per-column type-aware filter UI (E owns filtering), CSV import (F2), record→page UI (F3), infinite scroll.

## Success criteria
On the Students workspace: clicking **GPA** sorts all 126 students by GPA (numeric, whole-set), and the sort survives a reload of that view. Typing "carter" narrows to the Ms. Carter students. The pager reaches students 101–126. tsc/lint/tests green; the DB smoke confirms the SQL executes and returns correct rows.

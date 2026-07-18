# Workspaces F2 — CSV Import (Design)

**Date:** 2026-07-18
**Status:** Approved design (lead-authored), pre-implementation
**Depends on:** A/B (fields + validator), C (views), E (filter), F1 (sort/search/pager) — all on `workspaces-e-ai-filter`.

## Context
A workspace can only be filled one cell at a time. Nobody hand-types a 30-student roster, so the feature stalls at adoption. F2 adds **CSV import**: drop a file, map its columns to the workspace's fields, and bulk-create records — reusing the exact same typed validation the single-record path already runs, so imported data is as trustworthy as hand-entered data.

## Scope (lead call, user-confirmed)
- **Client-side parse** (`papaparse`) → instant header/preview, then mapped JSON rows sent to the server.
- **Map to existing fields only** — unmatched CSV columns are shown as "won't import" and ignored (creating fields from a column is a fast follow-up, F2.1).
- **Partial import** — validate all rows first; insert the valid ones and report the skipped ones with reasons. Never all-or-nothing; never silent drops.

Deferred: creating fields from unmatched columns, de-duplication/upsert, Excel/`.xlsx`, updating existing records, scheduled/re-import.

## Architecture

### New dependency
`papaparse` (client-only, ~45KB) + `@types/papaparse` (dev). Battle-tested CSV parsing (quotes, escapes, embedded newlines, encodings) — hand-rolling this is a correctness liability.

### Pure module: `src/lib/workspaces/import.ts` (no DB)
```ts
import { validateWorkspaceRecord } from '@/lib/workspace-validator' // (fields, input) => {success,data?,errors?}

// The workspace fields as returned by db.workspaceField.findMany and as
// validateWorkspaceRecord already consumes them (key/label/type/config/required...).
// Declare a single structural type in this module and use it for BOTH functions:
type ImportField = { key: string; label: string; type: string; config?: any; required?: boolean }

// CSV header -> field key (or null = won't import). Case-insensitive match on label then key.
export function autoMatchColumns(headers: string[], fields: ImportField[]): Record<string, string | null>

export type ImportRowError = { row: number; field: string; message: string }
export type ImportValidation = {
  valid: Array<Record<string, any>>   // coerced record data, ready to insert
  errors: ImportRowError[]            // per (row,field) failures
  validCount: number
  skippedCount: number                // rows with >=1 error
}
// rows are ALREADY mapped header->fieldKey client-side. Fields fetched once by the caller.
export function validateImportRows(fields: ImportField[], rows: Array<Record<string, unknown>>): ImportValidation
```
`validateImportRows` runs the existing `validateWorkspaceRecord(fields, row)` per row (row index is 1-based for user-facing messages), pushes `validation.data` to `valid` on success, and flattens `validation.errors` (field→message) into `ImportRowError[]` on failure. A row with any error is skipped whole (not partially inserted). Both functions are pure → fully unit-testable without a DB.

### Endpoint: `POST /api/workspaces/[id]/records/import`
Body: `{ rows: Array<Record<string, unknown>>, dryRun?: boolean }`.
- Auth (`getUser`) → 401; `authorizeWorkspace` → 404; returns the workspace (for `schemaVersion`).
- **Row cap:** reject > 5000 rows (400) to bound payload/DB work.
- Fetch fields once; `validateImportRows(fields, rows)`.
- **`dryRun: true`** → return `{ validCount, skippedCount, errors }` only (the preview step). No writes.
- **`dryRun` falsy** → `db.workspaceRecord.createMany({ data: valid.map(d => ({ workspaceId, data: d, schemaVersion: workspace.schemaVersion, createdById: user.id, status: 'active' })) })`, then return `{ inserted: valid.length, skipped: skippedCount, errors }`.
  - `createMany` is one round-trip for the whole batch (vs per-row `createWorkspaceRecord`). Import rows carry no `displayId`, so the single-record path's `P2002` display-link conflict cannot occur here.

### Client
- **`ImportCsvModal.tsx`** — three steps:
  1. **File** — drop/pick a `.csv`; `Papa.parse(file, { header: true, skipEmptyLines: true })` → headers + rows in-browser. Show row count + first ~5 rows.
  2. **Map** — for each CSV header, a select prefilled by `autoMatchColumns` (field label or "Don't import"); unmatched headers default to "Don't import" and are visibly greyed. Build the mapped rows (header→fieldKey) client-side.
  3. **Validate & confirm** — call the endpoint with `dryRun: true`, render the report (`120 rows · 117 valid · 3 skipped` + each skipped row/field/reason). Button **"Import 117"** calls the endpoint for real; on success close + refresh the grid (reuse the hook's reload).
- **Entry point:** an "Import CSV" button in `WorkspaceViews` header (near the view switcher / add-record affordance).

## Testing
- **`import.test.ts` (pure, TDD):** `autoMatchColumns` — exact/case-insensitive/label-vs-key match, no-match→null, a header matching two fields resolves deterministically; `validateImportRows` — all-valid coerces types (number "1200"→1200, choice validated, date), a bad cell yields one `ImportRowError` and skips that row while keeping the rest, empty rows list → zero counts, 1-based row numbers in messages.
- **Route:** `dryRun` returns the report and does NOT call `createMany`; real import calls `createMany` with only the valid coerced rows and returns `{inserted,skipped,errors}`; 401 unauth; 404 foreign workspace; 400 over the 5000-row cap; unmapped columns absent from stored data.
- **Component:** mapping auto-fills from headers; "Don't import" excludes a column; the report lists skipped rows; confirm triggers the real call + grid refresh.
- **Live-DB smoke (load-bearing — `createMany` + coercion vs real Postgres):** import a CSV with ~10 rows incl. 2 deliberately bad (non-numeric GPA, invalid choice); confirm valid rows land with correct JSON types (numbers as numbers, dates as ISO), the 2 bad rows are reported not inserted, the grid count rises by exactly the valid count, and the imported rows render correctly through F1's grid (sortable/searchable).

## Risks
- **Large paste / memory:** the 5000-row cap bounds it; papaparse streams client-side. Bigger files are a future chunked-import concern.
- **createMany bypasses per-row hooks:** acceptable — the only per-row logic that matters (typed validation/coercion) runs in `validateImportRows` before insert; there are no other side effects on create.
- **Header collisions:** two CSV headers mapping to the same field — `autoMatchColumns` picks the first; the mapping UI lets the user fix it. Documented.

## Out of scope
Creating fields from unmatched columns (F2.1), de-dupe/upsert, `.xlsx`, updating existing records, re-import/sync, per-cell fix-in-place in the preview.

## Success criteria
On the Students workspace: dropping a CSV of students maps its columns to Name/Grade/GPA/… , shows a validity report, and imports the valid rows in one action — with GPA stored as a number and Grade validated against its options, bad rows surfaced not silently dropped, and the imported records immediately sortable/searchable via F1. tsc/lint/tests green; the live smoke confirms `createMany` + coercion against real Postgres.

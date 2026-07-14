# Workspaces — Sub-project A: Foundation (Design)

**Date:** 2026-07-14
**Status:** Approved design, pre-implementation
**Author:** Joshua + Claude

## Context

Galli is evolving from a page builder into a **3-layer knowledge engine**:

- **Layer 1 — Displays:** visual experiences (already built). Become *consumers* of data.
- **Layer 2 — Workspaces:** the new source of truth. A standalone database that owns schema + records. NOT a page, NOT a board.
- **Layer 3 — Renderers/Views:** the same records rendered many ways (gallery, cards, calendar, KPI, dashboard…).

The full vision spans five independently-shippable sub-projects:

| # | Sub-project | Delivers | Depends on |
|---|---|---|---|
| **A** | **Workspace foundation** | Create workspace, define fields, add/edit/delete records in a working grid | — |
| B | Field-type system | Broaden field types (currency, %, rating, person, tags, url…) | A |
| C | View/renderer layer | Same records as gallery/cards/calendar/etc. | A(+B) |
| D | Display↔record binding + live elements | A record can *be* a page; KPI/chart elements pull live aggregates | A |
| E | AI-over-schema | Natural-language queries over the JSONB | A–D |

**This spec covers Sub-project A only.** It turns the existing POC (built in a prior Gemini session, currently uncommitted in the working tree) into a usable foundation.

### Locked product decisions (from brainstorming)

1. **Edit model = spreadsheet grid, inline.** Airtable/Excel feel: add rows, click cells to edit in place. (Not form-modal.)
2. **Field types in A = Core 5:** Text, Number, Date, Single-select, Checkbox. All other types are Sub-project B.
3. **Gating = free for now.** Ship A ungated to dogfood + drive adoption; gating (Pro or freemium) is a later decision tied to the premium surfaces in C/D/E.
4. **Architecture = Option 1 (Direct).** The grid reads the workspace directly; the existing `WorkspaceView` models/routes stay dormant until Sub-project C.
5. **Persistence = per-cell optimistic autosave.** Cell edits save on blur via `PATCH`; UI updates instantly and rolls back on error.

## Current state (what exists vs. what A adds)

**Already built (reusable):**
- Models `Workspace` / `WorkspaceField` / `WorkspaceRecord` (JSONB `data`) / `WorkspaceView` + `Display.workspaceRecord` back-relation.
- Layered backend: `authorize.ts` → `workspaces/validator.ts` → `workspace-validator.ts` (pure, TDD, 4 tests) → `service.ts` → `query-view.ts`.
- Routes: `POST/GET /api/workspaces`, `GET/POST …/fields`, `POST …/records`, `POST …/views`, `PATCH …/views/[viewId]`, `GET …/views/[viewId]/records`.
- UI: read-only `WorkspaceTable`, `ViewConfigPanel`, `/workspaces` (stub) + `/workspaces/[id]` (POC).
- Sidebar nav "Workspaces" (Database icon → `/workspaces`).

**Known defects to fix in A:**
- `src/lib/workspaces/service.ts:32` — `authorizeWorkspace` selects only `{id, ownerId}` but `service.ts` reads `workspace.schemaVersion` → records currently get `schemaVersion: undefined`.
- `src/app/api/workspaces/[id]/views/[viewId]/records/route.test.ts` — missing `NextRequest` import (TS error).
- **No migration exists** — `schema.prisma` was edited but never migrated.

## Design

### 1. Data model, migration & validation

**No structural model changes.** The 4 models are correct. Changes are behavioral:

- **Fix `service.ts` bug:** `authorizeWorkspace` also `select: { schemaVersion: true }`.
- **Add `checkbox` to the validator:** one `case 'checkbox' → Boolean(...)` in `workspace-validator.ts`.
- **Stable, server-generated field `key`:** the client sends a `label` ("Final Grade"); the API derives a stable `key` (slug `final_grade`, de-duped against existing keys) **once at creation and never again**. Renaming a field changes `label` only — `key` is frozen so `record.data` keys never break. This is A's most important data-integrity rule.
- **`required` is a soft hint in A:** per-cell saves validate only the *type* of the changed field and never block on "required field still empty." `required` renders a visual asterisk; hard enforcement is deferred. This is what lets you add a blank row and fill it in.
- **Single-select options:** stored in `field.config = { options: string[] }` (already what the validator reads). Managed by the column editor.

**Migration:** hand-author `prisma/migrations/<ts>_add_workspaces/migration.sql` containing **only** the 4 `Workspace*` tables + the `Display.workspaceRecord` FK. Do **not** trust `prisma migrate diff` on the shared dev DB (it would emit spurious `DROP TABLE` for concurrent branches' tables). Additive → deploys clean to prod Neon. Set `DATABASE_URL_UNPOOLED` alongside `DATABASE_URL` for prisma commands.

### 2. API additions

All owner-gated via `getUser` + `authorizeWorkspace`.

| Route | Method | Purpose | Status |
|---|---|---|---|
| `/api/workspaces/[id]` | GET | Grid read: workspace + fields (ordered) + records (paginated) | new |
| `/api/workspaces/[id]` | PATCH / DELETE | Rename/edit · delete workspace (cascades) | new |
| `/api/workspaces/[id]/fields` | POST | Add column — **modified** to take `label`, derive stable `key` server-side | modify |
| `/api/workspaces/[id]/fields/[fieldId]` | PATCH / DELETE | Rename label · edit select options · reorder (`position`) · delete column | new |
| `/api/workspaces/[id]/records` | POST | Add row — reused; empty `{}` body creates a blank row | reuse |
| `/api/workspaces/[id]/records/[recordId]` | PATCH / DELETE | Per-cell save (partial merge) · delete row | new |

**PATCH record = partial merge.** New service fn `updateWorkspaceRecord`: load record → validate *only the incoming changed field(s)* by type (reject unknown keys, coerce value) → shallow-merge into `data` → save with `updatedById`. Never touches untouched cells; never enforces required.

**Validator loses its hard "required" block** (per §1), so the empty-row `POST` and partial `PATCH` both pass. Strict unknown-key rejection stays.

Deletes rely on schema `onDelete: Cascade`.

### 3. Grid UI

Two load-bearing abstractions; everything else is thin.

**Data hook — `useWorkspaceGrid(workspaceId)`.** One place owns all network + optimistic state. Fetches `GET /api/workspaces/[id]`; exposes `addRow()`, `updateCell(recordId, key, value)`, `deleteRow(id)`, `addField(...)`, `updateField(...)`, `deleteField(id)`. Each applies the change to local state immediately, fires the API call, and **rolls back + toasts on error**. Components never call `fetch`. This is the unit with real logic → tested hardest.

**Component tree:**

```
/workspaces  (list — replaces the stub)
  ├─ WorkspacesListPage → GET /api/workspaces
  ├─ WorkspaceCard (tile per workspace)
  └─ CreateWorkspaceModal (name/icon → POST → navigate)

/workspaces/[id]  (rewrites the POC page)
  └─ WorkspaceGrid  (uses useWorkspaceGrid)
       ├─ GridHeader
       │    ├─ ColumnHeaderCell  (menu: rename · options · delete · reorder)
       │    └─ AddColumnButton → ColumnEditorPopover
       ├─ GridRow  (one per record; + row delete)
       │    └─ GridCell  ← dispatches by field.type
       │         ├─ TextCell  ├─ NumberCell  ├─ DateCell
       │         └─ SelectCell  └─ CheckboxCell
       └─ AddRowButton  (POST empty row, append optimistically)
```

**`GridCell`** is the seam that makes Core-5 tractable: switches on `field.type` to one of five small editors, each with the same contract — show value, click to edit, **save on blur/Enter, Esc to cancel**. Adding a 6th type (Sub-project B) = one new cell component, nothing else changes.

**`ColumnEditorPopover`** handles add/edit field: label input, type picker, (for `select`) options list editor.

The read-only `WorkspaceTable.tsx` is **absorbed into `WorkspaceGrid`**. Styling follows existing Tailwind semantic tokens (`surface`/`border`/`muted`).

### 4. Error handling

- **API:** reuse the status-code contract (`401`/`404`/`409`/`422`/`400`/`500`). Lift `handleWorkspaceError` from the records route so field/workspace routes share it.
- **Optimistic rollback:** any non-2xx → hook reverts that cell/row/column and toasts. A `422` on a cell reverts just that cell and surfaces the field message.
- **Concurrency:** partial-merge PATCH means different-cell edits never clobber; same-cell = last-write-wins. Fine for A (owner-only editing).
- **Grid states:** loading skeleton · "couldn't load — retry" · empty workspace → "add your first column" prompt.
- **Destructive actions:** deleting a column or workspace → confirm dialog. Orphaned `record.data` keys after a column delete are ignored by the grid (no cleanup needed).

### 5. Testing

- **Pure units (Vitest, no DB):** extend validator tests for `checkbox` + soft-required; new `deriveFieldKey(label, existingKeys)` gets its own tests (slug · de-dupe · stability-on-rename).
- **Service:** `updateWorkspaceRecord` partial-merge (mocked db — merges, rejects unknown key, coerces type, ignores required); confirm `createWorkspaceRecord` writes a real `schemaVersion`.
- **API routes:** extend the existing `.test.ts` pattern to the new GET-workspace / PATCH-DELETE record / PATCH-DELETE field routes; **fix the missing `NextRequest` import** in the current test file.
- **Green CI:** both current TS errors resolved; tsc + lint + test + build stay passing.
- **Verification (run, not deferred):** browser smoke — create workspace → add a column of each of the 5 types → add rows → edit cells → reorder/delete column → reload and confirm persistence.

## Out of scope for A (explicit)

- Any field type beyond the Core 5 (→ B).
- View abstraction / alternate renderers; `WorkspaceView` stays dormant (→ C).
- Display↔record binding, live KPI/aggregate elements (→ D).
- AI queries (→ E).
- Gating / billing / usage limits.
- Hard required-field enforcement; field type-change on existing data; drag-reorder polish (keyboard/arrow reorder is enough for A).
- Multi-user editing / real-time presence (owner-only in A).

## Success criteria

A user can, entirely in the browser and with everything persisting across reload:
create a "Students" workspace → add Name (text), Grade (number), Attendance (number), Sport (single-select: Soccer/Tennis/None), Active (checkbox) columns → add several rows → edit any cell inline → rename/reorder/delete a column → delete a row. CI stays green; the migration deploys to prod Neon cleanly.

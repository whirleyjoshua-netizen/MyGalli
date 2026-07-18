# Workspaces — Sub-project C: View / Renderer Layer (Design)

**Date:** 2026-07-14
**Status:** Approved design (lead-authored), pre-implementation
**Depends on:** A (grid) + B (field types) + D (KPI) — all live.

## Context
Layer 3 of the vision: the *same* Workspace records rendered many ways. A shipped a single Grid (records read directly). C activates the dormant `WorkspaceView` model so a workspace can have multiple saved views, each rendering the same records differently, with a view switcher.

## Scope (lead call)
Three renderers + a switcher + saved views:
- **Grid** (the existing table — the editing surface).
- **Gallery** — records as cards (a chosen title field + a few fields).
- **Kanban** — records grouped into columns by a chosen single-select (`choice`) field.

All three consume the **same** `fields`+`records` already fetched by the detail page — no per-view data endpoint. Views persist in `WorkspaceView` (type + config). Deferred: Calendar/Map/Timeline renderers, drag-to-move on Kanban, filters/sort per view, inline editing in Gallery/Kanban (Grid stays the editor).

## Architecture

### Data (`WorkspaceView` — already exists, no migration)
`type ∈ 'grid' | 'gallery' | 'kanban'`. `config`:
- grid: `{}`
- gallery: `{ titleField?: string }` (field key for the card title; default = first text field)
- kanban: `{ groupByField: string }` (a `choice` field key)

### API
- **`GET /api/workspaces/[id]`** — add `views: WorkspaceView[]` (ordered by position) to the response. **Ensure a default view**: if the workspace has zero views, create one `{ name: 'Grid', type: 'grid', config: {}, position: 0 }` before returning (so every workspace always has ≥1 view).
- **`POST …/views`** — already exists; **broaden** the type check from `'table'`-only to `grid|gallery|kanban`, and validate config (kanban requires a `groupByField` that is a `choice` field). Returns the created view.
- **`DELETE …/views/[viewId]`** — **new**; owner-gated, scoped `{id: viewId, workspaceId}`. Refuse to delete the last remaining view (400) so a workspace always has one.
- (The dormant `queryWorkspaceView` / `views/[viewId]/records` route stays unused — views render client-side from the already-fetched records.)

### Hook (`useWorkspaceGrid`)
Add: `views: WorkspaceView[]`; `addView(name, type, config)`; `deleteView(id)` (both reload after). Keep everything else.

### UI
- **`WorkspaceViews`** (refactor of `WorkspaceGrid`): owns the header + a **view-switcher tab bar** (view names, active highlight, "+ Add view") + renders the active view. Active view = `?view=<id>` URL param, defaulting to the first view. Empty-state (no fields) unchanged.
- **`GridView`** — the existing table extracted verbatim from `WorkspaceGrid` (edit surface: cells, add/delete row+column). Props: the grid hook.
- **`GalleryView`** — a responsive card grid; each record → a card showing the title field prominently + the other fields (label: value via `formatFieldValue`). Read-only (click a card → later; v1 just displays).
- **`KanbanView`** — columns = the group field's `config.options` + an "Uncategorized" column for null/other; each record → a compact card under its column. Read-only v1.
- **`AddViewModal`** — name + type picker + config (gallery: title-field select; kanban: group-by choice-field select, required). Follows the existing modal pattern.

## Testing
- **Routes (Vitest):** GET returns views + auto-creates a default when none; POST views accepts the 3 types + rejects kanban without a valid choice groupByField (400); DELETE view (200) but 400 on the last view.
- **Pure helper (`src/lib/workspaces/kanban.ts`, TDD):** `groupRecordsByField(records, fieldKey, options)` → `{ [option|__uncategorized]: records[] }` (covers null/unknown values → uncategorized).
- **Component:** GalleryView renders a card per record with the title; KanbanView renders a column per option with the right records.
- **Verify:** tsc/lint/full-suite green; browser smoke — create a gallery + a kanban view, switch between them, confirm the same records render three ways.

## Out of scope
Calendar/Map/Timeline renderers, Kanban drag-to-move, per-view filters/sort/visible-fields, editing in Gallery/Kanban, view rename/reorder UI (create+delete only), the public/shared rendering of views.

## Success criteria
A workspace shows a **Grid / Gallery / Kanban** switcher. Adding a Gallery view renders records as cards; adding a Kanban view grouped by a choice field renders records in columns. Switching views re-renders the same records. Views persist. tsc/lint/tests green.

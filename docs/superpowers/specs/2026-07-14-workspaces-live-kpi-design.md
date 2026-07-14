# Workspaces — Sub-project D: Live KPI Element (Design)

**Date:** 2026-07-14
**Status:** Approved design (lead-authored), pre-implementation
**Author:** Claude (lead), for Joshua
**Depends on:** Sub-project A (Workspace foundation — branch `workspaces-foundation`)

## Context

The 3-layer "knowledge engine" vision (see `workspaces-vision` memory): Displays (Layer 1) become *consumers* of Workspace data (Layer 2), rendered many ways (Layer 3). This sub-project delivers the **money shot**: a Display canvas element that renders a **live aggregate** pulled from a Workspace field — e.g. `Average GPA 3.74`, computed from the owner's records, not typed in. It connects all three layers end to end.

Sub-project D is the smallest slice that proves the thesis. It builds on A's number fields; richer field types (B) and alternate renderers/views (C) come later.

## Locked decisions (lead calls)

1. **New canvas element `workspace-kpi`** via the standard 7-seam element pattern (precedent: `live-feed`, `kpi`).
2. **Binding lives in element JSON** (like every other element) — NOT a separate DB model. No migration. Fields: workspace id/name, field key/label, aggregation, optional custom label + suffix, and a cached computed value.
3. **Aggregations (v1):** `count | sum | avg | min | max`. `sum/avg/min/max` operate over finite-numeric values of the bound field; `count` = number of active records. No filters, no multi-metric, owner-owned workspaces only. (Filters, real-time, collaborator workspaces = follow-ups.)
4. **Security/privacy — server-side compute, no public probe surface:**
   - The published page (`src/app/[username]/[slug]/page.tsx`) is an async Server Component with Prisma. It computes each KPI's aggregate **server-side at render** and injects the number into the element before rendering. A visitor sees only the single number, never records.
   - The published page verifies the bound workspace is **owned by the page owner** before computing; otherwise the value is `null` (dash). This prevents embedding another user's workspace aggregate.
   - The **only** API endpoint is `GET /api/workspaces/[id]/aggregate` — **owner-gated** (`getUser` + `authorizeWorkspace`) — used exclusively by the editor for a live preview. There is no public aggregate endpoint, so no arbitrary-aggregate probing.
5. **Editor freshness = live** (fetches on bind/edit); **published freshness = as-of-render** (server-computed each SSR/ISR pass). True real-time polling is a follow-up.

## Architecture

### Element JSON (extend `CanvasElement` in `src/lib/types/canvas.ts`)
```ts
// workspace-kpi
workspaceKpiWorkspaceId?: string
workspaceKpiWorkspaceName?: string   // denormalized for editor display
workspaceKpiFieldKey?: string
workspaceKpiFieldLabel?: string      // denormalized for display
workspaceKpiAgg?: 'count' | 'sum' | 'avg' | 'min' | 'max'
workspaceKpiLabel?: string           // optional custom label; default `${Agg} of ${fieldLabel}`
workspaceKpiSuffix?: string          // optional unit, e.g. "%", "lbs"
workspaceKpiValue?: number | null    // cached last-computed value (refreshed server-side on publish)
```
Add `'workspace-kpi'` to the `ElementType` union and a `createElement('workspace-kpi')` case (all bindings undefined, agg default `'avg'`).

### Aggregate logic (`src/lib/workspaces/aggregate.ts` — pure, TDD)
```ts
export type WorkspaceAgg = 'count' | 'sum' | 'avg' | 'min' | 'max'
// records: the active records' data blobs. Returns null when no applicable numeric values (except count → 0+).
export function computeAggregate(
  records: Array<{ data: Record<string, any> }>,
  fieldKey: string,
  agg: WorkspaceAgg
): number | null
```
Rules: `count` = `records.length` (row count, field-independent). `sum/avg/min/max` = over `records.map(r => r.data[fieldKey]).filter(v => typeof v === 'number' && isFinite(v))`; if that set is empty → `null` (avg/min/max/sum of nothing = null, so the UI shows a dash rather than a misleading 0). `avg` rounded to at most 2 decimals.

### API — owner-gated preview only
`GET /api/workspaces/[id]/aggregate?field=<key>&op=<agg>` → `getUser` → `authorizeWorkspace(user.id, id)` → validate `op` ∈ the 5 aggs and `field` exists in the workspace schema (400 otherwise) → fetch active records (`data` only) → `computeAggregate` → `{ value: number | null }`. 401/404/400 per the existing route contract.

### Components (7-seam)
- **Editor** `src/components/elements/WorkspaceKpiElement.tsx` (`'use client'`, props `{element,onChange,onDelete,isSelected,onSelect}`):
  - Unbound → "Bind to a workspace" flow: `GET /api/workspaces` (pick workspace) → `GET /api/workspaces/[id]` (pick field from `fields`) → pick aggregation → optional label/suffix. Writes the binding via `onChange`.
  - Bound → fetches the live value from the aggregate endpoint, renders a KPI tile (label · value · suffix), and persists `workspaceKpiValue` into JSON via `onChange` (so preview/public have a cached fallback). A small "change binding" affordance.
- **Public** `src/components/elements/PublicWorkspaceKpiElement.tsx` (`'use client'`, props `{element}`): renders the KPI tile **purely from JSON** (`workspaceKpiLabel`/default, formatted `workspaceKpiValue`, suffix). No fetch. Shows an em-dash when value is null/undefined.
- Register in the remaining seams: `SlashCommandMenu.tsx` (category `'Data & Visuals'`, label "Workspace Metric"), `ColumnCanvas.tsx` (`case 'workspace-kpi'`: preview→Public else Editor), `elements/index.ts` (barrel), `render-elements.tsx` (`case 'workspace-kpi' → <PublicWorkspaceKpiElement element={element} />`).

### Published-page server hydration (`src/lib/workspaces/kpi-hydrate.ts`)
```ts
// Walks a display's sections/columns/elements; for each workspace-kpi element with a bound
// workspaceId owned by `ownerId`, computes the aggregate server-side and returns a NEW element
// with workspaceKpiValue set (null if workspace missing/not owned by ownerId). Pure orchestration
// over an injected db-fetch fn so it is unit-testable.
export async function hydrateWorkspaceKpis(sections, ownerId, deps): Promise<sections>
```
Wire into `src/app/[username]/[slug]/page.tsx` (and the share page `src/app/s/[code]/page.tsx` if it renders elements): after loading the display + resolving the page owner's `userId`, run the sections through `hydrateWorkspaceKpis(sections, ownerId, { getWorkspaceOwner, getActiveRecords })` before rendering. Only workspaces whose `ownerId === pageOwnerId` are computed; others → `workspaceKpiValue: null`.

## Testing
- **Pure (Vitest):** `computeAggregate` — count, sum, avg (rounding), min, max, empty→null, non-numeric/null values ignored, mixed. `hydrateWorkspaceKpis` — computes for owned workspace, nulls for foreign/missing workspace, leaves non-KPI elements untouched, handles multiple KPIs.
- **Route:** `GET …/aggregate` — 401 unauth, 404 not-owner, 400 bad op / unknown field, 200 `{value}` (mock service).
- **Component (light):** `PublicWorkspaceKpiElement` renders value + label + suffix, and an em-dash for null.
- **Verification:** full `tsc`/`lint`/`vitest` green; DB smoke — bind a KPI to the SMOKE workspace's numeric field, confirm the aggregate endpoint + server compute return the expected number against the real dev DB; note if a browser walk is run.

## Out of scope (explicit)
- Filters / segmented aggregates ("avg grade WHERE sport=Soccer") → later.
- Real-time polling on the published page (v1 = as-of-render). 
- Collaborator/shared-workspace aggregates (owner-only).
- Charts/sparklines/multi-metric tiles (single scalar only).
- Aggregating non-numeric fields beyond `count`.
- Any change to published-page caching strategy.

## Success criteria
In the editor, add a "Workspace Metric" element → bind it to a workspace + numeric field + an aggregation → see the live computed number. Publish the page → a visitor sees the same number, server-computed, with no access to the underlying records and no way to query other workspaces' aggregates. `computeAggregate`/`hydrateWorkspaceKpis`/the route are unit-tested; CI stays green (modulo the pre-existing pro-gating failures from `main`).

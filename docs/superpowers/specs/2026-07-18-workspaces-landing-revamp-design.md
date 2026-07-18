# Workspaces Landing Revamp (Design)

**Date:** 2026-07-18
**Status:** Approved design (lead-authored), pre-implementation
**Base:** fresh branch off current `main` (`7f02118`); the Workspaces C+E+F1+F2 stack is already merged + live.

## Context
The `/workspaces` index is currently a bare header + a simple 3-column card grid (`WorkspacesListClient`), fed by a `GET /api/workspaces` that returns raw workspace rows (id/name/description/icon only). The user provided a full-page mockup and a pond-scene banner image to turn this into an on-brand, informative landing that shows off what Workspaces can do and surfaces each workspace's live state.

## Scope (lead call, user-confirmed)
- **Hero banner** = the provided pond image, as its own full-width strip; the real heading sits above it.
- **Rich cards** — enrich `GET /api/workspaces` so each card shows record count · primary view · last-edited.
- **Controls** — client-side search + sort (Recently updated / Name) + grid⇄list toggle. No "All owners" filter (no sharing yet).
- **Templates** — a "Start from a template" row of **"Coming soon"** placeholder cards (no templates system).
- **Static sections** — a "What you can do" feature tour (4 cards) + a "Workspace tips" rail (3 tips).

Deferred: a real templates/instantiation system, workspace sharing + owner filter, per-card ⋮ actions menu (cards are click-to-open), list-view density beyond the toggle.

## Architecture

### Banner asset
Copy the source (`C:\Users\whirl\Downloads\ChatGPT Image Jul 18, 2026, 02_32_21 AM.png`, 1930×815) into `public/workspaces-pond-banner.png` (matches the existing `public/hero-village.png` PNG-hero precedent). Render with `next/image` (`fill`, `object-cover`, `priority`) inside a full-width, `rounded-2xl overflow-hidden` container with a **fixed responsive height** (`h-36 sm:h-44 lg:h-52`) so the wide art reads as a banner strip and crops gracefully rather than dominating the fold. `next/image` serves an optimized/resized format to browsers regardless of the PNG source, so the delivered payload is small; the 2.65MB source lives only in the repo. Local `/public` assets are same-origin — no CSP host-allowlist change needed. Alt text: "Pond workspace".

### Enriched list API: `GET /api/workspaces`
Return, per workspace, the metadata the cards need:
```ts
type WorkspaceListItem = {
  id: string; name: string; description: string | null; icon: string | null
  recordCount: number          // active records only (status: 'active')
  fieldCount: number
  primaryView: string | null   // first view's type by position, for the badge; null if none
  lastActivity: string         // ISO — max(workspace.updatedAt, latest active record.updatedAt)
}
```
Query: `db.workspace.findMany({ where: { ownerId }, orderBy: { updatedAt: 'desc' }, select: { id, name, description, icon, updatedAt, _count: { select: { fields: true, records: { where: { status: 'active' } } } }, views: { orderBy: { position: 'asc' }, take: 1, select: { type: true } }, records: { where: { status: 'active' }, orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true } } } })`, then map to `WorkspaceListItem` (`recordCount = _count.records`, `fieldCount = _count.fields`, `primaryView = views[0]?.type ?? null`, `lastActivity = max(updatedAt, records[0]?.updatedAt)`). Prisma 5.22 supports filtered relation `_count`. The response is now an array of enriched objects (was raw rows) — the client type updates to match.
- **Why `lastActivity` and not just `workspace.updatedAt`:** the workspace row's `updatedAt` only changes on schema/meta edits, not on record edits — so it alone would make "edited 2h ago" and the "Recently updated" sort ignore actual data activity. Taking the max with the latest record's `updatedAt` makes both meaningful.

### Components (split by responsibility)
- **`WorkspaceCard.tsx`** (new, unit-tested) — one rich card: icon, name, description, and a metadata row `{recordCount} records · {primaryView view | "No views"} · {relative lastActivity}`. Reuses the existing relative-time helper from `src/lib/last-updated.ts` (shipped with the last-updated feature) — do not reinvent formatting. Handles zero records ("0 records") and no views. Click → `/workspaces/{id}`. Supports a `layout: 'grid' | 'list'` prop (list = a denser horizontal row).
- **`WorkspacesLandingSections.tsx`** (new) — the static content: the feature-tour cards (Define your schema / Add & edit data / View your data / Track live metrics), the "Coming soon" template row, and the tips rail. Pure/static, no data.
- **`WorkspacesListClient.tsx`** (rewrite) — orchestrator: fetches the enriched list; holds `search`, `sort` (`recent` | `name`), `layout` (`grid` | `list`) state; renders header → hero banner → feature sections → a "Your workspaces" section with the controls + filtered/sorted `WorkspaceCard`s (or the richer empty state) → tips rail. Keeps the existing `CreateWorkspaceModal` wiring.

### Behavior
- **Search** filters by name/description (case-insensitive substring), client-side over the fetched list.
- **Sort**: "Recently updated" (by `lastActivity` desc, the default) or "Name" (A→Z).
- **Toggle**: grid (cards) ↔ list (dense rows); persist the choice in `localStorage` (`galli-ws-layout`) so it sticks.
- **Empty state** (zero workspaces): the richer centered card from the mockup ("No workspaces yet" + "Create your first workspace 🌿"), and the feature-tour + templates-coming-soon still render (so a new user sees what Workspaces offers). The "Your workspaces" grid/controls are hidden until there's ≥1.

## Testing
- **Enriched API (Vitest, mocked db):** returns `recordCount` counting active only (a mocked `_count.records` under a `status:'active'` filter), `fieldCount`, `primaryView` from the first view (null when none), and `lastActivity = max(workspace.updatedAt, latest record.updatedAt)`; 401 unauth; only the caller's workspaces (`ownerId`).
- **`WorkspaceCard` (component):** renders name/description/count/view badge/relative time; "0 records" and "No views" for a fresh workspace; links to the right href; list vs grid layout differ.
- **`WorkspacesListClient` (component):** search narrows the list; sort reorders (recent vs name); toggle switches layout and persists to localStorage; zero-workspace empty state shows the create CTA while still rendering the feature/templates sections; template cards are non-interactive ("Coming soon").
- **Verify:** tsc/lint/tests green; browser smoke — load `/workspaces` seeded with a few workspaces (varied record counts + view types), screenshot grid and list layouts, confirm the banner renders, cards show correct counts/badges/times, search+sort work, and the empty state renders for a fresh account.

## Risks
- **Banner file size (2.65MB source):** only affects repo size; `next/image` delivers an optimized/resized asset. Acceptable (matches `hero-village.png`). A later webp conversion can shrink the source if desired.
- **`lastActivity` query cost:** adds a `take:1` record sub-query + filtered `_count` per workspace. Fine at expected per-user workspace counts; if a user ever has hundreds of workspaces, revisit with a denormalized column.
- **Response-shape change (audited):** two components consume `GET /api/workspaces` — `WorkspacesListClient` (rewritten here) and `WorkspaceKpiElement.tsx` (the D KPI-element editor's workspace picker). The KPI picker's type is `WsSummary = { id, name }` and it reads only `w.id`/`w.name`, both preserved in the enriched superset — so it keeps working unchanged. No other consumers (`CreateWorkspaceModal` uses the POST, not the GET). Confirmed via grep; no third caller to update.

## Out of scope
Real templates/instantiation, workspace sharing + "All owners" filter, per-card ⋮ actions (rename/delete from the card), reordering, a denormalized last-activity column, and any change to the workspace *detail* page.

## Success criteria
`/workspaces` shows the pond hero, a feature tour, a "coming soon" templates row, and a searchable/sortable/toggleable grid of rich workspace cards each showing live record count · view type · last-edited — with a welcoming empty state for new users. tsc/lint/tests green; browser smoke confirms the visual and the card metadata.

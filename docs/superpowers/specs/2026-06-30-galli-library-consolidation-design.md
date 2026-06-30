# Galli — Library Hub Consolidation — Design

- **Date:** 2026-06-30
- **Status:** Approved design, pre-implementation
- **Scope:** Information-architecture cleanup. Collapse the Apps storefront and the dead
  Templates stub into the single **Library** hub, and merge the Apps storefront + the Library
  Apps list into one unified "app-store" grid. No changes to the card system, the Pro gate model,
  or Templates/Kits behavior.

## Context — what exists today

- **Sidebar** (`src/components/dashboard/Sidebar.tsx`) nav items include:
  `Templates (soon)` (a dead stub — no route), `Apps` (→ `/apps` storefront), and `Library`
  (→ `/library`, tabs: Apps / Templates / Kits). Templates/Kits already live inside the Library.
- **Apps storefront** (`/apps`, `src/components/apps/AppsClient.tsx`): grid of `listedApps()`;
  each tile shows **Add to Library** (Pro-gated → 403/`UpgradePrompt`) or **In Library ✓** once
  added, and **Coming soon** for coming-soon apps (KollabShare).
- **Library Apps tab** (in `src/components/library/LibraryClient.tsx`): a separate list of the
  user's `CardLibraryItem`s (`GET /api/card-library`) with **Use on a page** + **Remove**.
- **Card library API**: `GET /api/card-library` → `[{id, provider, name, ...}]`;
  `POST` (Pro-gated, 403 for free / non-live providers); `DELETE /api/card-library/[id]`.
- The editor's `CardLibraryPicker` empty-state CTA links to `/apps`.

The redundancy: `Apps` and `Library` are two doors to overlapping things, and "browse" (storefront)
vs "downloaded" (library list) are split across two surfaces.

## Goals

1. **Sidebar** — remove the `Templates (soon)` stub and the `Apps` item; keep `Library` as the
   single entry point.
2. **Unified Apps tab** — the Library Apps tab becomes one app-store grid over the catalog
   (`listedApps()`), where each tile reflects its state: coming-soon / not-added (Add) /
   in-library (In Library ✓ + Use + Remove). Merges the storefront and the library list.
3. **Redirect** `/apps` → `/library?tab=apps`; delete the now-unused `AppsClient.tsx`; repoint the
   `CardLibraryPicker` empty-state link to `/library?tab=apps`.

## Non-goals

- No change to the card provider registry, `CardLibraryItem` model, the Pro gate logic, or the
  Templates/Kits galleries.
- No new "browse vs downloaded" sub-tabs or sections — a single grid with per-tile state (chosen
  model A).

## Design

### 1. Sidebar — `src/components/dashboard/Sidebar.tsx`

Remove two entries from the `NAV` array:
- `{ label: 'Templates', icon: LayoutTemplate, soon: true }`
- `{ label: 'Apps', icon: Blocks, href: '/apps', match: ... }`

Keep `{ label: 'Library', icon: Library, href: '/library', ... }`. Remove now-unused icon imports
(`LayoutTemplate`, `Blocks`) if nothing else references them.

### 2. Unified Apps tab — `src/components/library/LibraryAppsTab.tsx` (new)

A self-contained `'use client'` component owning the Apps experience (extracted so `LibraryClient`
stays focused). Responsibilities:

- **Data:** `const apps = listedApps()` (catalog); `GET /api/card-library` → the user's items.
  Build a `provider → items[]` map to know which catalog apps are "in library" and to get item ids
  for Remove.
- **Per-tile state:**
  - `status === 'coming-soon'` → **Coming soon** badge, no action.
  - not in library → **Add to Library** button. Pro-gated: free → `UpgradePrompt`; else `POST
    /api/card-library {provider, name, data: defaultData}`; on 403 → `UpgradePrompt`; on success
    add the provider to the in-library set.
  - in library → **In Library ✓** chip + **Use on a page** (Pro-gated → navigate `/editor`) +
    **Remove** (delete every `CardLibraryItem` whose provider matches via
    `DELETE /api/card-library/[id]`, then drop the provider from the set so the tile returns to
    the Add state).
- **Pro / a11y:** reuse `isPro(user)` (from `useAuthStore`), `ProBadge` (shown on an actionable
  tile when the user is free), `UpgradePrompt` (`feature="Library Apps"`), `aria-busy` on pending
  buttons. An inline error message on a failed add/remove.
- Plain code (not an agent): the provider→items grouping and "is added" check are simple
  array/Map operations.

### 3. `LibraryClient` — `src/components/library/LibraryClient.tsx`

- Render `<LibraryAppsTab />` for the `apps` tab (replacing the inline card-library list and the
  `handleUseApp` path — those move into `LibraryAppsTab`).
- Keep the Templates/Kits starter galleries and their `useStarter` flow and `UpgradePrompt`
  unchanged. The `?tab=apps|templates|kits` deep-link, Suspense wrapper, and `useRefreshUser()`
  stay. (`useRefreshUser()` remains in `LibraryClient`, so the child `LibraryAppsTab` just reads a
  fresh `plan` from the store.)
- Drop now-unused imports in `LibraryClient` (`CARD_PROVIDERS`, the card-library fetch/remove, the
  apps-specific state) that moved to `LibraryAppsTab`.

### 4. `/apps` redirect + cleanup

- Replace `src/app/(dashboard)/apps/page.tsx` with a redirect to `/library?tab=apps`.
- Delete `src/components/apps/AppsClient.tsx` (superseded by `LibraryAppsTab`; preserved in git
  history).
- Repoint the `CardLibraryPicker` empty-state CTA (`src/components/editor/CardLibraryPicker.tsx`)
  from `/apps` to `/library?tab=apps`.

## Data flow (Apps tab)

```
LibraryAppsTab mount
  ├─ listedApps()                → catalog (vouch live, kollabshare coming-soon)
  └─ GET /api/card-library       → provider→items map (which are "in library")

tile action:
  Add    → free? UpgradePrompt : POST /api/card-library (403 → UpgradePrompt) → mark added
  Use    → free? UpgradePrompt : router.push('/editor')
  Remove → DELETE each item id for that provider → mark not-added
```

## Components / files

- Create: `src/components/library/LibraryAppsTab.tsx`.
- Modify: `src/components/library/LibraryClient.tsx` (render the new tab, drop moved code),
  `src/components/dashboard/Sidebar.tsx` (remove 2 nav items + unused icon imports),
  `src/app/(dashboard)/apps/page.tsx` (redirect), `src/components/editor/CardLibraryPicker.tsx`
  (repoint link).
- Delete: `src/components/apps/AppsClient.tsx`.

## Testing

- This is primarily UI/IA; the underlying gate (`POST` 403, `DELETE`) is already covered by tests
  and was proven live. Verify via `tsc --noEmit`, the full vitest suite (no regressions), and live
  render: `/apps` → 307 to `/library?tab=apps`; the Apps tab shows the unified grid (Vouch
  add/in-library/remove states, KollabShare coming-soon); the Templates/Kits tabs unchanged; the
  sidebar no longer lists Templates or Apps.
- If a small pure helper is extracted for the provider→added mapping, add a unit test for it;
  otherwise rely on the above.

## Open items

- None. Pure consolidation; the Pro upgrade flow, billing stub, and registries are unchanged.

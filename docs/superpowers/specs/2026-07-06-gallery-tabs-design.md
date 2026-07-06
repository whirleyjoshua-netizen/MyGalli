# Gallery (rename "My Pages") + Boards tab — design

Date: 2026-07-06
Status: approved

## Problem

"My Pages" (`/my-pages`) lists all of a user's displays (pages **and** boards) mixed
together under Published/Drafts. Collection Boards are now live but have no dedicated
home. The user wants the section renamed **Gallery** and split into **Pages** and
**Boards** tabs.

## Design

**1. Rename nav + heading "My Pages" → "Gallery".**
- `SidebarContent` NAV entry label `'My Pages'` → `'Gallery'` (updates the desktop
  rail and the mobile drawer, which share `SidebarContent`). Route stays `/my-pages`
  (`match: p.startsWith('/my-pages')`) — renaming the URL would break existing links.
- The page heading `My Pages` → `Gallery`.

**2. Tabs inside the Gallery page (`/my-pages`).**
- Two tabs: **Pages** and **Boards**. No new API/schema — `/api/displays` already
  returns both (it excludes only `kind:'profile'`) with `kind` on each row.
- Split client-side: `pageDisplays = displays.filter(d => d.kind !== 'collection')`,
  `boardDisplays = displays.filter(d => d.kind === 'collection')`. The active tab's
  list flows into the existing Published/Drafts sections + `PageCard` grid (reused
  as-is — **plain cards, no Board badge/count for now**).
- Top-right action follows the tab: **New page** (Pages) / **New board** (Boards).
  "New board" reuses the existing create-board flow (`POST /api/displays
  {title:'Untitled Board', kind:'collection'}` → 403 redirects to `/enterprise`,
  else opens the editor).
- Empty states per tab: Pages → "Create your first page"; Boards → "Create a board".
- `DashDisplay` type gains `kind?: string`.

## Non-goals

No Board badge/member-count on cards (deferred). No route rename. No change to how
boards are created/edited/published (already shipped). The future **Hubs** tab
(when Hub is built) will slot in here as a third tab, superseding the Hub plan's
sidebar-tree Task 7 — noted, not built now.

## Testing

- Pure split helper or inline: given displays of mixed `kind`, Pages tab shows only
  `kind!=='collection'`, Boards tab shows only `kind==='collection'`.
- Page test (mocked `/api/displays` + store): renders both tabs; defaults to Pages
  showing a page card; clicking Boards shows a board card and the "New board" action.

## Files touched

Modify: `src/components/dashboard/SidebarContent.tsx` (label), `src/app/(dashboard)/my-pages/page.tsx`
(heading + tabs + split + per-tab action), `src/components/dashboard/PageCard.tsx`
(`DashDisplay.kind?`). New: `src/app/(dashboard)/my-pages/page.test.tsx`.

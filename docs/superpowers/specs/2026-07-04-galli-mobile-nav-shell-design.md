# Mobile Nav Shell — Design

**Date:** 2026-07-04
**Status:** Approved (design)

## Context

This is **sub-project 1 of 3** in a "make the whole platform mobile-friendly"
effort. A mobile-readiness audit (target viewport 375px) found:

- **Public / content surfaces (public page, share links, profile, explore,
  library, auth): largely fine** — they already use responsive Tailwind
  breakpoints and stack correctly. (Two small overflow bugs exist — pie chart,
  a couple of header rows — deferred to sub-project 2.)
- **Dashboard shell: broken.** `src/components/dashboard/Sidebar.tsx` renders a
  fixed 256px (`w-64`) `<aside>` as a static flex sibling of `<main>`
  (`src/app/(dashboard)/layout.tsx`), with **no mobile breakpoint and no
  hamburger/drawer**. At 375px the sidebar consumes ~68% of the screen, crushing
  every dashboard page into a ~119px sliver. This is the primary reason
  "features aren't showing on mobile." The individual dashboard pages are
  themselves mostly responsive — it is the shell that hides them.
- **Editor: not usable on a phone** — deferred to sub-project 3 (its own design;
  decided scope = desktop-primary editing, mobile = view + light edits).

This spec covers **only the mobile navigation shell** for the dashboard.

## Goal

Make every dashboard destination reachable and usable on a phone by giving the
dashboard shell a mobile navigation pattern, while leaving the desktop layout
visually unchanged.

## Decisions

- **Approach A — hamburger + off-canvas drawer** (chosen over a bottom tab bar,
  or bottom-bar + drawer). One well-understood pattern, houses everything (all 6
  nav items + Create + profile + logout), maximum reuse of the existing sidebar,
  minimal new surface. A bottom tab bar (Approach B) is explicitly deferred as
  later polish.
- **Reuse, don't rebuild:** extract the sidebar's inner content into a shared
  `SidebarContent` rendered by both the desktop rail and the mobile drawer.
- **Desktop is untouched** visually — the persistent rail keeps its current look
  and collapse behavior; it only gains `hidden md:flex` so it disappears below
  `md`.
- Breakpoint boundary: **`md`** (768px). Below `md` = mobile shell (top bar +
  drawer); `md` and up = persistent rail. This matches the codebase's existing
  `md:` grid breakpoints.

## Components

| File | Status | Responsibility |
|---|---|---|
| `src/components/dashboard/SidebarContent.tsx` | new | Shared inner content: Create button, 6 nav items, `ProfileCard`, user menu. Props `{ collapsed?: boolean; onNavigate?: () => void }` |
| `src/components/dashboard/Sidebar.tsx` | changed | Desktop rail only (`hidden md:flex`): brand + collapse toggle + `<SidebarContent collapsed={collapsed} />` |
| `src/components/dashboard/MobileNav.tsx` | new | `md:hidden` sticky top bar (hamburger · Wordmark · +Create) + left off-canvas drawer wrapping `<SidebarContent onNavigate={close} />` |
| `src/app/(dashboard)/layout.tsx` | changed | Render desktop `<Sidebar/>` + `<MobileNav/>` (top of `<main>`) + children |
| `src/app/layout.tsx` | changed | Add explicit `export const viewport` |

### `SidebarContent` (new)

Extract the current `Sidebar` body — everything below the brand/collapse header:
the **Create New** link, the `NAV` list (Home, My Pages, Shared with me, Explore,
Analytics, Library), the flex spacer, `ProfileCard`, and the user menu (avatar →
View profile / Log out). The `NAV` array and the active-path logic
(`usePathname` + each item's `match`) move here.

- Props: `{ collapsed?: boolean; onNavigate?: () => void }`.
- `collapsed` (default `false`) drives the existing label-hiding behavior; only
  the desktop rail passes `true/false` from its toggle. In the drawer it is
  always `false` (full width).
- `onNavigate` is called on any Create/nav-link/View-profile click and after
  logout, so the drawer can close itself. Desktop passes nothing (no-op).
- The user menu keeps its `absolute bottom-full` upward-opening popover and its
  own local open state — unchanged, works in both contexts.

### `Sidebar` (changed → desktop rail)

- Wrapper becomes `<aside className="hidden md:flex w-64/w-[76px] shrink-0
  h-screen sticky top-0 …">` (add `hidden md:flex`; keep existing width/collapse).
- Keeps the brand + collapse-toggle header and its local `collapsed` state.
- Body replaced by `<SidebarContent collapsed={collapsed} />`.
- No visual/behavioral change at `md`+.

### `MobileNav` (new, `md:hidden`)

Client component. Local `open` state for the drawer.

- **Top bar:** `sticky top-0 z-30 md:hidden` bar (~56px tall,
  `border-b bg-sidebar`) containing:
  - left: hamburger button (`Menu` icon) → `setOpen(true)`, `aria-label="Open
    menu"`, ≥44px tap target;
  - center/left: `<Wordmark>` linking to `/dashboard`;
  - right: a **+ Create** link → `/editor` (primary action always visible).
- **Drawer (when `open`):**
  - Backdrop: `fixed inset-0 z-40 bg-black/50 md:hidden`, tap → close.
  - Panel: `fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-sidebar border-r
    px-3 py-4 overflow-y-auto md:hidden`, slides in from the left. Contains a
    top row with the Wordmark + a close (`X`) button, then
    `<SidebarContent onNavigate={() => setOpen(false)} />`.
  - Closes on: backdrop tap, close button, any nav tap (via `onNavigate`),
    and `Escape` (keydown listener while open).
  - Body scroll lock while open (`document.body.style.overflow = 'hidden'` in an
    effect gated on `open`, restored on close/unmount).

### `(dashboard)/layout.tsx` (changed)

```
<div className="flex min-h-screen bg-background">
  <Sidebar />               {/* hidden md:flex */}
  <main className="flex-1 min-w-0">
    <MobileNav />           {/* md:hidden, sticky top-0 */}
    <VerifyBanner />
    {children}
  </main>
</div>
```

The sticky mobile bar sits at the top of `<main>`; no manual top-padding needed.

### `src/app/layout.tsx` (changed)

Add:

```ts
import type { Viewport } from 'next'
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }
```

No `maximumScale`/`userScalable` restriction — pinch-zoom stays enabled for
accessibility. (Next.js injects a default viewport already; this makes it
explicit and owned.)

## Data flow

No data, no API, no schema changes. Nav destinations and auth (`useAuthStore`,
`logout`) are unchanged — the same `Sidebar` logic, now shared. Drawer open/close
is local client state in `MobileNav`.

## Error handling

- None beyond existing auth flows. The drawer is presentational; failure modes
  are limited to state toggles.
- Scroll-lock effect must restore `overflow` on unmount/close to avoid a stuck
  page.

## Testing

- **Refactor safety:** `npx tsc --noEmit` clean; live-verify the desktop sidebar
  (`md`+) is visually and behaviorally identical (nav, active states, collapse,
  Create, profile, logout).
- **Unit (`MobileNav`):** with @testing-library/react (jsdom) — the top bar
  renders a hamburger and a Create link; clicking the hamburger opens the drawer;
  the drawer shows all 6 nav labels + Create + Log out; clicking a nav link or
  the backdrop closes it.
- **Live at 375px:** every destination (Home, My Pages, Shared, Explore,
  Analytics, Library), Create, View profile, and Log out are reachable via the
  drawer; content is full-width (no crushed sliver); pinch-zoom works.

## Out of scope

- Bottom tab bar (Approach B) — deferred polish.
- The content-overflow fixes (pie chart, explore/analytics/responses headers,
  modal swatch grids, dashboard search) — sub-project 2.
- The editor mobile experience — sub-project 3.
- A mobile presentation for the desktop-only `AnalyticsPanel`
  (`hidden xl:flex`) — deferred (it does not break layout; it is a feature gap).

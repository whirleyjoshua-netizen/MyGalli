# "My Pond" — Collaborations + Communities consolidation

**Date:** 2026-07-07
**Status:** Design approved
**Branch:** `worktree-my-pond` (off `origin/main`)

## Problem

The **Communities** tab currently lives under **Gallery** (`/my-pages`), but conceptually it belongs with **Collaborations** (`/shared`) — both are "shared spaces you participate in with other people." Consolidate them, and rebrand the section.

## Decisions (from brainstorming)

- Move the **Communities** tab out of Gallery (`/my-pages`) and into the Collaborations page (`/shared`).
- Collaborations page gets two tabs: **Collabs** and **Communities**.
- **Communities is the DEFAULT tab** on the page.
- Rename the section **"Collaborations" → "My Pond"** (nav label + page `<h1>`). Keep the existing two-people (`Users`) icon.
- **Keep the route `/shared`** (label-only rename; no URL change, no redirects).
- Move the Communities tab **as-is** (no behavior change to community-card rendering).
- **No new API or schema** — `/api/collaborations` and `/api/communities/joined` already exist.

## Current state

- `src/app/(dashboard)/my-pages/page.tsx` — Gallery, tabs `pages | boards | communities`. The `communities` tab owns: a `Community` type, `communities` state, a `fetch('/api/communities/joined')` effect, the tab button, and a render branch (grid of `<a href="/{username}/hub/{slug}">` cards; empty state "You haven't joined any communities yet.").
- `src/app/(dashboard)/shared/page.tsx` — Collaborations, no tabs. Header "Collaborations" + `Users` icon + subtitle "Pages you've been invited to collaborate on."; single list from `/api/collaborations`.
- `src/components/dashboard/SidebarContent.tsx` — NAV item `{ label: 'Collaborations', href: '/shared', ... }` with `Users` icon.

## Design

### `/shared` page → "My Pond" with two tabs
- Header `<h1>` "Collaborations" → **"My Pond"** (keep `Users` icon). Subtitle can stay generic or update to reflect both (e.g. "Pages you collaborate on and communities you've joined.").
- Add `activeTab: 'collabs' | 'communities'`, **defaulting to `'communities'`**, initialized from `?tab=` (`?tab=collabs` selects Collabs). Use the same tab-bar markup as the Gallery/Data pages (border-b-2 active style).
- **Collabs tab:** the existing collaborations list (the `/api/collaborations` fetch + card grid + empty state), unchanged.
- **Communities tab:** the moved code from Gallery — `Community` type, `fetch('/api/communities/joined')`, the community-card grid, and the "You haven't joined any communities yet." empty state, verbatim.
- Both fetches run on mount (or lazily per active tab — either is fine; simplest is both on mount, matching current patterns).

### `/my-pages` (Gallery) → drop Communities
- Remove the `'communities'` member from the `activeTab` union (→ `'pages' | 'boards'`), the `communities` state, the `Community` type (moved), the `/api/communities/joined` effect, the `['communities', 'Communities', …]` tab entry, and the `activeTab === 'communities'` render branch. Gallery returns to **Pages | Boards**.

### Sidebar
- `SidebarContent.tsx`: rename the NAV entry label `'Collaborations'` → **'My Pond'** (keep `href: '/shared'`, `match: p.startsWith('/shared')`, `Users` icon).

### Deep-links
- Check for any link/notification pointing at `/my-pages?tab=communities` (e.g. the `hub_member` notification `entityUrl`); if present, repoint to `/shared?tab=communities`. (The `hub_member` notification likely points at the hub itself — verify; only change if it targeted the Gallery communities tab.)

## Files

- Modify: `src/app/(dashboard)/shared/page.tsx` — tabs + Communities tab + "My Pond" header.
- Modify: `src/app/(dashboard)/my-pages/page.tsx` — remove Communities tab + its state/fetch/type.
- Modify: `src/components/dashboard/SidebarContent.tsx` — nav label → "My Pond".
- Possibly modify: whatever emits a `/my-pages?tab=communities` link (verify; likely none).

## Testing / verification

- `pnpm exec tsc --noEmit` clean **AND `pnpm exec next lint`** (lint-only rules like `no-html-link-for-pages`/`no-unescaped-entities` fail the prod build but NOT tsc — the community cards use `<a href="/{username}/hub/{slug}">` to an internal route, which may trip `no-html-link-for-pages`; if so, use `<Link>`). Run `next lint` before merge.
- Existing tests stay green (Gallery/Sidebar/MobileNav tests — MobileNav asserts nav labels; update any that assert "Collaborations").
- Manual smoke: sidebar shows **My Pond**; clicking it opens on the **Communities** tab; Collabs tab shows invited pages; Gallery shows only Pages | Boards; `/shared?tab=collabs` deep-links correctly.

## Deferred (YAGNI)
- Renaming the route to `/pond` (kept `/shared`).
- Any change to community/collab data models or endpoints.
- A custom pond/frog icon for the nav item (kept `Users`).

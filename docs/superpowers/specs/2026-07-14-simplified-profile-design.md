# Simplified Universal Profile — Design Spec

**Date:** 2026-07-14
**Branch:** `profile-standard` (worktree `C:\Users\whirl\pages-profile`)
**Status:** Approved design, pre-implementation

## Context

Today a user's public profile (`src/app/[username]/page.tsx`) includes a full
**page-builder canvas** — an editable `Display` of `kind:'profile'` rendered via
`ProfileCanvas` / edited via `ProfileCanvasEditor` at `/profile/edit`. This is
heavy, inconsistent between users, and overlaps with the fact that users can
already build a standalone page to express themselves.

We are replacing it with **one fixed, universal profile layout** shared by every
user, matching a provided mockup. The profile becomes a simple, non-scrolling
"card" of identity + actions + a horizontal row of the user's projects. If a user
wants free-form self-expression, they build a normal page — which then appears in
their projects row. The only editable pieces are the cover image and profile
picture (background theming is explicitly deferred).

## Goals

- Remove the page-builder/canvas from the profile entirely (UI only; data kept).
- A single fixed-window layout for all profiles; the **only** scroll is the
  horizontal Projects row.
- Editable by the owner: **cover banner image** and **avatar**. Name/bio remain
  editable via a slimmed edit page.
- Projects row aggregates the user's published **Pages + Boards**.
- Owner and visitor see different action cards.

## Non-Goals (deferred)

- Background / card-theme editing (page bg + card bg presets or custom colors).
- Hubs and Workspaces in the projects row (Pages + Boards only for now).
- Deleting profile-canvas data or code paths outside the profile (kept dormant).
- Surfacing interests/links on the profile (kept in DB, hidden from this view).
- True fixed-window behavior on mobile (graceful vertical stacking instead).

## Layout (fixed window)

Four stacked zones; only the Projects row scrolls (horizontally).

```
┌─────────────────────────────────────────────┐
│  COVER BANNER (editable image)              │  ProfileCover
├─────────────────────────────────────────────┤
│ ⬤ avatar   Name ·         [Mailbox][Share]  │  ProfileHeaderCard
│   @handle  N followers      [Follow/Edit]   │   (identity left, actions right)
├─────────────────────────────────────────────┤
│ 🍃 Bio text                                  │  ProfileBioBar
├─────────────────────────────────────────────┤
│ 🍃 My Galli                                  │
│    Projects, pages, boards & more            │  ProfileProjectsSection
│    [Page][Board][Page][Board] →  (h-scroll)  │
└─────────────────────────────────────────────┘
```

Desktop: fits the viewport. Narrow/mobile: zones stack; the page may scroll
vertically (a literal fixed window is unusable on a phone), but the Projects row
remains the horizontal scroller.

## Components (`src/components/profile/`)

- **`ProfileCover`** — banner from `user.coverImage`, or a default Galli gradient
  fallback. Owner: click-to-change (upload via `POST /api/upload`).
- **`ProfileHeaderCard`** — rounded card overlapping the cover bottom.
  - Left: **`ProfileIdentity`** — avatar, name, `@username`, follower/following
    counts. Reuses existing `ProfileIdCard` internals.
  - Right: **`ProfileActionCards`**.
- **`ProfileActionCards`** — three icon cards, viewer-dependent:
  - **Owner:** Mailbox (→ inbox) · Share Profile · Edit (→ `/profile/edit`)
  - **Visitor:** Message (→ compose) · Share Profile · Follow
  - Reuses `ShareProfileButton`, `ProfileMailboxModal`, existing follow logic.
- **`ProfileBioBar`** — slim card: bio text + leaf accents.
- **`ProfileProjectsSection`** — "My Galli" heading + subtitle + horizontal
  `ProjectCard` row. Extends today's `ProfilePagesScroll`. Each card shows a
  **type badge** (`Page` / `Board`) derived from `display.kind`.

## Data & editing

- **Schema:** add `User.coverImage String?` (additive). Author the migration by
  hand (only this column) per the shared-dev-DB drift gotcha, then
  `prisma migrate deploy` with `DATABASE_URL` + `DATABASE_URL_UNPOOLED` set inline
  (`127.0.0.1:5434`). Prod Neon is clean so the same additive migration applies.
- **API:** `PATCH /api/profile` (`src/app/api/profile/route.ts`) — add
  `coverImage` to the whitelist (validate/trim like `avatar`). No other API
  changes; follow/message/share endpoints are reused as-is.
- **Projects query:** published Displays where `kind in ['page','collection']`
  (Boards are `kind:'collection'`; Pages are `kind:'page'`). The current profile
  query (`published:true, kind:{ not:'profile' }`) already includes both — the
  work is the per-kind type badge and card mapping.
- **Editing UX:** the **Edit** action card links to a **slimmed `/profile/edit`**
  (`src/app/profile/edit/page.tsx`) that keeps `ProfileFieldsPanel`
  (name, bio, avatar, **+ new cover field**) and **drops `ProfileCanvasEditor`**.
  Reuses the existing debounced autosave to `PATCH /api/profile`.

## What is removed from the profile

Removed from the render/edit paths (files may remain in the repo, dormant):
`ProfileCanvas`, `ProfileCanvasBar`, `ProfileAbout`, and the canvas half of
`/profile/edit` (`ProfileCanvasEditor`, `ensureProfileCanvas` in the profile
flow). `profileDisplayId` and `kind:'profile'` Displays remain untouched in the
DB — fully reversible, no data migration.

## Verification

- **Unit:** projects mapper/helper — correct kinds included, correct type label
  per kind.
- **Component:** `ProfileActionCards` renders the correct three cards for owner
  vs visitor.
- **Manual E2E** in the worktree dev server (`DATABASE_URL=…@127.0.0.1:5434/pages
  pnpm dev`): visit `/joshuawhirley`
  - logged-in owner → Mailbox / Share / Edit; cover + avatar editable; edit page
    has no canvas.
  - logged-out visitor → Message / Share / Follow.
  - confirm the window is fixed and only the Projects row scrolls.
- **Pre-merge:** `npx tsc --noEmit`, `pnpm test`, `pnpm exec next lint` (lint
  gates the prod build).

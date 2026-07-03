# Unified Profile Editor — Design

**Date:** 2026-07-03
**Status:** Approved (design)

## Problem

Every user profile (`/[username]`) has a fixed **standard section** at the top
(ID card + About: name, avatar, location, bio, interests, links) and, below it, a
**customizable canvas** — a `Display` with `kind: 'profile'`, rendered read-only
by `ProfileCanvas`.

Editing today is split across two disconnected surfaces:

1. **"Edit profile"** (ID card button) opens `EditProfileModal` — edits the
   standard-section fields only.
2. **"Customize your profile" / "Edit canvas"** (`ProfileCanvasBar`) does
   `POST /api/profile/canvas` then `router.push('/editor?id=<profileDisplayId>')`,
   dropping the user into the **generic page editor**.

The generic `/editor` has no idea it is editing a profile. After adding elements
there is:
- no **"View Profile"** action to see the profile as a whole,
- no profile-specific save/return path — its header offers Publish / Share /
  Collaborate / Tabs and a "back to dashboard" arrow,
- so the canvas feels like an orphaned page draft, disconnected from the profile.

The user also does not want to be routed through multiple editors to finish one
profile.

## Goal

One **profile-editor screen**: the standard-section fields at the top, the real
`/`-prompt canvas editor directly below, with a clear way back to the profile.
No hop into the generic page editor.

## Decisions

- **Approach A — dedicated unified Profile Editor page.** (Chosen over making
  `/editor` profile-aware, which would tangle the ~1,300-line `PageEditor`, and
  over inline-editing the server-rendered profile page.)
- **Always live + autosave.** A profile is inherently public; the profile
  `Display` is already created `published: true`. There is no draft/publish
  toggle. The editor autosaves; the header shows a "Saved" indicator and a
  "View Profile" button.

## Route & entry points

- **New route:** `src/app/profile/edit/page.tsx` → `/profile/edit` (standalone,
  not inside the dashboard layout — same as `/editor`).
  - A static `profile/edit` segment takes precedence over the dynamic
    `[username]/[slug]` route in the Next.js App Router, so there is **no route
    conflict** (no page is created with slug "edit").
  - Server component responsibilities:
    - Require auth; redirect to `/login` if not signed in.
    - **Ensure the profile-canvas Display exists** using the same create-or-get
      logic as `POST /api/profile/canvas` (create with `kind:'profile'`,
      `published:true`, `slug:'__profile'`, empty sections; set
      `User.profileDisplayId`). This guarantees the page is never blank/dead.
    - Load the user's standard fields (name, avatar, location, bio, interests,
      links) and the canvas Display (`id`, `sections`, `background`, `spacing`,
      `version`).
    - Render `<ProfileEditor>` with that initial data.
- **Entry points collapse to one destination:**
  - ID card **"Edit profile"** → `router.push('/profile/edit')`
    (replaces opening `EditProfileModal`).
  - `ProfileCanvasBar` **"Customize" / "Edit canvas"** →
    `router.push('/profile/edit')` (no more client-side POST-then-route; the
    page handles ensuring the canvas).

## The one screen — `ProfileEditor` (client)

Laid out to mirror the public profile so editing is roughly WYSIWYG.

- **Sticky header:**
  - `[← Back]` → `/{username}`
  - Title: "Edit profile"
  - Autosave status: "Saving…" / "Saved ✓" (reflects both field and canvas saves)
  - `[View Profile]` → `/{username}` — the connection back that is missing today.
- **Top panel — Standard section** (`ProfileFieldsPanel`):
  - Fields extracted from `EditProfileModal`: avatar (upload via `/api/upload`),
    name, location/role, bio, interests (max 12), links (max 10, label + url).
  - Autosaves to `PATCH /api/profile` (debounced ~800 ms), filtering empty links,
    then updates the auth store via `setAuth`.
- **Below — Your canvas** (`ProfileCanvasEditor`):
  - The real `ColumnCanvas` with the `/` slash prompt: add / edit / delete / drag
    elements, add/remove sections, per-column style settings.
  - Page-level **Background** and **Spacing** controls (reusing
    `BackgroundSettings` and `SpacingSettings` modals) via a small toolbar row
    above the canvas.
  - Autosaves to `PATCH /api/displays/[id]` (debounced) sending
    `sections`, `background`, `spacing`, and `version`, using the same optimistic
    concurrency / 409-conflict handling `PageEditor` uses.

## Components

| Component | Status | Responsibility |
|---|---|---|
| `src/app/profile/edit/page.tsx` | new | Auth guard, ensure canvas exists, load data, render editor |
| `src/components/profile/ProfileEditor.tsx` | new | Header + composes the two panels; owns shared "saved" status |
| `src/components/profile/ProfileFieldsPanel.tsx` | new | Standard-section form + debounced autosave to `/api/profile` |
| `src/components/profile/ProfileCanvasEditor.tsx` | new | Canvas state + handlers + autosave for one `displayId`; reuses `ColumnCanvas`, `SlashCommandMenu`, `BackgroundSettings`, `ColumnStyleSettings`, `SpacingSettings` |
| `src/components/profile/ProfileOwnerControls.tsx` | changed | Route "Edit profile" to `/profile/edit` instead of opening the modal |
| `src/components/profile/ProfileCanvasBar.tsx` | changed | Route to `/profile/edit` (drop the POST-then-push) |
| `src/components/profile/EditProfileModal.tsx` | removed | Form logic moves into `ProfileFieldsPanel` |

`ProfileCanvasEditor` is a self-contained unit: given a `displayId` plus initial
`sections` / `background` / `spacing` / `version`, it manages canvas editing and
persistence, independent of `PageEditor`. This keeps the large `PageEditor`
untouched.

## Data flow

- **Fields:** local state → debounced `PATCH /api/profile` → `setAuth(updated)`.
  On "View Profile", the server-rendered `/{username}` re-reads the latest.
- **Canvas:** local state → debounced `PATCH /api/displays/[id]`
  (`sections`, `background`, `spacing`, `version`). Server bumps `version` on
  content changes and returns 409 on conflict → editor shows a reload banner
  (same pattern as `PageEditor`). Profile remains `published: true` → always live.
- No new API routes or schema changes: `/api/profile`, `/api/profile/canvas`, and
  `PATCH /api/displays/[id]` already exist and already accept the needed fields
  (including `spacing`).

## Error handling

- Not signed in → server redirect to `/login`.
- Canvas create-or-get failure → surface an inline error state in the editor
  (do not silently show an empty canvas with no save target).
- Field/canvas autosave failure → keep local edits, show a non-blocking "Couldn't
  save — retrying" state; retry on next debounce tick.
- Canvas version conflict (409) → reload banner, matching `PageEditor`.

## Testing

- Unit: any pure helper introduced (e.g. debounce/link-filter) gets a test.
  Reuse existing `/api/profile` sanitizers (already tested in `profile.test.ts`).
- Manual / live verification:
  - "Edit profile" and "Customize" both land on `/profile/edit` (single route).
  - Editing a field autosaves and shows on `/{username}` after "View Profile".
  - Adding a `/` element autosaves; it renders read-only in `ProfileCanvas` on
    the public profile.
  - Background + Spacing changes persist and render on the public profile.
  - "View Profile" / "Back" navigate to `/{username}`.

## Out of scope (YAGNI)

Tabs, header-card, collaborators, publish toggle, and kits — none apply to a
profile canvas and are intentionally excluded from this editor.

## Known tradeoff

`ProfileCanvasEditor` duplicates ~150 lines of `PageEditor`'s canvas-handler
wiring (slash menu, section/element CRUD, autosave). This is accepted to keep the
change low-risk and avoid refactoring `PageEditor` now. A shared
`useCanvasEditor(displayId)` hook can unify them in a later pass if the
duplication becomes a maintenance cost.

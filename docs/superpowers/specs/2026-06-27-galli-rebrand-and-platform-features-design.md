# Galli — Rebrand & Platform Features Design

**Date:** 2026-06-27
**Status:** Approved (design), pending implementation plans
**Author:** Joshua + Claude

## Overview

Five sequenced sub-projects transform "Gallio" (green-primary, mixed light UI) into
**Galli** — a light-themed, sidebar-driven creator platform with a social graph and
hardened email auth. Each sub-project ships as its own spec → plan → implementation
cycle. This document is the roadmap and the per-feature design.

**Build order:** 1. Rebrand → 2. UI restyle → 3. Email auth → 4. Social graph → 5. Slash menu.

Rationale: rebrand is mechanical and the restyle should bake in the new name; the UI
restyle establishes the light-theme token system everything else inherits; auth and
social are backend-heavy and mutually independent; the slash menu is isolated.

## Global Decisions

- **Brand:** Galli, plain wordmark. Frog mascot retired from main UI (favicon fallback only).
- **Theme:** Light theme across the whole app. Layout follows the provided mockup
  (left sidebar + center feed + right analytics panel). **No bottom dock.**
- **Palette:** Green stays primary (`#39D98A`). Aqua (`#1FB6FF`) and violet (`#6C63FF`)
  are secondary accents. Clean light neutrals for surfaces.
- **Email provider:** Resend (`RESEND_API_KEY`, `EMAIL_FROM`).
- **Not-yet-built sidebar items** (Templates, Shared with me, Integrations): stub as
  "coming soon" — do not fake data.

---

## Sub-Project 1 — Rebrand Gallio → Galli (small)

**Goal:** Replace the Gallio identity with Galli everywhere user-visible; keep internal
churn safe and verifiable.

**Changes:**
- User-facing "Gallio" → "Galli": landing page, dashboard, page `<title>`/OG metadata,
  auth screens, email templates, any copy.
- New `Galli` wordmark component (text). Remove frog from main UI; retain
  `public/gallio-frog.svg` only as favicon fallback (rename asset optional).
- Tailwind color tokens `gallio-*` → `galli-*` via mechanical find/replace across
  `tailwind.config`, `globals.css`, and all `className` usages.
- Auth cookie `gallio-auth` → `galli-auth` (one-time re-login; acceptable pre-launch).
  Update `src/lib/auth.ts`, middleware, and the Zustand store cookie writers.

**Verification:** `next build` passes, `vitest` passes, grep shows no stray
user-facing "Gallio", app loads and login round-trips with the new cookie name.

**Risks:** Missing a `gallio-*` className → broken styles. Mitigate with a full grep
sweep and a visual smoke check of dashboard + editor + public page after the rename.

---

## Sub-Project 2 — UI Restyle (large)

**Goal:** Light-theme restyle of the whole app using the mockup's layout, driven by a
reusable semantic-token system.

**2a. Token layer (foundation):**
- Define light-theme semantic CSS variables in `globals.css`: surface, surface-raised,
  border, muted, foreground, plus brand greens and secondary aqua/violet.
- Map Tailwind semantic utilities (`bg-surface`, `text-muted-foreground`, etc.) to the
  tokens. Migrate components off ad-hoc colors onto semantic tokens so the whole app
  shifts cohesively.

**2b. App shell (new persistent layout):**
- **Left sidebar:** Galli wordmark; prominent green "Create New" button; nav items
  (Home, My Pages, Shared with me, Discover, Templates, Integrations); bottom
  "your universe" usage card (pages used / quota) + user menu (avatar, name, role).
- **Center column:** welcome header ("Welcome back, {name}") with a search field;
  horizontally-scrolling "Public feed" row (chevron paging); "My pages" row of page
  cards + a "Create new page" tile.
- **Right analytics panel:** selected-page summary (cover, title, visibility, public
  URL); "Audience at a glance" stat trio (views / visitors / engagement with deltas);
  "Widget feedback" list (top form/analytics-element responses); "View full analytics" CTA.

**2c. Data wiring:**
- Right panel pulls real data from existing analytics + form-response APIs.
- Empty states for pages with no data (no fake numbers).

**2d. Nav reality:**
- Wire now: **Home** (dashboard), **Discover** (existing `/explore`), **My Pages**
  (filtered dashboard view).
- Stub "coming soon": **Shared with me**, **Templates**, **Integrations**.

**2e. Propagation:**
- After the dashboard shell lands, propagate the light theme + tokens to the editor,
  public display pages, share pages, and auth screens.

**Risks:** Large surface area. Mitigate by landing tokens + dashboard shell first,
verifying visually, then propagating page-by-page.

---

## Sub-Project 3 — Email Auth Hardening (medium)

**Goal:** Industry-standard email verification + password reset on top of the existing
email/password + Google JWT auth.

**Schema:**
- `User.emailVerified DateTime?`
- `VerificationToken { id, token (unique), userId, type ('verify'|'reset'), expiresAt, createdAt }`

**Email sender:** Resend via a thin `src/lib/email.ts` wrapper. Env: `RESEND_API_KEY`,
`EMAIL_FROM`. If unset, fall back to logging the link to the console in dev (no hard fail).

**Flows:**
- **Signup:** create user → issue `verify` token → send verification email → user clicks
  `/verify?token=…` → set `emailVerified`. Login still works while unverified.
- **Unverified banner:** show a "verify your email / resend" banner in the shell until verified.
- **Forgot password:** `/forgot` → issue `reset` token (short expiry) → send email →
  `/reset?token=…` → set new password, invalidate token.

**API routes:** `/api/auth/verify`, `/api/auth/resend-verification`, `/api/auth/forgot`,
`/api/auth/reset`. Rate-limit the send endpoints (reuse `src/lib/rate-limit.ts`).

**Risks:** Email deliverability config. Mitigate with the dev console fallback and clear
env docs.

---

## Sub-Project 4 — Social Graph (medium)

**Goal:** Follow/unfollow users, follower/following counts, and a public feed of pages
by followed users.

**Schema:**
- `Follow { id, followerId, followingId, createdAt, @@unique([followerId, followingId]) }`
  with relations back to `User`. Indexes on both columns.

**APIs:**
- `POST/DELETE /api/users/[username]/follow` — follow/unfollow (auth required).
- `GET /api/users/[username]` — profile incl. follower/following counts + isFollowing.
- `GET /api/feed` — published displays authored by users the current user follows,
  paginated, with author attribution.

**UI:**
- **Follow button** on public display pages (follows the page's author) and on explore cards.
- **Counts** shown on profile/author surfaces.
- **Dashboard "Public feed" row** consumes `/api/feed`, each card shows the page cover +
  title + "by {author}". Empty state prompts the user to Discover/follow creators.

**Risks:** Feed scope creep. Keep it to published pages of followed users; no ranking,
no notifications this pass.

---

## Sub-Project 5 — Slash Menu Horizontal Layout (small)

**Goal:** The `/` element menu lays out categories as columns side-by-side and scrolls
horizontally instead of vertically.

**Changes to `src/components/canvas/SlashCommandMenu.tsx`:**
- Wider popup; categories render as **columns** in a row with `overflow-x-auto`.
- Each column: category header + vertical list of its commands.
- Preserve: search filtering, kit-page visibility rule, empty state, and selection.
- Keyboard nav extends to left/right between columns (up/down within a column); Enter
  selects, Esc closes.
- Viewport clamping updated for the wider/horizontal popup.

**Risks:** Keyboard nav across a 2D grid is trickier than a flat list. Mitigate by
modeling selection as `{col, row}` and clamping on filter changes.

---

## Out of Scope (this roadmap)

- Notifications, feed ranking/algorithm, comments-on-feed.
- Building out Templates / Integrations / Shared-with-me beyond stubs.
- The AI page builder (currently hidden; unblocked separately when API credits exist).
- The bottom dock from the mockup.

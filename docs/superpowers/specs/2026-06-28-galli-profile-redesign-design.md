# Galli — Profile Page Redesign Design

**Date:** 2026-06-28
**Status:** Approved (design), pending implementation plans
**Author:** Joshua + Claude

## Overview

Redesign the public profile (`/[username]`) into a rich, partly self-authored page.
Two sequenced sub-projects, **merged independently**:
**A** — new layout + structured fields (bio/interests/links/location) + a pages scroll;
**B** — an editable "blank Galli page" canvas on the profile, built by **reusing a Display**
so it inherits the entire editor + element + background system.

## Global Decisions

- **Editable canvas = a reused `Display`.** The owner edits it in the existing editor; the
  public profile renders its sections read-only. No parallel editor, no new element code.
- **Structured fields:** bio (exists), interests (tags), links (labeled, icon-detected),
  and a location/role line.
- **Pages scroll:** the user's published pages, with one **featured** (pinned-to-front) page.
- **Cover banner:** none — the editable canvas (Row 3) is the creative hero.
- **Canvas visibility:** the profile canvas is **always shown** on the profile (no separate
  publish step).
- **Owner vs visitor:** owners see edit affordances (Edit Profile, Customize, pin); visitors
  see a clean read-only profile + Follow.

## Layout (target)

```
┌───────────────────────────────────────────────────────────┐
│  ROW 1                                                     │
│  ┌──────────────┐   ┌──────────────────────────────────┐  │
│  │  ID CARD      │   │  PAGES SCROLL (horizontal)       │  │
│  │  avatar, name │   │  [featured][page][page] →        │  │
│  │  @tag, location│  │                                  │  │
│  │  counts, Follow│  └──────────────────────────────────┘  │
│  │  /Edit/Share  │                                         │
│  └──────────────┘                                         │
│  ROW 2 — ABOUT: bio · interests chips · links (icons)      │
│  ROW 3 — EDITABLE CANVAS (rendered Display sections)       │
└───────────────────────────────────────────────────────────┘
```
On narrow screens the two Row-1 columns stack (ID card on top).

---

## Sub-Project A — Layout, structured fields, pages scroll

**Goal:** Rebuild `/[username]` into the Row 1 + Row 2 layout with editable structured
fields and a featured-first pages scroll.

**Schema (`prisma/schema.prisma`, User):**
```prisma
  location          String?
  interests         String[]   @default([])
  links             Json?      // [{ "label": string, "url": string }]
  featuredDisplayId String?
```

**API:**
- `PATCH /api/profile` — auth; updates the **current user's** `name`, `bio`, `location`,
  `interests` (string[]), `links` (validated `[{label,url}]`), `avatar`, and
  `featuredDisplayId` (must be a published display owned by the user, else cleared).
  Returns the updated public profile shape so the client store can refresh.

**Components:**
- `src/app/[username]/page.tsx` — server component; fetches user (incl. new fields), counts,
  and published pages (featured first), renders the new layout. 404 if user not found.
- `src/components/profile/ProfileIdCard.tsx` — avatar, name, @username, location/role,
  follower/following/friends counts (reuse `ProfileFollowCounts` modal), and an action row:
  **Follow** (visitor) or **Edit profile** (owner) + **Share** (copy link).
- `src/components/profile/ProfilePagesScroll.tsx` — horizontal scroll (reuse `ScrollRow`
  pattern + a profile page card) of published pages, featured first; owner sees a "pin to
  profile" control on each card that sets `featuredDisplayId`.
- `src/components/profile/ProfileAbout.tsx` — bio text, interests chips, links with
  auto-detected icons (Instagram, X/Twitter, YouTube, TikTok, LinkedIn, GitHub, generic web).
- `src/components/profile/EditProfileModal.tsx` — owner-only modal: name, location, bio,
  interests (tag input), links (label+URL rows, add/remove), avatar upload (reuse
  `/api/upload`). Saves via `PATCH /api/profile`; refreshes the auth store user.
- `src/components/profile/ShareProfileButton.tsx` — copies `galli.page/{username}` to clipboard.

**Store:** extend the `User` type with `location`, `interests`, `links`, `featuredDisplayId`
so the edit modal can reflect saved values immediately.

**Verification:** `PATCH /api/profile` updates fields and rejects a `featuredDisplayId` not
owned/published; profile renders for owner (edit affordances) and visitor (read-only + Follow);
link icons resolve; build + suite green; curl smoke for the profile PATCH.

**Risks:** `links`/`interests` validation (cap counts, validate URL shape) to avoid junk —
the PATCH sanitizes (max 10 links, max 12 interests, URLs must start with http/https).

---

## Sub-Project B — Editable profile canvas (reuse a Display)

**Goal:** A "blank Galli page" area (Row 3) the owner builds with the full element system.

**Schema:**
```prisma
// Display: add
  kind String @default("page") // 'page' | 'profile'
// User: add
  profileDisplayId String?
```

**Flow:**
- Row 3 shows a **"Customize your profile"** prompt to the owner when no canvas exists.
  Clicking it calls `POST /api/profile/canvas` which creates a `Display { kind: 'profile',
  published: true, title: "<username> profile" }` owned by the user, sets
  `User.profileDisplayId`, and returns its id; the client opens `/editor?id=<id>`.
- The public profile **renders the canvas Display's sections** read-only via the existing
  `renderElement(element, displayId)`, applying its background — as Row 3.
- Owner viewing their profile sees an **"Edit canvas"** button → `/editor?id=<profileDisplayId>`.

**Exclusions (the canvas must never appear as a normal page):** filter `kind != 'profile'`
in:
- `GET /api/displays` (dashboard list),
- `GET /api/explore`,
- `GET /api/feed`,
- the profile's own pages scroll (Sub-project A query),
- collaborations/shared lists are unaffected (profile canvas isn't shared).

**Editor note:** the editor already loads any `Display` by id; the profile canvas reuses it
unchanged. Publish/Share controls remain (harmless), but the canvas is always shown on the
profile regardless of `published`.

**Verification:** creating the canvas makes exactly one `kind:'profile'` Display, sets
`profileDisplayId`, and it does NOT appear in dashboard/explore/feed/pages-scroll; the public
profile renders its elements + background; owner can re-edit; build + suite green.

**Risks:** ensure the canvas Display's analytics/views don't pollute the user's totals
(exclude `kind:'profile'` from the ProfileCard total-views sum and analytics surfaces).

---

## Out of Scope (both)

Cover/banner image, profile themes beyond what the canvas background provides, profile
comments, visitor analytics on the profile canvas, drag-reordering the pages scroll.

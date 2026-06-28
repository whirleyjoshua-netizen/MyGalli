# Galli — Social Graph & Collaborative Creation Design

**Date:** 2026-06-28
**Status:** Approved (design), pending implementation plans
**Author:** Joshua + Claude

## Overview

Two sequenced sub-projects add a social layer to Galli and then let users co-create
pages with people in their network. Built and **merged independently** (merge-as-we-go):
**4a Social graph** first (collaboration depends on the follow graph), then
**4b Collaborative creation**.

## Global Decisions

- **Social model:** asymmetric **follow**. **Friends = mutual follow** (both follow rows
  exist) — derived at query time, never stored as a separate state.
- **Collaborator eligibility:** a page owner may invite only users they have a social
  connection with (someone they follow, or a mutual friend).
- **Co-editing model:** **async + presence** — collaborators use the normal save flow
  (last-write-wins) guarded by a version check; a presence heartbeat shows who is editing.
  No real-time CRDT/cursors this pass.
- **Permissions:** collaborators may **edit page content** (`sections`). **Owner-only:**
  publish, delete, settings, and managing collaborators.
- **Profile route:** `/[username]` is the public profile, sitting alongside the existing
  `/[username]/[slug]` display route.
- **Feed:** the dashboard "Public feed" shows published pages by people you follow, and
  falls back to explore/trending when you follow no one yet.

---

## Sub-Project 4a — Social Graph

**Goal:** Follow/unfollow users, follower/following/friends counts, public profiles, and a
real "people you follow" feed.

**Schema (`prisma/schema.prisma`):**
```prisma
model Follow {
  id          String   @id @default(cuid())
  followerId  String
  followingId String
  follower    User     @relation("Following", fields: [followerId], references: [id], onDelete: Cascade)
  following   User     @relation("Followers", fields: [followingId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  @@unique([followerId, followingId])
  @@index([followerId])
  @@index([followingId])
}
```
`User` gains: `following Follow[] @relation("Following")` (rows where I am the follower) and
`followers Follow[] @relation("Followers")` (rows where I am the followed). A self-follow is
rejected at the API.

**APIs:**
- `POST /api/users/[username]/follow` — follow (auth required; 400 on self-follow; idempotent).
- `DELETE /api/users/[username]/follow` — unfollow.
- `GET /api/users/[username]` — public profile: `{ id, username, name, avatar, bio,
  followerCount, followingCount, friendCount, isFollowing, isFollowedBy, isFriend,
  displays: [...published] }`. `isFriend = isFollowing && isFollowedBy`.
- `GET /api/users/[username]/followers` and `/following` — paginated lists with
  `isFollowing` per row (for follow-back buttons).
- `GET /api/feed?page=&limit=` — published displays authored by users the current user
  follows, newest first, with author attribution. Empty when following no one.

**Components / UI:**
- `src/app/[username]/page.tsx` — profile page: header (avatar, name, @username, bio),
  counts (followers / following / friends), `FollowButton`, and a grid of published pages
  (reuse explore card styling). 404 if username not found.
- `src/components/social/FollowButton.tsx` — client; states: Follow / Following (hover→
  Unfollow) / Friends (when mutual). Optimistic, posts to the follow API. Used on the
  profile, public display pages (follows the author), and explore cards.
- `src/components/social/FollowListModal.tsx` — followers/following lists with follow-back.
- **Dashboard feed rewire:** `src/app/(dashboard)/dashboard/page.tsx` "Public feed" fetches
  `/api/feed`; if it returns empty, fall back to `/api/explore` and label the row
  "Discover" so the row is never empty. (Keeps the existing `FeedCard`.)

**Verification:** unit tests for follow/unfollow idempotency, self-follow rejection, and
friend derivation; `GET /api/feed` returns only followed users' published pages; profile
counts correct; build + suite green. Manual: follow a seeded demo user, see their page in
the feed, mutual-follow shows "Friends".

**Risks:** route collision between `/[username]` and `/[username]/[slug]` — Next resolves
these distinctly (segment count differs), but verify a username that matches no user 404s
cleanly and doesn't shadow display routes.

---

## Sub-Project 4b — Collaborative Creation

**Goal:** A page owner invites followers/friends to co-edit a page's content; edits are
async with a presence indicator and a conflict guard.

**Schema:**
```prisma
model DisplayCollaborator {
  id        String   @id @default(cuid())
  displayId String
  display   Display  @relation(fields: [displayId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      String   @default("editor")
  invitedBy String
  createdAt DateTime @default(now())
  @@unique([displayId, userId])
  @@index([userId])
  @@index([displayId])
}
// Display gains: collaborators DisplayCollaborator[]  and  version Int @default(0)
// User gains:    collaborations DisplayCollaborator[]
```

**Access control (audit existing display endpoints):**
- A helper `canEditDisplay(userId, display)` = owner OR collaborator. Used by
  `GET /api/displays/[id]` (load) and `PATCH` (save `sections`).
- **Owner-only** (unchanged ownership check): publish toggle, `DELETE`, settings/title/slug,
  and all collaborator-management endpoints. The `PATCH` handler splits fields — content
  (`sections`) allowed for collaborators; owner-only fields (`published`, `slug`, etc.)
  rejected (403) for non-owners.

**Conflict guard (optimistic concurrency):**
- `Display.version` increments on every `sections` save. The editor sends the `version` it
  loaded; if it does not match current, `PATCH` returns `409` with the latest version. The
  editor shows "Updated by someone else — reload to get the latest" rather than clobbering.

**Presence (lightweight, ephemeral):**
- `POST /api/displays/[id]/presence` — heartbeat (auth + canEdit); records `{userId, name,
  avatar, lastSeen}` in an in-memory map keyed by displayId (acceptable to lose on restart).
- `GET /api/displays/[id]/presence` — active editors in the last ~15s.
- Editor polls every ~10s and renders presence avatars.

**Collaborator APIs:**
- `GET /api/displays/[id]/collaborators` — owner + collaborators can view.
- `POST /api/displays/[id]/collaborators` — owner only; body `{ username }`; 400 unless the
  invitee is followed-by or a friend of the owner; 409 if already a collaborator.
- `DELETE /api/displays/[id]/collaborators/[userId]` — owner removes anyone; a collaborator
  may remove themselves.

**Components / UI:**
- `src/components/editor/CollaborateModal.tsx` — list current collaborators (avatar, name,
  remove), and an invite picker that searches the owner's followers/friends by name/username.
- `src/components/editor/PresenceBar.tsx` — stacked avatars of active editors in the toolbar.
- Editor wires a "Collaborate" button (owner sees invite controls; collaborators see the
  roster + a "Leave" action).
- **"Shared with me"** sidebar item (currently a "Soon" stub) lights up → a view/list of
  pages where the user is a collaborator (new `GET /api/collaborations`). Dashboard cards
  for shared pages show a small collaborator hint.

**Verification:** unit tests for `canEditDisplay`, owner-only field rejection on `PATCH`,
invite-eligibility (reject non-connections), version-conflict `409`. Manual: owner invites a
friend, friend edits content & saves, presence shows both, simultaneous save surfaces the
conflict guard, friend cannot publish/delete.

**Risks:** must not let collaborators escalate to owner actions — the field-split on `PATCH`
is the critical control and gets explicit tests. In-memory presence is per-process; fine for
single-instance dev/deploy, documented as a known limitation.

---

## Out of Scope (both)

Real-time live cursors / CRDT co-editing, viewer/co-owner permission tiers, notifications,
feed ranking, comments on feed items.

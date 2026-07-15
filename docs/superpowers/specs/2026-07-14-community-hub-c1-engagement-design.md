# Community Hub V3 — Sub-project C1: Engagement Core (design)

Date: 2026-07-14
Status: approved (design), pending implementation plan
Branch: `worktree-hub-community` (worktree `.claude/worktrees/hub-community`, based on `dd0a5c2`)

## Context

Community Hub is live in production and, as of 2026-07-14, **browser-verified end-to-end**: a member can join, post, and comment; owner/collaborators can moderate; deleting a post cascades its comments; `/api/hubs/[id]/members` is correctly owner-only. No defects were found in the feature. That closes the "Browser smoke NOT run" caveat Phase 2 shipped with.

Two gaps block the community layer from actually retaining people:

1. **Nothing notifies anyone.** `hub_member` (join) fires a notification, but hub **posts and comments notify no one**. Members join a community and then never learn that anything happened in it. Bulletin already notifies followers on post; hubs have no equivalent because members are not followers.
2. **Poll/rating blocks are scaffolded but inert.** `HubPost.blocks` / `HubPost.settings` mirror `BulletinPost` exactly, and the posts API already returns `block` / `settings` / `myResponse` / `results` — but `src/app/api/hubs/[id]/posts/route.ts` returns **hardcoded `myResponse: null, results: null`**, and no `HubPostResponse` model exists. The shape is there; the substance is not.

**Intended outcome:** members hear about activity in communities they joined, and owners can post interactive polls/ratings/short-answers that members actually answer — reusing the Bulletin block system rather than rebuilding it.

## Scope

Community V3 was decomposed into four sub-projects, to be built in order (mirroring the Workspaces A–E pattern). **This spec covers C1 only.**

| | Sub-project | Status |
|---|---|---|
| **C1** | Engagement core — notifications + poll/rating blocks | **this spec** |
| C2 | Safety + moderation — report / ban / approval | later |
| C3 | Discovery + growth — communities in Explore | later |
| C4 | Conversation depth — threaded replies, comment images | later |

**Ordering rationale:** C2 precedes C3 deliberately. Shipping Explore discovery before report/ban would route strangers into communities whose only moderation tool is deleting a post after it has already been seen. Safety gates discovery. C1 comes first because notifications are the delivery channel C2 and C4 both need.

### Non-goals (explicitly deferred)

- Notification preferences, mute-per-hub, email/push delivery (prefs were already deferred project-wide; a `HubMember.muted` field is C2+ territory).
- Threaded replies, comment images (C4).
- Explore discovery for communities (C3).
- Report/ban/approval moderation (C2).
- Any change to Bulletin's own behaviour.

## Design

Guiding choice: **mirror Bulletin and thread `basePath`** — the smallest diff that reuses the most. Two alternatives were rejected: unifying `BulletinPost`/`HubPost` onto a polymorphic responses table (a large refactor of shipped, working code; Prisma handles polymorphism awkwardly; the actual duplication is two thin route files), and duplicating the block components as `HubPoll`/`HubRating`/etc (pure copy-paste of three working, tested components).

### 1. Data — one new model

`HubPostResponse`, mirroring `BulletinResponse` (schema.prisma:508) exactly:

```prisma
model HubPostResponse {
  id        String   @id @default(cuid())
  postId    String
  post      HubPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  // Same shape as BulletinResponse.responses: { [elementId]: { type, question, answer } }
  responses Json
  createdAt DateTime @default(now())
  @@unique([postId, userId])
}
```

Back-relations: `HubPost.responses HubPostResponse[]`, `User.hubPostResponses HubPostResponse[]`.

`onDelete: Cascade` on `postId` means owner moderation-delete cleans up responses — matching the comment-cascade behaviour verified on 2026-07-14. **No change to `HubPost`**: `blocks` and `settings` already exist.

**Migration:** hand-author `prisma/migrations/<ts>_add_hub_post_response/migration.sql` containing ONLY the `CREATE TABLE` + index/FK statements for this table, then `prisma migrate deploy`. Do **not** trust `migrate diff --from-url` — on the shared dev DB it is contaminated by concurrent branches' tables and emits spurious `DROP TABLE`s. Prisma commands need `DATABASE_URL_UNPOOLED` set alongside `DATABASE_URL`.

### 2. API — two changes

**New: `POST /api/hubs/[id]/posts/[postId]/respond`**

Mirrors `src/app/api/bulletin/[id]/respond/route.ts` with one substantive swap — the scope gate:

- Bulletin gates with `isInScope(post.authorId, followingIds, me.id)` (follower graph).
- Hub gates with **`canParticipate(userId, hub, collabIds, isMember)`** from `src/lib/community.ts` (owner || collaborator || real `HubMember` lookup), plus the hub's existing visibility/passcode resolution via `src/lib/hub-access.ts`.

Otherwise identical: validate `body.responses` is an object (400 if not); 401 unauthenticated; 404 unknown post; **IDOR-scope the lookup to `hubId` + `postId`** (as the comment DELETE route already does); `upsert` on `@@unique([postId, userId])`; recompute and return the aggregate.

Rate-limited, following the `hub-post-create` precedent (20/min).

**Changed: hub posts `GET`** (`src/app/api/hubs/[id]/posts/route.ts:44-45`)

Replace the hardcoded `myResponse: null, results: null` with real values, reusing `aggregateBlock` / `toRecords` from `src/lib/element-aggregate.ts` and gating visibility with the existing pure helper `resultsVisible({ isAuthor, revealAfterAnswer, hasResponded })` from `src/lib/bulletin.ts`. `settings` is normalized with the existing `normalizeSettings()`.

To avoid an N+1, fetch responses for the page's posts in one query and group in memory.

### 3. Components — thread `basePath` (and fix a latent bug)

`BulletinPostCard` already accepts `basePath` (default `/api/bulletin`) and uses it for **like** (line 47) and **delete** (line 62) — that is how `HubCommunitySection` reuses it. It already renders `BulletinBlock` (line 96-97).

**The bug:** `basePath` is **not** threaded into `BulletinBlock`, and `BulletinPoll` hardcodes `` fetch(`/api/bulletin/${postId}/respond`) `` (BulletinPoll.tsx:40). Today this is unreachable — the hub composer cannot attach a block, so hub posts never have one. **The moment C1 enables blocks in hubs, responses would POST to the bulletin endpoint against a hub post id — the wrong table.** Enabling polls without this fix ships a live bug.

Changes:
- Add `basePath: string` to `BulletinBlockProps`; `BulletinPostCard` passes its own `basePath` down.
- `BulletinPoll`, `BulletinRating`, `BulletinShortAnswer` use `` `${basePath}/${postId}/respond` ``.
- Default remains `/api/bulletin` → **Bulletin behaviour unchanged**.
- Hub composer gains the block picker, reusing `BulletinComposer`'s block-attach UI (one block max, per the existing "v1 UI allows at most one" rule). Hub posts POST must accept and validate `blocks` via the existing `isBulletinBlockType()` guard.

### 4. Notifications — split by role

New fan-out helper `notifyHubMembers(hubId, input, excludeUserId)` in `src/lib/notifications.ts` — the `HubMember` analogue of the existing `notifyFollowers`, using the same `db.notification.createMany` pattern and the same swallow-and-log error handling.

Recipients (decided with the user):

| Event | Recipients | Type |
|---|---|---|
| Owner/collaborator posts | all members except author | `hub_post` |
| Member posts | owner + collaborators only | `hub_post` |
| Comment on a post | the post author only (skip if self) | `hub_comment` |

Rationale: owner/collab posts are the broadcast members joined for; member posts are chatter, and fanning those to everyone with no mute available (prefs deferred) is how people learn to ignore notifications. The split reuses the role distinction already encoded in `canParticipate` / `canModerate`.

**Target selection is a pure function** in `src/lib/community.ts`, unit-testable without a DB, matching how `canParticipate`/`canModerate` are already tested:

```ts
export function postNotifyTargets(input: {
  authorId: string; ownerId: string; collabIds: string[]; memberIds: string[]
}): string[]
```
Returns member ids (minus author) when the author is owner/collab; returns owner+collabs (minus author) otherwise. Always de-duplicated and never includes the author.

**Registration:** add `'hub_post' | 'hub_comment'` to the `NotificationType` union and `formatNotification`'s switch in `src/lib/notifications-format.ts` (the db-free module — **never import `notifications.ts` into a client component**):

- `hub_post` → `` `${actorName} posted in “${contextText}”` ``
- `hub_comment` → `` `${actorName} commented on your post in “${contextText}”` ``

**`entityUrl`**: the **public** hub URL `` `/${username}/hub/${slug}` ``, with `contextText: hub.title` (consistent with `hub_member`'s use of `contextText`). Note this differs from `hub_member`, which uses `/hubs/${id}` because its recipient is always the owner; C1's recipients are members, and the public viewer is where the feed lives. Verified 2026-07-14 that the owner also sees moderation controls on the public viewer, so one URL serves every recipient. This requires the hub lookup to select `slug` and `user: { select: { username: true } }`.

Notification creation must never block or fail the post/comment write (the existing helpers already swallow and log).

## Reuse map

Existing code this builds on, rather than duplicating:

| Reused | Path |
|---|---|
| Block dispatcher + 3 block components | `src/components/bulletin/BulletinBlock.tsx`, `blocks/Bulletin{Poll,Rating,ShortAnswer}.tsx` |
| Aggregation | `src/lib/element-aggregate.ts` (`aggregateBlock`, `toRecords`) |
| Results-visibility, settings, block-type guard | `src/lib/bulletin.ts` (`resultsVisible`, `normalizeSettings`, `isBulletinBlockType`) |
| Participation/moderation gates | `src/lib/community.ts` (`canParticipate`, `canModerate`) |
| Access resolution | `src/lib/hub-access.ts` |
| Notification plumbing | `src/lib/notifications.ts`, `src/lib/notifications-format.ts` |
| Respond-route template | `src/app/api/bulletin/[id]/respond/route.ts` |
| Post card + composer | `src/components/bulletin/BulletinPostCard.tsx`, `BulletinComposer.tsx` |

## Testing

TDD (red first), following the established pattern:

- **Pure units** (no DB): `postNotifyTargets` — author excluded; owner-author → members; member-author → owner+collabs; de-duplication; empty/singleton cases. Extends `src/lib/community.test.ts`.
- **Routes**: respond route — 401 unauthenticated, 403 non-participant, 404 unknown/cross-hub post (IDOR), 400 malformed `responses`, 200 upsert-idempotent (answer twice → one row, updated). Mirrors the existing comment-route tests.
- **GET results gating**: author sees results; responder sees results when `revealAfterAnswer`; non-responder does not.
- **Components**: `basePath` threading — assert `BulletinPoll` posts to the hub path when given a hub `basePath`, and still to `/api/bulletin` by default (regression guard for Bulletin).
- **Full suite** must stay green (baseline **505/505** on `dd0a5c2`).

## Verification

1. `pnpm exec tsc --noEmit` + `pnpm test` + **`pnpm exec next lint`** (lint is NOT covered by tsc and has broken a prod deploy before).
2. Browser smoke in the worktree dev server (port 3100), using the hydration-safe pattern established 2026-07-14: owner posts a poll → member sees and answers it → results respect `revealAfterAnswer` → member's notification bell shows the broadcast → owner is notified of a member's post → comment notifies the post author → moderation-delete removes the post and its responses.
3. Verify persistence via API/DB, **not** UI timing — dev-mode first-compile runs 20-110s and makes correct behaviour look broken.

## Risks

- **Latent `basePath` bug**: fixing it is load-bearing, not incidental. If blocks ship before the fix, hub poll responses hit the bulletin table.
- **Notification volume**: the role split bounds it, but a large community still means a `createMany` fan-out per broadcast. Acceptable at current scale; revisit with prefs/mute in C2+.
- **Shared dev DB migration contamination**: hand-author the SQL (above).
- **Windows**: stop `pnpm dev` before `pnpm build`; `prisma generate` can EPERM while dev holds the engine dll.
- Environment note: worktrees do **not** inherit `.env` (it is gitignored) — copy it in, and export `JWT_SECRET` for the test suite or `hub-access.test.ts` fails.

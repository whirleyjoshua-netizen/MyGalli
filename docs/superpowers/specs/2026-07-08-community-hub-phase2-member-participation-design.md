# Community Hub — Phase 2: Member Participation

**Date:** 2026-07-08
**Status:** Design approved
**Branch:** `worktree-community-phase2` (off `origin/main` @ eaee6a8)

## Problem

The Community Hub (shipped 2026-07-07, see [[community-hub]]) is a one-way **broadcast**: owner/collaborators post; members can only **join** and **like**. Phase 2 makes it two-way — **members can post to the feed AND comment on posts** — with owner/collaborator moderation.

## Decisions (from brainstorming)

- **Both**: members create top-level posts AND comment on any post.
- **Open + delete moderation**: any joined member participates; owner/collaborator (and the author) can delete any post/comment. No approval queue / report / ban (deferred).
- **Member posts** = text + optional image (same as owner posts, reusing existing upload). **Comments** = text-only.
- **Flat comments** (no nested/threaded replies).
- **No notifications** this phase (scoped to participation).

## Current state (reuse)

- Models `HubPost` (`text`, `imageUrl`, `blocks`/`settings` reserved), `HubPostLike`, `HubMember`.
- APIs: `POST /api/hubs/[id]/posts` (gated `canPostToHub` = owner||collab), `DELETE /api/hubs/[id]/posts/[postId]` (author||owner), like GET/POST/DELETE, `join`, `members`, `posts` GET (published-gated with owner/collab bypass, added in PR #5).
- UI: public `HubCommunitySection` (Join + feed of `BulletinPostCard`, which handles like + delete via `basePath`/`onDeleted`); owner `HubCommunityConsole` (editor composer). `BulletinPostCard`/`FeedPost` have **no comment support** and are shared with Bulletin — do NOT modify them for comments.
- Helper `src/lib/community.ts`: `canPostToHub`, `toMemberDTO`.

## Design

### 1. Permission helpers — `src/lib/community.ts`
- `canParticipate(userId, hub: {userId}, collaboratorIds, isMember): boolean` = owner || collaborator || isMember.
- `canModerate(userId, hub: {userId}, collaboratorIds): boolean` = owner || collaborator.
- Keep `canPostToHub` (still used elsewhere / harmless); new code uses the two above.
- Membership lookup stays in the route: `const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId, userId } } }))`.
- Unit-test the pure helpers.

### 2. Member posts
- **`POST /api/hubs/[id]/posts`** — replace the `canPostToHub` gate with `canParticipate` (owner/collab/member). Everything else (text/imageUrl parse, 5000-char cap, empty guard) unchanged. Rate-limit member posting (anti-spam).
- **`DELETE /api/hubs/[id]/posts/[postId]`** — broaden the auth from `author||owner` to `author || canModerate` (adds collaborators).
- **Composer in `HubCommunitySection`** — when the viewer is joined (or owner/collab), show a post composer (text + optional image via existing `/api/upload`). On submit → `POST …/posts` → prepend to feed. (Owner also keeps the editor console; this is the members' path.)

### 3. Comments (net-new)
- **Model `HubPostComment`**:
  ```prisma
  model HubPostComment {
    id        String   @id @default(cuid())
    postId    String
    post      HubPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
    authorId  String
    author    User     @relation("HubPostCommentAuthor", fields: [authorId], references: [id], onDelete: Cascade)
    text      String
    createdAt DateTime @default(now())
    @@index([postId, createdAt])
  }
  ```
  Add the back-relations (`HubPost.comments HubPostComment[]`, `User` relation) + migration (hand-authored or `migrate diff`; timestamp after latest).
- **`GET /api/hubs/[id]/posts/[postId]/comments`** — public list, gated exactly like the posts GET (verify hub `community`, parent-Display `published` OR requester is owner/collab; else 404). Returns `{ comments: [{ id, author:{username,name,avatar}, text, createdAt }] }`, oldest→newest, capped (e.g. 200). Rate-limited.
- **`POST /api/hubs/[id]/posts/[postId]/comments`** — `getUser` required; verify the post belongs to the hub and hub is a community; `canParticipate` (owner/collab/member) else 403; `text` required, trimmed, ≤2000 chars; create; return the created comment. Rate-limited.
- **`DELETE /api/hubs/[id]/posts/[postId]/comments/[commentId]`** — `getUser`; load comment (+ its post's hub owner); allow `comment.authorId === me.id || canModerate`; else 403; delete.
- **Posts GET** (`/api/hubs/[id]/posts`) — include `commentCount` per post (`_count: { select: { comments: true } }`) in the returned payload (additive field; `BulletinPostCard` ignores unknown fields, our wrapper reads it).

### 4. Comments UI — `src/components/hub/HubPostComments.tsx`
- Rendered **under** each `BulletinPostCard` in `HubCommunitySection` (a wrapper, not a card edit).
- Collapsed: shows "💬 {commentCount}" toggle. Expanded: fetches `GET …/comments`, renders a flat list (avatar/name/text/time), a reply textarea (shown when joined/owner/collab) that POSTs and appends, and a delete (trash) on comments the viewer authored or can moderate.
- Needs `currentUserId` + whether the viewer canParticipate/canModerate — thread these from the page (the viewer page already knows the user + owner/membership for `HubCommunitySection`).

### 5. Wiring `HubCommunitySection`
- Accept whatever extra props are needed (e.g. `canParticipate`, `isOwnerOrCollab`) from the hub viewer page loader; render the composer + `HubPostComments` per post. Keep the existing Join/like/delete behavior.

## Files

**New**
- `src/components/hub/HubPostComments.tsx`
- `src/app/api/hubs/[id]/posts/[postId]/comments/route.ts` (GET + POST)
- `src/app/api/hubs/[id]/posts/[postId]/comments/[commentId]/route.ts` (DELETE)
- `prisma/migrations/<ts>_add_hub_post_comment/migration.sql`

**Modified**
- `prisma/schema.prisma` — `HubPostComment` + back-relations
- `src/lib/community.ts` (+ test) — `canParticipate`, `canModerate`
- `src/app/api/hubs/[id]/posts/route.ts` — gate → `canParticipate`; add `commentCount`
- `src/app/api/hubs/[id]/posts/[postId]/route.ts` — DELETE auth → author||canModerate
- `src/components/hub/HubCommunitySection.tsx` — member composer + comments per post
- The hub viewer page (`src/app/[username]/hub/[slug]/page.tsx` or the loader) — thread the participate/moderate/currentUserId props

## Testing / verification

- `tsc --noEmit` + **`pnpm exec next lint`** (prod-build gate — no static `<a>` to internal pages, escape apostrophes).
- Pure-helper tests for `canParticipate`/`canModerate`. Route tests mirroring existing `posts`/`community` test patterns where a harness exists (comment create requires membership; delete author/moderator; GET draft gating).
- Manual smoke: as a member, join → post text+image → appears in feed; comment on a post → appears; delete own comment; owner deletes a member's post + comment; non-member cannot post/comment (403); draft (unpublished) community comments not publicly readable.

## Deferred (unchanged)
Notifications on posts/comments, threaded replies, member image in comments, Explore discovery, poll/rating post blocks, report/ban/approval moderation.

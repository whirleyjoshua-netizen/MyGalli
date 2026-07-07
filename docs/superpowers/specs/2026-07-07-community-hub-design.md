# Community Hub — Design Spec

**Date:** 2026-07-07
**Status:** Draft for review
**Depends on:** Hub MVP (shipped) + Hub Access Control (collaborators/privacy — mid-build in a concurrent session; **this must land after that work merges**).

## One-sentence summary

A **Community Hub** is an ordinary Hub with a *community layer* switched on: public users can **join** it (a subscription separate from following the owner), and the owner + collaborators **broadcast posts** to members — reusing the Bulletin post/interactive-block engine and the Hub's existing URL, embed element, editor, and access control.

## Why it lives in the Hub family

The Hub already provides, for free, everything a standalone "Community" would have needed:

| Need | Provided by Hub today |
|------|----------------------|
| Its own shareable URL | `/{username}/hub/{slug}` public viewer |
| An embeddable widget on any page | the `hub` page element (cover tile → viewer) |
| An owner management console | `/hubs/[id]` editor |
| Co-managers who can also post | `HubCollaborator` (access-control work, in progress) |
| Private/gated content | visibility + passcode (access-control work, in progress) |

So the Community layer adds only what Hub lacks: a **public membership graph** and a **broadcast feed**. No parallel `Community` entity.

## Core concept: two distinct people-relationships on a Hub

- **Collaborator** (`HubCollaborator`, already being built) — a trusted co-manager. Can post, sees private content. Invited by the owner.
- **Member** (`HubMember`, *new*) — a public audience subscriber. Joins freely, reads broadcast posts, reacts/answers interactive blocks. Cannot post or see collaborator-private content.

Keeping these separate is the whole point of the feature: **someone can follow *this hub's* updates without following the rest of your Galli content.**

## Scope — Phase 1 (this spec)

Broadcast-only. Owner + collaborators post; members read + react.

**In:**
1. A `community` toggle on a Hub (**free** — consistent with regular hubs being free). "Create a Community Hub" is a preset that flips it on; can also be enabled on an existing hub in hub settings. **Reversible and non-destructive:** toggling `community` off hides the join button + posts feed from the public viewer and reverts the icon, but preserves all `HubMember` and `HubPost` rows — toggling back on restores the audience + post history intact. No confirmation-destroys-data trap.
   - **Icon reflects the mode:** when `community` is on, the hub renders a distinct **people icon** (lucide `UsersRound`) instead of the default hub icon — everywhere the hub surfaces: the sidebar page tree hub branches (`PagesTree.tsx`), the `/hubs` listing, and the embed tile. Driven purely by the `community` boolean.
2. `HubMember` — join / leave (account required, rate-limited). Member count.
3. `HubPost` broadcast feed — reuses the Bulletin `blocks`/`settings` JSON shape and its rendering + composer components. Authored by owner or collaborators. Likes + interactive-block responses (mirrors `BulletinLike`/`BulletinResponse`).
4. Public hub viewer gains a **Community section**: Join/Joined button, member count, the posts feed. Coexists with the existing files/folders content and respects existing access control.
5. Owner console (`/hubs/[id]`) gains a **Posts** composer + post list (delete own) and a **Members** list (view, remove a member).
6. The existing `hub` embed element's tile gains a **Join** affordance + member count when the hub is a Community Hub. **No new element type.**
7. A **"My Communities" tab on the Gallery page** (`my-pages`, which already has Pages | Boards tabs) listing the community hubs the signed-in user has **joined** (as a member) — each with its latest post — so any member can get back easily. Shown for every user who belongs to at least one community hub.

**Deferred → Phase 2+ (explicitly out of scope now):**
- **Notifications** on new posts (bell/push). Design leaves a fan-out seam (`notifyMembers`, mirroring `notifyFollowers`) but v1 relies on the `/communities` feed + the hub page. *(This is the part the user said to disregard for now — deliberately deferred.)*
- **Member posting / threads / comments** (two-way forum). v1 is broadcast-only.
- **Explore discovery** of community hubs (a `listed` flag can be added later).
- **Identified per-member analytics** (ties into Hub Phase 3 "identified analytics").
- **Moderation** beyond "remove member" (no ban/mute/report yet).

## Pro-gating — DECIDED

- **Enabling the community layer** on a hub → **FREE** (regular hubs are free; community stays free too).
- **Joining, reading, reacting** → **free** for any signed-in user.
- The only Pro gates in play are the *pre-existing* Hub ones, unchanged: adding **collaborators** (co-posters) is Pro, and making files **private/passcode** is Pro. The community itself never triggers a Pro prompt.

## Data model (additive migration)

```prisma
model Hub {
  // ...existing fields...
  community Boolean       @default(false)   // Community Hub layer on/off
  members   HubMember[]
  posts     HubPost[]
}

model HubMember {
  id        String   @id @default(cuid())
  hubId     String
  hub       Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation("UserHubMemberships", fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([hubId, userId])
  @@index([hubId])
  @@index([userId])
}

model HubPost {
  id        String   @id @default(cuid())
  hubId     String
  hub       Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation("HubPostAuthor", fields: [authorId], references: [id], onDelete: Cascade)
  text      String?
  imageUrl  String?
  blocks    Json     @default("[]")   // same shape as BulletinPost.blocks (0..1 block v1)
  settings  Json     @default("{}")   // { revealAfterAnswer, liveTally } — same as bulletin
  createdAt DateTime @default(now())
  likes     HubPostLike[]
  responses HubPostResponse[]
  @@index([hubId, createdAt])
}

model HubPostLike {
  id        String   @id @default(cuid())
  postId    String
  post      HubPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([postId, userId])
  @@index([postId])
}

model HubPostResponse {
  id        String   @id @default(cuid())
  postId    String
  post      HubPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  responses Json     // { [elementId]: { type, question, answer } } — same as BulletinResponse
  createdAt DateTime @default(now())
  @@unique([postId, userId])
  @@index([postId])
}
```

Additive only (one `ADD COLUMN` with default + four new tables). **Pick a migration timestamp later than the latest `prisma/migrations/` folder at build time** (concurrent sessions keep adding migrations — including the in-flight access-control migration).

## APIs

- `PATCH /api/hubs/[id]` — accept `community: boolean` (Pro-gated when enabling). `POST /api/hubs` may accept `community: true` for the "Create a Community Hub" preset.
- `POST /api/hubs/[id]/join` · `POST /api/hubs/[id]/leave` — signed-in, rate-limited (`rateLimit`, prefix `hubjoin`). Idempotent (upsert / deleteMany).
- `GET /api/hubs/[id]/posts` — public list for a community hub (paginated by `createdAt`). `POST` — owner **or collaborator** creates a post.
- `DELETE /api/hubs/[id]/posts/[postId]` — author or owner.
- `POST /api/hubs/[id]/posts/[postId]/like` · `.../respond` — members (signed-in).
- `GET /api/hubs/[id]/members` — owner only (list + count). `DELETE /api/hubs/[id]/members` — owner removes a member (`{ userId }`).

Authorization helper (pure, tested): `canPostToHub(user, hub, collaborators)` → owner or collaborator; `isMember(userId, hubId)`.

## Surfaces / components

- **Public viewer** `src/app/[username]/hub/[slug]/page.tsx` — when `hub.community`, render a Community section: `HubJoinButton` (join/joined + count) and `HubPostFeed` (reuses `BulletinPostCard` / `BulletinBlock` / `blocks/*` for rendering). Members-only reactions gated behind sign-in.
- **Owner console** `src/app/(dashboard)/hubs/[id]` — a **Posts** tab (reuse `BulletinComposer` to author `HubPost`) + a **Members** tab (list, remove). Collaborators see the composer too.
- **Embed element** — the existing `hub` element's public tile (`PublicHubElement`) gains a Join button + member count when the target hub is a Community Hub. No new element type; no `createElement` change beyond what Hub already does.
- **"My Communities" feed** — a new tab on the Gallery page (`src/app/(dashboard)/my-pages/page.tsx`, alongside the existing Pages | Boards tabs) listing hubs the viewer has **joined** + each hub's latest post; links to the hub viewer. Backed by `GET /api/communities/joined` (or reuse a `GET /api/hubs?joined=1`).

**Reuse map:** Hub entity/URL/editor/embed/access-control → existing. Bulletin composer + blocks + like/respond contract → reused for `HubPost`. `notifyFollowers`-style fan-out → Phase 2 seam.

## Hazards / notes

- **Re-id-on-instantiate (from `live-feed` lesson):** `HubMember`/`HubPost` are keyed to `hubId`. Do **not** seed a Community Hub into a template/kit without regenerating hub ids on copy, or members/posts would be shared across copies. Add a guard comment where hubs are cloned/seeded.
- **Sequencing:** land this only after the Hub access-control work (collaborators/privacy) merges — it shares the `Hub` model and the `/api/hubs/**` routes and the public viewer loader. Rebase onto that first.
- **Access control interaction:** community posts are their own stream and are visible to any viewer of a community hub; the existing folder/item visibility rules govern the *files* content only. A private hub (if visibility is later extended to whole hubs) would gate the community too — out of scope here.
- **`passcodeHash`-style leakage:** never select member emails or internal ids beyond what the UI needs; member list returns `{ userId, username, name, avatar }` only.

## Testing

- Pure `canPostToHub` / `isMember` unit tests (Vitest).
- Join/leave idempotency + rate-limit path (route-level).
- Component: `HubJoinButton` (join → POST, optimistic state), composer reuse renders and posts.
- Keep the full suite green; gate each task with `npx tsc --noEmit` + `npx vitest run`.

## Decisions — all RESOLVED

1. **Toggle vs. distinct type** → **toggle** on any hub (one hub type; "Community Hub" is a create-time preset). Reversible + non-destructive; icon switches to `UsersRound` when on.
2. **Pro-gate enabling community?** → **No — free.** Consistent with regular hubs being free. Only the pre-existing collaborator/privacy Pro gates remain.
3. **Member feed placement** → a **"My Communities" tab on the Gallery page** (with Pages | Boards), shown for any user who has joined ≥1 community hub. (Not a standalone `/communities` route.)

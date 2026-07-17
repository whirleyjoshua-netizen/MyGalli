# Community Hub Builder — Design

**Date:** 2026-07-17
**Status:** Approved (design); M1 scoped for implementation
**Branch context:** builds on `feat/community-entity` (Community-as-entity foundation: create from My Pond, element picker, `GET /api/communities`).

## Context & goal

Today a "Community" is a `Hub` with `community: true` plus a simple posts feed rendered inside the
file-data-room viewer. The user wants Community Hubs to become **something special for My Galli** — a
configurable, themed community page builder matching two mockups (an owner-facing builder and a
public view): a top utility strip (Notes / Kollab AI / Tools), a themed 2-column page (profile header
with stats + Follow/Share, a social feed with reactions, and sidebar widgets for Video, Members,
Events, Resources), and a full editor with left-nav settings, live preview, and a draft/publish
workflow.

This is a multi-subsystem program, decomposed into milestones. Each milestone is its own
spec→plan→build cycle. **This document specifies Milestone 1 in detail** and records the roadmap for
context.

## Milestone roadmap

- **M1 — Public Community Page + Social Feed** *(this spec)*: themed 2-column public page (profile
  header + stats + Follow/Join/Share), social feed with emoji reactions and composer, sidebar with
  Members, Resources, and a Video hero. Communities become independently publishable.
- **M2 — The Hub Builder**: dedicated editor with left-nav settings sections, live preview,
  draft-vs-published page config (JSON on `Hub`), unsaved-changes bar, Layout & Sections, Hub Profile,
  Community Settings.
- **M3 — Widgets & Tools**: Top Utility Strip (Notes, Tools), sidebar **Upcoming Events** (new Event
  model + CRUD), Tools quick-actions (Polls/Events/Files/Links).
- **M4 — Kollab AI + Appearance + SEO**: AI assistant widget (Anthropic), theme/color customization,
  per-hub SEO/OG, custom short URL, verified badge.

## Reuse map (confirmed in code)

- **Membership** = `HubMember` + `POST/DELETE /api/hubs/[id]/join`. "Follow" is the public label for
  joining; there is **no separate follow** — one concept.
- **Feed** = `HubPost` (+ `blocks` Json for polls via `src/lib/bulletin.ts`, `HubPostResponse` for
  answers, aggregation in `src/lib/element-aggregate.ts`), rendered by
  `src/components/bulletin/BulletinPostCard.tsx`; feed assembled in
  `src/app/api/hubs/[id]/posts/route.ts` GET; composer `src/components/hub/HubPostComposer.tsx`,
  block editor `src/components/bulletin/BlockEditor.tsx`.
- **Resources** = existing `HubItem` rows with `type in ('file','link')` (no new model). File-kind
  detection: `src/lib/hub-file-kind.ts`.
- **Reactions** today = `HubPostLike` (plain like, unique `[postId,userId]`) + like route
  `src/app/api/hubs/[id]/posts/[postId]/like/route.ts`. Insufficient for multi-emoji → new model.
- **Access gates**: `src/lib/community.ts` (`canParticipate`, `canModerate`).
- **Public page**: `src/app/[username]/hub/[slug]/page.tsx` → currently `notFound()` unless the linked
  `Display` is published (a problem for standalone communities — see below).

## M1 requirements

### R1 — Independent publishing (unblocks standalone communities)
Standalone communities (created from My Pond) have **no linked `Display`**, so the public page 404s
today. Fix:
- Add `Hub.published Boolean @default(false)`.
- New communities are created with `published: true` (live immediately — matches "your hub is live").
- Public page: when `hub.community`, gate visibility on `hub.published` (ignore `Display`).
  Non-community hubs keep the existing Display-published gate. Owner/collaborators may always view
  (for preview).
- A **Published** toggle is added to the existing `HubEditor` (full draft/publish UI is M2).

### R2 — Emoji reactions
- New model `HubPostReaction { id, postId, userId, emoji, createdAt, @@unique([postId,userId,emoji]),
  @@index([postId]) }`. Curated emoji set: `❤️ 👍 😂 🎉 😮 😢` (validated server-side). A user may add
  at most one of each emoji per post.
- **Migration backfills** existing `HubPostLike` rows into `HubPostReaction` with emoji `❤️`.
- API: `POST /api/hubs/[id]/posts/[postId]/reactions { emoji }` (add, idempotent),
  `DELETE .../reactions { emoji }` (remove). Both return `{ counts: { [emoji]: number }, mine:
  string[] }`. Gated by `canParticipate`; emoji must be in the allowed set (400 otherwise);
  rate-limited like the current like route.
- Feed `GET` extended: each post includes `reactions: { counts, mine }`, batched to avoid N+1
  (mirroring the existing likes join). The old `/like` route may remain as a thin alias for `❤️` or
  be removed once the client migrates — **remove** to avoid two sources of truth.

### R3 — Themed public page `CommunityHubView`
New client component `src/components/hub/community/CommunityHubView.tsx` (with focused subcomponents),
rendered by the public page when `hub.community`. Layout:
- **Profile header**: avatar (`coverImage`/hub avatar), title, `tagline`, "by @owner", member avatars +
  count, **Follow/Joined** button (join/leave via existing route) + **Share** (existing share
  affordance/URL), and **stat tiles**: Posts · Members · Resources · Events (Events = 0 until M3).
- **Nav row**: Home tab + "Search this hub…" — M1 does client-side filtering over loaded posts.
- **Left column (feed)**: composer (text + image + poll + emoji) for members via `HubPostComposer`;
  posts via `BulletinPostCard` extended with an **emoji reaction bar**; inline polls; "Load more".
- **Right column (sidebar)**:
  - **Video hero** — `hub.heroVideoUrl` rendered via a small embed helper (YouTube/Vimeo/mp4);
    hidden if unset.
  - **Members** — avatar cluster + count + "View all" (opens a lightweight modal listing all members).
  - **Resources** — the hub's public `HubItem`s of `type in ('file','link')`, showing the first 5
    (most recent) + "View all" (modal listing the rest), with file-kind icons.
- **Theme**: the green/nature Galli aesthetic baked in as the fixed M1 default (soft banners,
  botanical accents, "Good ideas grow in great communities" footer), using current brand/frog assets
  + CSS. The mockup's bespoke illustrations are a **separate art task**; M1 ships the layout/theme
  with existing assets + gradients.

### R4 — Owner-facing deltas in M1 (minimal; builder is M2)
Add to `HubEditor` (or its header/settings area): **tagline** input, **hero video URL** input, and a
**Published** toggle. Everything else on the public page auto-derives (members, resources, stats).

### R5 — Profile / hub fields
- `Hub.tagline String?` (short line under title; `description` stays for longer text).
- `Hub.heroVideoUrl String?`.
- Extend the `PATCH /api/hubs/[id]` allowlist with `published`, `tagline`, `heroVideoUrl`.

## Data model summary (one additive migration)

```
model HubPostReaction {
  id        String   @id @default(cuid())
  postId    String
  post      HubPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  emoji     String
  createdAt DateTime @default(now())
  @@unique([postId, userId, emoji])
  @@index([postId])
}
// Hub: + published Boolean @default(false), tagline String?, heroVideoUrl String?
// User + HubPost: back-relations reactions HubPostReaction[]
```
Migration also backfills `HubPostLike` → `HubPostReaction` (emoji `❤️`), then drops `HubPostLike`
(and its route/usages) once the reaction path is in place. Follow the repo's non-interactive
migration rule: hand-author `migration.sql` (CREATE TABLE + ALTER + INSERT…SELECT backfill + DROP),
`prisma migrate deploy`. Prod Neon is clean, so the same additive+backfill migration applies there.

## Components (new / changed)

- **New**: `CommunityHubView.tsx` + subcomponents (`CommunityHeader`, `CommunityFeed`,
  `CommunitySidebar`, `ReactionBar`, `ResourceList`, `VideoHero`), `src/lib/hub-video-embed.ts`
  (YouTube/Vimeo/mp4 → embed), `src/app/api/hubs/[id]/posts/[postId]/reactions/route.ts`.
- **Changed**: `src/app/[username]/hub/[slug]/page.tsx` (community branch + publish gate),
  `src/app/api/hubs/[id]/posts/route.ts` (reaction summary), `src/app/api/hubs/[id]/route.ts` (PATCH
  allowlist), `src/app/api/hubs/route.ts` (set `published: true` on community create),
  `BulletinPostCard.tsx` (reaction bar), `HubEditor.tsx` (tagline / heroVideoUrl / Published),
  `prisma/schema.prisma`.

## Non-goals (M1)
Top Utility Strip (Notes/Kollab AI/Tools), Upcoming Events, the full builder/settings-nav, draft
page-config JSON, appearance/theme customization, custom short URL, verified badge, bespoke
illustrations. These are M2–M4.

## Verification
- **Unit**: reactions route (add is idempotent, toggle/remove, per-emoji dedupe, invalid-emoji 400,
  unauth/participation gates); feed GET reaction summary shape; public-page community publish gating
  (unpublished community → 404 for public, 200 for owner).
- **End-to-end** (real login + fresh isolated DB, per the repo smoke pattern): create community →
  published → visit public page → Follow/Join → post (text + poll) → react with multiple emojis →
  poll-vote → Resources + Members + Video hero render.
- **Static**: `pnpm exec tsc --noEmit`, `pnpm exec next lint` (lint gates prod build), `pnpm test`.

## Open follow-ups (tracked, not M1)
- Bespoke illustration/art pass for the theme.
- Reaction picker UX polish; whether to keep a heart shortcut.
- `Hub.published` will evolve into the M2 draft/publish page-config workflow.

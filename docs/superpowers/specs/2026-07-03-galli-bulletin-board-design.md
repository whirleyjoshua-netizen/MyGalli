# Galli Bulletin Board — Design Spec

**Date:** 2026-07-03
**Status:** Approved (design), pending implementation plan
**Surface:** Dashboard home right column (`AnalyticsPanel`) + `/analytics` page

## 1. Concept

A **Bulletin** tab living on the dashboard's right-hand column, beside the existing
"Audience at a glance" content. Everything happens **inline in that 360px column** —
compose, read, like, and respond without leaving the panel. (MCQ was considered as a
fourth block type but dropped — poll already covers the choose-an-option case in a feed.)

A bulletin is a lightweight, follower-scoped micro-post. Its feed shows posts **only
from people you follow**, plus your own posts. A post is:

- optional **text**
- optional **image**
- an optional single **trackable block** — one of the three: **poll, rating, short-answer**

The differentiator: bulletin responses are **identified** — each answer is tied to the
responding follower's `userId`. That is impossible on a public page (page responses are
anonymous/session-based) and is what powers the unique analytics payoff (§5). Every post
author can later see, in their analytics, *who* among their followers answered and what
they picked.

Two post-level behaviors wrap whatever block a post contains:

- **Reveal results only after answering** — a follower can't see the tally until they respond.
- **Show live tally** — results update as responses arrive (implemented via lightweight
  polling, not websockets, in v1).

These are **post settings set in the composer**, not element properties — they describe how
the post talks to its audience and apply to the whole post.

## 2. Why new "bulletin blocks" instead of reusing page elements

The existing public interactive elements (`PublicPollElement`, `PublicRatingElement`,
`PublicShortAnswerElement`) are the wrong tool here for two reasons:

1. **Anonymous submission.** Poll posts to `/api/displays/[id]/poll` with a `sessionId`;
   rating/MCQ/short-answer post to `/api/forms/submit` as a `FormResponse` with a
   `sessionId`. Both are keyed on a **displayId** and carry no identity (dedup via
   `localStorage`). A bulletin must record **which follower** answered, so these paths
   cannot be reused.
2. **Page-width styling.** They hardcode `bg-white` / `text-slate-900`, `text-lg` headings,
   and `px-5` padding — heavy, off-theme cards when crammed into a narrow feed column.

Therefore we build **new compact bulletin blocks** that are theme-aware and sized for
~300px, submit **identified** responses to a bulletin endpoint, and honor the reveal/live
settings. Crucially they **reuse the existing element config shapes** (`CanvasElement`
fields like `pollQuestion`/`pollOptions`, `ratingMax`/`ratingStyle`,
`shortAnswerQuestion`) so the analytics aggregators can be shared almost verbatim (§5).

## 3. Data model (3 new Prisma models)

Conventions follow existing models: `cuid()` ids, `@@unique`, `@@index`, `onDelete: Cascade`,
and JSON response maps shaped `{ [elementId]: { type, question, answer } }`.

```prisma
model BulletinPost {
  id        String   @id @default(cuid())
  authorId  String
  author    User     @relation("BulletinAuthor", fields: [authorId], references: [id], onDelete: Cascade)

  text      String?
  imageUrl  String?

  // Zero or one CanvasElement-shaped block config, limited to the 3 allowed types.
  // Stored as an array for forward-compat (v1 UI allows at most one).
  blocks    Json      @default("[]")

  // { revealAfterAnswer: boolean, liveTally: boolean }
  settings  Json      @default("{}")

  createdAt DateTime  @default(now())

  likes     BulletinLike[]
  responses BulletinResponse[]

  @@index([authorId])
  @@index([createdAt])
}

model BulletinLike {
  id        String   @id @default(cuid())
  postId    String
  post      BulletinPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([postId, userId])
  @@index([postId])
}

model BulletinResponse {
  id        String   @id @default(cuid())
  postId    String
  post      BulletinPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String       // identified — this is the whole point
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Same shape as FormResponse.responses: { [elementId]: { type, question, answer } }
  responses Json

  createdAt DateTime @default(now())

  @@unique([postId, userId])   // one response set per follower per post (upsert)
  @@index([postId])
}
```

`User` gains the back-relations (`bulletinPosts`, `bulletinLikes`, `bulletinResponses`).

**Migration:** generated via `prisma migrate diff --from-url $DATABASE_URL
--to-schema-datamodel prisma/schema.prisma --script` written to a new
`prisma/migrations/<ts>_add_bulletin/migration.sql`, then `prisma migrate deploy`
(per the repo's non-interactive migration workflow).

## 4. APIs

All routes require an authenticated user (`getUser`). Feed/like/respond operate on the
current user's identity.

- **`POST /api/bulletin`** — create a post. Body: `{ text?, imageUrl?, block?, settings }`.
  Author = current user. Validates block type ∈ {poll, rating, shortanswer} and that
  the post is non-empty (has text, image, or block). Returns the created post.
- **`DELETE /api/bulletin/[id]`** — author-only (403 otherwise). Cascade removes likes/responses.
- **`GET /api/bulletin/feed?page&limit`** — posts from **followed users + self**, newest first,
  paginated. Each item includes:
  - `author` `{ id, name, username, avatar }`
  - `likeCount`, `likedByMe`
  - `myResponse` (this user's prior answer, or null)
  - `results` — the aggregate for the block, **gated by the reveal rule**: present if the
    viewer is the author, OR `settings.revealAfterAnswer` is false, OR the viewer has
    already responded. Otherwise `results: null`.
- **`POST /api/bulletin/[id]/like`** / **`DELETE`** — toggle a like (idempotent; upsert /
  delete on the `@@unique([postId, userId])`). Returns `{ likeCount, likedByMe }`.
- **`POST /api/bulletin/[id]/respond`** — body `{ responses: { [elementId]: {type, answer} } }`.
  Upserts the `BulletinResponse` for `(postId, currentUserId)`. Returns updated `results`
  (respecting the reveal rule — always visible to the responder now that they've answered).

**Visibility/authorization:** the feed only returns posts whose author is followed-by or
is the current user. Responding requires that the post is in the caller's feed scope
(you can only answer posts from people you follow, or your own). Liking follows the same
scope.

## 5. Analytics — the payoff

**Refactor.** The per-element aggregators currently inline in
`src/app/api/analytics/[displayId]/elements/route.ts` (`aggregateMCQ`, `aggregateRating`,
`aggregateShortAnswer`, `aggregatePoll`, …) are extracted into a shared pure-function module
`src/lib/element-aggregate.ts` with the signature `(config, entries) => summary`. The page
route is refactored to import them (no behavior change — covered by existing tests).

**Reuse for bulletins.** Bulletin analytics feeds the **same** aggregators, but from
`BulletinResponse` rows instead of `FormResponse`. Because bulletin entries carry `userId`,
the aggregators are extended to accept an optional **respondent identity** alongside each
entry and to return a `respondents` roster (`{ userId, name, avatar, answer }[]`) when
identities are present. The page path passes no identities (roster stays empty); the
bulletin path passes them.

**Analytics page.** `/analytics` gains a **"Bulletin" section** listing the current user's
own bulletin posts that contain a block. Each renders the same result card as the page
Elements tab, plus the **identified roster** — e.g. follower avatars grouped under each poll
option, or the list of who left which rating. This "know exactly who in my audience said
what" view is the feature no page analytics can offer.

**Scope note:** analytics is a documented future Pro-gating candidate, but page element
analytics is currently ungated; bulletin analytics stays **ungated in v1** for consistency.
Pro-gating is a separate future decision.

## 6. Panel UI (tabbed column)

`src/components/dashboard/AnalyticsPanel.tsx` becomes a **two-tab shell**:

- **"At a glance"** — the current content (selected-page summary, audience stats, widget
  feedback, CTA), moved into a tab. Unchanged behavior.
- **"Bulletin"** — a new `BulletinTab` component containing:
  - **Inline composer** at the top: avatar + collapsed "Share something…" that expands to a
    text field, an **add-image** control (reuses `/api/upload`), an **add-block** menu
    limited to the 3 block types, the **reveal / live** toggles, and a **Post** button.
    Sized to live in the 360px column.
  - **Feed list** below: compact `BulletinPostCard`s (author row with avatar + name +
    timestamp, text, image, the inline answerable block, a **like** button + count).
    Results honor the reveal rule; "live tally" re-fetches aggregates after the viewer
    answers and on a light interval while the tab is focused.

The panel is already `hidden xl:block` — **v1 is desktop-only**, consistent with the
existing panel's responsive behavior. A dedicated mobile bulletin surface is out of scope.

## 7. Compact bulletin blocks

New components under `src/components/bulletin/blocks/`:
`BulletinPoll.tsx`, `BulletinRating.tsx`, `BulletinShortAnswer.tsx`.

Each is:
- **Theme-aware** (semantic tokens: `surface`, `border`, `primary`, `muted-foreground`),
  tight padding, ~300px-native.
- **Config-compatible** with `CanvasElement` (reads the same fields the page elements read),
  so the composer and aggregators align.
- **Identified-submitting** — posts to `POST /api/bulletin/[id]/respond` (never the
  page form/poll endpoints), one response per follower (upsert), and reflects the reveal/live
  settings.

## 8. Data flow (end to end)

1. Author composes in the panel → `POST /api/bulletin` → `BulletinPost` row.
2. Follower loads dashboard → `GET /api/bulletin/feed` → sees the post; `results` hidden if
   `revealAfterAnswer` and they haven't answered.
3. Follower answers a block → `POST /api/bulletin/[id]/respond` → `BulletinResponse` upsert
   (identified) → response returns now-visible `results`.
4. Follower likes → `POST/DELETE /api/bulletin/[id]/like` → toggled `BulletinLike`.
5. Author opens `/analytics` → **Bulletin section** → shared aggregators run over
   `BulletinResponse` rows → result cards **plus** the identified respondent roster.

## 9. Error handling

- Unauthenticated → 401 on every route.
- Non-author DELETE → 403.
- Respond/like on a post outside the caller's follow scope → 403.
- Invalid block type or empty post on create → 400.
- Aggregators tolerate malformed/missing entries (skip, as the page aggregators already do).
- Composer/feed fetch failures degrade quietly (match existing panel's `.catch(() => …)`
  pattern) — never crash the dashboard.

## 10. Testing

- **Unit (`src/lib/element-aggregate.ts`):** each aggregator over crafted entries — including
  the new identified-roster path (respondents populated when identities present, empty when
  not). The page route refactor must keep existing element-analytics tests green.
- **Unit (feed gating):** the reveal rule — results present/absent for author vs. responded
  vs. not-responded × `revealAfterAnswer` true/false.
- **Unit (like/respond):** idempotent like toggle; respond upsert (second answer replaces the
  first, no duplicate rows).
- **Component:** each bulletin block renders from a config and submits an identified response;
  the composer builds a valid create payload.

## 11. Scope / YAGNI (explicitly deferred)

- **Mobile bulletin surface** — desktop-only v1 (panel is already `xl`-only).
- **Ephemerality / expiry** — posts persist; no auto-delete.
- **Realtime via websockets** — "live tally" uses lightweight polling.
- **Remixable elements** (lifting a poll onto your own post/page) — future idea "C".
- **Multiple blocks per post** — schema stores an array, but v1 UI allows at most one block.
- **Pro-gating of bulletin analytics** — ungated in v1, consistent with page analytics; a
  separate future decision.
- **MCQ block** — dropped from v1; poll covers the choose-an-option case in a feed. (Page
  MCQ elements and their aggregator are unaffected.)

## 12. Implementation phasing (for the plan)

1. Schema + migration + `element-aggregate.ts` extraction (page route refactor, tests green).
2. Bulletin APIs (create/delete/feed/like/respond) with the reveal-gating + identity logic.
3. Compact bulletin blocks (4 components).
4. Panel tab shell + `BulletinTab` composer + feed cards.
5. `/analytics` Bulletin section with the identified roster.

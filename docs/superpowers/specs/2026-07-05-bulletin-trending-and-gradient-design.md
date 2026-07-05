# Bulletin — Trending feed + gradient panel — design

Date: 2026-07-05
Status: draft (awaiting user review)
Builds on: `2026-07-03-galli-bulletin-board-design.md` (follower-scoped bulletin, shipped
2026-07-03) and `2026-07-04-mobile-bulletin-access-and-header-condense-design.md`
(`/bulletin` page + right-panel mount).

## Goal

Two changes to the Bulletin feature:

1. **Public "Trending" feed** — today the bulletin feed is follower-scoped
   (`authorIds = [me, ...following]`). Add an opt-in public dimension: authors can share a
   post publicly, and a **Trending** tab surfaces the most-engaged public posts platform-
   wide, alongside the existing **Following** feed.
2. **Gradient panel** — give the bulletin panel visual "spazz": a green→aqua→violet
   gradient border matching the Explore page palette, and a gradient-filled active tab.

Built free/functional (no Pro gating — bulletin is not gated).

## Decisions (settled with user)

- **Opt-in per post.** A composer toggle marks a post public; default is follower-only.
  No retroactive exposure of existing posts.
- **Two tabs: Following | Trending.** Segmented toggle at the top of the panel. Following
  is the default and unchanged. The two feeds' different privacy scopes stay visually
  separate.
- **Responses: everyone identified.** On public posts, non-follower ("stranger")
  responses appear by name in the author's analytics — identical to today's model. This
  means **no change to the response/aggregate/analytics code**; strangers simply become
  able to respond via Trending.
- **"Public" = any authenticated user** (the Trending tab, inside the authed dashboard).
  Exposure to logged-out/anonymous web visitors is explicitly **out of scope** for v1.
- **Ranking:** engagement score `likeCount + 2·responseCount`, recency as tiebreak, over
  public posts from the **last 7 days**.

## Data model

Add to `BulletinPost` in `prisma/schema.prisma`:

```prisma
isPublic  Boolean  @default(false)
// and:
@@index([isPublic, createdAt])
```

- `@default(false)` keeps every existing post follower-only (no retroactive exposure).
- The composite index serves the Trending query (`WHERE isPublic = true AND createdAt >= …
  ORDER BY createdAt`).
- **Additive migration**, generated non-interactively (`prisma migrate diff --from-url
  $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` →
  `prisma/migrations/<ts>_add_bulletin_is_public/migration.sql` → `prisma migrate deploy`).
  Safe on Vercel (build runs `prisma migrate deploy`), like the original bulletin
  migration. `ADD COLUMN … DEFAULT false` is non-blocking.

No other schema change. `isPublic` is a real indexed column (not stashed in `settings`
JSON) so the Trending query can filter + sort on it efficiently.

## Composer opt-in — `BulletinComposer.tsx`

Add a third settings toggle beside the existing *Reveal after answering* / *Live tally*:

- Label: **"🌍 Share to Trending"** (or an icon + "Share publicly"); default **off**.
- Local state `const [isPublic, setIsPublic] = useState(false)`.
- Sent in the create POST body: `{ text, imageUrl, block, settings, isPublic }`.
- Set at creation only — no post-hoc public/private toggle (matches the current no-edit
  model; keeps scope tight).

## Create route — `POST /api/bulletin/route.ts`

Read `isPublic` from the body (coerce to boolean, default false) and write it to the new
column on create. No other behavior change.

## Trending API — `GET /api/bulletin/trending?page=&limit=`

New route `src/app/api/bulletin/trending/route.ts`. Auth required (`getUser`; 401 if none).

1. **Candidate fetch:** `bulletinPost.findMany({ where: { isPublic: true, createdAt: {
   gte: now − 7 days } }, orderBy: { createdAt: 'desc' }, take: CANDIDATE_CAP })` where
   `CANDIDATE_CAP = 200`. (Bounded so the in-API scoring is cheap. If bulletin volume ever
   outgrows this, denormalize like/response counts onto the row — flagged, not built.)
2. **Engagement counts:** batch `bulletinLike.groupBy` + `bulletinResponse.groupBy` by
   `postId` over the candidate ids (same batching pattern as the feed route — no N+1).
3. **Rank:** sort candidates by `scoreTrending(likeCount, responseCount)` desc, then
   `createdAt` desc as tiebreak. Paginate the sorted list in memory
   (`slice((page-1)*limit, …)`), `PAGE_SIZE = 15`.
4. **Assemble** each post into the **same shape the feed route returns** (author, text,
   imageUrl, block, settings, createdAt, likeCount, likedByMe, myResponse, results),
   reusing the existing helpers (`normalizeSettings`, `resultsVisible`, `aggregateBlock`,
   `toRecords`). Results remain aggregate-only in the feed payload; identities live solely
   in the author's analytics tab (unchanged). Response shape:
   `{ posts, hasMore: (page*limit < scoredCount), page }`.

**Shared assembly:** the feed route and the trending route now build the same per-post
payload from a `(posts, likeGroups, myLikes, responseRows, meId)` set. Extract that into a
small helper (e.g. `assembleFeedPosts(...)` in `src/lib/bulletin.ts` or a colocated
module) and have BOTH routes call it — removes duplication and guarantees the two feeds
stay identical in shape. This is a targeted improvement to code both routes share, not a
broad refactor.

### `scoreTrending` — pure helper in `src/lib/bulletin.ts`

```ts
export function scoreTrending(likeCount: number, responseCount: number): number {
  return likeCount + 2 * responseCount
}
```

Unit-tested (weights responses above likes; monotonic). Kept trivial and tunable on
purpose — a time-decay curve is deferred (the 7-day window + simple score is enough for
v1).

## Feed UI — `BulletinTab.tsx` (Following | Trending tabs)

- Add `const [tab, setTab] = useState<'following' | 'trending'>('following')`.
- A segmented toggle renders above the composer/list. Switching tabs loads the
  corresponding endpoint (`/api/bulletin/feed` vs `/api/bulletin/trending`) and resets the
  list. The load function takes the active tab; `useEffect` re-runs on tab change.
- The **composer stays visible on both tabs** (you can post from either); a new post
  refreshes whichever feed is active.
- Reuses `BulletinPostCard` unchanged for both feeds.
- Per-tab empty states: Following keeps "No bulletins yet. Post one, or follow people to
  see theirs." Trending: "Nothing trending yet — share a post publicly to start."
- Loading state per tab (existing spinner text).

## Visual — gradient panel (Explore palette)

The Explore page uses `bg-gradient-to-r from-galli via-galli-aqua to-galli-violet`
(green → aqua → violet). Apply the same palette to the bulletin panel:

- **Gradient border frame:** wrap the panel content in an outer
  `rounded-2xl bg-gradient-to-br from-galli via-galli-aqua to-galli-violet p-[1.5px]`
  with an inner `rounded-[15px] bg-surface` (the `15px` = `16px − 1.5px` so the inner
  radius nests cleanly). This is the "spazz" — a thin luminous border around the panel.
- **Active tab:** the selected segmented-toggle tab gets
  `bg-gradient-to-r from-galli via-galli-aqua to-galli-violet text-white`; the inactive
  tab is `text-muted-foreground hover:text-foreground`.
- Applies wherever `BulletinTab` is framed — the right-panel mount and the `/bulletin`
  page. If the two mounts wrap `BulletinTab` differently, the frame lives in `BulletinTab`
  itself (or a small `BulletinPanelFrame` wrapper) so both surfaces get it once. Confirm
  the mount structure at implementation time and place the frame where it covers both
  without doubling.
- Respects light/dark via existing semantic tokens (`bg-surface`, `text-muted-foreground`).

## Security / privacy

- `isPublic` defaults false → existing posts unaffected; only explicitly-shared posts are
  discoverable.
- Trending is auth-gated (any logged-in user), not anonymous/logged-out.
- Trending feed payload carries aggregate results only (no responder identities) — same as
  the follower feed; identities remain confined to the author's analytics tab, which is
  unchanged.
- `isPublic` coerced to a strict boolean on the create route (no truthy-injection).
- No change to like/respond authorization: liking/responding still requires auth; the
  respond route's existing validation is untouched.

## Testing

- `src/lib/bulletin.test.ts`: add `scoreTrending` cases (responses weighted 2×; ordering
  monotonic; zero case). If `assembleFeedPosts` is extracted as a pure helper, unit-test
  it (shape correctness, `resultsVisible` gating, likedByMe/myResponse mapping) with a
  fixed input set.
- Trending route: an integration-style test asserting (a) only `isPublic` posts within the
  window are returned, (b) ordering follows the score (a post with more responses ranks
  above one with more likes-only, per the 2× weight), (c) 401 without auth. (Follow the
  existing bulletin route test patterns; use a hand-minted `galli-auth` JWT cookie per the
  project's authd-API testing note.)
- Composer: a test that toggling "Share to Trending" includes `isPublic: true` in the POST
  body.
- `BulletinTab`: a test that switching to the Trending tab fetches `/api/bulletin/trending`
  and that the active tab reflects selection.

## Scope / sequencing

Single focused spec → single plan. Suggested task order: (1) schema + migration +
`scoreTrending` helper; (2) `assembleFeedPosts` extraction + refactor feed route to use it
(no behavior change, gated by existing feed tests); (3) trending route; (4) composer
`isPublic` toggle + create-route write; (5) `BulletinTab` tabs; (6) gradient panel visual.
Each gated by `tsc --noEmit` + full vitest suite.

## Files touched

- Schema/migration: `prisma/schema.prisma` + new `prisma/migrations/<ts>_add_bulletin_is_public/migration.sql`.
- New: `src/app/api/bulletin/trending/route.ts`; possibly `assembleFeedPosts` module (or in `bulletin.ts`).
- Edited: `src/lib/bulletin.ts` (+ `.test.ts`), `src/app/api/bulletin/feed/route.ts`
  (use shared assembler), `src/app/api/bulletin/route.ts` (write `isPublic`),
  `src/components/bulletin/BulletinComposer.tsx` (toggle), `src/components/bulletin/BulletinTab.tsx`
  (tabs + gradient frame).

## Deferred (YAGNI)

- Post-hoc public/private editing of an existing post.
- Anonymous-response mode for public posts (user chose everyone-identified).
- Logged-out/anonymous web exposure of trending bulletins (e.g. on Explore or a public page).
- Time-decay ranking / denormalized engagement counters (revisit at scale).

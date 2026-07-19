# Explore Content Redesign — Design

**Date:** 2026-07-19
**Status:** Approved (mockup + user decisions)
**Base:** `main` @ `bca64db` (PageHero + Library + Data redesigns live). Branch `feat/explore-redesign` (worktree).
**Program:** 3rd/last of the page content-redesigns (Library ✅ → Data ✅ → **Explore**). The biggest — Explore has real data gaps, so this is scoped **real-where-feasible** with a **curated Featured** row (user-confirmed), **no schema change**, **Workspaces omitted** from type chips (no public flag).

## Goal
Bring Explore into the dashboard shell with a `PageHero` header and rebuild the body toward the mockup: search + Filters, type chips, **Featured Collections** (curated), **Trending** (real), **Browse by Category** (real counts), **Explore Creators** (real, new discovery query). Honest data — no fabricated feeds; curated where the concept doesn't exist yet.

### Decisions (confirmed)
- **Real where feasible + curated Featured Collections** (editorial cards linking to real filtered views). No schema migration.
- **Move `/explore` into `(dashboard)`** so it inherits the sidebar (matches the mockup); URL unchanged; stays **public** (not added to `middleware` PROTECTED_PATHS — same as Library). Replace the standalone `GalliTopBar` with `PageHero`.
- **Type chips**: All / Pages / Boards / Hubs / People. **Workspaces omitted** (no public flag). Hubs = published community hubs; People = creators.
- **Trending**: ranked by real `views` (all-time is the honest signal we have); titled **"Trending"** (not "This Week") to avoid an unbacked time claim. Windowed trending is a later follow-up.
- **Featured Collections art**: brand gradient + icon tiles (no fabricated pond photos); real destinations (a category/search-filtered Explore view).

## Architecture
Server page moves into the dashboard group; `ExploreClient` is rewritten into a sectioned layout. New read-only queries/endpoints back the real sections. No schema change.

### Route / shell
- **Move** `src/app/explore/page.tsx` → `src/app/(dashboard)/explore/page.tsx` (server component; fetches initial rows + creators + category counts; passes to `ExploreClient`). Delete the old file.
- `ExploreClient` drops `GalliTopBar`; renders `<PageHero icon={<Compass/>} title="Explore" subtitle="Discover pages, boards, hubs, and creators from across the pond." controls={<SearchBox/> + <FiltersButton/>} />` then the sections. Keep the faint `gallio-frog.svg` watermark.

### New data (read-only, no schema change)
- **`src/lib/explore.ts`** — add:
  - `getExploreCreators(viewerId?, limit=8)`: users with ≥1 `published` Display, `orderBy` follower `_count` desc; returns `{ id, username, name, avatar, followerCount, isFollowing }` (isFollowing via the viewer's `Follow` rows).
  - `getCategoryCounts()`: `db.display.groupBy({ by: ['category'], where: { published, kind: { not: 'profile' } }, _count: true })` → `Record<category, number>`.
  - Extend `getExploreRows` (or a new `getTrending`) so trending items carry the author's `followerCount` (via `user._count.followers`).
  - `getPublicCommunities(limit)`: `db.hub.findMany({ where: { community: true, published: true }, ... })` with member `_count` — for the Hubs chip view.
- **`src/app/api/explore/route.ts`** — add an optional **`kind`** filter (`page` | `collection`) so the Pages/Boards chips can fetch a typed grid. Additive.
- **New `src/app/api/explore/creators/route.ts`** (GET) — wraps `getExploreCreators(viewerId)` for client refetch/pagination (optional; initial set comes from the server page).

### Sections (ExploreClient)
1. **Header** — PageHero + `SearchBox` (existing, debounced) + a **Filters** button opening a small popover with the existing sort options (recent / popular). Search switches to a results grid (existing `/api/explore?search=`).
2. **Type chips** — `All | Pages | Boards | Hubs | People`. `All` shows the curated section layout; the others switch the body to a single grid: Pages/Boards → `/api/explore?kind=`, Hubs → public communities, People → creators.
3. **Featured Collections** (curated) — 4 hardcoded `FeaturedCollection` tiles (gradient + icon + title + tagline), each linking to a real filtered Explore view (a category or a search). Honest "editorial" framing.
4. **Trending** — real top pages/boards by views; each card: cover/gradient, a **type badge** (Page/Board), title, `by @author`, views + author follower count.
5. **Browse by Category** — the 8 categories (icon + name + real count from `getCategoryCounts`); clicking sets the category filter.
6. **Explore Creators** — real creators (avatar, name, `@handle`, follower count, `FollowButton`).

### Components (new / changed)
- **New:** `src/components/explore/FeaturedCollections.tsx` (curated tiles), `src/components/explore/CategoryTiles.tsx`, `src/components/explore/CreatorCard.tsx`, `src/components/explore/TrendingCard.tsx` (or extend `ExploreRowCard` with a type badge + counts).
- **Changed:** `src/components/explore/ExploreClient.tsx` (full section rewrite), `src/lib/explore.ts` (+ new queries), `src/app/api/explore/route.ts` (kind filter).
- **Reuse:** `PageHero`, `SearchBox`, `ScrollRow` (horizontal rails), `FollowButton` (needs `username`), `ExploreRowCard`, category icons, `gallio-frog.svg`.

## Requirements
- **R1 — Route move + shell:** `/explore` renders inside the dashboard sidebar via `(dashboard)/explore/page.tsx`; PageHero header replaces GalliTopBar; still reachable logged-out (public). Sidebar "Explore" active state still works (`startsWith('/explore')`).
- **R2 — Search + Filters:** existing search preserved (debounced → grid). Filters button toggles sort (recent/popular) applied to the active grid. No regression to search behavior.
- **R3 — Type chips:** All/Pages/Boards/Hubs/People switch the body as above. Empty states per view ("Nothing here yet"). Workspaces intentionally absent.
- **R4 — Featured Collections:** 4 curated tiles; each navigates to a real filtered view; no fabricated per-item counts (use a static tagline, not a fake "N items", OR a real count if trivially available — prefer tagline to avoid faking).
- **R5 — Trending:** real `views`-ranked pages/boards with type badge + author follower count; titled "Trending".
- **R6 — Browse by Category:** real per-category counts; clicking filters.
- **R7 — Explore Creators:** real discovery query (users with a published page, follower counts); `FollowButton` works (optimistic, by username); hides the viewer themselves.

## Verification
- **Unit:** `getExploreCreators`/`getCategoryCounts`/`getPublicCommunities` shape (mock `db`); `/api/explore?kind=` filters; `CreatorCard` renders avatar/handle/count + FollowButton; `FeaturedCollections`/`CategoryTiles` render N tiles with correct hrefs; chip switching shows the right view.
- **Static:** `tsc --noEmit`; authoritative `eslint` (root:true worktree workaround) 0 errors; existing explore tests green (`GalliTopBar.test` still valid since the component isn't deleted).
- **Visual:** browser check Explore vs mockup — sidebar present, header, chips switch views, Trending/Categories/Creators show real data, Follow works, mobile stacks.

## Non-goals (later)
- Windowed "Trending This Week" from `AnalyticsEvent`; per-card follower counts on non-creator cards beyond trending.
- A real `Collection` model / editorial CMS (curated hardcoded now).
- Public **Workspaces** discovery (needs a schema `published` flag).
- Multi-facet Filters beyond sort.
- Paginated infinite scroll for the new rows (fixed top-N now).

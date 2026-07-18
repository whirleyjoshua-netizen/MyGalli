# My Pond page revamp — design

**Date:** 2026-07-18
**Route:** `/shared` (dashboard) — the "My Pond" page
**Status:** Design approved (pending spec review)

## Goal

Revamp the My Pond page to match the provided mockup: a warm, pond-themed
landing for the user's communities and collaborations. Replace the current
minimal layout (title + tabs + plain cards) with a richer hero, a dismissible
welcome banner, a fully-working search/filter/sort/view toolbar, richer cards
(cover, role badge, member count, activity), and a static right-rail guidance
card.

The left sidebar/taskbar is **out of scope and unchanged.**

## Non-goals

- No changes to the sidebar, routing, or auth.
- No destructive card actions (leave/delete) this pass — the ⋮ menu is
  lightweight (Open, Copy link).
- No new schema/migration. The only backend change is a richer query in the
  existing joined-communities endpoint.

## Assets (delivered, in `public/pond/`)

- `hero-sign.png` — 1536×1024 **transparent** PNG. Wooden sign + frog, baked-in
  copy "Your pond is where ideas flow and connections grow." Renders cleanly on
  the light page background as-is (no masking). Verified in-browser.
- `welcome-banner.png` — 2172×724 wide pond/village scene with a running frog.
  Used as a banner background with a left→right light scrim for text legibility.

## Backend change

### `GET /api/communities/joined` (extend, additive)

Currently returns only communities the user is a **member** of, with
`{ id, title, username, slug, coverImage, latestPost }`.

Change it to return **owned community hubs ∪ joined community hubs** (deduped by
hub id), each shaped as:

```ts
{
  id: string
  title: string
  username: string           // hub owner's username (for the /[username]/hub/[slug] link)
  slug: string
  coverImage: string | null
  role: 'owner' | 'member'   // owner if hub.userId === me.id, else member
  memberCount: number        // _count.members
  latestPost: { text: string | null; createdAt: string } | null
  updatedAt: string          // hub.updatedAt — activity fallback when no posts
}
```

Implementation notes:
- Query owned: `hub.findMany({ where: { userId: me.id, community: true }, select: {..., _count: { select: { members: true } }, posts: take 1 desc } })`.
- Query joined: existing `hubMember.findMany({ where: { userId: me.id, hub: { community: true } } })`, pulling the same hub fields + `_count.members`.
- Merge into a Map keyed by hub id (owned wins on conflict → role `owner`).
- `role` is derived, not stored (HubMember has no role column).
- Sort server-side by activity desc (`latestPost.createdAt ?? updatedAt`); the
  client can re-sort.

The existing `/api/collaborations` endpoint (Collabs tab) is unchanged; the
Collabs cards reuse what it already returns (`coverImage, title, published,
owner, updatedAt`).

## Front-end structure

Current: one 127-line client component in `src/app/(dashboard)/shared/page.tsx`.

New: the page stays the Suspense wrapper + orchestrator; presentational pieces
move to `src/components/pond/`:

| Component | Responsibility |
|---|---|
| `PondHero` | Frog + "My Pond" title/subtitle (left), `hero-sign.png` (center-right), "＋ New community" button + grid/list view toggle (right). Optional "← Back" (`router.back()`). |
| `PondWelcomeBanner` | `welcome-banner.png` bg + left light scrim, overlaid copy, dismiss ✕. Dismissal persisted in `localStorage['pond-welcome-dismissed']`. |
| `PondToolbar` | Search box, "All communities" filter, "Recently active" sort, compact filter/sort popover button. Controlled — emits `{ query, filter, sort }`. |
| `CommunityCard` | Cover (or gradient fallback), role badge, title, description (latest post or "No posts yet"), member count, "Active … ago", ⋮ menu. Links to `/[username]/hub/[slug]`. |
| `CollabCard` | Same shell for the Collabs tab: cover/gradient, title, published/private icon, "shared by @user", "Updated … ago". Links to `/editor?id=…`. |
| `GetMoreCard` | Static right-rail guidance: 4 items (Create a community, Invite collaborators, Share and engage, Organize your spaces) + "Learn more about My Pond →". |
| `NewCommunityModal` | Small name-input modal → `POST /api/hubs { community: true, title }` → `router.push('/hubs/'+id)`. |

`MyPondContent` owns state: `activeTab`, `view: 'grid' | 'list'`, `query`,
`filter: 'all' | 'owned' | 'joined'`, `sort: 'active' | 'newest' | 'alpha' | 'members'`,
plus the fetched `communities` / `displays` and a `welcomeDismissed` flag.

### Layout (below the hero + tabs)

```
PondWelcomeBanner            (full width, dismissible)
PondToolbar                  (full width: search left, filter/sort right)
<div class="flex gap-6">
  <main class="flex-1">      grid: 1 / 2 / 3 cols responsive (list view = rows)
     CommunityCard[] | CollabCard[]
  </main>
  <aside class="w-72 hidden xl:block">
     GetMoreCard              (static)
  </aside>
</div>
```

Right rail hidden below `xl`. Cards go 3-col at `lg`, 2 at `sm`, 1 on mobile.

## Toolbar behavior (all client-side, in-memory)

- **Search** — case-insensitive match on community/collab title.
- **Filter** (Communities tab) — `all` / `owned` (role owner) / `joined` (role member).
- **Sort** — `active` (latestPost/updatedAt desc, default), `newest` (created/updated desc), `alpha` (title A–Z), `members` (memberCount desc).
- **View toggle** — grid vs. compact list; persisted in `localStorage['pond-view']`.
- Filtering/sorting is derived state over the loaded arrays — no refetch.

## Empty states

- No communities → dashed card: "No communities in your pond yet." + a "Create a
  community" button (opens `NewCommunityModal`).
- No collabs → existing "No pages shared with you yet." dashed card, restyled.
- Search yields nothing → "No communities match '<query>'."

## Styling

- Brand tokens (`galli.*`, `--primary`, `--surface`, `--border`), Plus Jakarta
  Sans, `rounded-2xl`, `shadow-soft`. Consistent with existing dashboard cards.
- Role badge: green pill "Owner" / neutral pill "Member" with a small icon.
- Activity dot: green `•` + relative time via existing time-ago helper.

## Testing / verification

- Unit: extend/adjust any existing `/api/communities/joined` expectations;
  add a test for the owned∪joined merge + `role`/`memberCount` shaping.
- Client: toolbar filter/sort/search are pure functions over the arrays — unit
  test the derive helper (`filterSortCommunities`).
- Browser smoke (real Chrome): load `/shared`, confirm hero sign + banner
  render, cards show role/member/activity, search/filter/sort/view all work,
  banner dismiss persists, right rail visible at `xl`.
- `pnpm test`, `tsc --noEmit`, and `next lint` green before shipping.

## Rollout

Feature branch → worktree → PR → prod (per project norm). No migration, so
prod deploy is additive and safe.
```

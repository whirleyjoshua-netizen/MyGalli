# Community Hub — Live Feed — design

**Date:** 2026-07-20
**Status:** Approved design (spec). Implementation plan next.
**Milestone:** M5b. Branch `feat/hub-live-feed`, worktree `.claude/worktrees/hub-live`, base `main` @ `7776a4b`.
**Predecessor:** M5a Trust & Safety.

## Context & goal

`CommunityFeed` fetches once — `useEffect(() => { load() }, [hubId])` — and never again. Post
something and nobody sees it until they reload. Someone can react or reply to the post you are
looking at and the page stays frozen. For a product whose whole premise is a community gathering
place, the room currently feels empty even when it isn't.

This milestone makes the feed feel alive. It is deliberately small: no new models, no new API route.

### Decisions (user-approved)

- **New posts arrive behind a "N new posts" pill**, not by auto-insertion. The feed contains polls,
  comment threads and reaction buttons that people are mid-interaction with; shifting content under a
  reader is the exact failure the pill pattern exists to prevent.
- **Reaction and comment counts on already-visible posts update in place.** They ride along in the
  payload the feed already fetches, so this is near-free, produces no layout shift, and is what
  actually reads as "alive".
- **Out of scope:** the Kollab pool (a grid — inserting a tile reshuffles layout, so it needs its own
  UX decision), live comment *lists*, and presence.

### Transport: polling, not SSE or WebSockets

This app runs on Vercel serverless; WebSockets would need a third-party service. The repo already
polls in two places, so polling is the house pattern and costs nothing new to operate.

**Follow `src/components/analytics/overview/LiveActivityFeed.tsx`, not `NotificationBell.tsx`.**
LiveActivityFeed is the better precedent: it gates on `document.visibilityState === 'visible'` so a
backgrounded tab stops polling, and it holds the callback in a ref to avoid stale-closure bugs.
`NotificationBell` polls unconditionally at 45s — do not copy that.

## Requirements

### R1 — Poll the feed

`CommunityFeed` gains an interval, **exported as `FEED_POLL_MS`** so tests can advance timers by it
(mirroring how `LIVE_POLL_MS` is exported and used in `LiveActivityFeed.test.tsx`). 20s matches the
existing live surface.

Rules:
- Poll only when `document.visibilityState === 'visible'`.
- Never poll when the `preview` prop is set — the builder's live preview must stay fetch-free.
- Hold the fetch callback in a ref so the interval isn't re-created on every render.
- A failed poll is a no-op: keep showing what we have, never blank the feed.
- Clear the interval on unmount.

### R2 — The "N new posts" pill

The poll fetches the same `GET /api/hubs/[id]/posts` the feed already uses. Split the response:

- **Posts whose ids are already displayed** → merge in place (R3).
- **Posts whose ids are not displayed** → held in a `pending` buffer. They are NOT inserted.

A pill renders above the feed showing the pending count, e.g. "▲ 3 new posts". Clicking it prepends
the buffered posts, clears the buffer, and scrolls the feed to the top.

- No pending posts ⇒ no pill at all (not a zero-state).
- The pill count is the number of buffered posts, deduped by id — polling repeatedly must not inflate
  it.
- **The viewer's own new post must not go through the pill.** The composer already calls `load()` on
  success; that path must continue to insert directly. Seeing "1 new post" after clicking Post would
  be absurd.

### R3 — Live counts on visible posts

For a post already on screen, a poll updates **only** `reactions` and `commentCount`. It must never
reorder the list, replace the post object wholesale, or re-mount the card — any of those would reset
poll answers and open comment threads.

Two components currently seed state at mount and ignore later prop changes, so they need to accept
updates:

**`ReactionBar`** (`src/components/hub/community/ReactionBar.tsx`) does
`useState(initial.counts)` / `useState(initial.mine)`, and on tap writes optimistically, then
reconciles from its own request's response, reverting on failure.

⚠️ **The race that must be handled:** user taps a reaction → optimistic local update → a poll that
was already in flight returns *pre-tap* data → the bar visually reverts → the user's own request
resolves and corrects it. A brief, wrong flicker on the exact element they just touched.

Fix: the bar tracks its own in-flight/dirty state and **ignores incoming prop syncs while its own
write is unsettled**. Its own response stays authoritative for its own state. Server `mine` is
per-viewer and correct, so syncing is otherwise safe.

**`HubPostComments`** (`src/components/hub/HubPostComments.tsx`) does `useState(initialCount)`.
Sync the prop into state, but **do not** disturb an open thread or an in-flight reply.

### R4 — No API change

`GET /api/hubs/[id]/posts` already returns `reactions` and `commentCount` and takes the newest 50.
Nothing server-side changes. If polling every 20s proves expensive later, an `?since=` parameter is
the obvious follow-up — explicitly not now.

## Security / correctness notes

- Polling introduces **no new data exposure**: it re-calls an endpoint the viewer already loads, with
  the same read gate (`canViewCommunityHub`) and the same per-viewer `mine` computation.
- A banned user's poll returns whatever the read gate allows — bans block *participation*, not
  reading a published community. That is the existing, intended behaviour.
- The merge must key strictly on post id. Never merge by array index; the feed is ordered by
  `createdAt desc` and indices shift.

## Verification plan

- **Unit:** the pill counts only genuinely-new ids and dedupes across repeated polls; no pill when
  nothing is new; polling is skipped when the tab is hidden and when `preview` is set; a failed poll
  leaves the feed intact; counts merge in place without reordering; `ReactionBar` ignores a prop sync
  while its own write is unsettled but accepts one afterwards. Use fake timers advanced by
  `FEED_POLL_MS`, as `LiveActivityFeed.test.tsx` does.
- **Browser smoke — REQUIRED before merge** (standing rule since a CSP bug shipped past a green
  suite, and since M5a shipped three components that worked but were unreachable): with two sessions
  open, post from one and confirm the other shows the pill without shifting; click it and confirm
  insertion plus scroll; react from one and watch the count change on the other; confirm a hidden tab
  stops polling (check the network panel); confirm the builder preview issues no requests; console
  clean.
- **Static:** `tsc --noEmit`, `eslint` (worktree `root:true` workaround), `pnpm test`, `next build`.
  Remember the vitest worker-timeout flake — a "failure" whose passed-files + errors equals the total
  file count is machine contention; re-run those files in isolation.

## Non-goals

SSE/WebSocket transport, live Kollab pool, live comment lists, typing indicators, presence/online
counts, an `?since=` delta endpoint, and unread-state persistence across sessions.

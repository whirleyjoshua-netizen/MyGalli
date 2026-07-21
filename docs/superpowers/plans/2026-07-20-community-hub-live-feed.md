# Community Hub Live Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the community feed live — new posts arrive behind a "N new posts" pill, and reaction/comment counts on visible posts update in place — without shifting content under a reader.

**Architecture:** Visibility-gated polling of the endpoint the feed already calls. No new model, no new API route. Two existing components gain the ability to accept prop updates they currently ignore.

**Tech Stack:** Next.js 15.5.19 App Router, React 19, TypeScript, Tailwind, Vitest + @testing-library/react.

## Global Constraints

- Worktree `C:\Users\whirl\pages-mvp\.claude\worktrees\hub-live`, branch `feat/hub-live-feed`. **Run `git branch --show-current` before every commit** — concurrent sessions share checkouts in this repo.
- **No new API route and no schema change.** `GET /api/hubs/[id]/posts` already returns `reactions` and `commentCount`.
- **Never poll when the `preview` prop is set** — the builder's live preview must stay fetch-free.
- **Never poll while `document.visibilityState !== 'visible'`** — public hub tabs get left open for days.
- Component tests use **`fireEvent` from `@testing-library/react`**. `@testing-library/user-event` is NOT a dependency of this repo.
- Tests: `npx vitest run <path>`; set `JWT_SECRET=test-secret-for-local-run-only-1234567890` if needed.
- **The shared dev database `pages` is BROKEN** (an unrelated migration is stuck from a concurrent session). Do NOT try to repair it; do NOT run `prisma migrate dev` or `migrate diff --from-url`. Nothing in this milestone needs a database — mock `fetch` in tests.
- Lint in a worktree: temporarily write `{ "root": true, "extends": "next/core-web-vitals" }` to `.eslintrc.json`, run `npx eslint . --ext .ts,.tsx`, then `git checkout -- .eslintrc.json`. `next lint` fails in a worktree.
- Do NOT add an `eslint-disable` for a rule this ESLint config doesn't define — that is itself a lint error.
- **Reference implementation for polling: `src/components/analytics/overview/LiveActivityFeed.tsx`** (visibility-gated, callback held in a ref, interval constant exported for tests). Do NOT copy `NotificationBell.tsx`, which polls unconditionally.

---

### Task 1: `ReactionBar` accepts live count updates

**Files:**
- Modify: `src/components/hub/community/ReactionBar.tsx`
- Test: `src/components/hub/community/ReactionBar.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `ReactionSummary = { counts: Record<string, number>; mine: string[] }`.
- Produces: `ReactionBar` now re-syncs from its `initial` prop when that prop changes — except while its own write is unsettled. Public props are unchanged, so no caller needs editing.

**The problem:** the component does `useState(initial.counts)` / `useState(initial.mine)`, which read the prop **once at mount**. A poll updating `post.reactions` therefore changes nothing on screen.

**⚠️ The race this task exists to prevent:** the user taps a reaction → the bar updates optimistically → a poll that was *already in flight* returns pre-tap data → the bar visibly reverts the thing they just pressed → their own request resolves and corrects it. The fix is that the bar ignores incoming prop syncs while its own write is unsettled.

**⚠️ Implementer trap:** `initial` is an object literal recreated on every parent render. `useEffect(..., [initial])` would fire on every render and can loop. Depend on a **serialized key** instead, e.g. `const initialKey = JSON.stringify(initial)` and `useEffect(..., [initialKey])`.

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/ReactionBar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReactionBar } from './ReactionBar'

const sum = (counts: Record<string, number>, mine: string[] = []) => ({ counts, mine })

beforeEach(() => { vi.restoreAllMocks() })

describe('ReactionBar live updates', () => {
  it('renders the initial counts', () => {
    render(<ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 2 })} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('adopts a new count when the prop changes', () => {
    const { rerender } = render(<ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 2 })} />)
    rerender(<ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 5 })} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  // The race: a poll in flight when the user taps must not revert their tap.
  it('ignores a stale prop sync while its own write is unsettled', async () => {
    let resolveFetch: (v: unknown) => void = () => {}
    global.fetch = vi.fn(() => new Promise((r) => { resolveFetch = r })) as any

    const { rerender } = render(
      <ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 2 }, [])} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /❤️/ }))
    expect(await screen.findByText('3')).toBeInTheDocument()   // optimistic

    // A poll lands with pre-tap data while our request is still open.
    rerender(<ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 2 }, [])} />)
    expect(screen.getByText('3')).toBeInTheDocument()          // must NOT revert to 2

    resolveFetch({ ok: true, status: 200, json: async () => sum({ '❤️': 3 }, ['❤️']) })
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
  })

  it('accepts prop syncs again once its own write has settled', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => sum({ '❤️': 3 }, ['❤️']) })) as any
    const { rerender } = render(
      <ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 2 }, [])} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /❤️/ }))
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())

    rerender(<ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 9 }, ['❤️'])} />)
    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument())
  })
})
```

If the emoji button's accessible name differs from the emoji itself, read the component and adjust the query — do not change the component to suit the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/hub/community/ReactionBar.test.tsx`
Expected: FAIL — the prop-change test still shows `2`.

- [ ] **Step 3: Implement**

In `ReactionBar.tsx`, add `useEffect` and `useRef` to the React import, then:

```tsx
  // True from the moment the user taps until their own request settles. While
  // set, incoming prop syncs are ignored: a poll already in flight returns
  // pre-tap data and would visibly revert the reaction they just pressed.
  const busyRef = useRef(false)

  // `initial` is a fresh object every parent render, so depend on a serialised
  // key rather than the object identity — otherwise this effect fires forever.
  const initialKey = JSON.stringify(initial)
  useEffect(() => {
    if (busyRef.current) return
    setCounts(initial.counts)
    setMine(initial.mine)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey])
```

**Only add that disable comment if ESLint actually flags the rule** — `react-hooks/exhaustive-deps` IS configured in this repo (it appears in the existing warning list), so it is legitimate here. Do not add disables for rules that are not configured.

In `toggle()`, set `busyRef.current = true` immediately before the optimistic update, and reset it to `false` in a `finally` (or at every exit path, including the 401 redirect and both revert branches).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/hub/community/ReactionBar.test.tsx` → PASS (4 tests).

- [ ] **Step 5: Verify tsc + commit**

```bash
npx tsc --noEmit
git add src/components/hub/community/ReactionBar.tsx src/components/hub/community/ReactionBar.test.tsx
git commit -m "feat(live): ReactionBar adopts live counts without clobbering a tap"
```

---

### Task 2: `HubPostComments` accepts a live count

**Files:**
- Modify: `src/components/hub/HubPostComments.tsx`
- Test: `src/components/hub/HubPostComments.test.tsx` (create if absent)

**Interfaces:**
- Produces: the component re-syncs its count from `initialCount` **while the thread is closed**. Props unchanged.

**Why the guard:** once the thread is open the component owns the count — the user may have just added a comment and be looking at their own optimistic increment. A poll must not overwrite that.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HubPostComments } from './HubPostComments'

const base = { hubId: 'h1', postId: 'p1', canComment: true, canModerate: false, currentUserId: 'u1' }

describe('HubPostComments live count', () => {
  it('adopts a new count while the thread is closed', () => {
    const { rerender } = render(<HubPostComments {...base} initialCount={1} />)
    expect(screen.getByText(/1 comment/i)).toBeInTheDocument()
    rerender(<HubPostComments {...base} initialCount={4} />)
    expect(screen.getByText(/4 comments/i)).toBeInTheDocument()
  })

  // Once open, the component owns the count — the user may have just replied.
  it('ignores a count sync while the thread is open', () => {
    const { rerender } = render(<HubPostComments {...base} initialCount={1} />)
    fireEvent.click(screen.getByText(/1 comment/i))
    rerender(<HubPostComments {...base} initialCount={4} />)
    expect(screen.queryByText(/4 comments/i)).toBeNull()
  })
})
```

Read the component first and match its actual count label; adjust the queries to the real text rather than changing the component.

- [ ] **Step 2: Run test to verify it fails.**

- [ ] **Step 3: Implement**

```tsx
  // Sync only while closed; an open thread owns its count (the user may be
  // looking at their own optimistic increment).
  useEffect(() => {
    if (!open) setCount(initialCount)
  }, [initialCount, open])
```

Place it after the existing state declarations and add `useEffect` to the React import.

- [ ] **Step 4: Run test to verify it passes.**

- [ ] **Step 5: Verify tsc + commit**

```bash
git add src/components/hub/HubPostComments.tsx src/components/hub/HubPostComments.test.tsx
git commit -m "feat(live): HubPostComments adopts a live count while closed"
```

---

### Task 3: Poll the feed, buffer new posts behind a pill

**Files:**
- Modify: `src/components/hub/community/CommunityFeed.tsx`
- Test: `src/components/hub/community/CommunityFeed.test.tsx` (create)

**Interfaces:**
- Consumes: Tasks 1 and 2 (so merged counts actually render).
- Produces: `export const FEED_POLL_MS = 20_000`, consumed by the test to advance fake timers — mirroring `LIVE_POLL_MS` in `LiveActivityFeed.test.tsx`.

**Behaviour contract:**
1. Poll every `FEED_POLL_MS`, only when visible, never in `preview`.
2. Incoming posts whose ids are **already displayed** → merge `reactions` and `commentCount` in place. Never reorder, never replace the post object wholesale, never re-mount the card (that would reset poll answers and open threads).
3. Incoming posts whose ids are **not displayed** → buffer, do not insert.
4. The pill shows the buffered count; clicking prepends them, clears the buffer, scrolls to top.
5. **The viewer's own post bypasses the pill** — the composer's `onPosted` calls `load()`, a full replace that also clears the buffer.
6. A failed poll is a no-op — never blank the feed.
7. Dedupe strictly by id: repeated polls must not inflate the pill.

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/CommunityFeed.test.tsx`. Mock the child components so the test is about feed logic, not rendering:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CommunityFeed, FEED_POLL_MS } from './CommunityFeed'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'

vi.mock('@/components/bulletin/BulletinPostCard', () => ({
  BulletinPostCard: ({ post }: any) => <div data-testid="post">{post.text}</div>,
}))
vi.mock('@/components/hub/HubPostComments', () => ({ HubPostComments: () => null }))
vi.mock('@/components/hub/HubPostComposer', () => ({ HubPostComposer: () => null }))
vi.mock('@/components/hub/ReportButton', () => ({ ReportButton: () => null }))

const post = (id: string, text: string, extra: Record<string, unknown> = {}) => ({
  id, text, imageUrl: null, block: null, settings: { revealAfterAnswer: false, liveTally: true },
  createdAt: '2026-07-20T00:00:00.000Z', myResponse: null, results: null,
  author: { id: 'a1', name: 'A', username: 'a', avatar: null }, ...extra,
})

const feed = (posts: unknown[]) => ({ ok: true, json: async () => ({ posts }) })
const base = { hubId: 'h1', canPost: true, isPrivileged: false, currentUserId: 'me', config: DEFAULT_HUB_CONFIG }

beforeEach(() => { vi.useFakeTimers(); vi.restoreAllMocks() })
afterEach(() => { vi.useRealTimers() })

const tick = async () => { await act(async () => { vi.advanceTimersByTime(FEED_POLL_MS) }) }

describe('CommunityFeed live polling', () => {
  it('buffers a new post behind a pill instead of inserting it', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(feed([post('p1', 'first')]))
      .mockResolvedValue(feed([post('p2', 'second'), post('p1', 'first')])) as any
    render(<CommunityFeed {...base} />)
    expect(await screen.findByText('first')).toBeInTheDocument()

    await tick()
    expect(await screen.findByText(/1 new post/i)).toBeInTheDocument()
    expect(screen.queryByText('second')).toBeNull()          // not inserted
  })

  it('inserts buffered posts when the pill is clicked', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(feed([post('p1', 'first')]))
      .mockResolvedValue(feed([post('p2', 'second'), post('p1', 'first')])) as any
    render(<CommunityFeed {...base} />)
    await screen.findByText('first')
    await tick()
    fireEvent.click(await screen.findByText(/1 new post/i))
    expect(await screen.findByText('second')).toBeInTheDocument()
    expect(screen.queryByText(/new post/i)).toBeNull()       // pill cleared
  })

  it('does not inflate the pill across repeated polls', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(feed([post('p1', 'first')]))
      .mockResolvedValue(feed([post('p2', 'second'), post('p1', 'first')])) as any
    render(<CommunityFeed {...base} />)
    await screen.findByText('first')
    await tick(); await tick(); await tick()
    expect(await screen.findByText(/1 new post/i)).toBeInTheDocument()
  })

  it('merges counts on a visible post in place, without a pill', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(feed([post('p1', 'first', { commentCount: 0 })]))
      .mockResolvedValue(feed([post('p1', 'first', { commentCount: 7 })])) as any
    const { container } = render(<CommunityFeed {...base} />)
    await screen.findByText('first')
    await tick()
    expect(screen.queryByText(/new post/i)).toBeNull()
    expect(container.querySelectorAll('[data-testid="post"]').length).toBe(1)
  })

  it('does not poll when the tab is hidden', async () => {
    global.fetch = vi.fn().mockResolvedValue(feed([post('p1', 'first')])) as any
    render(<CommunityFeed {...base} />)
    await screen.findByText('first')
    const calls = (global.fetch as any).mock.calls.length
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await tick()
    expect((global.fetch as any).mock.calls.length).toBe(calls)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('does not fetch at all in preview mode', async () => {
    global.fetch = vi.fn() as any
    render(<CommunityFeed {...base} preview />)
    await tick()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('keeps the feed intact when a poll fails', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(feed([post('p1', 'first')]))
      .mockRejectedValue(new Error('offline')) as any
    render(<CommunityFeed {...base} />)
    await screen.findByText('first')
    await tick()
    expect(screen.getByText('first')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/hub/community/CommunityFeed.test.tsx`
Expected: FAIL — `FEED_POLL_MS` is not exported and no polling exists.

- [ ] **Step 3: Implement**

In `CommunityFeed.tsx`, add `useRef` to the React import and export the constant:

```tsx
// Matches LIVE_POLL_MS on the analytics live surface.
export const FEED_POLL_MS = 20_000
```

Add state and refs beside the existing ones:

```tsx
  const [pending, setPending] = useState<FeedPost[]>([])
  const topRef = useRef<HTMLDivElement>(null)
  // Refs mirror state so the polling callback can read current values without
  // being re-created (and without stale closures).
  const postsRef = useRef<FeedPost[]>([])
  const pendingRef = useRef<FeedPost[]>([])
  useEffect(() => { postsRef.current = posts }, [posts])
  useEffect(() => { pendingRef.current = pending }, [pending])
```

`load()` keeps its full-replace behaviour and additionally clears the buffer — this is the path the composer uses, so the viewer's own post never goes through the pill:

```tsx
  async function load() {
    if (preview) { setPosts([]); setLoaded(true); return }
    const res = await fetch(`/api/hubs/${hubId}/posts`)
    if (res.ok) { setPosts((await res.json()).posts); setPending([]) }
    setLoaded(true)
  }
```

Add the poll:

```tsx
  async function poll() {
    if (preview) return
    let incoming: FeedPost[]
    try {
      const res = await fetch(`/api/hubs/${hubId}/posts`)
      if (!res.ok) return                        // a failed poll is a no-op
      incoming = (await res.json()).posts
    } catch {
      return
    }
    const fresh = new Map(incoming.map((p) => [p.id, p]))

    // Visible posts: update counts only. Never reorder or replace the object
    // wholesale — that would re-mount the card and reset poll answers and
    // open comment threads.
    setPosts((cur) =>
      cur.map((p) => {
        const f = fresh.get(p.id)
        return f ? { ...p, reactions: f.reactions, commentCount: f.commentCount } : p
      }),
    )

    // Genuinely new posts go to the buffer, deduped against both lists.
    const displayed = new Set(postsRef.current.map((p) => p.id))
    const buffered = new Set(pendingRef.current.map((p) => p.id))
    const added = incoming.filter((p) => !displayed.has(p.id) && !buffered.has(p.id))
    if (added.length) setPending((cur) => [...added, ...cur])
  }

  const pollRef = useRef(poll)
  useEffect(() => { pollRef.current = poll })
  useEffect(() => {
    if (preview) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') pollRef.current()
    }, FEED_POLL_MS)
    return () => clearInterval(id)
  }, [preview])

  function showPending() {
    setPosts((cur) => {
      const ids = new Set(cur.map((p) => p.id))
      return [...pending.filter((p) => !ids.has(p.id)), ...cur]
    })
    setPending([])
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
```

Render the anchor and the pill as the first children of the wrapper, above the composer:

```tsx
    <div className="space-y-4">
      <div ref={topRef} />
      {pending.length > 0 && (
        <button
          onClick={showPending}
          className="w-full rounded-full border border-border bg-surface py-2 text-sm font-medium text-primary shadow-soft hover:bg-muted"
        >
          ▲ {pending.length} new {pending.length === 1 ? 'post' : 'posts'}
        </button>
      )}
      {canPost && config.feed.composerEnabled && <HubPostComposer … />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/hub/community/CommunityFeed.test.tsx` → PASS (7 tests).

- [ ] **Step 5: Verify tsc + lint + commit**

```bash
npx tsc --noEmit
git add src/components/hub/community/CommunityFeed.tsx src/components/hub/community/CommunityFeed.test.tsx
git commit -m "feat(live): poll the community feed behind a new-posts pill"
```

---

### Task 4: Verification + browser smoke

**Files:** none.

**The browser pass happens BEFORE merge.** This repo has shipped a CSP bug that every server-side test passed through, and three components that worked but were unreachable. Tests prove logic; the browser proves behaviour.

- [ ] **Step 1: Static gate**

```bash
npx tsc --noEmit        # 0
npx vitest run          # all pass
npx next build          # exit 0
```
Lint via the worktree workaround → **0 errors** (warnings are pre-existing).

If the suite reports failures/errors whose count plus the passed-file count equals the total test files on disk, that is the known vitest worker-spawn flake under machine load — extract those files from the log and re-run them in isolation rather than reporting a failure.

- [ ] **Step 2: Seed and serve**

Use the fresh database `postgresql://pages:pages@127.0.0.1:5434/pages_safety` (the shared `pages` DB is broken). Seed a published community hub with an owner, a member, and two or three posts. Build, then `npx next start -p 3021`.

- [ ] **Step 3: Browser smoke (real Chrome, two sessions)**

Use the `superpowers-chrome:browsing` skill.

1. Open the hub as the member. In a second context (or via a direct `POST /api/hubs/<id>/posts` as the owner), create a post.
2. Within ~20s the member's page shows **"▲ 1 new post"** and **nothing on screen moves**.
3. Click the pill → the post appears at the top, the pill disappears, the view scrolls to top.
4. React to a visible post from the other session → within ~20s the member's count updates **in place**, with no pill and no reflow.
5. Tap a reaction as the member and immediately confirm it does **not** flicker back when the next poll lands.
6. Post as the member themselves → it appears directly, **no pill**.
7. Background the tab, wait past two intervals, confirm no requests in the network panel; foreground and confirm polling resumes.
8. Open the builder preview and confirm it issues **no** feed requests.
9. Console clean throughout.

- [ ] **Step 4: Clean up + merge**

Remove scratch scripts, confirm `git status` clean, merge `origin/main`, re-run the static gate, and merge to `main` only after the browser smoke passes.

---

## Self-review notes (author)

- **Spec coverage:** R1 polling → Task 3; R2 pill → Task 3; R3 live counts → Tasks 1, 2 (the components) and Task 3 (the merge); R4 no API change → holds throughout; verification → Task 4.
- **Ordering is deliberate:** Tasks 1 and 2 come first because without them Task 3's merge would update state that nothing renders — the feature would look broken and an implementer might "fix" it by re-mounting cards, which is exactly what must not happen.
- **Type consistency:** `FeedPost` is the existing exported type from `BulletinPostCard`; `ReactionSummary` from `@/lib/hub-reactions`. `FEED_POLL_MS` is defined in Task 3 and consumed only by its test.
- **Two implementer traps are called out inline:** the `[initial]` object-identity dependency that would loop (Task 1), and the temptation to replace post objects wholesale, which re-mounts cards and resets in-progress poll answers (Task 3).
- **Known limitation, accepted:** each poll refetches the newest 50 posts rather than a delta. An `?since=` parameter is the obvious optimisation and is explicitly deferred in the spec.

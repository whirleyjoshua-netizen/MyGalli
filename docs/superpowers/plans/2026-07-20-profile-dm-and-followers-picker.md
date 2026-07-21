# Profile DM + Followers Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the profile "Message" button start a real DM for logged-in members (keeping anonymous visitor notes for logged-out visitors), and replace the `window.prompt` username entry with a searchable followers/following picker.

**Architecture:** No schema and no API changes — every endpoint needed already exists and is tested. The work is three client components plus one pure helper: a `mergeSocialGraph` function (testable in isolation), a `UserPickerModal` that consumes it, a `ProfileDmModal` that chains the two existing DM POSTs, and prop plumbing to get the viewer's session down to `ProfileActionCards` and the viewer's username into `MessagesClient`.

**Tech Stack:** Next.js 15.5 App Router, React 19, TypeScript, Tailwind, Vitest + @testing-library/react, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-20-profile-dm-and-followers-picker-design.md`

## Global Constraints

- Branch: `feat/profile-dm`, worktree `C:/Users/whirl/pages-mvp/.claude/worktrees/profile-dm`. All paths below are relative to that worktree. `cd` there first.
- Run tests with `pnpm vitest run <path>`. Run the type gate with `pnpm exec tsc --noEmit`.
- **`tsc` does NOT run ESLint.** Before the branch is finished, `pnpm exec next lint` must pass — a lint error fails the production build. Escape apostrophes in JSX (`&apos;`) and never use a raw `<a>` for an internal static route (`react/no-unescaped-entities`, `@next/next/no-html-link-for-pages`).
- **Do not modify** `src/app/api/messages/profile/route.ts`. It stays unauthenticated by design (public visitor notes, honeypot + IP rate limit). Its 5 existing tests must stay green.
- **Do not modify** any route under `src/app/api/dm/**` or `src/app/api/users/[username]/**`. No schema changes.
- Write targeted edits only. Do not rewrite whole files; do not introduce a BOM or curly quotes into existing files.
- Follower endpoints return `{ users: [{ username, name, avatar, isFollowing }] }` — **no `id` field**. Never index on `id` for these rows.
- Styling follows existing components: modal shell is `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40` with an inner `onClick={(e) => e.stopPropagation()}`; surfaces use `bg-surface border border-border rounded-2xl shadow-soft-lg`; the primary button colour is `bg-galli text-white`.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/dm-picker.ts` (create) | Pure merge/dedup/sort of the two follower lists. No React, no fetch. |
| `src/lib/dm-picker.test.ts` (create) | Unit tests for the above. |
| `src/components/messages/UserPickerModal.tsx` (create) | Fetches both lists, renders search + rows, calls `onSelect(username)`. |
| `src/components/messages/UserPickerModal.test.tsx` (create) | Component tests. |
| `src/components/messages/MessagesClient.tsx` (modify) | Accept `myUsername`; open the picker instead of `window.prompt`. |
| `src/components/messages/MessagesClient.test.tsx` (modify) | Replace the `window.prompt` stub with picker interaction. |
| `src/app/(dashboard)/messages/page.tsx` (modify) | Pass `myUsername={auth?.username ?? ''}`. |
| `src/components/profile/ProfileDmModal.tsx` (create) | Logged-in composer: create conversation, post first message, navigate. |
| `src/components/profile/ProfileDmModal.test.tsx` (create) | Component tests for the two-call sequence. |
| `src/components/profile/ProfileActionCards.tsx` (modify) | Branch the `message` card on `isLoggedIn`. |
| `src/components/profile/ProfileActionCards.test.tsx` (create) | Tests for the auth-aware branch. |
| `src/components/profile/ProfileHeaderCard.tsx` (modify) | Pass `isLoggedIn` through. |
| `src/app/[username]/page.tsx` (modify) | Supply `isLoggedIn={!!meId}`. |

---

### Task 1: Pure social-graph merge helper

**Files:**
- Create: `src/lib/dm-picker.ts`
- Test: `src/lib/dm-picker.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export interface PickerUser { username: string; name: string | null; avatar: string | null; isMutual: boolean }` and `export function mergeSocialGraph(followers: SocialRow[], following: SocialRow[]): PickerUser[]`, plus `export interface SocialRow { username: string; name: string | null; avatar: string | null; isFollowing?: boolean }` and `export function filterPickerUsers(users: PickerUser[], query: string): PickerUser[]`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/dm-picker.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mergeSocialGraph, filterPickerUsers } from './dm-picker'

const row = (username: string, name: string | null = null) => ({
  username,
  name,
  avatar: null,
})

describe('mergeSocialGraph', () => {
  it('marks users present in both lists as mutual', () => {
    const out = mergeSocialGraph([row('sarah')], [row('sarah')])
    expect(out).toHaveLength(1)
    expect(out[0].isMutual).toBe(true)
  })

  it('marks a one-way follower as not mutual', () => {
    const out = mergeSocialGraph([row('sarah')], [])
    expect(out[0].isMutual).toBe(false)
  })

  it('dedupes by username so a mutual appears exactly once', () => {
    const out = mergeSocialGraph([row('sarah'), row('jo')], [row('sarah')])
    expect(out.map((u) => u.username)).toEqual(['sarah', 'jo'])
  })

  it('sorts mutuals first, then alphabetically by display name', () => {
    const followers = [row('zed', 'Zed'), row('amy', 'Amy'), row('bob', 'Bob')]
    const following = [row('zed', 'Zed')]
    const out = mergeSocialGraph(followers, following)
    expect(out.map((u) => u.username)).toEqual(['zed', 'amy', 'bob'])
  })

  it('falls back to username when name is null for sorting', () => {
    const out = mergeSocialGraph([row('bea'), row('ann')], [])
    expect(out.map((u) => u.username)).toEqual(['ann', 'bea'])
  })

  it('sorts case-insensitively', () => {
    const out = mergeSocialGraph([row('b', 'beta'), row('a', 'Alpha')], [])
    expect(out.map((u) => u.username)).toEqual(['a', 'b'])
  })

  it('prefers the richer record when the same user appears in both lists', () => {
    const out = mergeSocialGraph([row('sarah', null)], [
      { username: 'sarah', name: 'Sarah Johnson', avatar: '/a.png' },
    ])
    expect(out[0].name).toBe('Sarah Johnson')
    expect(out[0].avatar).toBe('/a.png')
  })

  it('returns an empty array when both lists are empty', () => {
    expect(mergeSocialGraph([], [])).toEqual([])
  })
})

describe('filterPickerUsers', () => {
  const users = mergeSocialGraph(
    [row('sarahj', 'Sarah Johnson'), row('bob', 'Bob Smith')],
    []
  )

  it('returns everything for an empty query', () => {
    expect(filterPickerUsers(users, '')).toHaveLength(2)
  })

  it('matches on username case-insensitively', () => {
    expect(filterPickerUsers(users, 'SARAH').map((u) => u.username)).toEqual(['sarahj'])
  })

  it('matches on display name', () => {
    expect(filterPickerUsers(users, 'smith').map((u) => u.username)).toEqual(['bob'])
  })

  it('ignores surrounding whitespace and a leading @', () => {
    expect(filterPickerUsers(users, '  @bob ').map((u) => u.username)).toEqual(['bob'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterPickerUsers(users, 'zzz')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/dm-picker.test.ts`
Expected: FAIL — `Failed to resolve import "./dm-picker"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/dm-picker.ts`:

```ts
/**
 * Shapes the viewer's follower + following lists into one picker list.
 *
 * The follower endpoints (`/api/users/[username]/followers|following`) return
 * no `id`, so `username` is the identity here — which is fine, because
 * `POST /api/dm/conversations` also keys off `username`.
 */

export interface SocialRow {
  username: string
  name: string | null
  avatar: string | null
  isFollowing?: boolean
}

export interface PickerUser {
  username: string
  name: string | null
  avatar: string | null
  /** Present in BOTH lists: they follow the viewer and the viewer follows them. */
  isMutual: boolean
}

const displayName = (u: { name: string | null; username: string }) =>
  (u.name || u.username).toLowerCase()

export function mergeSocialGraph(followers: SocialRow[], following: SocialRow[]): PickerUser[] {
  const followingNames = new Set(following.map((u) => u.username))
  const byUsername = new Map<string, PickerUser>()

  // `following` is merged last so its record wins on conflict, but a null
  // field must never overwrite a populated one from the other list.
  for (const row of [...followers, ...following]) {
    const existing = byUsername.get(row.username)
    byUsername.set(row.username, {
      username: row.username,
      name: row.name ?? existing?.name ?? null,
      avatar: row.avatar ?? existing?.avatar ?? null,
      isMutual: followingNames.has(row.username) && followers.some((f) => f.username === row.username),
    })
  }

  return [...byUsername.values()].sort((a, b) => {
    if (a.isMutual !== b.isMutual) return a.isMutual ? -1 : 1
    return displayName(a).localeCompare(displayName(b))
  })
}

export function filterPickerUsers(users: PickerUser[], query: string): PickerUser[] {
  const q = query.trim().replace(/^@/, '').toLowerCase()
  if (!q) return users
  return users.filter(
    (u) => u.username.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q)
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/dm-picker.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Type gate**

Run: `pnpm exec tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/lib/dm-picker.ts src/lib/dm-picker.test.ts docs/superpowers/specs docs/superpowers/plans
git commit -m "feat(dm): pure social-graph merge + filter helper for the member picker"
```

---

### Task 2: UserPickerModal component

**Files:**
- Create: `src/components/messages/UserPickerModal.tsx`
- Test: `src/components/messages/UserPickerModal.test.tsx`

**Interfaces:**
- Consumes: `mergeSocialGraph`, `filterPickerUsers`, `PickerUser` from `@/lib/dm-picker` (Task 1).
- Produces: `export function UserPickerModal({ myUsername, onSelect, onClose }: { myUsername: string; onSelect: (username: string) => void; onClose: () => void })`. Rendered only when open — the parent controls mounting, matching `ProfileMailboxModal`'s convention (not `FollowListModal`'s `isOpen` prop).

- [ ] **Step 1: Write the failing test**

Create `src/components/messages/UserPickerModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { UserPickerModal } from './UserPickerModal'

const users = (...names: string[]) => ({
  users: names.map((n) => ({ username: n, name: null, avatar: null, isFollowing: true })),
})

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn(async (url: any) => {
    const href = String(url)
    if (href.includes('/followers')) return { ok: true, json: async () => users('sarah', 'bob') } as any
    if (href.includes('/following')) return { ok: true, json: async () => users('sarah') } as any
    return { ok: true, json: async () => ({ users: [] }) } as any
  }) as any
})

describe('UserPickerModal', () => {
  it('lists the merged social graph', async () => {
    render(<UserPickerModal myUsername="me" onSelect={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('@sarah')).toBeInTheDocument())
    expect(screen.getByText('@bob')).toBeInTheDocument()
  })

  it('fetches both lists for the viewer', async () => {
    render(<UserPickerModal myUsername="me" onSelect={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/users/me/followers', expect.anything()))
    expect(global.fetch).toHaveBeenCalledWith('/api/users/me/following', expect.anything())
  })

  it('filters rows as the user types', async () => {
    render(<UserPickerModal myUsername="me" onSelect={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('@bob')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'sarah' } })
    expect(screen.queryByText('@bob')).not.toBeInTheDocument()
    expect(screen.getByText('@sarah')).toBeInTheDocument()
  })

  it('calls onSelect with the username of the clicked row', async () => {
    const onSelect = vi.fn()
    render(<UserPickerModal myUsername="me" onSelect={onSelect} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('@bob')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /bob/ }))
    expect(onSelect).toHaveBeenCalledWith('bob')
  })

  it('offers a free-text username fallback when the graph is empty', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ users: [] }) })) as any
    const onSelect = vi.fn()
    render(<UserPickerModal myUsername="me" onSelect={onSelect} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'stranger' } })
    fireEvent.click(screen.getByRole('button', { name: /message @stranger/i }))
    expect(onSelect).toHaveBeenCalledWith('stranger')
  })

  it('closes when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<UserPickerModal myUsername="me" onSelect={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('survives a failed fetch without crashing', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    render(<UserPickerModal myUsername="me" onSelect={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/messages/UserPickerModal.test.tsx`
Expected: FAIL — `Failed to resolve import "./UserPickerModal"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/messages/UserPickerModal.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { mergeSocialGraph, filterPickerUsers, type PickerUser, type SocialRow } from '@/lib/dm-picker'

async function loadList(username: string, mode: 'followers' | 'following'): Promise<SocialRow[]> {
  try {
    const res = await fetch(`/api/users/${username}/${mode}`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.users) ? data.users : []
  } catch {
    return []
  }
}

export function UserPickerModal({
  myUsername,
  onSelect,
  onClose,
}: {
  myUsername: string
  onSelect: (username: string) => void
  onClose: () => void
}) {
  const [people, setPeople] = useState<PickerUser[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadList(myUsername, 'followers'), loadList(myUsername, 'following')])
      .then(([followers, following]) => {
        if (cancelled) return
        setPeople(mergeSocialGraph(followers, following))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [myUsername])

  const rows = useMemo(() => filterPickerUsers(people, query), [people, query])
  // The picker only knows the viewer's own graph. A typed username that matches
  // nobody in it is still a valid person to message, so offer it directly
  // rather than dead-ending the way the old window.prompt never could.
  const fallback = query.trim().replace(/^@/, '')
  const showFallback = !loading && rows.length === 0 && fallback.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-bold">New message</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people or type a username"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : showFallback ? (
            <button
              onClick={() => onSelect(fallback)}
              className="w-full cursor-pointer rounded-xl p-3 text-left text-sm font-medium hover:bg-muted"
            >
              Message @{fallback}
            </button>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Follow someone to start a conversation, or type their username above.
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((r) => (
                <li key={r.username}>
                  <button
                    onClick={() => onSelect(r.username)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-muted"
                  >
                    {r.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatar} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 font-bold text-primary">
                        {(r.name || r.username).charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name || r.username}</p>
                      <p className="truncate text-xs text-muted-foreground">@{r.username}</p>
                    </div>
                    {r.isMutual && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        Friend
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/messages/UserPickerModal.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/messages/UserPickerModal.tsx src/components/messages/UserPickerModal.test.tsx
git commit -m "feat(dm): searchable followers/following picker modal"
```

---

### Task 3: Wire the picker into MessagesClient

**Files:**
- Modify: `src/components/messages/MessagesClient.tsx` (props at line 28; `startConversation` at 199-223; button at 262-268)
- Modify: `src/components/messages/MessagesClient.test.tsx` (the `window.prompt` stub at line 220)
- Modify: `src/app/(dashboard)/messages/page.tsx:23`

**Interfaces:**
- Consumes: `UserPickerModal` from Task 2.
- Produces: `MessagesClient` now takes `{ myId: string; myUsername: string }`.

- [ ] **Step 1: Rewrite the failing test**

In `src/components/messages/MessagesClient.test.tsx`, replace the whole `describe('starting a conversation', ...)` block (lines 211-228) with:

```tsx
  describe('starting a conversation', () => {
    it('creates the conversation and selects it when a person is picked', async () => {
      const created = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'cNew' }) }))
      global.fetch = vi.fn(async (url: any, init?: any) => {
        const href = String(url)
        if (href.endsWith('/api/dm/conversations') && init?.method === 'POST') return created() as any
        if (href.includes('/followers')) {
          return { ok: true, json: async () => ({ users: [{ username: 'sarah', name: 'Sarah Johnson', avatar: null }] }) } as any
        }
        if (href.includes('/following')) return { ok: true, json: async () => ({ users: [] }) } as any
        if (href.includes('/messages')) return { ok: true, json: async () => ({ messages: [] }) } as any
        return { ok: true, json: async () => ({ conversations: [] }) } as any
      }) as any

      render(<MessagesClient myId="me" myUsername="mine" />)
      fireEvent.click(screen.getByRole('button', { name: /new message/i }))

      await waitFor(() => expect(screen.getByText('@sarah')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: /Sarah Johnson/ }))

      await waitFor(() => expect(created).toHaveBeenCalled())
      await waitFor(() => expect(push).toHaveBeenCalledWith('/messages?c=cNew'))
    })

    it('closes the picker after a successful start', async () => {
      global.fetch = vi.fn(async (url: any, init?: any) => {
        const href = String(url)
        if (href.endsWith('/api/dm/conversations') && init?.method === 'POST') {
          return { ok: true, json: async () => ({ id: 'cNew' }) } as any
        }
        if (href.includes('/followers')) {
          return { ok: true, json: async () => ({ users: [{ username: 'sarah', name: 'Sarah Johnson', avatar: null }] }) } as any
        }
        if (href.includes('/following')) return { ok: true, json: async () => ({ users: [] }) } as any
        if (href.includes('/messages')) return { ok: true, json: async () => ({ messages: [] }) } as any
        return { ok: true, json: async () => ({ conversations: [] }) } as any
      }) as any

      render(<MessagesClient myId="me" myUsername="mine" />)
      fireEvent.click(screen.getByRole('button', { name: /new message/i }))
      await waitFor(() => expect(screen.getByText('@sarah')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: /Sarah Johnson/ }))
      await waitFor(() => expect(screen.queryByText('@sarah')).not.toBeInTheDocument())
    })
  })
```

Also update the six existing `render(<MessagesClient myId="me" />)` calls (lines 53, 58, 65, 72, 88, 128, 185, 190, 222) to `render(<MessagesClient myId="me" myUsername="mine" />)`, and the `rerender(...)` at line 190 likewise.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/messages/MessagesClient.test.tsx`
Expected: FAIL — the picker never appears; `Unable to find an element with the text: @sarah`.

- [ ] **Step 3: Implement**

In `src/components/messages/MessagesClient.tsx`:

Add the import after line 14:

```tsx
import { UserPickerModal } from './UserPickerModal'
```

Change the signature at line 28:

```tsx
export function MessagesClient({ myId, myUsername }: { myId: string; myUsername: string }) {
```

Add picker state next to the other `useState` calls (after line 38):

```tsx
  const [pickerOpen, setPickerOpen] = useState(false)
```

Replace `startConversation` (lines 199-223) with a version that takes the username from the picker:

```tsx
  const startConversation = async (username: string) => {
    setPickerOpen(false)
    setBusy(true)
    try {
      const res = await fetch('/api/dm/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!res.ok) {
        window.alert(res.status === 404 ? 'No member with that username.' : 'Could not start that conversation.')
        return
      }
      const data = await res.json()
      // Navigate first: the conversation was already created successfully,
      // so a blip refreshing the list must not surface a create-failed error.
      router.push(`/messages?c=${data.id}`)
      loadConversations().catch(() => {})
    } catch {
      window.alert('Could not start that conversation.')
    } finally {
      setBusy(false)
    }
  }
```

Change the button's handler at line 263 from `onClick={startConversation}` to:

```tsx
          onClick={() => setPickerOpen(true)}
```

Mount the picker just before the closing `</div>` of the outer wrapper (after the block ending at line 333, before line 334's `</div>`):

```tsx
      {pickerOpen && (
        <UserPickerModal
          myUsername={myUsername}
          onSelect={startConversation}
          onClose={() => setPickerOpen(false)}
        />
      )}
```

In `src/app/(dashboard)/messages/page.tsx`, change line 23 to:

```tsx
        <MessagesClient myId={auth?.id ?? ''} myUsername={auth?.username ?? ''} />
```

(`verifyAuth` selects `username` — see `src/lib/auth.ts:27`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/components/messages/`
Expected: PASS — all files, including the 2 rewritten start-conversation tests.

- [ ] **Step 5: Type gate**

Run: `pnpm exec tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/components/messages/MessagesClient.tsx src/components/messages/MessagesClient.test.tsx "src/app/(dashboard)/messages/page.tsx"
git commit -m "feat(dm): replace the window.prompt username entry with the people picker"
```

---

### Task 4: ProfileDmModal

**Files:**
- Create: `src/components/profile/ProfileDmModal.tsx`
- Test: `src/components/profile/ProfileDmModal.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export function ProfileDmModal({ username, name, onClose }: { username: string; name: string | null; onClose: () => void })`.

Behavior: textarea + Send. On send, `POST /api/dm/conversations {username}` → `{ id }`, then `POST /api/dm/conversations/<id>/messages {body}`, then `router.push('/messages?c=<id>')`. Send is disabled while empty or in flight. A failed create surfaces an inline error and keeps the typed text.

- [ ] **Step 1: Write the failing test**

Create `src/components/profile/ProfileDmModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ProfileDmModal } from './ProfileDmModal'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

beforeEach(() => {
  vi.clearAllMocks()
})

const type = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/write a message/i), { target: { value: text } })

describe('ProfileDmModal', () => {
  it('creates the conversation then posts the first message', async () => {
    const calls: string[] = []
    global.fetch = vi.fn(async (url: any, init?: any) => {
      const href = String(url)
      calls.push(`${init?.method} ${href}`)
      if (href.endsWith('/api/dm/conversations')) return { ok: true, json: async () => ({ id: 'cNew' }) } as any
      return { ok: true, json: async () => ({ message: {} }) } as any
    }) as any

    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    type('hello there')
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(calls).toEqual([
      'POST /api/dm/conversations',
      'POST /api/dm/conversations/cNew/messages',
    ]))
  })

  it('sends the typed body to the messages endpoint', async () => {
    let sentBody: any = null
    global.fetch = vi.fn(async (url: any, init?: any) => {
      const href = String(url)
      if (href.endsWith('/api/dm/conversations')) return { ok: true, json: async () => ({ id: 'cNew' }) } as any
      sentBody = JSON.parse(init.body)
      return { ok: true, json: async () => ({ message: {} }) } as any
    }) as any

    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    type('hello there')
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(sentBody).toEqual({ body: 'hello there' }))
  })

  it('navigates to the new conversation after sending', async () => {
    global.fetch = vi.fn(async (url: any) => {
      const href = String(url)
      if (href.endsWith('/api/dm/conversations')) return { ok: true, json: async () => ({ id: 'cNew' }) } as any
      return { ok: true, json: async () => ({ message: {} }) } as any
    }) as any

    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    type('hi')
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/messages?c=cNew'))
  })

  it('disables send until something is typed', () => {
    global.fetch = vi.fn() as any
    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    type('hi')
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled()
  })

  it('keeps the text and shows an error when the create fails', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    type('keep me')
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(screen.getByText(/could not send/i)).toBeInTheDocument())
    expect(screen.getByPlaceholderText(/write a message/i)).toHaveValue('keep me')
    expect(push).not.toHaveBeenCalled()
  })

  it('does not post a message when the conversation create fails', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }))
    global.fetch = fetchMock as any
    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    type('nope')
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(screen.getByText(/could not send/i)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('closes when the close button is clicked', () => {
    global.fetch = vi.fn() as any
    const onClose = vi.fn()
    render(<ProfileDmModal username="sarah" name="Sarah" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/profile/ProfileDmModal.test.tsx`
Expected: FAIL — `Failed to resolve import "./ProfileDmModal"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/profile/ProfileDmModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

export function ProfileDmModal({
  username,
  name,
  onClose,
}: {
  username: string
  name: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const send = async () => {
    const text = body.trim()
    if (!text) return
    setBusy(true)
    setError(false)
    try {
      // Idempotent: returns the existing conversation (200) if these two have
      // messaged before, so this never creates a duplicate thread.
      const created = await fetch('/api/dm/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!created.ok) throw new Error('create failed')
      const { id } = await created.json()

      const sent = await fetch(`/api/dm/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      if (!sent.ok) throw new Error('send failed')

      router.push(`/messages?c=${id}`)
    } catch {
      // The typed text is deliberately left in place so a retry costs nothing.
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-bold">Message {name || `@${username}`}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <textarea
            autoFocus
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Write a message to ${name || `@${username}`}…`}
            className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
          />
          {error && (
            <p className="mt-2 text-sm text-red-600">Could not send that message. Try again.</p>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={busy || body.trim().length === 0}
              className="cursor-pointer rounded-full bg-galli px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/profile/ProfileDmModal.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/ProfileDmModal.tsx src/components/profile/ProfileDmModal.test.tsx
git commit -m "feat(profile): DM composer that starts a real conversation"
```

---

### Task 5: Auth-aware Message card + session plumbing

**Files:**
- Modify: `src/components/profile/ProfileActionCards.tsx` (props 13-25; message card 66-73; modal mount 93-95)
- Create: `src/components/profile/ProfileActionCards.test.tsx`
- Modify: `src/components/profile/ProfileHeaderCard.tsx` (props 4-22; passthrough 43-49)
- Modify: `src/app/[username]/page.tsx` (the `ProfileHeaderCard` call at 58-67)

**Interfaces:**
- Consumes: `ProfileDmModal` from Task 4.
- Produces: `ProfileActionCards` and `ProfileHeaderCard` both gain a required `isLoggedIn: boolean` prop.

- [ ] **Step 1: Write the failing test**

Create `src/components/profile/ProfileActionCards.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileActionCards } from './ProfileActionCards'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/social/FollowButton', () => ({ FollowButton: () => <button>Follow</button> }))
vi.mock('@/components/profile/ProfileMailboxModal', () => ({
  ProfileMailboxModal: () => <div>visitor note composer</div>,
}))
vi.mock('@/components/profile/ProfileDmModal', () => ({
  ProfileDmModal: () => <div>dm composer</div>,
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as any
})

const props = { username: 'sarah', name: 'Sarah', isFollowing: false, isFriend: false }

describe('ProfileActionCards', () => {
  it('opens the DM composer for a logged-in visitor', () => {
    render(<ProfileActionCards isOwner={false} isLoggedIn {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Message/ }))
    expect(screen.getByText('dm composer')).toBeInTheDocument()
    expect(screen.queryByText('visitor note composer')).not.toBeInTheDocument()
  })

  it('opens the anonymous visitor composer for a logged-out visitor', () => {
    render(<ProfileActionCards isOwner={false} isLoggedIn={false} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Message/ }))
    expect(screen.getByText('visitor note composer')).toBeInTheDocument()
    expect(screen.queryByText('dm composer')).not.toBeInTheDocument()
  })

  it('shows the owner mailbox link instead of a Message button for the owner', () => {
    render(<ProfileActionCards isOwner isLoggedIn {...props} />)
    expect(screen.queryByRole('button', { name: /^Message/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Mailbox/ })).toHaveAttribute('href', '/messages')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/profile/ProfileActionCards.test.tsx`
Expected: FAIL — the first test finds `visitor note composer`, not `dm composer` (and TS flags the unknown `isLoggedIn` prop).

- [ ] **Step 3: Implement**

In `src/components/profile/ProfileActionCards.tsx`:

Add the import after line 7:

```tsx
import { ProfileDmModal } from '@/components/profile/ProfileDmModal'
```

Add `isLoggedIn` to the destructure and the type (lines 13-25) — insert `isLoggedIn,` after `isOwner,` and `isLoggedIn: boolean` after `isOwner: boolean`.

Replace the message card block (lines 66-73) with:

```tsx
        if (c.key === 'message') {
          return (
            <button key={c.key} onClick={() => setMessageOpen(true)} className={`${cardCls} cursor-pointer text-left`}>
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <Body label={c.label} sublabel={c.sublabel} />
            </button>
          )
        }
```

Rename the state at line 26 to match:

```tsx
  const [messageOpen, setMessageOpen] = useState(false)
```

Replace the modal mount (lines 93-95) with the auth-aware branch. A logged-in member gets a real threaded DM; a logged-out visitor keeps the anonymous note path, which is the only way a non-member can reach the owner at all:

```tsx
      {messageOpen &&
        (isLoggedIn ? (
          <ProfileDmModal username={username} name={name} onClose={() => setMessageOpen(false)} />
        ) : (
          <ProfileMailboxModal username={username} name={name} onClose={() => setMessageOpen(false)} />
        ))}
```

In `src/components/profile/ProfileHeaderCard.tsx`, add `isLoggedIn,` to the destructure (after `isOwner,` on line 10) and `isLoggedIn: boolean` to the type (after line 19), then add `isLoggedIn={isLoggedIn}` to the `ProfileActionCards` call after line 44.

In `src/app/[username]/page.tsx`, add to the `ProfileHeaderCard` call after line 64 (`isOwner={isMe}`):

```tsx
            isLoggedIn={!!meId}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/components/profile/`
Expected: PASS — 10 tests across the two profile test files.

- [ ] **Step 5: Type gate**

Run: `pnpm exec tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/components/profile/ProfileActionCards.tsx src/components/profile/ProfileActionCards.test.tsx src/components/profile/ProfileHeaderCard.tsx "src/app/[username]/page.tsx"
git commit -m "feat(profile): route the Message button to DMs for signed-in members"
```

---

### Task 6: Full gate

**Files:** none modified unless a gate fails.

- [ ] **Step 1: Full test suite**

Run: `pnpm vitest run`
Expected: all files pass. Per the known Windows worker-timeout issue, if the summary reports "errors" where passed + errors equals the total file count, re-run only the skipped files — those are worker-spawn timeouts under load, not failures.

- [ ] **Step 2: Type gate**

Run: `pnpm exec tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 3: Lint gate — this is the one that breaks production builds**

Run: `pnpm exec next lint`
Expected: "No ESLint warnings or errors."
If the worktree errors on config resolution, add `"root": true` to the worktree's `.eslintrc.json` and run `pnpm exec eslint src --ext .ts,.tsx` directly. Do not commit that `root` change.

- [ ] **Step 4: Confirm the untouched visitor path still passes**

Run: `pnpm vitest run src/app/api/messages/profile/route.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit any gate fixes**

```bash
git add -A
git commit -m "chore(dm): gate fixes"
```

---

## Manual verification (after Task 6)

With two accounts that follow each other:

1. Account A opens Account B's profile → clicks **Message** → composer appears (not the visitor-note form with optional name/email fields).
2. Send → lands on `/messages?c=…` with the message visible in the thread.
3. Account B opens `/messages` → the conversation is in **All** (not Requests, because they follow each other) and **not** in Visitor notes.
4. Log out entirely, open Account B's profile → **Message** still shows the old anonymous composer, and a note sent there still lands in **Visitor notes**.
5. On `/messages`, click **New Message** → the picker lists followers/following with mutuals first and a "Friend" chip; search filters; clicking a row opens the conversation.

## Self-Review

- **Spec coverage:** auth-aware split → Task 5; DM composer two-call sequence → Task 4; picker sources/merge/dedup/mutuals-first → Tasks 1-2; search → Tasks 1-2; empty-state free-text fallback → Task 2; `myUsername` plumbing → Task 3; `isLoggedIn` plumbing → Task 5; non-goals (no schema, no API, no auth on the visitor route) → enforced by Global Constraints and verified in Task 6 Step 4; `MessagesClient.test.tsx:220` prompt-stub breakage → Task 3 Step 1.
- **Placeholder scan:** every code step contains complete code; no TBDs.
- **Type consistency:** `PickerUser`/`SocialRow`/`mergeSocialGraph`/`filterPickerUsers` defined in Task 1 and consumed with identical names in Task 2. `UserPickerModal({ myUsername, onSelect, onClose })` defined in Task 2, used identically in Task 3. `ProfileDmModal({ username, name, onClose })` defined in Task 4, used identically in Task 5. `startConversation` changes arity from `()` to `(username: string)` in Task 3 — its only caller is the picker's `onSelect`, matching `(username: string) => void`.

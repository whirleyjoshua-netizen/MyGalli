# Public Profile Header Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the public profile page the same sticky gradient header Explore has, by extracting that header into one shared component both pages consume.

**Architecture:** Extract the header currently inlined in `ExploreClient.tsx` into `src/components/nav/GalliTopBar.tsx` — it owns the gradient bar, frog + wordmark, auth-aware Home and avatar/login, and exposes a `search` slot plus a `children` sub-bar slot. The search *chrome* is extracted separately into `src/components/nav/SearchBox.tsx` so Explore and the profile share one pill styling while keeping their own behavior (live filter vs. navigate). Explore additionally learns to seed its search state from `?search=`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, zustand (`useAuthStore`, persisted to localStorage), vitest + @testing-library/react (jsdom).

## Global Constraints

- Work in worktree `C:\Users\whirl\pages-mvp\.claude\worktrees\profile-header-bar`, branch `profile-header-bar`. **Never commit on `main`.** Verify with `git status -sb` before every commit.
- **Never commit:** `Documents/`, `Images/`, `g1t.json`, `nul`, `.claude/settings.local.json`. Always `git add` exact paths — never `git add -A`.
- Tests: `pnpm test` (vitest run). Colocated `*.test.tsx` next to the component.
- `tsc --noEmit` does **not** run ESLint, and prod builds have previously failed on lint. `pnpm exec next lint` must pass before the branch is done.
- Bare `<img>` requires `{/* eslint-disable-next-line @next/next/no-img-element */}` on the line above. Use `<Link>` for static internal routes, never `<a href="/static">`.
- Preserve exact existing Tailwind classes when moving markup. `galli-dark` is a real token (`galli.dark` = `#0F3D2E`).
- Do not change Explore's filtering, debounce, or grid logic. Markup moves; behavior does not.
  - **One intended exception:** Home becomes auth-aware (`/dashboard` logged in, `/` logged out). Today Explore hard-codes `/dashboard` even for logged-out visitors. This is required by the spec and is not a regression.
- The search pill styling exists in exactly one place: `SearchBox`. Do not copy its classes into any other file.

## File Structure

| File | Responsibility |
|---|---|
| `src/components/explore/ExploreClient.test.tsx` | **Create (Task 1).** Characterization tests written *before* the refactor. |
| `src/components/nav/GalliTopBar.tsx` | **Create (Task 2).** Gradient bar, brand, auth-aware Home + avatar/login, `search` and `children` slots. Knows nothing about its consumers. |
| `src/components/nav/GalliTopBar.test.tsx` | **Create (Task 2).** Auth states + slot rendering. |
| `src/components/nav/SearchBox.tsx` | **Create (Task 3).** The search pill chrome only. Controlled; behavior supplied by the caller. |
| `src/components/nav/SearchBox.test.tsx` | **Create (Task 3).** Change/submit/clear behavior. |
| `src/components/explore/ExploreClient.tsx` | **Modify (Tasks 4, 5).** Consume `GalliTopBar` + `SearchBox`; seed search from `?search=`. |
| `src/components/nav/ProfileSearchInput.tsx` | **Create (Task 6).** Owns router + state; renders `SearchBox`; routes to `/explore?search=`. |
| `src/components/nav/ProfileSearchInput.test.tsx` | **Create (Task 6).** Submit routes; empty/whitespace submit no-ops. |
| `src/app/[username]/page.tsx` | **Modify (Task 6).** Render `<GalliTopBar search={<ProfileSearchInput />} />` above `ProfileCover`. |

**Task order rationale:** Task 1 characterizes Explore's *current* behavior so the extraction in Task 4 is provably behavior-preserving. Tasks 2 and 3 build the shared pieces; Task 4 swaps Explore onto them; Task 5 adds URL seeding; Task 6 mounts on the profile. Each task ends with a green suite and a commit.

---

### Task 1: Characterize Explore's current header behavior

Explore has **zero tests**. Before moving any markup, lock in current behavior so the refactor can be proven safe.

**Files:**
- Test: `src/components/explore/ExploreClient.test.tsx` (create)

**Interfaces:**
- Consumes: `ExploreClient({ initialRows: Rows })` from `src/components/explore/ExploreClient.tsx`
- Produces: nothing (test-only task)

- [ ] **Step 1: Write the characterization tests**

Create `src/components/explore/ExploreClient.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExploreClient } from './ExploreClient'

vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { username: 'josh', name: 'Josh', avatar: null } }),
}))

const emptyRows = { trending: [], following: [], categories: [] }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ displays: [] }) } as Response))
  )
})

describe('ExploreClient header', () => {
  it('renders the brand, Home link, and search box', () => {
    render(<ExploreClient initialRows={emptyRows} />)
    expect(screen.getByText('My Galli')).toBeInTheDocument()
    expect(screen.getByLabelText('Home')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
  })

  it('renders the account avatar initial linking to the profile', () => {
    render(<ExploreClient initialRows={emptyRows} />)
    expect(screen.getByLabelText('Your profile')).toHaveAttribute('href', '/josh')
  })

  it('renders the category chips sub-bar', () => {
    render(<ExploreClient initialRows={emptyRows} />)
    // Labels come from CATEGORIES in src/lib/categories.ts
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sports & Athletics/ })).toBeInTheDocument()
  })

  it('typing in search drives the /api/explore fetch', async () => {
    render(<ExploreClient initialRows={emptyRows} />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'surf' } })
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=surf'))
    })
  })

  it('clears the search box via the clear button', () => {
    render(<ExploreClient initialRows={emptyRows} />)
    const input = screen.getByLabelText('Search') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'surf' } })
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(input.value).toBe('')
  })
})
```

- [ ] **Step 2: Run the tests to verify they pass against current code**

Run: `pnpm test src/components/explore/ExploreClient.test.tsx`
Expected: **PASS** (5 tests). These characterize existing behavior, so they must be green now.

A failure here means the test is wrong, not the component — fix the test until it describes what Explore actually does today. Do not touch `ExploreClient.tsx` in this task.

- [ ] **Step 3: Commit**

```bash
git status -sb   # confirm branch is profile-header-bar
git add src/components/explore/ExploreClient.test.tsx
git commit -m "test(explore): characterize header + search behavior before refactor"
```

---

### Task 2: Create `GalliTopBar`

**Files:**
- Create: `src/components/nav/GalliTopBar.tsx`
- Test: `src/components/nav/GalliTopBar.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore` from `@/lib/store` (shape: `{ user: { username: string; name: string | null; avatar: string | null } | null }`)
- Produces: `GalliTopBar({ search, children }: { search?: React.ReactNode; children?: React.ReactNode })` — used by Tasks 4 and 6.

- [ ] **Step 1: Write the failing test**

Create `src/components/nav/GalliTopBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GalliTopBar } from './GalliTopBar'

const mockUser = vi.hoisted(() => ({ current: null as null | { username: string; name: string | null; avatar: string | null } }))
vi.mock('@/lib/store', () => ({ useAuthStore: () => ({ user: mockUser.current }) }))

describe('GalliTopBar', () => {
  it('sends Home to /dashboard and shows the avatar when logged in', () => {
    mockUser.current = { username: 'josh', name: 'Josh', avatar: null }
    render(<GalliTopBar />)
    expect(screen.getByLabelText('Home')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByLabelText('Your profile')).toHaveAttribute('href', '/josh')
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('sends Home to / and shows the login control when logged out', () => {
    mockUser.current = null
    render(<GalliTopBar />)
    expect(screen.getByLabelText('Home')).toHaveAttribute('href', '/')
    expect(screen.getByLabelText('Log in')).toHaveAttribute('href', '/login')
    expect(screen.queryByLabelText('Your profile')).not.toBeInTheDocument()
  })

  it('renders the search slot when provided', () => {
    mockUser.current = null
    render(<GalliTopBar search={<input aria-label="Slotted search" />} />)
    expect(screen.getByLabelText('Slotted search')).toBeInTheDocument()
  })

  it('omits the sub-bar when no children are given', () => {
    mockUser.current = null
    render(<GalliTopBar />)
    expect(screen.queryByTestId('subbar')).not.toBeInTheDocument()
  })

  it('renders children in the sub-bar', () => {
    mockUser.current = null
    render(<GalliTopBar><span>Chips here</span></GalliTopBar>)
    expect(screen.getByTestId('subbar')).toBeInTheDocument()
    expect(screen.getByText('Chips here')).toBeInTheDocument()
  })

  it('always renders the brand wordmark', () => {
    mockUser.current = null
    render(<GalliTopBar />)
    expect(screen.getByText('My Galli')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/nav/GalliTopBar.test.tsx`
Expected: FAIL — `Failed to resolve import "./GalliTopBar"`

- [ ] **Step 3: Write the implementation**

Create `src/components/nav/GalliTopBar.tsx`. Classes are copied verbatim from `ExploreClient.tsx` lines 64–140 so the bar is pixel-identical; the only additions are the auth-aware `href` on Home and the two slots.

```tsx
'use client'

import type { ReactNode } from 'react'
import { Home, User as UserIcon } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'

export function GalliTopBar({
  search,
  children,
}: {
  search?: ReactNode
  children?: ReactNode
}) {
  const { user } = useAuthStore()
  const initial = (user?.name || user?.username || '?').charAt(0).toUpperCase()

  return (
    <div className="sticky top-0 z-20">
      {/* Gradient bar */}
      <div className="bg-gradient-to-r from-galli via-galli-aqua to-galli-violet text-white shadow-soft-lg">
        <div className="flex items-center px-4 py-3 sm:px-8">
          {/* Left — home */}
          <div className="flex flex-1 justify-start">
            <Link
              href={user ? '/dashboard' : '/'}
              aria-label="Home"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            >
              <Home className="h-5 w-5" />
            </Link>
          </div>

          {/* Center — brand + search slot */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gallio-frog.svg" alt="" aria-hidden className="h-7 w-7" />
            </span>
            <span className="hidden text-xl font-extrabold tracking-tight text-white drop-shadow-sm sm:inline">
              My Galli
            </span>
            {search}
          </div>

          {/* Right — avatar or login */}
          <div className="flex flex-1 justify-end">
            {user ? (
              <a href={`/${user.username}`} aria-label="Your profile" className="shrink-0">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar}
                    alt=""
                    className="h-9 w-9 rounded-full border-2 border-white/60 object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-galli-dark">
                    {initial}
                  </span>
                )}
              </a>
            ) : (
              <Link
                href="/login"
                aria-label="Log in"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <UserIcon className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Optional sub-bar */}
      {children && (
        <div data-testid="subbar" className="border-b border-border bg-surface/80 backdrop-blur">
          <div className="px-4 py-2 sm:px-8">{children}</div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/nav/GalliTopBar.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git status -sb
git add src/components/nav/GalliTopBar.tsx src/components/nav/GalliTopBar.test.tsx
git commit -m "feat(nav): shared GalliTopBar with search + sub-bar slots"
```

---

### Task 3: Create `SearchBox`

The search pill chrome, in one place. Explore and the profile share the styling; each supplies its own behavior. This is the only file allowed to contain these classes.

**Files:**
- Create: `src/components/nav/SearchBox.tsx`
- Test: `src/components/nav/SearchBox.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  ```ts
  SearchBox(props: {
    value: string
    onChange: (value: string) => void
    onSubmit?: () => void
    onClear?: () => void
    placeholder?: string   // default: 'Search My Galli pages…'
  })
  ```
  Renders a `<form role="search">`. The clear button appears only when `onClear` is supplied **and** `value` is non-empty. Used by Tasks 4 and 6.

- [ ] **Step 1: Write the failing test**

Create `src/components/nav/SearchBox.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBox } from './SearchBox'

const onChange = vi.fn()
const onSubmit = vi.fn()
const onClear = vi.fn()

beforeEach(() => vi.clearAllMocks())

describe('SearchBox', () => {
  it('reports typing through onChange', () => {
    render(<SearchBox value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'surf' } })
    expect(onChange).toHaveBeenCalledWith('surf')
  })

  it('shows the current value', () => {
    render(<SearchBox value="surf" onChange={onChange} />)
    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('surf')
  })

  it('calls onSubmit when the form is submitted', () => {
    render(<SearchBox value="surf" onChange={onChange} onSubmit={onSubmit} />)
    fireEvent.submit(screen.getByRole('search'))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('does not throw on submit when no onSubmit is given', () => {
    render(<SearchBox value="surf" onChange={onChange} />)
    expect(() => fireEvent.submit(screen.getByRole('search'))).not.toThrow()
  })

  it('shows the clear button only when onClear is given and value is non-empty', () => {
    const { rerender } = render(<SearchBox value="surf" onChange={onChange} onClear={onClear} />)
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument()

    rerender(<SearchBox value="" onChange={onChange} onClear={onClear} />)
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()

    rerender(<SearchBox value="surf" onChange={onChange} />)
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
  })

  it('calls onClear when the clear button is clicked', () => {
    render(<SearchBox value="surf" onChange={onChange} onClear={onClear} />)
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(onClear).toHaveBeenCalled()
  })

  it('does not submit the form when the clear button is clicked', () => {
    render(<SearchBox value="surf" onChange={onChange} onSubmit={onSubmit} onClear={onClear} />)
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('uses a default placeholder and accepts an override', () => {
    const { rerender } = render(<SearchBox value="" onChange={onChange} />)
    expect(screen.getByPlaceholderText('Search My Galli pages…')).toBeInTheDocument()

    rerender(<SearchBox value="" onChange={onChange} placeholder="Find people" />)
    expect(screen.getByPlaceholderText('Find people')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/nav/SearchBox.test.tsx`
Expected: FAIL — `Failed to resolve import "./SearchBox"`

- [ ] **Step 3: Write the implementation**

Create `src/components/nav/SearchBox.tsx`. Classes are copied verbatim from `ExploreClient.tsx` lines 88–102.

`type="button"` on the clear button is **required**: a bare `<button>` inside a `<form>` defaults to `type="submit"`, which would fire `onSubmit` on every clear. The current Explore code gets away with a bare button only because it isn't inside a form.

```tsx
'use client'

import { Search, X } from 'lucide-react'

export function SearchBox({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = 'Search My Galli pages…',
}: {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  onClear?: () => void
  placeholder?: string
}) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
      className="flex h-10 w-44 items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3.5 backdrop-blur-sm sm:w-72 md:w-80"
    >
      <Search className="h-4 w-4 shrink-0 text-white/80" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/70"
      />
      {onClear && value && (
        <button type="button" onClick={onClear} aria-label="Clear search">
          <X className="h-4 w-4 text-white/80" />
        </button>
      )}
    </form>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/nav/SearchBox.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git status -sb
git add src/components/nav/SearchBox.tsx src/components/nav/SearchBox.test.tsx
git commit -m "feat(nav): shared SearchBox pill chrome"
```

---

### Task 4: Refactor `ExploreClient` onto `GalliTopBar` + `SearchBox`

Behavior-preserving. Task 1's tests must stay green **without modification** — that is the proof.

**Files:**
- Modify: `src/components/explore/ExploreClient.tsx:1-11` (imports), `:63-140` (header block)

**Interfaces:**
- Consumes: `GalliTopBar({ search, children })` (Task 2); `SearchBox({ value, onChange, onSubmit?, onClear?, placeholder? })` (Task 3)
- Produces: no new exports

- [ ] **Step 1: Replace the header block**

In `src/components/explore/ExploreClient.tsx`, replace lines 63–140 — the entire `{/* Sticky header */}` block, from `<div className="sticky top-0 z-20">` through its matching closing `</div>` — with:

```tsx
      {/* Sticky header */}
      <GalliTopBar
        search={
          <SearchBox
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
          />
        }
      >
        <ExploreCategoryChips active={activeCategory} onSelect={(id) => { setActiveCategory(id); setSearch('') }} />
      </GalliTopBar>
```

No `onSubmit` is passed: Explore filters live as you type, so Enter should do nothing beyond suppressing a page reload — which `SearchBox` already handles via `preventDefault`.

- [ ] **Step 2: Fix the imports**

Replace line 4 — `Search`, `X`, `Home`, and `User as UserIcon` now live in `SearchBox`/`GalliTopBar` and would be unused here (unused imports fail lint):

```tsx
import { Compass, Loader2, Users } from 'lucide-react'
```

Add after line 9:

```tsx
import { GalliTopBar } from '@/components/nav/GalliTopBar'
import { SearchBox } from '@/components/nav/SearchBox'
```

`Link` (line 5) and `useAuthStore` (line 6) may now be unused in this file, along with the `const initial = ...` line. Check each with:

```bash
grep -n "Link\|useAuthStore\|initial\|Search\|<X\b\|Home\|UserIcon" src/components/explore/ExploreClient.tsx
```

Remove whichever are no longer referenced. Note `Compass`, `Loader2`, and `Users` are used further down the file in the body — keep them.

- [ ] **Step 3: Run Task 1's tests to prove behavior is preserved**

Run: `pnpm test src/components/explore/ExploreClient.test.tsx`
Expected: PASS (5 tests), **unmodified**. If any fail, the refactor changed behavior — fix the component, not the test.

- [ ] **Step 4: Verify no unused imports**

Run: `pnpm exec next lint`
Expected: no errors for `ExploreClient.tsx`.

- [ ] **Step 5: Commit**

```bash
git status -sb
git add src/components/explore/ExploreClient.tsx
git commit -m "refactor(explore): consume shared GalliTopBar + SearchBox"
```

---

### Task 5: Seed Explore's search from `?search=`

**Files:**
- Modify: `src/components/explore/ExploreClient.tsx`
- Test: `src/components/explore/ExploreClient.test.tsx`

**Interfaces:**
- Consumes: `useSearchParams` from `next/navigation`
- Produces: Explore honors `?search=<query>` — relied on by Task 6's `ProfileSearchInput`

`src/app/explore/page.tsx` already wraps `<ExploreContent />` in `<Suspense>`, which `useSearchParams` requires. No page change needed.

- [ ] **Step 1: Write the failing tests**

In `src/components/explore/ExploreClient.test.tsx`, add this mock alongside the existing `@/lib/store` mock at the top of the file:

```tsx
const mockParams = vi.hoisted(() => ({ current: new URLSearchParams() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => mockParams.current }))
```

Reset it inside the existing `beforeEach`:

```tsx
  mockParams.current = new URLSearchParams()
```

Then append this block:

```tsx
describe('ExploreClient URL search seeding', () => {
  it('seeds the search box from ?search=', () => {
    mockParams.current = new URLSearchParams('search=surfing')
    render(<ExploreClient initialRows={emptyRows} />)
    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('surfing')
  })

  it('starts empty when ?search= is absent', () => {
    mockParams.current = new URLSearchParams()
    render(<ExploreClient initialRows={emptyRows} />)
    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('')
  })

  it('fetches immediately for a seeded query', async () => {
    mockParams.current = new URLSearchParams('search=surfing')
    render(<ExploreClient initialRows={emptyRows} />)
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=surfing'))
    })
  })
})
```

- [ ] **Step 2: Run tests to verify the seeding ones fail**

Run: `pnpm test src/components/explore/ExploreClient.test.tsx`
Expected: FAIL — "seeds the search box from ?search=" expects `'surfing'`, receives `''`.

- [ ] **Step 3: Implement the seeding**

Add the import:

```tsx
import { useSearchParams } from 'next/navigation'
```

Then replace line 23 (`const [search, setSearch] = useState('')`) with:

```tsx
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
```

This is lazy initial state — it seeds on first render only, so typing afterward is never clobbered.

- [ ] **Step 4: Run tests to verify all pass**

Run: `pnpm test src/components/explore/ExploreClient.test.tsx`
Expected: PASS (8 tests — 5 from Task 1 plus 3 new)

- [ ] **Step 5: Commit**

```bash
git status -sb
git add src/components/explore/ExploreClient.tsx src/components/explore/ExploreClient.test.tsx
git commit -m "feat(explore): seed search from ?search= query param"
```

---

### Task 6: Add the header to the public profile

**Files:**
- Create: `src/components/nav/ProfileSearchInput.tsx`
- Test: `src/components/nav/ProfileSearchInput.test.tsx`
- Modify: `src/app/[username]/page.tsx`

**Interfaces:**
- Consumes: `GalliTopBar` (Task 2); `SearchBox` (Task 3); Explore's `?search=` support (Task 5)
- Produces: `ProfileSearchInput()` — no props

- [ ] **Step 1: Write the failing test**

Create `src/components/nav/ProfileSearchInput.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileSearchInput } from './ProfileSearchInput'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

beforeEach(() => vi.clearAllMocks())

describe('ProfileSearchInput', () => {
  it('routes to explore with the query on submit', () => {
    render(<ProfileSearchInput />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'surfing' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(push).toHaveBeenCalledWith('/explore?search=surfing')
  })

  it('encodes special characters in the query', () => {
    render(<ProfileSearchInput />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'surf & turf' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(push).toHaveBeenCalledWith('/explore?search=surf%20%26%20turf')
  })

  it('trims surrounding whitespace from the query', () => {
    render(<ProfileSearchInput />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '  surfing  ' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(push).toHaveBeenCalledWith('/explore?search=surfing')
  })

  it('does nothing when submitted empty', () => {
    render(<ProfileSearchInput />)
    fireEvent.submit(screen.getByRole('search'))
    expect(push).not.toHaveBeenCalled()
  })

  it('does nothing when submitted with only whitespace', () => {
    render(<ProfileSearchInput />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '   ' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(push).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/nav/ProfileSearchInput.test.tsx`
Expected: FAIL — `Failed to resolve import "./ProfileSearchInput"`

- [ ] **Step 3: Write the implementation**

Create `src/components/nav/ProfileSearchInput.tsx`. It owns router + state only; all chrome comes from `SearchBox`.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchBox } from './SearchBox'

export function ProfileSearchInput() {
  const router = useRouter()
  const [value, setValue] = useState('')

  return (
    <SearchBox
      value={value}
      onChange={setValue}
      onSubmit={() => {
        const q = value.trim()
        if (!q) return
        router.push(`/explore?search=${encodeURIComponent(q)}`)
      }}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/nav/ProfileSearchInput.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Mount the bar on the profile page**

In `src/app/[username]/page.tsx`, add these imports after the existing `ProfileCover` import:

```tsx
import { GalliTopBar } from '@/components/nav/GalliTopBar'
import { ProfileSearchInput } from '@/components/nav/ProfileSearchInput'
```

Then replace:

```tsx
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
        <ProfileCover coverImage={user.coverImage} isOwner={isMe} />
```

with:

```tsx
    <div className="min-h-screen bg-background">
      <GalliTopBar search={<ProfileSearchInput />} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
        <ProfileCover coverImage={user.coverImage} isOwner={isMe} />
```

`GalliTopBar` and `ProfileSearchInput` are client components rendered from this server component — a client island. Do **not** add `'use client'` to the page, and do not thread auth props: `GalliTopBar` reads the persisted store itself.

- [ ] **Step 6: Verify the whole suite and lint**

Run: `pnpm test`
Expected: PASS — full suite green (main was 505/505; this branch adds 27).

Run: `pnpm exec next lint`
Expected: no errors.

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git status -sb
git add src/components/nav/ProfileSearchInput.tsx src/components/nav/ProfileSearchInput.test.tsx "src/app/[username]/page.tsx"
git commit -m "feat(profile): add shared GalliTopBar to public profile"
```

---

### Task 7: Browser verification

Unit tests can't prove the bar renders correctly over the cover image or that the search round-trip works against a real server.

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

The machine-level `DATABASE_URL` points at the wrong DB and overrides `.env`, and `localhost` resolves to IPv6 where Postgres isn't listening — so set it inline with `127.0.0.1`:

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
pnpm dev
```

- [ ] **Step 2: Verify as a logged-out visitor**

Use the `superpowers-chrome:browsing` skill. In a fresh incognito context (no `galli-auth` cookie), open `http://localhost:3000/marcusjohnson`.

Confirm:
- The gradient bar renders sticky at the top, above the cover image
- Home points to `/`, and the login icon (not an avatar) shows on the right
- The bar stays pinned when scrolling to the projects section

- [ ] **Step 3: Verify the search round-trip**

Type `surf` into the profile's search box and press Enter. Confirm the URL becomes `/explore?search=surf` **and** the Explore search box is prefilled with `surf` (this is Task 5 working end-to-end).

- [ ] **Step 4: Verify as a logged-in user**

Log in as `marcus@demo.gallio.app` / `demo1234`, then visit another user's profile (`/sofiareyes`). Confirm Home now points to `/dashboard` and the avatar renders on the right.

- [ ] **Step 5: Confirm Explore is unregressed**

Visit `/explore`. Confirm the bar looks identical to before, category chips filter, typing in search still filters the grid live (no navigation), and the clear button clears without reloading the page.

- [ ] **Step 6: Report findings**

Report what was observed. Do **not** claim success without having actually loaded the pages. If anything is off, fix it and re-verify before proceeding.

---

## Definition of Done

- [ ] `pnpm test` green (full suite)
- [ ] `pnpm exec next lint` clean
- [ ] `pnpm exec tsc --noEmit` clean
- [ ] Browser-verified: logged-out + logged-in profile, search round-trip, Explore unregressed
- [ ] Search pill classes exist in exactly one file (`SearchBox.tsx`)
- [ ] All commits on `profile-header-bar`; `main` untouched
- [ ] No forbidden files staged

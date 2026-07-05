# Sidebar Profile Consolidation + Settings Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the redundant bottom user-menu bar into the `ProfileCard` (with a Settings item) and add a small `/settings` page for editing name / bio / avatar.

**Architecture:** `ProfileCard` becomes the single identity+menu unit with a kebab dropdown, rendering in both the expanded and collapsed rail states; `SidebarContent` drops its duplicate bottom bar. A new `/settings` page reuses the existing `PATCH /api/profile` + `/api/upload` and refreshes the auth store.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, lucide-react, Zustand, Vitest + Testing Library.

## Global Constraints

- Menu items (both rail states): **View profile** → `/{username}`, **Settings** → `/settings`, **Log out** → `await logout()` (store) then `router.push('/login')`.
- Auth store API: `useAuthStore()` exposes `user: User | null`, `setAuth(user: User)`, `logout(): Promise<void>`. `User` (from `@/lib/types`) has `id, email, username, name?, avatar?, bio?`.
- Settings saves via `PATCH /api/profile` (already accepts `name`, `bio`, `avatar`, returns the updated user) — NO new API route, NO schema change. Avatar upload via `POST /api/upload` (FormData `file` → `{ url }`).
- Kebab trigger button carries `aria-label="Account menu"`.
- **Gate each task:** `npx tsc --noEmit` (exit 0) AND `npx vitest run` (full suite green). Windows + Git Bash; FOREGROUND; do NOT run `pnpm build`. The suite can be slow (~30-45min) with occasional transient worker-pool timeouts on UNRELATED files — re-run a timed-out file to confirm; env flakiness ≠ task failure.
- Do not stage the always-untracked files (`Documents/`, `Images/`, `g1t.json`, `nul`, `test-output.txt`, `.claude/settings.local.json`); `git add` specific paths.

---

## Task 1: Consolidated `ProfileCard`

**Files:**
- Modify (rewrite): `src/components/dashboard/ProfileCard.tsx`
- Test: `src/components/dashboard/ProfileCard.test.tsx` (new)

**Interfaces:**
- Produces: `ProfileCard({ collapsed?: boolean })` — renders the identity card (expanded) or an avatar button (collapsed), each opening an account dropdown (View profile / Settings / Log out).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/dashboard/ProfileCard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileCard } from './ProfileCard'

const logout = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { username: 'josh', name: 'Josh', avatar: null, bio: 'hi' }, logout }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)))
})

describe('ProfileCard', () => {
  it('opens the account menu with View profile, Settings, and Log out', () => {
    render(<ProfileCard />)
    fireEvent.click(screen.getByLabelText('Account menu'))
    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute('href', '/josh')
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })
  it('logs out via the store when Log out is clicked', () => {
    render(<ProfileCard />)
    fireEvent.click(screen.getByLabelText('Account menu'))
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(logout).toHaveBeenCalled()
  })
  it('collapsed variant hides the @handle/stats but still opens the menu', () => {
    render(<ProfileCard collapsed />)
    expect(screen.queryByText('@josh')).toBeNull()
    expect(screen.queryByText('Followers')).toBeNull()
    fireEvent.click(screen.getByLabelText('Account menu'))
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (current ProfileCard has no menu / `Account menu` button).

Run: `npx vitest run src/components/dashboard/ProfileCard.test.tsx`

- [ ] **Step 3: Rewrite `ProfileCard.tsx`**

```tsx
// src/components/dashboard/ProfileCard.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Users, Eye, MoreVertical, UserCircle, Settings, LogOut } from 'lucide-react'
import { useAuthStore } from '@/lib/store'

function fmt(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

export function ProfileCard({ collapsed = false }: { collapsed?: boolean }) {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [followers, setFollowers] = useState<number | null>(null)
  const [views, setViews] = useState<number | null>(null)

  useEffect(() => {
    if (collapsed) return // stats only shown in the expanded card
    fetch('/api/displays')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setViews(Array.isArray(d) ? d.reduce((s: number, x: { views?: number }) => s + (x.views || 0), 0) : 0))
      .catch(() => setViews(0))
    if (user?.username) {
      fetch(`/api/users/${user.username}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setFollowers(d?.followerCount ?? 0))
        .catch(() => setFollowers(0))
    }
  }, [user?.username, collapsed])

  if (!user) return null
  const initial = (user.name || user.username || '?').charAt(0).toUpperCase()

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    router.push('/login')
  }

  const avatarEl = user.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatar} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
  ) : (
    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-galli/30 to-galli-violet/30 text-galli-dark font-bold flex items-center justify-center shrink-0">
      {initial}
    </span>
  )

  const menu = menuOpen && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      <div className="absolute bottom-full left-0 mb-2 z-50 w-52 bg-surface border border-border rounded-xl shadow-soft-lg py-1 overflow-hidden">
        <Link
          href={`/${user.username}`}
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <UserCircle className="w-4 h-4" /> View profile
        </Link>
        <Link
          href="/settings"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Settings className="w-4 h-4" /> Settings
        </Link>
        <div className="border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </div>
    </>
  )

  if (collapsed) {
    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Account menu"
          className="w-full flex items-center justify-center p-2 rounded-xl border border-border bg-surface hover:bg-muted transition-colors cursor-pointer"
        >
          {avatarEl}
        </button>
        {menu}
      </div>
    )
  }

  return (
    <div className="relative mb-3">
      <div className="p-3 rounded-2xl border border-border bg-surface">
        <div className="flex items-center gap-2.5">
          {avatarEl}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate leading-tight">{user.name || user.username}</p>
            <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
          </div>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account menu"
            className="p-1.5 -mr-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {user.bio && <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-snug">{user.bio}</p>}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center py-1.5 rounded-xl bg-muted/60">
            <span className="flex items-center gap-1 text-sm font-bold text-foreground">
              <Users className="w-3.5 h-3.5 text-primary" /> {fmt(followers)}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Followers</span>
          </div>
          <div className="flex flex-col items-center py-1.5 rounded-xl bg-muted/60">
            <span className="flex items-center gap-1 text-sm font-bold text-foreground">
              <Eye className="w-3.5 h-3.5 text-galli-aqua" /> {fmt(views)}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Page views</span>
          </div>
        </div>
      </div>
      {menu}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/components/dashboard/ProfileCard.test.tsx`

- [ ] **Step 5: Gate + commit**

Run: `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/components/dashboard/ProfileCard.tsx src/components/dashboard/ProfileCard.test.tsx
git commit -m "feat(dashboard): ProfileCard hosts account menu (view profile / settings / log out)"
```

---

## Task 2: Remove the redundant bottom bar from `SidebarContent`

**Files:**
- Modify: `src/components/dashboard/SidebarContent.tsx`
- Modify: `src/components/dashboard/MobileNav.test.tsx` (the `@josh` assertion moved into ProfileCard, which the test mocks out)
- Modify: `src/components/dashboard/SidebarContent.test.tsx` (assert the duplicate bar is gone)

**Interfaces:**
- Consumes: `ProfileCard({ collapsed })` from Task 1.

- [ ] **Step 1: Update the two existing tests to match the new structure**

In `src/components/dashboard/MobileNav.test.tsx`, the drawer test currently asserts `expect(screen.getByText('@josh')).toBeTruthy()`. Since `@josh` now lives inside `ProfileCard` (which these tests mock as a stub), remove that one assertion line. Leave the rest (nav labels, `Create New`) unchanged.

In `src/components/dashboard/SidebarContent.test.tsx`, add to the existing `describe` a test proving the duplicate bar (which rendered the `@handle`) is gone — `ProfileCard` is mocked to a stub so no real `@josh` should appear from SidebarContent itself:

```tsx
  it('no longer renders a duplicate account bar (@handle lives in ProfileCard)', () => {
    render(<SidebarContent />)
    expect(screen.queryByText('@josh')).toBeNull()
    expect(screen.getByTestId('profile-card')).toBeInTheDocument()
  })
```

(Confirm `SidebarContent.test.tsx` mocks `ProfileCard` as `() => <div data-testid="profile-card" />`; it does. If it does not, add that `vi.mock`.)

- [ ] **Step 2: Run — expect the new SidebarContent test to FAIL** (the bottom bar still renders `@josh`).

Run: `npx vitest run src/components/dashboard/SidebarContent.test.tsx`

- [ ] **Step 3: Edit `SidebarContent.tsx`**

Make these changes:

1. **Imports:** remove `ChevronDown`, `LogOut`, `UserCircle` from the lucide import (they were only used by the bottom bar). Remove `useState` from the react import and `useRouter` from the `next/navigation` import if they become unused (they are — only the bottom bar used them). Keep `usePathname`, `Link`, and the remaining icons.
2. **Store usage:** the component destructures `const { user, logout } = useAuthStore()` — the bottom bar was the only consumer of `user`/`logout` here. Remove the `useAuthStore` import and that call, plus the `menuOpen` state, the `handleLogout` function, and the `initial` variable (all only used by the bottom bar).
3. **ProfileCard render:** replace the line `{!collapsed && <ProfileCard />}` with:

```tsx
      <ProfileCard collapsed={collapsed} />
```

4. **Delete the entire bottom user-menu block** — everything from the `{/* User menu */}` comment through its closing `</div>` (the `<div className="relative"> … </div>` containing the avatar button and the `menuOpen` dropdown), which sits just before the component's closing `</>`.

After editing, run `npx tsc --noEmit` and remove anything it reports as unused (unused imports/vars are the signal you missed one of the above).

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/components/dashboard/SidebarContent.test.tsx src/components/dashboard/MobileNav.test.tsx`

- [ ] **Step 5: Gate + commit**

Run: `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/components/dashboard/SidebarContent.tsx src/components/dashboard/MobileNav.test.tsx src/components/dashboard/SidebarContent.test.tsx
git commit -m "refactor(dashboard): drop redundant sidebar bottom bar; ProfileCard in both rail states"
```

---

## Task 3: `/settings` page

**Files:**
- Create: `src/app/(dashboard)/settings/page.tsx`
- Test: `src/app/(dashboard)/settings/page.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (`user`, `setAuth`); `PATCH /api/profile`; `POST /api/upload`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/(dashboard)/settings/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsPage from './page'

const setAuth = vi.fn()
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { id: 'u1', username: 'josh', name: 'Josh', bio: 'hi', avatar: null, email: 'j@x.com' }, setAuth }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn((url: string) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(url === '/api/profile' ? { name: 'Josh R', bio: 'hi' } : {}) } as Response),
  ))
})

describe('SettingsPage', () => {
  it('pre-fills the form from the store user', () => {
    render(<SettingsPage />)
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('Josh')
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('j@x.com')
  })
  it('saves edited name via PATCH /api/profile', async () => {
    render(<SettingsPage />)
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Josh R' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      const patch = calls.find((c) => c[0] === '/api/profile')
      expect(patch).toBeTruthy()
      expect(JSON.parse(patch![1].body)).toMatchObject({ name: 'Josh R' })
    })
    expect(setAuth).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module './page'`). `npx vitest run "src/app/(dashboard)/settings/page.test.tsx"`

- [ ] **Step 3: Implement `src/app/(dashboard)/settings/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import type { User } from '@/lib/types'

export default function SettingsPage() {
  const { user, setAuth } = useAuthStore()
  const [name, setName] = useState(user?.name || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!user) return null
  const initial = (name || user.username || '?').charAt(0).toUpperCase()

  const onUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      if (r.ok) setAvatar((await r.json()).url)
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, bio, avatar }),
      })
      if (r.ok) {
        const updated = await r.json()
        setAuth({ ...user, ...updated } as User)
        setSaved(true)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-6 lg:px-8 py-7 max-w-xl">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-6">Settings</h1>
      <div className="space-y-5">
        <div>
          <span className="block text-sm font-medium mb-2">Profile photo</span>
          <div className="flex items-center gap-4">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" />
            ) : (
              <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-galli/30 to-galli-violet/30 text-galli-dark font-bold text-xl flex items-center justify-center">
                {initial}
              </span>
            )}
            <label className="px-3 py-2 rounded-lg border border-border text-sm font-medium cursor-pointer hover:bg-muted transition">
              {uploading ? 'Uploading…' : 'Change photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }}
              />
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="s-name" className="block text-sm font-medium mb-1.5">Display name</label>
          <input id="s-name" aria-label="Display name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>

        <div>
          <label htmlFor="s-bio" className="block text-sm font-medium mb-1.5">Bio</label>
          <textarea id="s-bio" aria-label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" />
        </div>

        <div>
          <label htmlFor="s-email" className="block text-sm font-medium mb-1.5">Email</label>
          <input id="s-email" aria-label="Email" value={user.email} readOnly
            className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-sm text-muted-foreground" />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run "src/app/(dashboard)/settings/page.test.tsx"`

- [ ] **Step 5: Gate + commit**

Run: `npx tsc --noEmit`; `npx vitest run`.

```bash
git add "src/app/(dashboard)/settings/page.tsx" "src/app/(dashboard)/settings/page.test.tsx"
git commit -m "feat(settings): account settings page (name / bio / avatar)"
```

---

## Verification (after all tasks)

1. `npx tsc --noEmit` clean; `npx vitest run` fully green.
2. Manual smoke (dev server, logged in): the left rail bottom shows ONE identity card with a ⋮ menu → View profile / Settings / Log out; collapse the rail → the card becomes an avatar button opening the same menu; there is no second user bar. Open `/settings`, change the display name + upload a photo, Save → "Saved ✓", and the sidebar card reflects the new name/avatar without a reload; Log out returns to `/login`.

## Self-review notes (checked against spec)

- **Coverage:** ProfileCard menu + collapsed variant (T1), bottom-bar removal + both-state render (T2), /settings page reusing PATCH /api/profile + /api/upload + store refresh (T3). ✔
- **No new API / schema:** settings uses existing `PATCH /api/profile` and `/api/upload`. ✔
- **Test fallout handled:** T2 updates `MobileNav.test.tsx` (the `@josh` assertion that came from the now-deleted bottom bar) and adds a SidebarContent assertion. ✔
- **Type consistency:** `ProfileCard({ collapsed })`, `setAuth({ ...user, ...updated } as User)`, `User` fields (`email` required; `name`/`avatar`/`bio` optional) all match `@/lib/types`. ✔

# Mobile Nav Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the dashboard shell a mobile navigation pattern (hamburger + off-canvas drawer) so every dashboard destination is reachable on a phone, leaving the desktop layout visually unchanged.

**Architecture:** Extract the sidebar's inner content into a shared `SidebarContent` component. `Sidebar` becomes the desktop-only rail (`hidden md:flex`) that wraps it; a new `MobileNav` (`md:hidden`) renders a sticky top bar + a left off-canvas drawer that also wraps `SidebarContent`. Wire both into the dashboard layout and add an explicit viewport export.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, lucide-react, Zustand (`useAuthStore`), Vitest + @testing-library/react (jsdom).

## Global Constraints

- Reuse the existing sidebar content — do NOT rebuild nav/Create/profile/logout. Extract into `SidebarContent` and render it in both the desktop rail and the mobile drawer.
- Breakpoint boundary is **`md`** (768px): below `md` = mobile shell; `md`+ = persistent rail. Desktop (`md`+) must stay visually and behaviorally identical.
- No data, no API, no schema changes. Nav destinations and auth (`useAuthStore`, `logout`) unchanged.
- Preserve accessibility: pinch-zoom stays enabled (viewport export sets `width: 'device-width', initialScale: 1` and NO `maximumScale`/`userScalable`). Tap targets ≥44px for the hamburger/close.
- Body scroll must be locked while the drawer is open and restored on close/unmount.
- Existing semantic tokens/components: `bg-sidebar`, `border-border`, `<Wordmark>`, `<ProfileCard>`, `bg-primary text-primary-foreground`.
- Windows/dev: verify with `npx tsc --noEmit` + `npx vitest run` + live checks at 375px. Do NOT run `pnpm build` while the dev server is running.

---

### Task 1: Extract `SidebarContent`; make `Sidebar` the desktop rail

**Files:**
- Create: `src/components/dashboard/SidebarContent.tsx`
- Modify: `src/components/dashboard/Sidebar.tsx` (full rewrite — see below)

**Interfaces:**
- Produces:
  - `<SidebarContent collapsed?: boolean onNavigate?: () => void />` — the Create link + 6 nav items + `ProfileCard` + user menu; calls `onNavigate?.()` on any Create/nav/View-profile click and after logout.
  - `<Sidebar />` — desktop-only rail (`hidden md:flex`) wrapping `SidebarContent`.

- [ ] **Step 1: Create `SidebarContent`**

Create `src/components/dashboard/SidebarContent.tsx` (this is the body of the current `Sidebar`, lifted verbatim and parameterized by `collapsed` + `onNavigate`):

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Plus, Home, FileText, Users, Compass, Library, ChevronDown, LogOut, BarChart3, UserCircle,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { ProfileCard } from '@/components/dashboard/ProfileCard'

interface NavItem {
  label: string
  icon: typeof Home
  href?: string
  soon?: boolean
  match?: (path: string) => boolean
}

const NAV: NavItem[] = [
  { label: 'Home', icon: Home, href: '/dashboard', match: (p) => p === '/dashboard' },
  { label: 'My Pages', icon: FileText, href: '/my-pages', match: (p) => p.startsWith('/my-pages') },
  { label: 'Shared with me', icon: Users, href: '/shared', match: (p) => p.startsWith('/shared') },
  { label: 'Explore', icon: Compass, href: '/explore', match: (p) => p.startsWith('/explore') },
  { label: 'Analytics', icon: BarChart3, href: '/analytics', match: (p) => p.startsWith('/analytics') },
  { label: 'Library', icon: Library, href: '/library', match: (p) => p.startsWith('/library') },
]

export function SidebarContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    onNavigate?.()
    router.push('/login')
  }

  const initial = (user?.name || user?.username || '?').charAt(0).toUpperCase()

  return (
    <>
      {/* Create New */}
      <Link
        href="/editor"
        onClick={onNavigate}
        className={`flex items-center ${
          collapsed ? 'justify-center' : 'justify-between'
        } gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-soft hover:brightness-105 transition-all cursor-pointer`}
      >
        {!collapsed && <span>Create New</span>}
        <Plus className="w-4 h-4 shrink-0" />
      </Link>

      {/* Nav */}
      <nav className="mt-5 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.href && (item.match ? item.match(pathname) : pathname === item.href.split('?')[0])
          const Icon = item.icon
          const base = `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            collapsed ? 'justify-center' : ''
          }`
          if (item.soon) {
            return (
              <div key={item.label} className={`${base} text-muted-foreground/70 cursor-default`} title="Coming soon">
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Soon</span>
                  </>
                )}
              </div>
            )
          }
          return (
            <Link
              key={item.label}
              href={item.href!}
              onClick={onNavigate}
              className={`${base} cursor-pointer ${
                active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-primary' : ''}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Profile ID card */}
      {!collapsed && <ProfileCard />}

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className={`w-full flex items-center gap-2.5 p-2 rounded-xl border border-border bg-surface hover:bg-muted transition-colors cursor-pointer ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          ) : (
            <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary font-bold text-sm flex items-center justify-center shrink-0">
              {initial}
            </span>
          )}
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold truncate">{user?.name || user?.username || 'You'}</p>
                <p className="text-[11px] text-muted-foreground truncate">@{user?.username}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </>
          )}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-surface border border-border rounded-xl shadow-soft-lg py-1 overflow-hidden">
              <Link
                href={user?.username ? `/${user.username}` : '#'}
                onClick={() => { setMenuOpen(false); onNavigate?.() }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <UserCircle className="w-4 h-4" />
                View profile
              </Link>
              <div className="border-t border-border">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Rewrite `Sidebar` as the desktop rail**

Replace the entire contents of `src/components/dashboard/Sidebar.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'
import { SidebarContent } from '@/components/dashboard/SidebarContent'

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`${
        collapsed ? 'w-[76px]' : 'w-64'
      } hidden md:flex shrink-0 h-screen sticky top-0 bg-sidebar border-r border-border flex-col px-3 py-4 transition-[width] duration-200`}
    >
      {/* Brand + collapse */}
      <div className="flex items-center justify-between px-2 mb-5 h-9">
        {!collapsed && (
          <Link href="/dashboard" className="text-2xl">
            <Wordmark />
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <SidebarContent collapsed={collapsed} />
    </aside>
  )
}
```

Note: the `<aside>` keeps `flex-col` but the `flex` is now supplied by `md:flex` (with `hidden` as the base), so on mobile it is `display:none` and on `md`+ it is a flex column — identical desktop appearance.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Live-verify desktop unchanged**

With the dev server running, load the dashboard at a desktop width (≥768px): the sidebar looks and behaves exactly as before — nav highlights the active route, collapse toggle works, Create/profile/logout work. At <768px the sidebar is now hidden (mobile nav arrives in Task 3).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/SidebarContent.tsx src/components/dashboard/Sidebar.tsx
git commit -m "refactor(dashboard): extract SidebarContent; Sidebar is desktop-only rail (hidden md:flex)"
```

---

### Task 2: `MobileNav` component (top bar + drawer)

**Files:**
- Create: `src/components/dashboard/MobileNav.tsx`
- Test: `src/components/dashboard/MobileNav.test.tsx`

**Interfaces:**
- Consumes: `SidebarContent` (Task 1), `Wordmark`.
- Produces: `<MobileNav />` — a `md:hidden` sticky top bar + off-canvas drawer.

- [ ] **Step 1: Write the failing test**

Create `src/components/dashboard/MobileNav.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileNav } from './MobileNav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { username: 'josh', name: 'Josh' }, logout: vi.fn() }),
}))
// ProfileCard fetches on mount — stub it out for this UI test.
vi.mock('@/components/dashboard/ProfileCard', () => ({ ProfileCard: () => <div data-testid="profile-card" /> }))

describe('MobileNav', () => {
  beforeEach(() => { document.body.style.overflow = '' })

  it('renders a top bar with a menu button and a Create link, drawer closed initially', () => {
    render(<MobileNav />)
    expect(screen.getByLabelText('Open menu')).toBeTruthy()
    expect(screen.getByRole('link', { name: /create/i })).toBeTruthy()
    // nav labels are not in the DOM until the drawer opens
    expect(screen.queryByText('Analytics')).toBeNull()
  })

  it('opens the drawer on menu click, showing all nav destinations + logout', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    for (const label of ['Home', 'My Pages', 'Shared with me', 'Explore', 'Analytics', 'Library', 'Log out']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(document.body.style.overflow).toBe('hidden') // scroll locked
  })

  it('closes the drawer when a nav link is tapped', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    fireEvent.click(screen.getByText('Explore'))
    expect(screen.queryByText('Analytics')).toBeNull() // drawer gone
    expect(document.body.style.overflow).toBe('') // scroll restored
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/MobileNav.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `MobileNav`**

Create `src/components/dashboard/MobileNav.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Plus } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'
import { SidebarContent } from '@/components/dashboard/SidebarContent'

export function MobileNav() {
  const [open, setOpen] = useState(false)

  // Lock body scroll + close on Escape while the drawer is open.
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      {/* Top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 h-14 px-3 bg-sidebar border-b border-border">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2.5 -ml-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="text-xl">
          <Wordmark />
        </Link>
        <Link
          href="/editor"
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-soft hover:brightness-105 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create
        </Link>
      </header>

      {/* Drawer */}
      {open && (
        <div className="md:hidden">
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
          {/* Panel */}
          <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-sidebar border-r border-border flex flex-col px-3 py-4 overflow-y-auto">
            <div className="flex items-center justify-between px-2 mb-5 h-9">
              <Link href="/dashboard" className="text-2xl" onClick={() => setOpen(false)}>
                <Wordmark />
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/MobileNav.test.tsx`
Expected: PASS (3 tests). If `toBeTruthy()`/`toBeNull()` matchers need jest-dom, they do not — these are core vitest matchers and the queries throw on absence only for `getBy*`, so the tests are self-contained.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/MobileNav.tsx src/components/dashboard/MobileNav.test.tsx
git commit -m "feat(dashboard): MobileNav top bar + off-canvas drawer"
```

---

### Task 3: Wire `MobileNav` into the layout + add viewport export

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `MobileNav` (Task 2).

- [ ] **Step 1: Render `MobileNav` in the dashboard layout**

Replace the contents of `src/app/(dashboard)/layout.tsx` with:

```tsx
import { Sidebar } from '@/components/dashboard/Sidebar'
import { MobileNav } from '@/components/dashboard/MobileNav'
import { VerifyBanner } from '@/components/auth/VerifyBanner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <MobileNav />
        <VerifyBanner />
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Add an explicit viewport export to the root layout**

In `src/app/layout.tsx`, add a `Viewport` export. Add the import to the existing `next` type import (or a new import line) and export the const near the existing `metadata` export:

```tsx
import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}
```

(If `src/app/layout.tsx` already imports `Metadata` from `'next'`, extend that import to `{ Metadata, Viewport }` rather than adding a duplicate import. Do NOT set `maximumScale` or `userScalable` — pinch-zoom must stay enabled.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Live-verify the mobile shell at 375px**

With the dev server running, open the dashboard in a 375px-wide viewport (browser devtools device toolbar):
- The persistent sidebar is gone; a sticky top bar shows ☰ · wordmark · **+ Create**, and page content is full-width (no crushed sliver).
- Tapping ☰ slides in the drawer with all 6 nav items + ProfileCard + user menu; tapping a nav item navigates and closes the drawer; backdrop tap and Escape close it; the page behind does not scroll while open.
- At ≥768px the top bar is gone and the desktop sidebar is back, unchanged.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx" src/app/layout.tsx
git commit -m "feat(dashboard): wire MobileNav into layout; explicit viewport export"
```

---

### Task 4: Full verification

**Files:** none.

- [ ] **Step 1: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass (including the 3 new `MobileNav` tests).

- [ ] **Step 2: End-to-end live check**

At 375px: navigate Home → My Pages → Shared → Explore → Analytics → Library all via the drawer; open Create; open View profile; Log out. At ≥768px: confirm the desktop sidebar is unchanged (nav, collapse, Create, profile, logout).

- [ ] **Step 3: Deploy (fix→push→deploy cadence)**

```bash
git push origin main
vercel ls my-galli   # confirm the new production deploy goes Ready + takes mygalli.com
```

---

## Notes for the implementer

- This is a refactor + additive UI: no data, no API, no schema changes.
- The desktop rail must look identical at `md`+ — the only change to it is the `hidden md:flex` visibility gate and delegating its body to `SidebarContent`.
- A concurrent session may be editing OTHER files in this repo. Your targets (`SidebarContent`, `Sidebar`, `MobileNav`, the two layouts) are unlikely to collide, but if `git` reports an `index.lock`, wait a moment and retry; if a target file doesn't match this plan, STOP and report rather than guessing.

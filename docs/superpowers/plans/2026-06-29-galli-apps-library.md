# Apps Page + Library (Apps section), Pro-Gated — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Apps storefront and the Library page's Apps section end-to-end, gated behind a minimal Pro tier (free users browse, actions are upgrade-gated).

**Architecture:** Build on the existing card-provider registry (`src/lib/cards/registry.ts`) and `CardLibraryItem` store. Add a `User.plan` field + `isPro()` helper as the single gate. Apps page reads listed providers and writes to `/api/card-library`; Library page reads `/api/card-library`; the editor's existing `CardLibraryPicker` flow gets a slash item + Pro gate. No new tables.

**Tech Stack:** Next.js 14 App Router, TypeScript, React 18, Zustand (`useAuthStore`), Prisma + PostgreSQL, Tailwind, Vitest, lucide-react.

## Global Constraints

- Display brand name is **"My Galli"**; never reintroduce bare "Galli" in new user-facing copy.
- Pro gate is the single helper `isPro(user)` in `src/lib/plan.ts` — do not scatter `plan === 'pro'` checks.
- Free users **browse** Apps/Library freely; only **actions** (Add to Library, use a library App on a page) are gated.
- Launch apps: `vouch` = live + listed; `kollabshare` = coming-soon + listed (placeholder); `example` = not listed.
- Migrations are non-interactive here: generate SQL via `prisma migrate diff ... --script` → write to a new `prisma/migrations/<ts>_<name>/migration.sql` → `prisma migrate deploy`. The dev DB is on port 5434; a machine-level `DATABASE_URL` may override `.env`, so confirm it points at the Galli dev DB before running (see memory note `database-url-env-override`).
- Tailwind brand tokens: `galli`, `galli-aqua`, `galli-violet`, `galli-dark`; `bg-surface`, `shadow-soft`, `shadow-soft-lg`.

---

### Task 1: Pro-tier foundation (`User.plan` + `isPro` + wiring)

**Files:**
- Modify: `prisma/schema.prisma` (User model)
- Create: `prisma/migrations/<timestamp>_add_user_plan/migration.sql`
- Create: `src/lib/plan.ts`
- Create: `src/__tests__/plan.test.ts`
- Modify: `src/lib/types.ts` (User interface)
- Modify: `src/lib/auth.ts` (both `select` blocks)
- Modify: `src/app/api/auth/login/route.ts`, `src/app/api/auth/signup/route.ts`, `src/app/api/auth/google/route.ts` (returned user object)

**Interfaces:**
- Produces: `isPro(user: { plan?: string | null } | null | undefined): boolean`
- Produces: `User.plan?: 'free' | 'pro'` available on `useAuthStore().user`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/plan.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isPro } from '@/lib/plan'

describe('isPro', () => {
  it('is false for null/undefined', () => {
    expect(isPro(null)).toBe(false)
    expect(isPro(undefined)).toBe(false)
  })
  it('is false for free or missing plan', () => {
    expect(isPro({ plan: 'free' })).toBe(false)
    expect(isPro({})).toBe(false)
    expect(isPro({ plan: null })).toBe(false)
  })
  it('is true only for pro', () => {
    expect(isPro({ plan: 'pro' })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/plan.test.ts`
Expected: FAIL — cannot resolve `@/lib/plan`.

- [ ] **Step 3: Create the helper**

Create `src/lib/plan.ts`:

```ts
export type Plan = 'free' | 'pro'

export function isPro(user: { plan?: string | null } | null | undefined): boolean {
  return user?.plan === 'pro'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/plan.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the schema field**

In `prisma/schema.prisma`, inside `model User`, add (next to other scalar fields):

```prisma
  plan        String   @default("free")
```

- [ ] **Step 6: Generate and apply the migration**

Confirm `DATABASE_URL` targets the Galli dev DB (port 5434), then run:

```bash
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > migration.sql
```

Create `prisma/migrations/<timestamp>_add_user_plan/migration.sql` with the generated SQL (it should be):

```sql
ALTER TABLE "User" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';
```

Then apply and regenerate the client:

```bash
npx prisma migrate deploy
npx prisma generate
```

Expected: migration applied; `User.plan` available in the Prisma client.

- [ ] **Step 7: Expose `plan` on the User type**

In `src/lib/types.ts`, add to the `User` interface (after `featuredDisplayId`):

```ts
  plan?: 'free' | 'pro'
```

- [ ] **Step 8: Select `plan` in auth lookups**

In `src/lib/auth.ts`, add `plan: true,` to the `select` object in **both** `verifyAuth` and `getUser` (after `emailVerified: true,`).

- [ ] **Step 9: Return `plan` from auth responses**

In each of `src/app/api/auth/login/route.ts`, `signup/route.ts`, and `google/route.ts`, add to the returned `user: { ... }` object (after `emailVerified: user.emailVerified,`):

```ts
        plan: user.plan,
```

- [ ] **Step 10: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 11: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/plan.ts src/__tests__/plan.test.ts src/lib/types.ts src/lib/auth.ts "src/app/api/auth/login/route.ts" "src/app/api/auth/signup/route.ts" "src/app/api/auth/google/route.ts"
git commit -m "feat(pro): add User.plan + isPro() gate, wire plan through auth"
```

---

### Task 2: Pro UI primitives (`ProBadge`, `UpgradePrompt`)

**Files:**
- Create: `src/components/pro/ProBadge.tsx`
- Create: `src/components/pro/UpgradePrompt.tsx`

**Interfaces:**
- Produces: `<ProBadge className?: string />`
- Produces: `<UpgradePrompt isOpen: boolean; onClose: () => void; feature?: string />`

- [ ] **Step 1: Create ProBadge**

Create `src/components/pro/ProBadge.tsx`:

```tsx
import { Sparkles } from 'lucide-react'

export function ProBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-galli-violet/15 px-2 py-0.5 text-[10px] font-semibold text-galli-violet ${className}`}
    >
      <Sparkles className="h-3 w-3" />
      Pro
    </span>
  )
}
```

- [ ] **Step 2: Create UpgradePrompt**

Create `src/components/pro/UpgradePrompt.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { X, Sparkles } from 'lucide-react'

export function UpgradePrompt({
  isOpen,
  onClose,
  feature = 'This feature',
}: {
  isOpen: boolean
  onClose: () => void
  feature?: string
}) {
  if (!isOpen) return null
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-soft-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-galli-violet/15">
            <Sparkles className="h-6 w-6 text-galli-violet" />
          </div>
          <h3 className="text-lg font-bold">Upgrade to Pro</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {feature} is part of My Galli Pro. Upgrade to add Apps to your Library and use them on your pages.
          </p>
          <Link
            href="/enterprise"
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            See Pro
          </Link>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/pro/
git commit -m "feat(pro): ProBadge + UpgradePrompt UI primitives"
```

---

### Task 3: Registry storefront metadata (`listed`, `status`, KollabShare, `listedApps()`)

**Files:**
- Modify: `src/lib/cards/registry.ts`
- Create: `src/__tests__/cards-registry.test.ts`

**Interfaces:**
- Consumes: `CARD_PROVIDERS`, `CardProviderConfig` (from Task context — existing).
- Produces: `CardProviderConfig.listed?: boolean`, `CardProviderConfig.status?: 'live' | 'coming-soon'`
- Produces: `listedApps(): CardProviderConfig[]`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/cards-registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { listedApps, CARD_PROVIDERS } from '@/lib/cards/registry'

describe('listedApps', () => {
  it('includes vouch (live) and kollabshare (coming-soon)', () => {
    const ids = listedApps().map((a) => a.id)
    expect(ids).toContain('vouch')
    expect(ids).toContain('kollabshare')
  })
  it('excludes the dev example card', () => {
    expect(listedApps().map((a) => a.id)).not.toContain('example')
  })
  it('marks vouch live and kollabshare coming-soon', () => {
    expect(CARD_PROVIDERS.vouch.status).toBe('live')
    expect(CARD_PROVIDERS.kollabshare.status).toBe('coming-soon')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/cards-registry.test.ts`
Expected: FAIL — `listedApps` not exported / `kollabshare` undefined.

- [ ] **Step 3: Extend the config interface**

In `src/lib/cards/registry.ts`, add to `interface CardProviderConfig` (after `fields: CardField[]`):

```ts
  listed?: boolean // appears on the Apps storefront
  status?: 'live' | 'coming-soon' // live = addable; coming-soon = visible only
```

- [ ] **Step 4: Mark existing providers**

In the `vouch` entry, add after `id: 'vouch',`:

```ts
    listed: true,
    status: 'live',
```

The `example` entry stays unlisted — add after `id: 'example',`:

```ts
    listed: false,
```

- [ ] **Step 5: Add the KollabShare placeholder**

In `CARD_PROVIDERS`, add a new entry (after the `example` entry, before the closing `}`):

```ts
  kollabshare: {
    id: 'kollabshare',
    name: 'KollabShare',
    description: 'Collaborative sharing widget — coming soon to My Galli.',
    icon: 'Share2',
    type: 'external',
    listed: true,
    status: 'coming-soon',
    defaultData: {},
    fields: [],
  },
```

- [ ] **Step 6: Add the `listedApps` helper**

At the end of `src/lib/cards/registry.ts`, add:

```ts
// Providers shown on the Apps storefront
export function listedApps(): CardProviderConfig[] {
  return Object.values(CARD_PROVIDERS).filter((p) => p.listed)
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/__tests__/cards-registry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/cards/registry.ts src/__tests__/cards-registry.test.ts
git commit -m "feat(apps): registry listed/status metadata + KollabShare + listedApps()"
```

---

### Task 4: Apps storefront page + sidebar nav + API enforcement

**Files:**
- Create: `src/app/(dashboard)/apps/page.tsx`
- Create: `src/components/apps/AppsClient.tsx`
- Modify: `src/components/dashboard/Sidebar.tsx:39`
- Modify: `src/app/api/card-library/route.ts` (POST handler)

**Interfaces:**
- Consumes: `listedApps()`, `CARD_PROVIDERS` (Task 3); `isPro` (Task 1); `ProBadge`, `UpgradePrompt` (Task 2); `useAuthStore` (existing).
- Produces: route `/apps`.

- [ ] **Step 1: Enforce Pro on the add endpoint**

In `src/app/api/card-library/route.ts`, add the import at top:

```ts
import { isPro } from '@/lib/plan'
```

In the `POST` handler, immediately after the existing `if (!user) return ... 401` line, add:

```ts
    if (!isPro(user)) {
      return NextResponse.json({ error: 'Pro required' }, { status: 403 })
    }
```

- [ ] **Step 2: Verify enforcement manually**

With the dev server running and logged in as a `free` user, run:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/card-library \
  -H 'Content-Type: application/json' -b "galli-auth=<your-cookie>" \
  -d '{"provider":"vouch","name":"Test"}'
```

Expected: `403`. (After Step 7 you'll confirm `201` once the account is `pro`.)

- [ ] **Step 3: Build the AppsClient**

Create `src/components/apps/AppsClient.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import { listedApps } from '@/lib/cards/registry'
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { ProBadge } from '@/components/pro/ProBadge'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] || Icons.Blocks
  return <Cmp className={className} />
}

export function AppsClient() {
  const { user } = useAuthStore()
  const pro = isPro(user)
  const apps = listedApps()
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  useEffect(() => {
    fetch('/api/card-library')
      .then((r) => (r.ok ? r.json() : []))
      .then((items: { provider: string }[]) =>
        setAdded(new Set(items.map((i) => i.provider))),
      )
      .catch(() => setAdded(new Set()))
  }, [])

  const addApp = async (id: string, name: string, defaultData: Record<string, unknown>) => {
    if (!pro) {
      setUpgradeOpen(true)
      return
    }
    setPending(id)
    const res = await fetch('/api/card-library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: id, name, data: defaultData }),
    })
    if (res.ok) setAdded((prev) => new Set(prev).add(id))
    else if (res.status === 403) setUpgradeOpen(true)
    setPending(null)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Apps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add My Galli Apps to your Library, then drop them on any page.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {apps.map((app) => {
          const isComingSoon = app.status === 'coming-soon'
          const isAdded = added.has(app.id)
          return (
            <div key={app.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-galli/15 text-galli-dark">
                  <LucideIcon name={app.icon} className="h-5 w-5" />
                </span>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{app.name}</h3>
                  {!pro && !isComingSoon && <ProBadge />}
                </div>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{app.description}</p>
              <div className="mt-4">
                {isComingSoon ? (
                  <span className="inline-flex rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    Coming soon
                  </span>
                ) : isAdded ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-galli/15 px-3 py-1.5 text-xs font-semibold text-galli-dark">
                    <Icons.Check className="h-3.5 w-3.5" /> In Library
                  </span>
                ) : (
                  <button
                    onClick={() => addApp(app.id, app.name, app.defaultData)}
                    disabled={pending === app.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
                  >
                    <Icons.Plus className="h-3.5 w-3.5" />
                    {pending === app.id ? 'Adding…' : 'Add to Library'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Adding Apps" />
    </div>
  )
}
```

- [ ] **Step 4: Create the page**

Create `src/app/(dashboard)/apps/page.tsx`:

```tsx
import { AppsClient } from '@/components/apps/AppsClient'

export const metadata = { title: 'Apps' }

export default function AppsPage() {
  return <AppsClient />
}
```

- [ ] **Step 5: Update the sidebar nav**

In `src/components/dashboard/Sidebar.tsx`, replace line 39:

```tsx
  { label: 'Integrations', icon: Blocks, soon: true },
```

with:

```tsx
  { label: 'Apps', icon: Blocks, href: '/apps', match: (p) => p.startsWith('/apps') },
```

- [ ] **Step 6: Verify it compiles and renders**

Run: `npx tsc --noEmit -p tsconfig.json` (expect no new errors).
With the dev server running, load `http://localhost:3000/apps` — expect the grid with Vouch (Add to Library) and KollabShare (Coming soon). As a free user, clicking Add shows the upgrade prompt.

- [ ] **Step 7: Verify the Pro path**

Set your account to Pro and confirm Add works:

```bash
npx prisma db execute --stdin <<'SQL'
UPDATE "User" SET "plan" = 'pro' WHERE "email" = '<your-email>';
SQL
```

Log out/in (to refresh the stored user), reload `/apps`, click **Add to Library** on Vouch → expect **In Library ✓**. Re-run the Step 2 curl → expect `201`.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)/apps/" src/components/apps/ src/components/dashboard/Sidebar.tsx "src/app/api/card-library/route.ts"
git commit -m "feat(apps): Apps storefront page, sidebar nav, Pro-gated add endpoint"
```

---

### Task 5: Library page (Apps tab live, Templates/Kits coming soon) + sidebar nav

**Files:**
- Create: `src/app/(dashboard)/library/page.tsx`
- Create: `src/components/library/LibraryClient.tsx`
- Modify: `src/components/dashboard/Sidebar.tsx` (add Library item + import `Library` icon)

**Interfaces:**
- Consumes: `GET /api/card-library`, `DELETE /api/card-library/[id]` (existing); `CARD_PROVIDERS` (existing); `isPro` (Task 1); `UpgradePrompt` (Task 2).
- Produces: route `/library`.

- [ ] **Step 1: Build the LibraryClient**

Create `src/components/library/LibraryClient.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Layers, Plus } from 'lucide-react'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

interface LibItem {
  id: string
  provider: string
  name: string
}

type Tab = 'apps' | 'templates' | 'kits'

const TABS: { id: Tab; label: string; soon?: boolean }[] = [
  { id: 'apps', label: 'Apps' },
  { id: 'templates', label: 'Templates', soon: true },
  { id: 'kits', label: 'Kits', soon: true },
]

export function LibraryClient() {
  const router = useRouter()
  const { user } = useAuthStore()
  const pro = isPro(user)
  const [tab, setTab] = useState<Tab>('apps')
  const [items, setItems] = useState<LibItem[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  useEffect(() => {
    fetch('/api/card-library')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: LibItem[]) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const remove = async (id: string) => {
    const res = await fetch(`/api/card-library/${id}`, { method: 'DELETE' })
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const use = () => {
    if (!pro) { setUpgradeOpen(true); return }
    router.push('/editor')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Apps, templates, and kits you’ve collected.</p>
      </header>

      <div className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => !t.soon && setTab(t.id)}
            className={`relative px-3 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            } ${t.soon ? 'cursor-default opacity-60' : ''}`}
          >
            {t.label}
            {t.soon && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">Soon</span>
            )}
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-galli" />}
          </button>
        ))}
      </div>

      {tab !== 'apps' ? (
        <p className="py-16 text-center text-muted-foreground">Coming soon.</p>
      ) : loading ? (
        <p className="py-16 text-center text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <Layers className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
          <p className="mb-4 text-sm text-muted-foreground">No Apps in your Library yet.</p>
          <Link
            href="/apps"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Browse Apps
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const provider = CARD_PROVIDERS[item.provider]
            return (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-soft">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{provider?.name ?? item.provider}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={use} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90">
                    Use on a page
                  </button>
                  <button onClick={() => remove(item.id)} aria-label="Remove" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Using library Apps" />
    </div>
  )
}
```

- [ ] **Step 2: Create the page**

Create `src/app/(dashboard)/library/page.tsx`:

```tsx
import { LibraryClient } from '@/components/library/LibraryClient'

export const metadata = { title: 'Library' }

export default function LibraryPage() {
  return <LibraryClient />
}
```

- [ ] **Step 3: Add the sidebar nav item**

In `src/components/dashboard/Sidebar.tsx`, add `Library` to the lucide import (in the `lucide-react` import block, add `Library,`). Then in the `NAV` array, add after the `Apps` entry:

```tsx
  { label: 'Library', icon: Library, href: '/library', match: (p) => p.startsWith('/library') },
```

- [ ] **Step 4: Verify it compiles and renders**

Run: `npx tsc --noEmit -p tsconfig.json` (expect no new errors).
Load `http://localhost:3000/library` — expect the Apps tab (with your added Vouch item if Pro, else empty-state CTA), and Templates/Kits tabs showing "Coming soon."

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/library/" src/components/library/ src/components/dashboard/Sidebar.tsx
git commit -m "feat(library): Library page with live Apps tab + coming-soon Templates/Kits"
```

---

### Task 6: Editor surfacing — slash "Apps" item + Pro gate on insert

**Files:**
- Modify: `src/components/canvas/SlashCommandMenu.tsx` (import, COMMANDS array, `CATEGORY_ORDER:130`)
- Modify: `src/components/editor/PageEditor.tsx` (`case 'card'` ~482, add state + render `UpgradePrompt`)

**Interfaces:**
- Consumes: `isPro` (Task 1), `UpgradePrompt` (Task 2), `useAuthStore` (existing), existing `cardPickerOpen` flow.

- [ ] **Step 1: Rename the slash category and add the App Card item**

In `src/components/canvas/SlashCommandMenu.tsx`:

Add `Blocks,` to the `lucide-react` import block (top of file).

Change `CATEGORY_ORDER` (line 130) `'Integrations'` → `'Apps'`:

```ts
const CATEGORY_ORDER = ['Content', 'Data & Visuals', 'Media', 'Forms', 'Social', 'Apps', 'Kit']
```

Add this entry to the `COMMANDS` array (after the `rate-card` entry, line ~116):

```ts
  { id: 'card', label: 'App Card', icon: Blocks, description: 'Insert a card from your Library', category: 'Apps' },
```

- [ ] **Step 2: Gate the card insertion in the editor**

In `src/components/editor/PageEditor.tsx`, ensure these imports exist (add if missing):

```tsx
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'
```

Near the other `useState` hooks in the component, add:

```tsx
  const { user } = useAuthStore()
  const [upgradeOpen, setUpgradeOpen] = useState(false)
```

Replace the existing `case 'card'` block (lines ~482-487) with:

```tsx
      case 'card': {
        // Library Apps are a Pro feature; gate the insert.
        setShowSlashMenu(false)
        if (!isPro(user)) {
          setUpgradeOpen(true)
          return
        }
        setCardPickerOpen(true)
        return
      }
```

- [ ] **Step 3: Render the UpgradePrompt**

Next to the existing `<CardLibraryPicker ... />` render (line ~1234), add:

```tsx
      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Using library Apps" />
```

- [ ] **Step 4: Verify it compiles and behaves**

Run: `npx tsc --noEmit -p tsconfig.json` (expect no new errors).
In the editor, type `/` → confirm an **Apps** group with **App Card**. As a free user, selecting it shows the upgrade prompt; as Pro, it opens the Card Library picker.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (including `plan` and `cards-registry`).

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/SlashCommandMenu.tsx src/components/editor/PageEditor.tsx
git commit -m "feat(apps): slash 'App Card' item + Pro gate on library card insert"
```

---

## Self-Review

**Spec coverage:**
- Pro gate (`User.plan`, `isPro`, badge/prompt, browse-free/action-gated) → Tasks 1, 2, 4, 6. ✅
- Apps storefront from registry, `listed`/`status`, Vouch live / KollabShare coming-soon / example hidden → Tasks 3, 4. ✅
- Add to Library via `CardLibraryItem`, API 403 enforcement → Task 4. ✅
- Library page, Apps tab live, Templates/Kits coming-soon → Task 5. ✅
- Sidebar Integrations→Apps + Library item → Tasks 4, 5. ✅
- Editor slash surfacing + Pro gate on insert → Task 6. ✅
- Out-of-scope items (Templates system, Kits-in-Library, 3rd-party apps, billing) → not implemented, by design. ✅

**Placeholder scan:** No "TBD"/"handle edge cases"/uncoded steps — every code step shows full code. KollabShare ships as an intentional coming-soon placeholder entry (allowed by spec).

**Type consistency:** `isPro(user)` signature matches across Tasks 1/4/6; `listedApps()` matches Task 3↔4; `UpgradePrompt`/`ProBadge` props match definitions in Task 2 and all call sites; `CardLibraryItem` fields (`provider`, `name`, `data`) match the existing POST handler.

## Notes / follow-on specs
- KollabShare goes live by setting `status: 'live'` + a real `iframeUrl` once the app ships.
- Real Pro upgrade/billing flow replaces the `/enterprise` stub CTA — separate spec.
- Library **Templates** and **Kits** tabs are scaffolded; each is its own follow-on spec.

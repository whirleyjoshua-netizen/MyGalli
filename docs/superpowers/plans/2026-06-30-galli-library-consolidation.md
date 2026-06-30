# Library Hub Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the Apps storefront and the dead Templates stub into the single Library hub, with the Library Apps tab becoming one unified "app-store" grid (browse + downloaded in one surface).

**Architecture:** Extract a new `LibraryAppsTab` that merges today's storefront (`AppsClient`) with the Library's card-library list — one grid over `listedApps()` with per-tile state (coming-soon / Add / In-Library+Use+Remove). `LibraryClient` renders it for the Apps tab. Then remove the now-redundant standalone surfaces (sidebar Templates + Apps items, `/apps` route, `AppsClient`).

**Tech Stack:** Next.js 14 App Router, TypeScript, React 18, Zustand, Tailwind, Vitest, lucide-react.

## Global Constraints

- Reuse the existing Pro infra — `isPro(user)` (`src/lib/plan.ts`), `ProBadge`, `UpgradePrompt`. No `plan === 'pro'` literals.
- Do NOT use `import * as Icons from 'lucide-react'` (bundles all of Lucide) — use explicit named imports / a small icon map.
- Free users browse; only actions gate (client `UpgradePrompt` + the existing server 403 on `POST /api/card-library`). No changes to the card system, registries, or Pro gate logic.
- Apps catalog = `listedApps()` (Vouch `status:'live'`, KollabShare `status:'coming-soon'`). "Added" = at least one `CardLibraryItem` exists for that provider. "Remove" deletes ALL of the user's items for that provider.
- Copy says "My Galli", never bare "Galli".
- Each task leaves the app in a working state; do Task 1 (build the unified tab) before Task 2 (remove the old surfaces).
- Commit only explicit paths — the repo has stray untracked files (`Documents/`, `Images/`, `g1t.json`, `nul`) and a modified `.claude/settings.local.json` that must never be committed. Never `git add .`/`-A`/`git add src`.

**Existing interfaces (already on main):**
- `listedApps(): CardProviderConfig[]` from `@/lib/cards/registry`; `CardProviderConfig` has `{ id, name, description, icon (lucide name string), status?, defaultData, ... }`. Listed providers and their icons: `vouch` → `'ShieldCheck'`, `kollabshare` → `'Share2'`.
- `GET /api/card-library` → `[{ id, provider, name, data, style }]`; `POST /api/card-library {provider, name, data}` (401 unauth / 403 free or non-live / 201 ok); `DELETE /api/card-library/[id]`.
- `isPro`, `ProBadge`, `UpgradePrompt`, `useRefreshUser`, `useAuthStore` (`{ user }`, `user.plan`).

---

### Task 1: Unified `LibraryAppsTab` + wire it into `LibraryClient`

**Files:**
- Create: `src/components/library/LibraryAppsTab.tsx`
- Modify (full replace): `src/components/library/LibraryClient.tsx`

**Interfaces:**
- Produces: `<LibraryAppsTab />` (self-contained client component; manages its own card-library fetch, add/use/remove, and `UpgradePrompt`).

- [ ] **Step 1: Create the unified Apps tab component**

Create `src/components/library/LibraryAppsTab.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, Trash2, ShieldCheck, Share2, Blocks } from 'lucide-react'
import { listedApps } from '@/lib/cards/registry'
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { ProBadge } from '@/components/pro/ProBadge'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

interface LibItem {
  id: string
  provider: string
  name: string
}

// Explicit map of the icons listed providers use — avoids bundling all of lucide.
const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  Share2,
}
function ProviderIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = PROVIDER_ICONS[name] || Blocks
  return <Cmp className={className} />
}

export function LibraryAppsTab() {
  const router = useRouter()
  const { user } = useAuthStore()
  const pro = isPro(user)
  const apps = listedApps()
  const [items, setItems] = useState<LibItem[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/card-library')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: LibItem[]) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
  }, [])

  const itemsFor = (provider: string) => items.filter((i) => i.provider === provider)

  const add = async (id: string, name: string, defaultData: Record<string, unknown>) => {
    if (!pro) { setUpgradeOpen(true); return }
    setPending(id)
    setError(null)
    try {
      const res = await fetch('/api/card-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id, name, data: defaultData }),
      })
      if (res.ok) {
        const item = await res.json()
        setItems((prev) => [...prev, item])
      } else if (res.status === 403) {
        setUpgradeOpen(true)
      } else {
        setError('Could not add that app. Please try again.')
      }
    } catch {
      setError('Could not add that app. Please try again.')
    } finally {
      setPending(null)
    }
  }

  const remove = async (provider: string) => {
    setError(null)
    const mine = itemsFor(provider)
    try {
      for (const it of mine) {
        const res = await fetch(`/api/card-library/${it.id}`, { method: 'DELETE' })
        if (!res.ok) { setError('Could not remove that app. Please try again.'); return }
      }
      setItems((prev) => prev.filter((i) => i.provider !== provider))
    } catch {
      setError('Could not remove that app. Please try again.')
    }
  }

  const use = () => {
    if (!pro) { setUpgradeOpen(true); return }
    router.push('/editor')
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {apps.map((app) => {
          const isComingSoon = app.status === 'coming-soon'
          const added = itemsFor(app.id).length > 0
          return (
            <div key={app.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-galli/15 text-galli-dark">
                  <ProviderIcon name={app.icon} className="h-5 w-5" />
                </span>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{app.name}</h3>
                  {!pro && !isComingSoon && <ProBadge />}
                </div>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{app.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {isComingSoon ? (
                  <span className="inline-flex rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    Coming soon
                  </span>
                ) : added ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-galli/15 px-3 py-1.5 text-xs font-semibold text-galli-dark">
                      <Check className="h-3.5 w-3.5" /> In Library
                    </span>
                    <button onClick={use} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90">
                      Use on a page
                    </button>
                    <button onClick={() => remove(app.id)} aria-label={`Remove ${app.name}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => add(app.id, app.name, app.defaultData)}
                    disabled={pending === app.id}
                    aria-busy={pending === app.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {pending === app.id ? 'Adding…' : 'Add to Library'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Library Apps" />
    </div>
  )
}
```

- [ ] **Step 2: Replace LibraryClient to render the new tab (and drop the old apps list)**

Replace the ENTIRE contents of `src/components/library/LibraryClient.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Trophy, FileText, Heart, Sparkles, Library, Store } from 'lucide-react'
import { listTemplates } from '@/lib/templates/registry'
import { listKits } from '@/lib/kits/registry'
import '@/lib/kits/all'
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { useRefreshUser } from '@/lib/use-refresh-user'
import { ProBadge } from '@/components/pro/ProBadge'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'
import { LibraryAppsTab } from '@/components/library/LibraryAppsTab'

interface Starter {
  kind: 'template' | 'kit'
  id: string
  name: string
  description: string
  pro?: boolean
  emoji?: string
  iconName?: string
  gradient: string
}

type Tab = 'apps' | 'templates' | 'kits'

const TABS: { id: Tab; label: string }[] = [
  { id: 'apps', label: 'Apps' },
  { id: 'templates', label: 'Templates' },
  { id: 'kits', label: 'Kits' },
]

const KIT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy, FileText, Heart, Sparkles, Library, Store,
}
function LucideIcon({ name, className }: { name?: string; className?: string }) {
  const Cmp = (name && KIT_ICONS[name]) || Library
  return <Cmp className={className} />
}

const TEMPLATE_STARTERS: Starter[] = listTemplates().map((t) => ({
  kind: 'template', id: t.id, name: t.name, description: t.description, pro: t.pro, emoji: t.emoji, gradient: t.gradient,
}))
const KIT_STARTERS: Starter[] = listKits().map((k) => ({
  kind: 'kit', id: k.id, name: k.name, description: k.description, pro: k.pro, iconName: k.icon, gradient: 'from-galli/20 to-galli-violet/15',
}))

export function LibraryClient() {
  useRefreshUser()
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuthStore()
  const pro = isPro(user)
  const requested = params.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(
    requested === 'templates' || requested === 'kits' ? requested : 'apps',
  )
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)

  const useStarter = async (s: Starter) => {
    if (s.pro && !pro) { setUpgradeOpen(true); return }
    setCreating(s.id)
    setError(null)
    try {
      const res = await fetch('/api/displays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `My ${s.name}`,
          ...(s.kind === 'template' ? { templateId: s.id } : { kitId: s.id }),
        }),
      })
      if (res.ok) {
        const display = await res.json()
        router.push(`/editor?id=${display.id}`)
        return
      }
      if (res.status === 403) { setUpgradeOpen(true); return }
      setError('Could not create a page from that. Please try again.')
    } catch {
      setError('Could not create a page from that. Please try again.')
    } finally {
      setCreating(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Apps, templates, and kits to build your pages.</p>
      </header>

      <div className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-galli" />}
          </button>
        ))}
      </div>

      {tab === 'apps' ? (
        <LibraryAppsTab />
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(tab === 'templates' ? TEMPLATE_STARTERS : KIT_STARTERS).map((s) => (
              <div key={s.id} className="flex flex-col rounded-2xl border border-border bg-surface shadow-soft">
                <div className={`flex h-28 items-center justify-center rounded-t-2xl bg-gradient-to-br ${s.gradient} text-4xl`}>
                  {s.emoji ? <span>{s.emoji}</span> : <LucideIcon name={s.iconName} className="h-9 w-9 text-galli-dark" />}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{s.name}</h3>
                    {s.pro && !pro && <ProBadge />}
                  </div>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                  <div className="mt-4">
                    <button
                      onClick={() => useStarter(s)}
                      disabled={creating === s.id}
                      aria-busy={creating === s.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {creating === s.id ? 'Creating…' : 'Use'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <UpgradePrompt
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={tab === 'kits' ? 'Kits' : 'Templates'}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Verify it renders**

With the dev server running (http://localhost:3000): `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/library?tab=apps"` → expect **200** (or 307 to /login if no cookie — both mean it compiled). A **500** is a real error. Signed in, the Apps tab shows one grid: Vouch with **Add to Library** (or **In Library ✓ / Use / Remove** if already added) and KollabShare as **Coming soon**; Templates/Kits tabs unchanged.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all pass (no test imports `AppsClient`; the card-library and registry tests are unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/components/library/LibraryAppsTab.tsx src/components/library/LibraryClient.tsx
git commit -m "feat(library): unified app-store Apps tab (browse + downloaded in one grid)"
```

---

### Task 2: Remove the standalone Apps/Templates surfaces

**Files:**
- Modify: `src/components/dashboard/Sidebar.tsx` (remove 2 nav items + unused icon imports)
- Modify (full replace): `src/app/(dashboard)/apps/page.tsx` (redirect)
- Modify: `src/components/editor/CardLibraryPicker.tsx` (repoint empty-state link)
- Delete: `src/components/apps/AppsClient.tsx`

**Interfaces:**
- Consumes: `LibraryAppsTab` / `/library?tab=apps` (Task 1).

- [ ] **Step 1: Remove the Templates stub and Apps item from the sidebar**

In `src/components/dashboard/Sidebar.tsx`, delete these two lines from the `NAV` array:

```tsx
  { label: 'Templates', icon: LayoutTemplate, soon: true },
```
```tsx
  { label: 'Apps', icon: Blocks, href: '/apps', match: (p) => p.startsWith('/apps') },
```

Then remove the now-unused icons from the `lucide-react` import block at the top of the file: delete `LayoutTemplate` and `Blocks` from the import list (leave `Library` and all others — they're still used).

- [ ] **Step 2: Redirect /apps to the Library**

Replace the ENTIRE contents of `src/app/(dashboard)/apps/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'

// The Apps storefront now lives inside the Library hub. Its previous standalone
// implementation (AppsClient) is preserved in git history.
export default function AppsPage() {
  redirect('/library?tab=apps')
}
```

- [ ] **Step 3: Repoint the editor picker's empty-state link**

In `src/components/editor/CardLibraryPicker.tsx`, find the empty-state CTA `<Link href="/apps" ...>Browse Apps</Link>` and change its `href` from `/apps` to `/library?tab=apps` (keep the "Browse Apps" label and everything else).

- [ ] **Step 4: Delete the superseded AppsClient**

```bash
git rm src/components/apps/AppsClient.tsx
```

- [ ] **Step 5: Verify compile + render + tests**

Run: `npx tsc --noEmit -p tsconfig.json` → no new errors (confirms nothing still imports `AppsClient`).
With the dev server running:
- `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/apps` → expect **307** (redirect to /library?tab=apps).
- The sidebar no longer lists **Templates** or **Apps**; **Library** remains.
Run: `npx vitest run` → all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/Sidebar.tsx "src/app/(dashboard)/apps/page.tsx" src/components/editor/CardLibraryPicker.tsx
git commit -m "refactor(library): drop standalone Apps + Templates nav, redirect /apps to Library"
```

---

## Self-Review

**Spec coverage:**
- Sidebar removes Templates stub + Apps item → Task 2. ✅
- Unified app-store Apps tab (coming-soon / Add / In-Library+Use+Remove), merging storefront + library list → Task 1 (`LibraryAppsTab`). ✅
- `/apps` → redirect to `/library?tab=apps` → Task 2. ✅
- Delete `AppsClient.tsx` → Task 2. ✅
- Repoint `CardLibraryPicker` empty-state link → Task 2. ✅
- `LibraryClient` renders the new tab, keeps Templates/Kits unchanged, `?tab=` + Suspense intact → Task 1. ✅
- Reuse Pro infra; no lucide wildcard (explicit `PROVIDER_ICONS`/`KIT_ICONS`) → Tasks 1. ✅
- Out of scope (card system, gate model, Templates/Kits behavior) → untouched. ✅

**Placeholder scan:** No "TBD"/"handle errors"/uncoded steps — full file contents and exact edits given.

**Type consistency:** `LibraryAppsTab` is self-contained (no props); `LibraryClient` imports it by name. `listedApps()`/`CardProviderConfig.icon`/`defaultData`, `GET/POST/DELETE /api/card-library`, and `isPro`/`ProBadge`/`UpgradePrompt` signatures all match existing code. `LibItem` shape (`id, provider, name`) matches the API.

## Notes
- Live add/remove/use round-trips in the unified grid exercise the same `POST`/`DELETE /api/card-library` already proven; the controller can re-verify with a minted session if desired, but the new code is UI wiring over proven endpoints.
- After Task 1, `/apps` (AppsClient) still works (redundant) so the app is never broken between tasks; Task 2 removes it.

# Library: Templates + Kits tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Library's Templates and Kits tabs live — browsable galleries where "Use" creates a new page from a curated template or an existing kit, gated per-item by Pro.

**Architecture:** A new template registry (curated seed `sections`) mirrors the existing kit registry. `POST /api/displays` gains a `templateId` branch and Pro-gates Pro kits/templates (403). `LibraryClient` renders the two galleries and calls that endpoint on "Use". Reuses the Apps-spec Pro infra (`isPro`, `ProBadge`, `UpgradePrompt`).

**Tech Stack:** Next.js 14 App Router, TypeScript, React 18, Zustand, Prisma, Tailwind, Vitest, lucide-react.

## Global Constraints

- All 7 kits are Pro (`pro: true`); the 5 starter templates are free (no `pro`). The gate keys off each item's `pro` flag.
- Pro gate is the single helper `isPro(user)` (`src/lib/plan.ts`) — no scattered `plan === 'pro'`.
- Interaction model: gallery → "Use" creates a page now via `POST /api/displays`; no "collect/download" step.
- Free users browse everything; only "Use" on a `pro` item gates (client `UpgradePrompt` + server 403). Blank-page creation (no kit/template) stays free.
- `useSearchParams` requires a Suspense boundary — `library/page.tsx` must wrap `<LibraryClient />` in `<Suspense>`.
- Kit registration is populated by importing the kit modules; route them through one central module `src/lib/kits/all.ts` (this also fixes the currently-missing `business-kit` import in the displays route).
- Copy says "My Galli", never bare "Galli". Template covers are gradient + emoji (no new image assets).
- Commit only explicit paths — the repo has stray untracked files (`Documents/`, `Images/`, `g1t.json`, `nul`) and a modified `.claude/settings.local.json` that must never be committed. Never `git add .`/`-A`/`git add src`.

**Shared shapes (from `src/lib/types/canvas.ts`):**
- `Section { id: string; layout: 'full-width'|'two-column'|'three-column'; columns: Column[] }`
- `Column { id: string; elements: CanvasElement[]; settings?: ColumnSettings }`
- `CanvasElement { id: string; type: ElementType; ...optional per type }` — only `id` + `type` required.
- Element field defaults used here: `heading {content, level}`, `text {content}`, `image {url, alt, caption}`, `button {buttonText, buttonUrl, buttonVariant:'solid', buttonColor:'blue', buttonAlign}`, `list {listType:'bulleted', listTitle, listColumns:1, items:[]}`, `quote {quoteText, quoteAuthor}`.

---

### Task 1: Template registry + 5 starter templates

**Files:**
- Create: `src/lib/templates/registry.ts`
- Create: `src/__tests__/templates-registry.test.ts`

**Interfaces:**
- Produces: `TemplateConfig` (`{ id, name, description, category, emoji, gradient, pro?, seed: { sections: Section[]; headerCard?: unknown; tabs?: unknown } }`), `TEMPLATE_REGISTRY: Record<string, TemplateConfig>`, `listTemplates(): TemplateConfig[]`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/templates-registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { listTemplates, TEMPLATE_REGISTRY } from '@/lib/templates/registry'

describe('template registry', () => {
  it('exposes the 5 starter templates', () => {
    const ids = listTemplates().map((t) => t.id)
    expect(ids).toEqual(
      expect.arrayContaining(['link-in-bio', 'travel-itinerary', 'reading-list', 'bucket-list', 'event-invite']),
    )
    expect(listTemplates()).toHaveLength(5)
  })
  it('every template has non-empty seed sections', () => {
    for (const t of listTemplates()) {
      expect(Array.isArray(t.seed.sections)).toBe(true)
      expect(t.seed.sections.length).toBeGreaterThan(0)
    }
  })
  it('starter templates are all free', () => {
    expect(listTemplates().every((t) => !t.pro)).toBe(true)
    expect(TEMPLATE_REGISTRY['link-in-bio'].pro).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/templates-registry.test.ts`
Expected: FAIL — cannot resolve `@/lib/templates/registry`.

- [ ] **Step 3: Create the registry**

Create `src/lib/templates/registry.ts`:

```ts
import type { CanvasElement, Section } from '@/lib/types/canvas'

export interface TemplateConfig {
  id: string
  name: string
  description: string
  category: string
  emoji: string
  gradient: string
  pro?: boolean
  seed: {
    sections: Section[]
    headerCard?: unknown
    tabs?: unknown
  }
}

// Authoring helpers — deterministic ids so seeds are stable/testable.
let _n = 0
function el(e: Partial<CanvasElement> & { type: CanvasElement['type'] }): CanvasElement {
  _n += 1
  return { id: `tpl-el-${_n}`, ...e } as CanvasElement
}
function sec(elements: CanvasElement[]): Section {
  _n += 1
  return { id: `tpl-sec-${_n}`, layout: 'full-width', columns: [{ id: `tpl-col-${_n}`, elements }] }
}
const btn = (text: string) =>
  el({ type: 'button', buttonText: text, buttonUrl: '', buttonVariant: 'solid', buttonColor: 'blue', buttonAlign: 'center' })

export const TEMPLATE_REGISTRY: Record<string, TemplateConfig> = {
  'link-in-bio': {
    id: 'link-in-bio',
    name: 'Link-in-Bio',
    description: 'A clean profile with a stack of links — perfect for your social bio.',
    category: 'personal',
    emoji: '🔗',
    gradient: 'from-galli/30 to-galli-aqua/20',
    seed: {
      sections: [
        sec([
          el({ type: 'image', url: '', alt: 'Your photo', caption: '' }),
          el({ type: 'heading', content: 'Your Name', level: 1 }),
          el({ type: 'text', content: 'A short bio about you and what you make.' }),
        ]),
        sec([btn('My Website'), btn('Latest Project'), btn('Contact Me')]),
      ],
    },
  },
  'travel-itinerary': {
    id: 'travel-itinerary',
    name: 'Travel Itinerary',
    description: 'Plan and share a trip day by day, with a photo gallery.',
    category: 'personal',
    emoji: '🗺️',
    gradient: 'from-galli-aqua/30 to-galli/20',
    seed: {
      sections: [
        sec([
          el({ type: 'heading', content: 'Trip Itinerary', level: 1 }),
          el({ type: 'text', content: 'Where we are going and why it will be unforgettable.' }),
        ]),
        sec([
          el({ type: 'heading', content: 'Day by Day', level: 2 }),
          el({ type: 'list', listType: 'numbered', listTitle: 'Plan', listColumns: 1, items: ['Day 1 — Arrive & explore', 'Day 2 — Main adventure', 'Day 3 — Relax & depart'] }),
        ]),
        sec([
          el({ type: 'heading', content: 'Gallery', level: 2 }),
          el({ type: 'image', url: '', alt: 'Trip photo', caption: 'Add your favourite shots here.' }),
        ]),
      ],
    },
  },
  'reading-list': {
    id: 'reading-list',
    name: 'Reading List',
    description: 'Track and recommend books with notes and ratings.',
    category: 'personal',
    emoji: '📚',
    gradient: 'from-amber-300/40 to-galli/20',
    seed: {
      sections: [
        sec([
          el({ type: 'heading', content: 'My Reading List', level: 1 }),
          el({ type: 'text', content: 'Books I loved and what stuck with me.' }),
        ]),
        sec([
          el({ type: 'list', listType: 'bulleted', listTitle: 'Currently Reading', listColumns: 1, items: ['Title — Author'] }),
          el({ type: 'list', listType: 'bulleted', listTitle: 'Finished', listColumns: 1, items: ['Title — Author ★★★★★', 'Title — Author ★★★★☆'] }),
        ]),
      ],
    },
  },
  'bucket-list': {
    id: 'bucket-list',
    name: 'Bucket List',
    description: 'A checklist of goals and dreams, with inspiration.',
    category: 'personal',
    emoji: '✅',
    gradient: 'from-galli-violet/30 to-pink-300/20',
    seed: {
      sections: [
        sec([
          el({ type: 'heading', content: 'My Bucket List', level: 1 }),
          el({ type: 'text', content: 'Everything I want to do, see, and become.' }),
        ]),
        sec([
          el({ type: 'list', listType: 'bulleted', listTitle: 'Goals', listColumns: 2, items: ['See the northern lights', 'Learn to surf', 'Visit Japan', 'Run a marathon'] }),
        ]),
        sec([el({ type: 'image', url: '', alt: 'Inspiration', caption: '' })]),
      ],
    },
  },
  'event-invite': {
    id: 'event-invite',
    name: 'Event Invite',
    description: 'A simple invite page with the details and a call to action.',
    category: 'events',
    emoji: '🎉',
    gradient: 'from-pink-300/40 to-galli-violet/20',
    seed: {
      sections: [
        sec([
          el({ type: 'heading', content: "You're Invited", level: 1 }),
          el({ type: 'text', content: 'Join us for a celebration to remember.' }),
        ]),
        sec([
          el({ type: 'list', listType: 'bulleted', listTitle: 'Details', listColumns: 1, items: ['When — Date & time', 'Where — Venue & address', 'Dress — Theme'] }),
          el({ type: 'image', url: '', alt: 'Event', caption: '' }),
        ]),
        sec([btn('RSVP')]),
      ],
    },
  },
}

export function listTemplates(): TemplateConfig[] {
  return Object.values(TEMPLATE_REGISTRY)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/templates-registry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/templates/registry.ts src/__tests__/templates-registry.test.ts
git commit -m "feat(templates): curated template registry + 5 free starter templates"
```

---

### Task 2: Kit Pro flag + central registration + listKits()

**Files:**
- Modify: `src/lib/kits/registry.ts` (add `pro?` to `KitConfig`, add `listKits()`)
- Create: `src/lib/kits/all.ts`
- Modify: `src/lib/kits/{athlete,resume,wedding,creative,creator,academic,business}-kit.ts` (add `pro: true`)
- Create: `src/__tests__/kits-pro.test.ts`

**Interfaces:**
- Consumes: existing `KIT_REGISTRY`, `registerKit`, `KitConfig`.
- Produces: `KitConfig.pro?: boolean`, `listKits(): KitConfig[]`, and `src/lib/kits/all.ts` whose import populates `KIT_REGISTRY` with all 7 kits.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/kits-pro.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import '@/lib/kits/all'
import { listKits } from '@/lib/kits/registry'

describe('kits Pro flag', () => {
  it('registers all 7 kits', () => {
    expect(listKits()).toHaveLength(7)
  })
  it('marks every kit as Pro', () => {
    expect(listKits().every((k) => k.pro === true)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/kits-pro.test.ts`
Expected: FAIL — `@/lib/kits/all` not found and/or `listKits` not exported.

- [ ] **Step 3: Add `pro?` and `listKits()` to the registry**

In `src/lib/kits/registry.ts`, add `pro?: boolean` to the `KitConfig` interface (after `defaultHeaderCard: {...}`):

```ts
  pro?: boolean
```

At the end of `src/lib/kits/registry.ts`, add:

```ts
export function listKits(): KitConfig[] {
  return Object.values(KIT_REGISTRY)
}
```

- [ ] **Step 4: Create the central registration module**

Create `src/lib/kits/all.ts`:

```ts
// Importing this module registers every kit into KIT_REGISTRY. Consumers that
// need the full kit list (API route, Library) should import this — not the
// individual kit files — so registration stays complete and consistent.
import './athlete-kit'
import './resume-kit'
import './wedding-kit'
import './creative-kit'
import './creator-kit'
import './academic-kit'
import './business-kit'
```

- [ ] **Step 5: Mark each kit Pro**

In each of the 7 files `src/lib/kits/{athlete,resume,wedding,creative,creator,academic,business}-kit.ts`, add `pro: true,` to the exported kit object (place it right after the `id:` line). Example for `creative-kit.ts`:

```ts
export const CREATIVE_KIT: KitConfig = {
  id: 'creative',
  pro: true,
  name: 'Personal Creative Kit',
```

Do the same for `ATHLETE_KIT`, `RESUME_KIT`, `WEDDING_KIT`, `CREATOR_KIT`, `ACADEMIC_KIT`, `BUSINESS_KIT`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/__tests__/kits-pro.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/kits/registry.ts src/lib/kits/all.ts src/lib/kits/athlete-kit.ts src/lib/kits/resume-kit.ts src/lib/kits/wedding-kit.ts src/lib/kits/creative-kit.ts src/lib/kits/creator-kit.ts src/lib/kits/academic-kit.ts src/lib/kits/business-kit.ts src/__tests__/kits-pro.test.ts
git commit -m "feat(kits): pro flag on all 7 kits + central all.ts registration + listKits()"
```

---

### Task 3: Create-from-template + Pro enforcement in `POST /api/displays`

**Files:**
- Modify: `src/app/api/displays/route.ts`

**Interfaces:**
- Consumes: `isPro` (Task —, from prior spec), `TEMPLATE_REGISTRY` (Task 1), `KIT_REGISTRY` + `src/lib/kits/all.ts` (Task 2).
- Produces: `POST /api/displays` accepts `templateId`; returns 403 for a Pro kit/template requested by a free user.

- [ ] **Step 1: Update imports**

In `src/app/api/displays/route.ts`, replace the six individual kit imports:

```ts
import '@/lib/kits/athlete-kit'
import '@/lib/kits/resume-kit'
import '@/lib/kits/wedding-kit'
import '@/lib/kits/creator-kit'
import '@/lib/kits/creative-kit'
import '@/lib/kits/academic-kit'
```

with the central registration + the new imports:

```ts
import '@/lib/kits/all'
import { TEMPLATE_REGISTRY } from '@/lib/templates/registry'
import { isPro } from '@/lib/plan'
```

(Keep the existing `import { KIT_REGISTRY } from '@/lib/kits/registry'` and `import { generateKitDisplay } from '@/lib/kits/generate'`.)

- [ ] **Step 2: Destructure `templateId` and seed from kit OR template, gating Pro**

In the `POST` handler, change the destructure line:

```ts
    const { title, description, kitId } = await request.json()
```

to:

```ts
    const { title, description, kitId, templateId } = await request.json()
```

Then replace the existing kit-seed block:

```ts
    // If kitId is provided, generate kit structure
    let kitData: any = {}
    if (kitId) {
      const kit = KIT_REGISTRY[kitId]
      if (!kit) {
        return NextResponse.json({ error: 'Unknown kit' }, { status: 400 })
      }
      const generated = generateKitDisplay(kit, user.name || user.username)
      kitData = {
        sections: generated.sections,
        tabs: generated.tabs,
        headerCard: generated.headerCard,
        kitConfig: generated.kitConfig,
      }
    }
```

with (handles kit, template, and the Pro gate):

```ts
    // Seed from a kit or a template; Pro items require a Pro plan.
    let kitData: any = {}
    if (kitId) {
      const kit = KIT_REGISTRY[kitId]
      if (!kit) {
        return NextResponse.json({ error: 'Unknown kit' }, { status: 400 })
      }
      if (kit.pro && !isPro(user)) {
        return NextResponse.json({ error: 'Pro required' }, { status: 403 })
      }
      const generated = generateKitDisplay(kit, user.name || user.username)
      kitData = {
        sections: generated.sections,
        tabs: generated.tabs,
        headerCard: generated.headerCard,
        kitConfig: generated.kitConfig,
      }
    } else if (templateId) {
      const template = TEMPLATE_REGISTRY[templateId]
      if (!template) {
        return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
      }
      if (template.pro && !isPro(user)) {
        return NextResponse.json({ error: 'Pro required' }, { status: 403 })
      }
      kitData = {
        sections: template.seed.sections,
        tabs: template.seed.tabs,
        headerCard: template.seed.headerCard,
      }
    }
```

(The existing `db.display.create` block already spreads `kitData.sections`/`tabs`/`headerCard`/`kitConfig`, so no change there — `kitConfig` is simply absent for templates.)

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Sanity-check the endpoint**

With the dev server running:
- Unauthenticated create still rejected: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/displays -H 'Content-Type: application/json' -d '{"title":"x","templateId":"link-in-bio"}'` → expect **401**.
- (The authenticated 403 for a Pro kit/free user, and the 201 happy path, are verified by the controller/reviewer — they need a session cookie this shell can't mint. The gate logic is confirmed by code review + the `isPro` unit tests + this 401 ordering.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/displays/route.ts
git commit -m "feat(displays): seed from templateId + Pro-gate pro kits/templates (403)"
```

---

### Task 4: Library galleries (Templates + Kits) + ?tab deep-link + /new-kit redirect

**Files:**
- Modify: `src/components/library/LibraryClient.tsx` (full rewrite below)
- Modify: `src/app/(dashboard)/library/page.tsx` (Suspense wrap)
- Modify: `src/app/(dashboard)/new-kit/page.tsx` (redirect)

**Interfaces:**
- Consumes: `listTemplates()` (Task 1), `listKits()` + `@/lib/kits/all` (Task 2), `POST /api/displays {templateId|kitId}` (Task 3), `isPro`, `ProBadge`, `UpgradePrompt`, `useRefreshUser` (existing).

- [ ] **Step 1: Rewrite LibraryClient with live Templates + Kits galleries**

Replace the entire contents of `src/components/library/LibraryClient.tsx` with:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import * as Icons from 'lucide-react'
import { Trash2, Layers, Plus } from 'lucide-react'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import { listTemplates } from '@/lib/templates/registry'
import { listKits } from '@/lib/kits/registry'
import '@/lib/kits/all'
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { useRefreshUser } from '@/lib/use-refresh-user'
import { ProBadge } from '@/components/pro/ProBadge'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

interface LibItem {
  id: string
  provider: string
  name: string
}

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

function LucideIcon({ name, className }: { name?: string; className?: string }) {
  const Cmp = (name && (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name]) || Icons.Layers
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
  const [items, setItems] = useState<LibItem[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/card-library')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: LibItem[]) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const remove = async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/card-library/${id}`, { method: 'DELETE' })
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id))
      else setError('Could not remove that item. Please try again.')
    } catch {
      setError('Could not remove that item. Please try again.')
    }
  }

  const handleUseApp = () => {
    if (!pro) { setUpgradeOpen(true); return }
    router.push('/editor')
  }

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

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {tab === 'apps' ? (
        loading ? (
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
                    <button onClick={handleUseApp} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90">
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
        )
      ) : (
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
      )}

      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="This" />
    </div>
  )
}
```

- [ ] **Step 2: Wrap the page in Suspense (required by useSearchParams)**

Replace the contents of `src/app/(dashboard)/library/page.tsx` with:

```tsx
import { Suspense } from 'react'
import { LibraryClient } from '@/components/library/LibraryClient'

export const metadata = { title: 'Library' }

export default function LibraryPage() {
  return (
    <Suspense fallback={<div />}>
      <LibraryClient />
    </Suspense>
  )
}
```

- [ ] **Step 3: Redirect the orphaned /new-kit to the Library Kits tab**

Replace the contents of `src/app/(dashboard)/new-kit/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'

// The kit gallery now lives in the Library. Its previous standalone
// implementation is preserved in git history.
export default function NewKitPage() {
  redirect('/library?tab=kits')
}
```

- [ ] **Step 4: Verify it compiles and renders**

Run: `npx tsc --noEmit -p tsconfig.json` → no new errors.
With the dev server running, check (200 or 307-to-login both mean the route compiled & rendered; 500 is a real error):
```bash
for p in "/library?tab=templates" "/library?tab=kits" "/new-kit"; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000$p")"
done
```
Then, signed in, click a free template's **Use** → a new page is created and the editor opens; click a kit's **Use** as a free user → the `UpgradePrompt` appears.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all pass (including `templates-registry` and `kits-pro`).

- [ ] **Step 6: Commit**

```bash
git add "src/components/library/LibraryClient.tsx" "src/app/(dashboard)/library/page.tsx" "src/app/(dashboard)/new-kit/page.tsx"
git commit -m "feat(library): live Templates + Kits galleries, ?tab deep-link, /new-kit redirect"
```

---

## Self-Review

**Spec coverage:**
- Template registry + 5 free starter templates with seed content → Task 1. ✅
- Kits all Pro + `listKits()` + central registration (fixes missing business-kit) → Task 2. ✅
- `POST /api/displays` templateId + Pro 403 (blank stays free) → Task 3. ✅
- Library Templates/Kits galleries, per-item Pro badge + gate, "Use" creates page, `?tab` deep-link, Suspense → Task 4. ✅
- `/new-kit` → `/library?tab=kits` redirect → Task 4. ✅
- Reuse `isPro`/`ProBadge`/`UpgradePrompt`/`useRefreshUser` → Tasks 3, 4. ✅
- Out-of-scope (user-saved templates, cover uploads, landing repoint, billing) → not implemented, by design. ✅

**Placeholder scan:** No "TBD"/"handle errors"/uncoded steps — every code step is complete. Seed content is fully authored in Task 1.

**Type consistency:** `TemplateConfig`/`listTemplates()` (Task 1) match their use in Tasks 3–4; `KitConfig.pro`/`listKits()` (Task 2) match Tasks 3–4; the `Starter` shape is internal to Task 4; `POST /api/displays` body `{templateId|kitId}` matches between Task 3 (server) and Task 4 (client); `isPro(user)` signature consistent.

## Notes
- Live authenticated 403/201 round-trips for the create endpoint are verified by the controller/reviewer (the shell can't mint a session cookie in this env); the gate is covered by `isPro` unit tests + code review + the 401 ordering check.
- Premium templates later = set `pro: true` on a `TemplateConfig`; the gate and badge already handle it.

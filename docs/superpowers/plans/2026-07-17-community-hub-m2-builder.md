# Community Hub M2 — The Hub Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give community-hub owners a dedicated **Builder** — left settings nav + embedded live preview + autosaved `Hub.config` — that drives the public `CommunityHubView` (toggle/reorder sidebar widgets, feed settings, who-can-post).

**Architecture:** A single live `Hub.config` JSON (autosaved via PATCH with `version` optimistic concurrency, mirroring `PageEditor` — no draft/publish staging). `/hubs/[id]` renders `HubBuilder` for community hubs (data-room `HubEditor` unchanged otherwise). `CommunityHubView` becomes config-driven with a `DEFAULT_HUB_CONFIG` fallback so existing communities never regress. `sanitizeHubConfig` guards every read and write.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma/PostgreSQL, Tailwind, Vitest (+ jsdom/RTL).

## Global Constraints
- **Spec:** `docs/superpowers/specs/2026-07-17-community-hub-m2-builder-design.md`. This plan implements **M2 only**.
- **Base:** branch `feat/community-m2` off `main` @ `4d837cd` (M1 live). Work in the worktree `C:\Users\whirl\pages-mvp\.claude\worktrees\community-m2`.
- **Config is authoritative but untrusted:** `sanitizeHubConfig(raw)` runs on BOTH write (PATCH) and read (server page) and ALWAYS returns a valid `HubConfig`. `Hub.config === null` ⇒ `DEFAULT_HUB_CONFIG` (= exact M1 behavior).
- **No draft staging:** edits autosave to the one live config; Publish/Unpublish is the M1 `Hub.published` visibility toggle only.
- **who-can-post enforced server-side** in the posts POST, not just hidden in UI.
- **Sidebar widget keys (exact):** `'members' | 'resources' | 'video'`. **whoCanPost (exact):** `'members' | 'owner-only'`.
- **Migrations non-interactive:** hand-author `migration.sql`, `prisma migrate deploy` with `DATABASE_URL`+`DATABASE_URL_UNPOOLED` set inline (fresh DB `pages_m2`; the shared `pages` DB is drifted). Windows: stop dev before `prisma generate`; `127.0.0.1` not `localhost`.
- **Lint gates prod build:** run `pnpm exec next lint`; escape apostrophes (`&apos;`), `<Link>` for internal static routes. A pre-existing `.eslintrc.json` plugin-conflict warning makes `next lint` exit 1 with zero real findings — distinguish it.
- Never commit `Documents/`, `Images/`, `g1t.json`, `nul`, `.env`, `.claude/settings.local.json`.

## File structure
- **New lib:** `src/lib/types/hub-config.ts` (types + `DEFAULT_HUB_CONFIG`), `src/lib/hub-config.ts` (`sanitizeHubConfig`, `canPostWithAccess`, `buildHubPayloadKey`).
- **New hook:** `src/hooks/useHubAutosave.ts`.
- **New builder components:** `src/components/hub/builder/{HubBuilder,HubBuilderNav,HubBuilderSaveBar,HubBuilderPreview,HubSettingsSection,LayoutSectionsSection,HubProfileSection,CommunitySettingsSection}.tsx`.
- **Changed:** `prisma/schema.prisma` (`Hub.config`,`Hub.version`), `src/app/api/hubs/[id]/route.ts` (PATCH config+version+409), `src/app/api/hubs/[id]/posts/route.ts` (who-can-post), `src/app/(dashboard)/hubs/[id]/page.tsx` (branch), `src/components/hub/community/{CommunityHubView,CommunitySidebar,CommunityFeed}.tsx` (config-driven), `src/app/[username]/hub/[slug]/page.tsx` (pass config).

---

### Task 1: Config types + pure helpers (`hub-config`)

**Files:**
- Create: `src/lib/types/hub-config.ts`, `src/lib/hub-config.ts`, `src/lib/hub-config.test.ts`

**Interfaces:**
- Produces: `type HubConfig`, `type HubSidebarWidget`, `HUB_SIDEBAR_KEYS`, `DEFAULT_HUB_CONFIG`, `sanitizeHubConfig(raw): HubConfig`, `canPostWithAccess({ canParticipate, whoCanPost, isPrivileged }): boolean`, `buildHubPayloadKey(payload): string`.

- [ ] **Step 1: Write the failing test** `src/lib/hub-config.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_HUB_CONFIG } from './types/hub-config'
import { sanitizeHubConfig, canPostWithAccess, buildHubPayloadKey } from './hub-config'

describe('sanitizeHubConfig', () => {
  it('null/garbage → default config', () => {
    expect(sanitizeHubConfig(null)).toEqual(DEFAULT_HUB_CONFIG)
    expect(sanitizeHubConfig('nope')).toEqual(DEFAULT_HUB_CONFIG)
    expect(sanitizeHubConfig(42)).toEqual(DEFAULT_HUB_CONFIG)
  })
  it('keeps valid sidebar order + enabled, drops unknown keys, dedupes, and fills missing widgets', () => {
    const out = sanitizeHubConfig({
      sidebar: [{ key: 'video', enabled: false }, { key: 'bogus', enabled: true }, { key: 'video', enabled: true }],
      feed: { composerEnabled: false, loadMoreEnabled: true, emptyStateText: 'x'.repeat(500) },
      access: { whoCanPost: 'owner-only' },
    })
    // video first (from input, first occurrence wins), then the missing members+resources appended enabled
    expect(out.sidebar.map((s) => s.key)).toEqual(['video', 'members', 'resources'])
    expect(out.sidebar[0]).toEqual({ key: 'video', enabled: false })
    expect(out.feed.composerEnabled).toBe(false)
    expect(out.feed.emptyStateText!.length).toBeLessThanOrEqual(200)
    expect(out.access.whoCanPost).toBe('owner-only')
  })
  it('coerces invalid whoCanPost + non-boolean flags to defaults', () => {
    const out = sanitizeHubConfig({ feed: { composerEnabled: 'yes' }, access: { whoCanPost: 'anyone' } })
    expect(out.access.whoCanPost).toBe('members')
    expect(out.feed.composerEnabled).toBe(true)
  })
})

describe('canPostWithAccess', () => {
  it("members mode = base canParticipate", () => {
    expect(canPostWithAccess({ canParticipate: true, whoCanPost: 'members', isPrivileged: false })).toBe(true)
    expect(canPostWithAccess({ canParticipate: false, whoCanPost: 'members', isPrivileged: false })).toBe(false)
  })
  it('owner-only mode = privileged only, even for members', () => {
    expect(canPostWithAccess({ canParticipate: true, whoCanPost: 'owner-only', isPrivileged: false })).toBe(false)
    expect(canPostWithAccess({ canParticipate: true, whoCanPost: 'owner-only', isPrivileged: true })).toBe(true)
  })
})

describe('buildHubPayloadKey', () => {
  it('is stable regardless of key order', () => {
    expect(buildHubPayloadKey({ a: 1, b: 2 })).toBe(buildHubPayloadKey({ b: 2, a: 1 }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/hub-config.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement types** `src/lib/types/hub-config.ts`:

```ts
export const HUB_SIDEBAR_KEYS = ['members', 'resources', 'video'] as const
export type HubSidebarKey = (typeof HUB_SIDEBAR_KEYS)[number]
export type HubSidebarWidget = { key: HubSidebarKey; enabled: boolean }
export type HubWhoCanPost = 'members' | 'owner-only'

export type HubConfig = {
  sidebar: HubSidebarWidget[]
  feed: { composerEnabled: boolean; loadMoreEnabled: boolean; emptyStateText?: string }
  access: { whoCanPost: HubWhoCanPost }
}

export const DEFAULT_HUB_CONFIG: HubConfig = {
  sidebar: [
    { key: 'members', enabled: true },
    { key: 'resources', enabled: true },
    { key: 'video', enabled: true },
  ],
  feed: { composerEnabled: true, loadMoreEnabled: true },
  access: { whoCanPost: 'members' },
}
```

- [ ] **Step 4: Implement helpers** `src/lib/hub-config.ts`:

```ts
import {
  HUB_SIDEBAR_KEYS,
  DEFAULT_HUB_CONFIG,
  type HubConfig,
  type HubSidebarKey,
  type HubWhoCanPost,
} from './types/hub-config'

const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

// Always returns a valid HubConfig. Preserves the caller's sidebar order for
// known keys (first occurrence wins), appends any missing widgets enabled, and
// coerces every field. Runs on both write and read so a bad payload can never
// break the public render.
export function sanitizeHubConfig(raw: unknown): HubConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>

  const seen = new Set<HubSidebarKey>()
  const sidebar: HubConfig['sidebar'] = []
  if (Array.isArray(r.sidebar)) {
    for (const w of r.sidebar) {
      const key = w?.key
      if ((HUB_SIDEBAR_KEYS as readonly string[]).includes(key) && !seen.has(key)) {
        seen.add(key)
        sidebar.push({ key, enabled: bool(w?.enabled, true) })
      }
    }
  }
  for (const key of HUB_SIDEBAR_KEYS) {
    if (!seen.has(key)) sidebar.push({ key, enabled: true })
  }

  const feedRaw = (r.feed && typeof r.feed === 'object' ? r.feed : {}) as Record<string, any>
  const emptyStateText =
    typeof feedRaw.emptyStateText === 'string' ? feedRaw.emptyStateText.slice(0, 200) : undefined

  const whoCanPost: HubWhoCanPost = r.access?.whoCanPost === 'owner-only' ? 'owner-only' : 'members'

  return {
    sidebar,
    feed: {
      composerEnabled: bool(feedRaw.composerEnabled, DEFAULT_HUB_CONFIG.feed.composerEnabled),
      loadMoreEnabled: bool(feedRaw.loadMoreEnabled, DEFAULT_HUB_CONFIG.feed.loadMoreEnabled),
      ...(emptyStateText !== undefined ? { emptyStateText } : {}),
    },
    access: { whoCanPost },
  }
}

export function canPostWithAccess(input: {
  canParticipate: boolean
  whoCanPost: HubWhoCanPost
  isPrivileged: boolean
}): boolean {
  if (input.whoCanPost === 'owner-only') return input.isPrivileged
  return input.canParticipate
}

// Stable stringify (sorted keys) so autosave can skip identical payloads.
export function buildHubPayloadKey(payload: unknown): string {
  return JSON.stringify(payload, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}
```

- [ ] **Step 4b: Note** — the test caps `emptyStateText` at 200; the sanitizer slices to 200. The test passes a 500-char string and asserts `<= 200`. ✓

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/hub-config.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/hub-config.ts src/lib/hub-config.ts src/lib/hub-config.test.ts
git commit -m "feat(hub-builder): HubConfig types + sanitize/access/payload helpers"
```

---

### Task 2: Schema + migration (`Hub.config`, `Hub.version`)

**Files:**
- Modify: `prisma/schema.prisma` (`model Hub`)
- Create: `prisma/migrations/20260718000000_hub_config/migration.sql`

**Interfaces:**
- Produces: `Hub.config Json?`, `Hub.version Int @default(0)`.

- [ ] **Step 1: Add fields** to `model Hub` (after `heroVideoUrl`):

```prisma
  heroVideoUrl String?
  config      Json?
  version     Int      @default(0)
```

- [ ] **Step 2: Hand-author migration** `prisma/migrations/20260718000000_hub_config/migration.sql`:

```sql
ALTER TABLE "Hub" ADD COLUMN "config" JSONB;
ALTER TABLE "Hub" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 3: Apply to a fresh DB + regenerate**

```bash
docker exec pages-mvp-postgres-1 psql -U pages -d pages -c "DROP DATABASE IF EXISTS pages_m2 WITH (FORCE);" -c "CREATE DATABASE pages_m2;"
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages_m2" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages_m2"
pnpm exec prisma migrate deploy && pnpm exec prisma generate
```
Expected: "All migrations have been successfully applied." + client generated.

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260718000000_hub_config
git commit -m "feat(hub-builder): Hub.config + Hub.version columns"
```

---

### Task 3: PATCH accepts `config` + `version` (optimistic 409)

**Files:**
- Modify: `src/app/api/hubs/[id]/route.ts` (PATCH)
- Test: `src/app/api/hubs/[id]/route.test.ts` (create)

**Interfaces:**
- Consumes: `sanitizeHubConfig` (`@/lib/hub-config`).
- Produces: PATCH accepts `config` (sanitized) and `version` (if provided and `!== hub.version` → 409); on success `version` is incremented and returned.

- [ ] **Step 1: Write the failing test** `src/app/api/hubs/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { hub: { findUnique: vi.fn(), update: vi.fn() } } }))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { PATCH } from './route'

const ctx = { params: Promise.resolve({ id: 'h1' }) }
const req = (body: unknown) => new Request('http://localhost/api/hubs/h1', { method: 'PATCH', body: JSON.stringify(body) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', version: 3 })
  ;(db.hub.update as any).mockImplementation(async ({ data }: any) => ({ id: 'h1', ...data }))
})

describe('PATCH /api/hubs/[id] — config + version', () => {
  it('409 when version is stale', async () => {
    const res = await PATCH(req({ config: {}, version: 2 }), ctx)
    expect(res.status).toBe(409)
    expect(db.hub.update).not.toHaveBeenCalled()
  })
  it('sanitizes config, bumps version, returns updated hub', async () => {
    const res = await PATCH(req({ config: { access: { whoCanPost: 'owner-only' } }, version: 3 }), ctx)
    expect(res.status).toBe(200)
    const arg = (db.hub.update as any).mock.calls[0][0]
    expect(arg.data.version).toBe(4)
    expect(arg.data.config.access.whoCanPost).toBe('owner-only')
    expect(arg.data.config.sidebar).toHaveLength(3) // sanitized to full widget set
  })
  it('404 for non-owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    expect((await PATCH(req({ config: {} }), ctx)).status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/route.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement** — in `src/app/api/hubs/[id]/route.ts` PATCH, add the import `import { sanitizeHubConfig } from '@/lib/hub-config'` and, inside PATCH after the existing allowlist assignments and before `db.hub.update`:

```ts
  if (typeof body.heroVideoUrl === 'string') data.heroVideoUrl = body.heroVideoUrl.trim().slice(0, 500)
  if ('config' in body) data.config = sanitizeHubConfig(body.config) as unknown as object
  if (typeof body.version === 'number' && body.version !== r.hub.version) {
    return NextResponse.json({ error: 'Conflict', version: r.hub.version }, { status: 409 })
  }
  if (typeof body.version === 'number') data.version = r.hub.version + 1
```
(Adjust to reference the loaded hub — `ownHub` returns `{ me, hub }` as `r`; use `r.hub.version`. The `data` object and `db.hub.update({ where:{id}, data })` already exist.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/route.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/route.ts" "src/app/api/hubs/[id]/route.test.ts"
git commit -m "feat(hub-builder): PATCH accepts sanitized config + optimistic version"
```

---

### Task 4: who-can-post enforcement in posts POST

**Files:**
- Modify: `src/app/api/hubs/[id]/posts/route.ts` (POST)
- Test: `src/app/api/hubs/[id]/posts/route.test.ts` (add cases)

**Interfaces:**
- Consumes: `sanitizeHubConfig`, `canPostWithAccess` (`@/lib/hub-config`).
- Produces: a non-privileged member posting to an `owner-only` community gets 403.

- [ ] **Step 1: Write the failing test** — add to `src/app/api/hubs/[id]/posts/route.test.ts`. In the `db.hub.findUnique` mock for POST, the HUB must now also carry `config`. Add a case:

```ts
describe('POST /api/hubs/[id]/posts — who-can-post', () => {
  it('403 when community is owner-only and caller is a plain member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({ ...HUB, config: { access: { whoCanPost: 'owner-only' } } })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem' }) // is a member
    ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
    const res = await POST(req({ text: 'hi' }), ctx)
    expect(res.status).toBe(403)
  })
  it('owner can still post to an owner-only community', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'O', username: 'hubowner', avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({ ...HUB, config: { access: { whoCanPost: 'owner-only' } } })
    const res = await POST(req({ text: 'hi' }), ctx)
    expect(res.status).toBe(201)
  })
})
```
(Ensure the existing HUB fixture and `db.hub.findUnique` select include nothing that breaks; the POST handler will select `config` — see Step 3.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/posts/route.test.ts" -t who-can-post`
Expected: FAIL (member currently allowed → 201).

- [ ] **Step 3: Implement** — in `src/app/api/hubs/[id]/posts/route.ts` POST:

Add imports: `import { sanitizeHubConfig, canPostWithAccess } from '@/lib/hub-config'`.

Add `config: true` to the `db.hub.findUnique` select (the POST one, ~line 96-99).

Replace the participation gate block:
```ts
  if (!canParticipate(me.id, hub, collabIds, isMember)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```
with:
```ts
  const isPrivileged = me.id === hub.userId || collabIds.includes(me.id)
  const base = canParticipate(me.id, hub, collabIds, isMember)
  const whoCanPost = sanitizeHubConfig(hub.config).access.whoCanPost
  if (!canPostWithAccess({ canParticipate: base, whoCanPost, isPrivileged })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/posts/route.test.ts"`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/posts/route.ts" "src/app/api/hubs/[id]/posts/route.test.ts"
git commit -m "feat(hub-builder): enforce who-can-post server-side in posts POST"
```

---

### Task 5: Config-driven public page

**Files:**
- Modify: `src/components/hub/community/CommunityHubView.tsx`, `CommunitySidebar.tsx`, `CommunityFeed.tsx`
- Modify: `src/app/[username]/hub/[slug]/page.tsx` (pass config)

**Interfaces:**
- Consumes: `HubConfig` (`@/lib/types/hub-config`), `sanitizeHubConfig` (`@/lib/hub-config`).
- `CommunityHubView` gains a `config: HubConfig` prop; `CommunitySidebar` gains `config: HubConfig`; `CommunityFeed` gains `config: HubConfig`.

- [ ] **Step 1: `CommunitySidebar` renders per config** — replace its signature + body so it renders sidebar sections in `config.sidebar` order, skipping disabled. New `CommunitySidebar.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { UsersRound, FolderOpen, FileText, LinkIcon } from 'lucide-react'
import { hubVideoEmbed } from '@/lib/hub-video-embed'
import type { HubConfig, HubSidebarKey } from '@/lib/types/hub-config'

type Member = { userId: string; username: string; name: string | null; avatar: string | null }
type Resource = { id: string; type: string; title: string; url: string | null }

export function CommunitySidebar({
  config, heroVideoUrl, members, resources,
}: {
  config: HubConfig
  heroVideoUrl: string | null
  members: Member[]
  resources: Resource[]
}) {
  const [showMembers, setShowMembers] = useState(false)
  const [showResources, setShowResources] = useState(false)
  const embed = hubVideoEmbed(heroVideoUrl)

  const widget = (key: HubSidebarKey) => {
    if (key === 'video') {
      if (!embed) return null
      return (
        <div key="video" className="overflow-hidden rounded-2xl border border-border bg-black">
          {embed.kind === 'file' ? (
            <video src={embed.src} controls className="aspect-video w-full" />
          ) : (
            <iframe src={embed.src} title="Community video" allow="fullscreen; picture-in-picture" className="aspect-video w-full" />
          )}
        </div>
      )
    }
    if (key === 'members') {
      return (
        <section key="members" className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="h-4 w-4 text-primary" /> Members ({members.length})</h3>
            {members.length > 6 && <button onClick={() => setShowMembers(true)} className="text-xs text-primary hover:underline">View all →</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {members.slice(0, 12).map((m) => (
              <span key={m.userId} title={m.name || m.username} className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-galli/30 to-galli-violet/30">
                {m.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt="" className="h-full w-full object-cover" />
                )}
              </span>
            ))}
          </div>
        </section>
      )
    }
    // resources
    if (resources.length === 0) return null
    return (
      <section key="resources" className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><FolderOpen className="h-4 w-4 text-primary" /> Resources</h3>
          {resources.length > 5 && <button onClick={() => setShowResources(true)} className="text-xs text-primary hover:underline">View all →</button>}
        </div>
        <ul className="space-y-2">
          {resources.slice(0, 5).map((r) => (
            <li key={r.id}>
              <a href={r.url || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-primary">
                {r.type === 'link' ? <LinkIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                <span className="truncate">{r.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {config.sidebar.filter((w) => w.enabled).map((w) => widget(w.key))}

      {showMembers && (
        <Modal title={`Members (${members.length})`} onClose={() => setShowMembers(false)}>
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 py-1.5">
              <span className="h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-galli/30 to-galli-violet/30">
                {m.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="text-sm">{m.name || m.username} <span className="text-muted-foreground">@{m.username}</span></span>
            </div>
          ))}
        </Modal>
      )}
      {showResources && (
        <Modal title="Resources" onClose={() => setShowResources(false)}>
          {resources.map((r) => (
            <a key={r.id} href={r.url || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 py-1.5 text-sm hover:text-primary">
              {r.type === 'link' ? <LinkIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
              <span className="truncate">{r.title}</span>
            </a>
          ))}
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {children}
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-border py-2 text-sm">Close</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `CommunityFeed` honors feed config** — change its signature to accept `config` and use `config.feed`:

In `CommunityFeed.tsx`, change props to add `config: HubConfig` (import `HubConfig`), gate the composer on `canPost && config.feed.composerEnabled`, use `config.feed.emptyStateText || 'No posts yet. Be the first to share something.'` for the empty state, and only show any "load more" affordance when `config.feed.loadMoreEnabled` (M2 feed still loads 50; keep behavior, just respect the composer/empty-state/load-more flags). Minimal diff:
```tsx
import type { HubConfig } from '@/lib/types/hub-config'
// props: add `config: HubConfig`
{canPost && config.feed.composerEnabled && <HubPostComposer hubId={hubId} onPosted={load} />}
// empty state text:
<p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{config.feed.emptyStateText || 'No posts yet. Be the first to share something.'}</p>
```

- [ ] **Step 3: `CommunityHubView` threads config** — add `config: HubConfig` to its props; pass `config` to `<CommunityFeed>` and `<CommunitySidebar>`; keep everything else. Import `HubConfig`.

- [ ] **Step 4: Server page passes config** — in `src/app/[username]/hub/[slug]/page.tsx`, in the community branch, compute `const config = sanitizeHubConfig(hub.config)` and pass `config={config}` to `<CommunityHubView>`. Add imports `import { sanitizeHubConfig } from '@/lib/hub-config'`.

- [ ] **Step 5: Typecheck + lint**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec next lint --file src/components/hub/community/CommunityHubView.tsx --file src/components/hub/community/CommunitySidebar.tsx --file src/components/hub/community/CommunityFeed.tsx --file "src/app/[username]/hub/[slug]/page.tsx"
```
Expected: exit 0 (ignore the known pre-existing eslintrc warning).

- [ ] **Step 6: Commit**

```bash
git add src/components/hub/community "src/app/[username]/hub/[slug]/page.tsx"
git commit -m "feat(hub-builder): config-driven CommunityHubView (sidebar order/toggle + feed settings)"
```

---

### Task 6: `useHubAutosave` hook

**Files:**
- Create: `src/hooks/useHubAutosave.ts`, `src/hooks/useHubAutosave.test.ts`

**Interfaces:**
- Consumes: `buildHubPayloadKey` (`@/lib/hub-config`).
- Produces: `useHubAutosave({ hubId, payload, version, enabled }): { saving: boolean; lastSaved: Date | null; conflict: boolean; dirty: boolean }`. Debounced (900ms) PATCH of `{ ...payload, version }`; skips when the payload key is unchanged; on 409 sets `conflict`; on success updates `lastSaved` and the internal version from the response.

- [ ] **Step 1: Write the failing test** `src/hooks/useHubAutosave.test.ts` (RTL renderHook + fake timers + mocked fetch):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useHubAutosave } from './useHubAutosave'

beforeEach(() => { vi.useFakeTimers(); (global as any).fetch = vi.fn() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

const ok = (version: number) => ({ ok: true, status: 200, json: async () => ({ version }) })

describe('useHubAutosave', () => {
  it('debounced-PATCHes the payload with version and records lastSaved', async () => {
    ;(fetch as any).mockResolvedValue(ok(6))
    const { rerender } = renderHook(({ p }) => useHubAutosave({ hubId: 'h1', payload: p, version: 5, enabled: true }), { initialProps: { p: { a: 1 } } })
    rerender({ p: { a: 2 } })
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(fetch).toHaveBeenCalledWith('/api/hubs/h1', expect.objectContaining({ method: 'PATCH' }))
    const body = JSON.parse((fetch as any).mock.calls[0][1].body)
    expect(body.version).toBe(5)
    expect(body.a).toBe(2)
  })
  it('sets conflict on 409', async () => {
    ;(fetch as any).mockResolvedValue({ ok: false, status: 409, json: async () => ({ version: 9 }) })
    const { result, rerender } = renderHook(({ p }) => useHubAutosave({ hubId: 'h1', payload: p, version: 5, enabled: true }), { initialProps: { p: { a: 1 } } })
    rerender({ p: { a: 2 } })
    await act(async () => { vi.advanceTimersByTime(1000) })
    await waitFor(() => expect(result.current.conflict).toBe(true))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/hooks/useHubAutosave.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/hooks/useHubAutosave.ts`:

```ts
'use client'

import { useEffect, useRef, useState } from 'react'
import { buildHubPayloadKey } from '@/lib/hub-config'

export function useHubAutosave({
  hubId, payload, version, enabled = true, delay = 900,
}: {
  hubId: string
  payload: Record<string, unknown>
  version: number
  enabled?: boolean
  delay?: number
}) {
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [conflict, setConflict] = useState(false)
  const [dirty, setDirty] = useState(false)
  const versionRef = useRef(version)
  const lastKeyRef = useRef<string | null>(buildHubPayloadKey(payload))

  useEffect(() => { versionRef.current = version }, [version])

  const key = buildHubPayloadKey(payload)
  useEffect(() => {
    if (!enabled || conflict) return
    if (key === lastKeyRef.current) return
    setDirty(true)
    const t = setTimeout(async () => {
      setSaving(true)
      try {
        const res = await fetch(`/api/hubs/${hubId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, version: versionRef.current }),
        })
        if (res.status === 409) { setConflict(true); return }
        if (res.ok) {
          lastKeyRef.current = key
          const updated = await res.json().catch(() => ({}))
          if (typeof updated.version === 'number') versionRef.current = updated.version
          setLastSaved(new Date())
          setDirty(false)
        }
      } catch { /* keep dirty; will retry on next change */ } finally { setSaving(false) }
    }, delay)
    return () => clearTimeout(t)
  }, [key, enabled, conflict, hubId, delay]) // eslint-disable-line react-hooks/exhaustive-deps

  return { saving, lastSaved, conflict, dirty }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/hooks/useHubAutosave.test.ts`
Expected: PASS (2 tests). If RTL renderHook/timers prove flaky in this env, keep the two assertions minimal and note any adjustment in the report — do not weaken them to tautologies.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useHubAutosave.ts src/hooks/useHubAutosave.test.ts
git commit -m "feat(hub-builder): useHubAutosave debounced PATCH hook with 409 handling"
```

---

### Task 7: Builder shell + nav + save bar + page branch

**Files:**
- Create: `src/components/hub/builder/HubBuilder.tsx`, `HubBuilderNav.tsx`, `HubBuilderSaveBar.tsx`
- Modify: `src/app/(dashboard)/hubs/[id]/page.tsx` (branch community → builder)

**Interfaces:**
- Consumes: `useHubAutosave`, `HubConfig`/`DEFAULT_HUB_CONFIG`/`sanitizeHubConfig`.
- Produces: `<HubBuilder hubId />` (client) — fetches the hub, holds working state, renders nav + active section (sections wired in Tasks 9-10) + preview (Task 8) + save bar.

- [ ] **Step 1: `HubBuilderNav`** `src/components/hub/builder/HubBuilderNav.tsx`:

```tsx
'use client'

import { Settings, LayoutGrid, User, Users, Palette, Boxes, Search } from 'lucide-react'

export type BuilderSection = 'settings' | 'layout' | 'profile' | 'community'

const ITEMS: { key: BuilderSection; label: string; sub: string; icon: any; enabled: boolean }[] = [
  { key: 'settings', label: 'Hub Settings', sub: 'Manage the basics', icon: Settings, enabled: true },
  { key: 'layout', label: 'Layout & Sections', sub: 'Customize what appears', icon: LayoutGrid, enabled: true },
  { key: 'profile', label: 'Hub Profile', sub: "Your hub's identity", icon: User, enabled: true },
  { key: 'community', label: 'Community Settings', sub: 'Permissions & access', icon: Users, enabled: true },
]
const SOON: { label: string; sub: string; icon: any }[] = [
  { label: 'Appearance', sub: 'Themes, colors & visuals', icon: Palette },
  { label: 'Widgets & Tools', sub: 'Top utility widgets', icon: Boxes },
  { label: 'SEO & Sharing', sub: 'Optimize & share', icon: Search },
]

export function HubBuilderNav({ active, onSelect }: { active: BuilderSection; onSelect: (s: BuilderSection) => void }) {
  return (
    <nav className="space-y-1">
      {ITEMS.map((it) => (
        <button
          key={it.key}
          onClick={() => onSelect(it.key)}
          className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${active === it.key ? 'bg-galli/10 text-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >
          <it.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span><span className="block text-sm font-medium">{it.label}</span><span className="block text-xs text-muted-foreground">{it.sub}</span></span>
        </button>
      ))}
      <div className="pt-2">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">Coming soon</p>
        {SOON.map((it) => (
          <div key={it.label} className="flex cursor-not-allowed items-start gap-3 rounded-xl px-3 py-2.5 opacity-50">
            <it.icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span><span className="block text-sm font-medium">{it.label}</span><span className="block text-xs">{it.sub}</span></span>
          </div>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: `HubBuilderSaveBar`** `src/components/hub/builder/HubBuilderSaveBar.tsx`:

```tsx
'use client'

import { Loader2, Check } from 'lucide-react'

export function HubBuilderSaveBar({ saving, dirty, lastSaved, conflict }: { saving: boolean; dirty: boolean; lastSaved: Date | null; conflict: boolean }) {
  return (
    <div className="flex items-center gap-2 border-t border-border bg-surface px-6 py-3 text-sm">
      {conflict ? (
        <span className="text-destructive">Someone else edited this hub — reload to continue.</span>
      ) : saving ? (
        <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>
      ) : dirty ? (
        <span className="text-muted-foreground">Unsaved changes…</span>
      ) : lastSaved ? (
        <span className="flex items-center gap-1.5 text-muted-foreground"><Check className="h-3.5 w-3.5 text-primary" /> Saved</span>
      ) : (
        <span className="text-muted-foreground">All changes save automatically.</span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `HubBuilder` shell** `src/components/hub/builder/HubBuilder.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import { useHubAutosave } from '@/hooks/useHubAutosave'
import { sanitizeHubConfig } from '@/lib/hub-config'
import type { HubConfig } from '@/lib/types/hub-config'
import { HubBuilderNav, type BuilderSection } from './HubBuilderNav'
import { HubBuilderSaveBar } from './HubBuilderSaveBar'
import { HubBuilderPreview } from './HubBuilderPreview'
import { LayoutSectionsSection } from './LayoutSectionsSection'
import { HubProfileSection } from './HubProfileSection'
import { HubSettingsSection } from './HubSettingsSection'
import { CommunitySettingsSection } from './CommunitySettingsSection'

type HubState = {
  id: string; title: string; tagline: string | null; description: string | null
  coverImage: string | null; heroVideoUrl: string | null; slug: string
  published: boolean; community: boolean; version: number; username: string
}

export function HubBuilder({ hubId }: { hubId: string }) {
  const [hub, setHub] = useState<HubState | null>(null)
  const [config, setConfig] = useState<HubConfig | null>(null)
  const [fields, setFields] = useState<Partial<HubState>>({})
  const [section, setSection] = useState<BuilderSection>('layout')

  useEffect(() => {
    fetch(`/api/hubs/${hubId}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d?.hub) return
      const h = d.hub
      setHub({ id: h.id, title: h.title, tagline: h.tagline ?? null, description: h.description ?? null, coverImage: h.coverImage ?? null, heroVideoUrl: h.heroVideoUrl ?? null, slug: h.slug, published: !!h.published, community: !!h.community, version: h.version ?? 0, username: d.username ?? h.user?.username ?? '' })
      setConfig(sanitizeHubConfig(h.config))
    })
  }, [hubId])

  const merged = hub ? { ...hub, ...fields } : null
  const payload = merged && config ? {
    title: merged.title, tagline: merged.tagline, description: merged.description,
    coverImage: merged.coverImage, heroVideoUrl: merged.heroVideoUrl, published: merged.published,
    config,
  } : {}
  const autosave = useHubAutosave({ hubId, payload, version: hub?.version ?? 0, enabled: !!merged })

  if (!merged || !config) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  const setField = <K extends keyof HubState>(k: K, v: HubState[K]) => setFields((f) => ({ ...f, [k]: v }))

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to My Galli</Link>
          <span className="text-sm font-semibold">Editing: {merged.title}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${merged.published ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{merged.published ? 'Published' : 'Draft'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${merged.username}/hub/${merged.slug}`} target="_blank" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">View live <ExternalLink className="h-3.5 w-3.5" /></Link>
          <button onClick={() => setField('published', !merged.published)} className="rounded-lg bg-galli px-4 py-1.5 text-sm font-medium text-white">{merged.published ? 'Unpublish' : 'Publish'}</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-surface p-3">
          <HubBuilderNav active={section} onSelect={setSection} />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {section === 'settings' && <HubSettingsSection hub={merged} onField={setField} />}
          {section === 'layout' && <LayoutSectionsSection config={config} onChange={setConfig} />}
          {section === 'profile' && <HubProfileSection hub={merged} onField={setField} />}
          {section === 'community' && <CommunitySettingsSection config={config} onChange={setConfig} />}
        </main>
        <aside className="hidden w-[420px] shrink-0 overflow-y-auto border-l border-border bg-muted/30 p-4 xl:block">
          <HubBuilderPreview hub={merged} config={config} />
        </aside>
      </div>

      <HubBuilderSaveBar saving={autosave.saving} dirty={autosave.dirty} lastSaved={autosave.lastSaved} conflict={autosave.conflict} />
    </div>
  )
}
```
Note: `GET /api/hubs/[id]` currently returns `{ hub, folders, items, notes, bookmarks }` — confirm it also exposes the owner `username` and the new `config`/`version`/`published`/`tagline`/`heroVideoUrl` on `hub`; if `username` is absent, derive the live link another way (e.g. add `user: { select: { username } }` to that route's hub query) — make that small addition in this task if needed.

- [ ] **Step 4: Branch the page** — `src/app/(dashboard)/hubs/[id]/page.tsx`:

```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { HubEditor } from '@/components/hub/HubEditor'
import { HubBuilder } from '@/components/hub/builder/HubBuilder'

export default function HubEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [community, setCommunity] = useState<boolean | null>(null)
  useEffect(() => { fetch(`/api/hubs/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => setCommunity(!!d?.hub?.community)) }, [id])
  if (community === null) return null
  return community ? <HubBuilder hubId={id} /> : <HubEditor hubId={id} />
}
```

- [ ] **Step 5: Typecheck** (sections referenced here are created in Tasks 8-10; to keep this task self-contained, create minimal placeholder exports NOW and flesh them out in their tasks — OR reorder so Tasks 8-10 land first. RECOMMENDED: implement the four section components + preview as stubs in this task returning a titled empty panel, then Tasks 8-10 replace their bodies.)

Create stubs so the shell compiles:
- `HubBuilderPreview.tsx`, `HubSettingsSection.tsx`, `LayoutSectionsSection.tsx`, `HubProfileSection.tsx`, `CommunitySettingsSection.tsx` each exporting a component with the props used above and a `<div className="text-sm text-muted-foreground">Coming in the next step</div>` body.

Run: `pnpm exec tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/hub/builder "src/app/(dashboard)/hubs/[id]/page.tsx"
git commit -m "feat(hub-builder): builder shell + nav + save bar + page branch (section stubs)"
```

---

### Task 8: Live preview (`HubBuilderPreview`)

**Files:**
- Modify: `src/components/hub/builder/HubBuilderPreview.tsx` (replace stub)

**Interfaces:**
- Consumes: `CommunityHubView`, `HubConfig`.
- Produces: `<HubBuilderPreview hub config />` — renders the real `CommunityHubView` from the in-progress config with a desktop/mobile width toggle.

- [ ] **Step 1: Implement** `src/components/hub/builder/HubBuilderPreview.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { CommunityHubView } from '@/components/hub/community/CommunityHubView'
import type { HubConfig } from '@/lib/types/hub-config'

export function HubBuilderPreview({ hub, config }: {
  hub: { id: string; title: string; tagline: string | null; description: string | null; coverImage: string | null; heroVideoUrl: string | null; slug: string; username: string }
  config: HubConfig
}) {
  const [mobile, setMobile] = useState(false)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</span>
        <div className="flex gap-1">
          <button onClick={() => setMobile(false)} className={`rounded p-1 ${!mobile ? 'bg-galli/10 text-primary' : 'text-muted-foreground'}`}><Monitor className="h-4 w-4" /></button>
          <button onClick={() => setMobile(true)} className={`rounded p-1 ${mobile ? 'bg-galli/10 text-primary' : 'text-muted-foreground'}`}><Smartphone className="h-4 w-4" /></button>
        </div>
      </div>
      <div className={`mx-auto overflow-hidden rounded-2xl border border-border bg-background ${mobile ? 'max-w-[390px]' : 'w-full'}`}>
        <div className="pointer-events-none origin-top scale-[0.85]">
          <CommunityHubView
            hub={hub}
            config={config}
            ownerUsername={hub.username}
            isPrivileged
            joined
            memberCount={0}
            members={[]}
            resources={[]}
            counts={{ posts: 0, members: 0, resources: 0, events: 0 }}
            sharePath={`/${hub.username}/hub/${hub.slug}`}
          />
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Preview uses sample data.</p>
    </div>
  )
}
```
Note: the preview passes empty members/resources so the video/feed still demonstrate layout & ordering; `pointer-events-none` makes it non-interactive. If `CommunityFeed`'s mount-time `fetch` is undesirable in preview, guard it with an optional `preview?: boolean` prop on `CommunityHubView`→`CommunityFeed` that short-circuits `load()` and renders the empty state — add that prop in this task if the fetch causes noise.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm exec next lint --file src/components/hub/builder/HubBuilderPreview.tsx`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/builder/HubBuilderPreview.tsx src/components/hub/community
git commit -m "feat(hub-builder): live preview panel with desktop/mobile toggle"
```

---

### Task 9: Layout & Sections editor

**Files:**
- Modify: `src/components/hub/builder/LayoutSectionsSection.tsx` (replace stub)

**Interfaces:**
- Produces: `<LayoutSectionsSection config onChange />` — toggle + reorder sidebar widgets (move up/down) and edit feed settings.

- [ ] **Step 1: Implement** `src/components/hub/builder/LayoutSectionsSection.tsx`:

```tsx
'use client'

import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import type { HubConfig, HubSidebarKey } from '@/lib/types/hub-config'

const LABELS: Record<HubSidebarKey, string> = { members: 'Members', resources: 'Resources', video: 'Video hero' }

export function LayoutSectionsSection({ config, onChange }: { config: HubConfig; onChange: (c: HubConfig) => void }) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= config.sidebar.length) return
    const sidebar = [...config.sidebar]
    ;[sidebar[i], sidebar[j]] = [sidebar[j], sidebar[i]]
    onChange({ ...config, sidebar })
  }
  const toggle = (i: number) => {
    const sidebar = config.sidebar.map((w, k) => (k === i ? { ...w, enabled: !w.enabled } : w))
    onChange({ ...config, sidebar })
  }
  const setFeed = (patch: Partial<HubConfig['feed']>) => onChange({ ...config, feed: { ...config.feed, ...patch } })

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="text-lg font-bold">Sidebar sections</h2>
        <p className="mb-3 text-sm text-muted-foreground">Reorder and toggle what shows in the community sidebar.</p>
        <div className="space-y-2">
          {config.sidebar.map((w, i) => (
            <div key={w.key} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
              <span className="flex-1 text-sm font-medium">{LABELS[w.key]}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground disabled:opacity-30 hover:bg-muted"><ArrowUp className="h-4 w-4" /></button>
              <button onClick={() => move(i, 1)} disabled={i === config.sidebar.length - 1} className="rounded p-1 text-muted-foreground disabled:opacity-30 hover:bg-muted"><ArrowDown className="h-4 w-4" /></button>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={w.enabled} onChange={() => toggle(i)} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-galli after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Feed</h2>
        <div className="mt-3 space-y-3">
          <Row label="Allow members to post" checked={config.feed.composerEnabled} onChange={(v) => setFeed({ composerEnabled: v })} />
          <Row label="Show a 'Load more' button" checked={config.feed.loadMoreEnabled} onChange={(v) => setFeed({ loadMoreEnabled: v })} />
          <div>
            <label className="mb-1 block text-sm font-medium">Empty-state message</label>
            <input value={config.feed.emptyStateText ?? ''} onChange={(e) => setFeed({ emptyStateText: e.target.value })} placeholder="No posts yet. Be the first to share something." maxLength={200} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
          </div>
        </div>
      </section>
    </div>
  )
}

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
      <span className="text-sm">{label}</span>
      <span className="relative inline-flex cursor-pointer items-center">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-5 w-9 rounded-full bg-muted peer-checked:bg-galli after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
      </span>
    </label>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm exec next lint --file src/components/hub/builder/LayoutSectionsSection.tsx`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/builder/LayoutSectionsSection.tsx
git commit -m "feat(hub-builder): Layout & Sections editor (reorder/toggle sidebar + feed settings)"
```

---

### Task 10: Hub Settings / Hub Profile / Community Settings sections

**Files:**
- Modify: `src/components/hub/builder/HubSettingsSection.tsx`, `HubProfileSection.tsx`, `CommunitySettingsSection.tsx` (replace stubs)

**Interfaces:**
- `HubSettingsSection` + `HubProfileSection`: props `{ hub, onField }` where `onField(key, value)` updates a Hub field. `CommunitySettingsSection`: props `{ config, onChange }`.

- [ ] **Step 1: `HubProfileSection`** — name, tagline, hero video, cover (reuses existing fields via `onField`):

```tsx
'use client'
export function HubProfileSection({ hub, onField }: { hub: { title: string; tagline: string | null; heroVideoUrl: string | null; slug: string; username: string }; onField: (k: any, v: any) => void }) {
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-bold">Hub profile</h2>
      <Field label="Name"><input value={hub.title} onChange={(e) => onField('title', e.target.value)} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" /></Field>
      <Field label="Tagline"><input value={hub.tagline ?? ''} onChange={(e) => onField('tagline', e.target.value)} placeholder="This is a test of the Community Network" className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" /></Field>
      <Field label="Hero video URL"><input value={hub.heroVideoUrl ?? ''} onChange={(e) => onField('heroVideoUrl', e.target.value)} placeholder="YouTube, Vimeo, or .mp4" className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" /></Field>
      <Field label="Public URL"><div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">galli.page/{hub.username}/hub/{hub.slug}</div></Field>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm font-medium">{label}</label>{children}</div>
}
```

- [ ] **Step 2: `HubSettingsSection`** — published status card + basics (description):

```tsx
'use client'
export function HubSettingsSection({ hub, onField }: { hub: { title: string; description: string | null; published: boolean }; onField: (k: any, v: any) => void }) {
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-bold">Hub settings</h2>
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">Status: {hub.published ? 'Published' : 'Draft'}</p>
        <p className="text-xs text-muted-foreground">{hub.published ? 'Your hub is live and visible to everyone.' : 'Only you can see this hub.'}</p>
        <button onClick={() => onField('published', !hub.published)} className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm">{hub.published ? 'Unpublish' : 'Publish'}</button>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea value={hub.description ?? ''} onChange={(e) => onField('description', e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `CommunitySettingsSection`** — who-can-post:

```tsx
'use client'
import type { HubConfig } from '@/lib/types/hub-config'
export function CommunitySettingsSection({ config, onChange }: { config: HubConfig; onChange: (c: HubConfig) => void }) {
  const set = (whoCanPost: HubConfig['access']['whoCanPost']) => onChange({ ...config, access: { ...config.access, whoCanPost } })
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-bold">Community settings</h2>
      <p className="text-sm text-muted-foreground">Who can create posts in this community?</p>
      <div className="space-y-2">
        {(['members', 'owner-only'] as const).map((opt) => (
          <label key={opt} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${config.access.whoCanPost === opt ? 'border-galli bg-galli/5' : 'border-border'}`}>
            <input type="radio" name="whoCanPost" checked={config.access.whoCanPost === opt} onChange={() => set(opt)} className="accent-galli" />
            <span className="text-sm">{opt === 'members' ? 'All members can post' : 'Only owner & collaborators can post'}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Members can always read, react, and comment.</p>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm exec next lint --file src/components/hub/builder/HubProfileSection.tsx --file src/components/hub/builder/HubSettingsSection.tsx --file src/components/hub/builder/CommunitySettingsSection.tsx`
Expected: exit 0 (escape any apostrophes).

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/builder
git commit -m "feat(hub-builder): Hub Settings, Hub Profile, Community Settings sections"
```

---

### Task 11: End-to-end verification

**Files:** none (verification only) — fresh isolated DB `pages_m2` + real login (mirror the M1 smoke pattern).

- [ ] **Step 1: Static gates** — `pnpm exec tsc --noEmit`; `pnpm test`; `pnpm exec next lint` (distinguish the known eslintrc warning). All green.

- [ ] **Step 2: Boot dev** against `pages_m2` (already migrated in Task 2) with inline env; wait for "Ready in".

- [ ] **Step 3: Scripted E2E** `_m2-e2e.mjs` (login-cookie approach, not hand-minted JWTs): seed owner + member (bcrypt `smoke1234`); owner creates a community; then assert:
  1. `PATCH /api/hubs/{id}` with `{ config: {...reordered+members disabled...}, version: 0 }` → 200, `version` bumps to 1.
  2. Re-PATCH with stale `version: 0` → 409.
  3. `GET /{owner}/hub/{slug}` public HTML → Members widget absent (disabled), sidebar order reflects config.
  4. Set `config.access.whoCanPost = 'owner-only'` via PATCH; member joins; member `POST /api/hubs/{id}/posts` → **403**; owner post → 201.
  5. `GET /api/hubs/{id}` returns `config` + `version` for the builder to load.
  Print PASS/FAIL per assertion.

- [ ] **Step 4: Cleanup** — kill ONLY the dev PID you started (`taskkill //F //PID <pid> //T`, never a blanket node kill); `rm -f _m2-e2e.mjs`; leave `pages_m2`.

- [ ] **Step 5: Final commit** (only if verification fixes were made).

---

## Deployment note (post-merge)
The migration is a single additive `ALTER TABLE` (config + version) — safe on prod Neon via the build's `prisma migrate deploy`. No backfill needed (`config` null ⇒ default = M1 behavior; `version` defaults 0).

## Self-review notes
- **Spec coverage:** R1 config model → Tasks 1-2; R2 PATCH → Task 3; R3 builder → Tasks 6-10; R4 config-driven page → Task 5; R5 who-can-post → Task 4. Verification → Task 11.
- **Type consistency:** `HubConfig`/`DEFAULT_HUB_CONFIG`/`sanitizeHubConfig`/`canPostWithAccess`/`buildHubPayloadKey` defined in Task 1, consumed in 3/4/5/6/7-10. `BuilderSection` defined in Task 7's `HubBuilderNav`, consumed by `HubBuilder`. Section-component prop shapes match between Task 7 (shell wiring) and Tasks 8-10 (implementations).
- **Ordering:** Task 7 creates section/preview **stubs** so the shell compiles; Tasks 8-10 replace the stub bodies. Keep the stub prop signatures identical to the final ones (as written in Tasks 8-10) so no re-wiring is needed.

# Galli Profile Redesign — Sub-project B (Editable Profile Canvas)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Give the profile (Row 3) an owner-editable "blank Galli page" canvas by reusing a `Display` (`kind: 'profile'`) — edited in the existing editor, rendered read-only on the public profile.

**Architecture:** Add `Display.kind` + `User.profileDisplayId`. A create-or-get endpoint makes the canvas Display and links it; the profile page renders its sections via the existing `renderElement`/`getGridClass`/`getColumnStyles` with its background. `kind:'profile'` Displays are filtered out of dashboard/explore/feed/profile-pages so the canvas never appears as a normal page.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + PostgreSQL, Vitest, lucide-react, Tailwind.

## Global Constraints

- **Canvas = a `Display` with `kind: 'profile'`, `published: true`**, owned by the user, referenced by `User.profileDisplayId`. Edited in the normal editor (`/editor?id=…`).
- **Always shown** on the profile (no separate publish step); rendered read-only for everyone, with an owner-only **Edit canvas** / **Customize** control.
- **Exclusions:** `kind != 'profile'` filter MUST be added to `GET /api/displays`, `GET /api/explore`, `GET /api/feed`, and the profile page's published-pages query. (Existing rows default to `kind:'page'`, so they remain visible.)
- **Reuse:** `renderElement(element, displayId)`, `getGridClass(layout)`, `getColumnStyles(column)` from `@/lib/render-elements`; `getBackgroundStyles(bg)` from `@/lib/types/background`.
- **DB safety + migrations (repo memory):** machine `DATABASE_URL` overrides `.env` — inline each command: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; <cmd>`. Migrations via `migrate diff … --script` → write `prisma/migrations/<ts>_<name>/migration.sql` → `migrate deploy`; confirm datasource `pages`/`5434`. **`prisma generate` EPERMs while a dev server runs** — if so, ask the user to stop it briefly.
- Verify: `pnpm exec tsc --noEmit`, `pnpm test`. **Do NOT run `pnpm build` while a dev server runs** (races `.next` → phantom `/_not-found` errors); rely on tsc + tests + live render, or stop the server first. Async params; `getUser`.

---

### Task 1: Schema — Display.kind + User.profileDisplayId + migration

**Files:** Modify `prisma/schema.prisma`; create `prisma/migrations/20260628040000_add_profile_canvas/migration.sql`.

- [ ] **Step 1:** Add to `model Display`: `kind String @default("page")`. Add to `model User`: `profileDisplayId String?`.
- [ ] **Step 2:** Generate + inspect SQL — `npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma\schema.prisma --script` (confirm datasource; additive: `ALTER TABLE "Display" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'page';` and `ALTER TABLE "User" ADD COLUMN "profileDisplayId" TEXT;`). Write to the migration.sql path.
- [ ] **Step 3:** Apply — `npx prisma migrate deploy`; then `npx prisma generate` (if EPERM, ask the user to stop their dev server, retry).
- [ ] **Step 4:** Verify + commit
```
docker exec pages-mvp-postgres-1 psql -U pages -d pages -tAc "SELECT column_name FROM information_schema.columns WHERE (table_name='Display' AND column_name='kind') OR (table_name='User' AND column_name='profileDisplayId');"
```
```bash
git add prisma/schema.prisma prisma/migrations/20260628040000_add_profile_canvas
git commit -m "feat(profile): add Display.kind + User.profileDisplayId migration"
```

---

### Task 2: Create-or-get profile canvas API

**Files:** Create `src/app/api/profile/canvas/route.ts`.

**Interfaces:** `POST /api/profile/canvas` (auth) → `{ id }` — returns the user's existing profile-canvas Display id, or creates one (`kind:'profile'`, `published:true`, `slug:'__profile'`, `title:'<username> profile'`, `sections: []`) and links it via `User.profileDisplayId`.

- [ ] **Step 1: Implement**
```ts
// src/app/api/profile/canvas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const fresh = await db.user.findUnique({ where: { id: me.id }, select: { profileDisplayId: true, username: true } })

    if (fresh?.profileDisplayId) {
      const existing = await db.display.findUnique({ where: { id: fresh.profileDisplayId }, select: { id: true } })
      if (existing) return NextResponse.json({ id: existing.id })
    }

    const display = await db.display.create({
      data: {
        userId: me.id,
        kind: 'profile',
        published: true,
        slug: '__profile',
        title: `${fresh?.username ?? 'My'} profile`,
        sections: [],
      },
      select: { id: true },
    })
    await db.user.update({ where: { id: me.id }, data: { profileDisplayId: display.id } })
    return NextResponse.json({ id: display.id })
  } catch (e) {
    console.error('Profile canvas error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```
- [ ] **Step 2: Build/tsc + curl smoke** (logged-in jar): `POST /api/profile/canvas` → `{ id }`; second call returns the SAME id; `db` shows one `kind='profile'` display for the user and `User.profileDisplayId` set.
- [ ] **Step 3: Commit**
```bash
git add src/app/api/profile/canvas/route.ts
git commit -m "feat(profile): create-or-get profile canvas Display API"
```

---

### Task 3: Exclude kind='profile' from listings

**Files:** Modify `src/app/api/displays/route.ts` (GET where), `src/app/api/explore/route.ts` (where), `src/app/api/feed/route.ts` (where), `src/app/[username]/page.tsx` (published-pages query).

**Interfaces:** none new — adds `kind: { not: 'profile' }` to four queries.

- [ ] **Step 1:** In `src/app/api/displays/route.ts` GET, change `where: { userId: user.id }` → `where: { userId: user.id, kind: { not: 'profile' } }`.
- [ ] **Step 2:** In `src/app/api/explore/route.ts`, change `const where = { published: true, ...kitFilter, ...searchFilter }` → `const where = { published: true, kind: { not: 'profile' }, ...kitFilter, ...searchFilter }`.
- [ ] **Step 3:** In `src/app/api/feed/route.ts`, change `const where = { published: true, userId: { in: followingIds } }` → `const where = { published: true, kind: { not: 'profile' }, userId: { in: followingIds } }`.
- [ ] **Step 4:** In `src/app/[username]/page.tsx`, the displays query `where: { userId: user.id, published: true }` → `where: { userId: user.id, published: true, kind: { not: 'profile' } }`.
- [ ] **Step 5: tsc + curl smoke** — after creating a profile canvas (Task 2), confirm it does NOT appear in `GET /api/displays`, `GET /api/explore`, `GET /api/feed`, nor the profile pages scroll. (Its id is known from Task 2; grep the JSON responses for it → absent.)
- [ ] **Step 6: Commit**
```bash
git add "src/app/api/displays/route.ts" src/app/api/explore/route.ts src/app/api/feed/route.ts "src/app/[username]/page.tsx"
git commit -m "feat(profile): exclude profile-canvas displays from listings"
```

---

### Task 4: ProfileCanvas render + Row 3 wiring

**Files:** Create `src/components/profile/ProfileCanvas.tsx`, `src/components/profile/ProfileCanvasBar.tsx`; modify `src/app/[username]/page.tsx` (fetch canvas + Row 3).

**Interfaces:**
- `<ProfileCanvas sections; background />` (server) — renders sections read-only with background.
- `<ProfileCanvasBar hasCanvas: boolean; profileDisplayId: string | null />` (client) — owner-only; "Edit canvas" links to `/editor?id=…` when canvas exists, else "Customize your profile" which `POST`s `/api/profile/canvas` and routes to `/editor?id=<id>`.

- [ ] **Step 1: ProfileCanvas** — mirror the public display render (from `src/app/[username]/[slug]/page.tsx`), parsing `sections` and applying background:
```tsx
// src/components/profile/ProfileCanvas.tsx
import type { Section } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import { getBackgroundStyles, DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import { renderElement, getGridClass, getColumnStyles } from '@/lib/render-elements'

export function ProfileCanvas({ sections, background, displayId }: { sections: Section[]; background?: BackgroundConfig | null; displayId: string }) {
  if (!sections || sections.length === 0) return null
  const bg = background || DEFAULT_BACKGROUND_CONFIG
  return (
    <div className="mt-6 rounded-2xl border border-border overflow-hidden" style={getBackgroundStyles(bg)}>
      <div className="p-5 space-y-8">
        {sections.map((section) => (
          <div key={section.id} className={`grid gap-6 ${getGridClass(section.layout)}`}>
            {section.columns.map((column) => (
              <div key={column.id} style={getColumnStyles(column)}>
                {column.elements.map((element) => (
                  <div key={element.id}>{renderElement(element, displayId)}</div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```
- [ ] **Step 2: ProfileCanvasBar** (client):
```tsx
// src/components/profile/ProfileCanvasBar.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wand2 } from 'lucide-react'

export function ProfileCanvasBar({ hasCanvas, profileDisplayId }: { hasCanvas: boolean; profileDisplayId: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const go = async () => {
    if (hasCanvas && profileDisplayId) { router.push(`/editor?id=${profileDisplayId}`); return }
    setBusy(true)
    try {
      const res = await fetch('/api/profile/canvas', { method: 'POST' })
      if (res.ok) { const { id } = await res.json(); router.push(`/editor?id=${id}`) }
    } finally { setBusy(false) }
  }
  return (
    <div className="mt-6 flex items-center justify-between p-4 rounded-2xl border border-dashed border-border bg-surface">
      <p className="text-sm text-muted-foreground">{hasCanvas ? 'Your custom profile canvas.' : 'Add a custom canvas to your profile — text, images, anything.'}</p>
      <button onClick={go} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-soft hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer">
        <Wand2 className="w-4 h-4" /> {hasCanvas ? 'Edit canvas' : 'Customize your profile'}
      </button>
    </div>
  )
}
```
- [ ] **Step 3: Wire Row 3 in `src/app/[username]/page.tsx`** — after fetching `user` (which now has `profileDisplayId`), fetch the canvas display when present and render:
```tsx
// add to the Promise.all (or a separate await) — fetch canvas if linked:
const canvas = user.profileDisplayId
  ? await db.display.findUnique({ where: { id: user.profileDisplayId }, select: { id: true, sections: true, background: true } })
  : null
const canvasSections = canvas ? (typeof canvas.sections === 'string' ? JSON.parse(canvas.sections) : (canvas.sections as unknown[])) : []
const canvasBackground = canvas ? (typeof canvas.background === 'string' ? JSON.parse(canvas.background) : canvas.background) : null
```
Replace the `{/* Row 3 ... */}` comment with:
```tsx
        {/* Row 3: editable profile canvas */}
        {canvas && <ProfileCanvas sections={canvasSections} background={canvasBackground} displayId={canvas.id} />}
        {isMe && <ProfileCanvasBar hasCanvas={!!canvas} profileDisplayId={user.profileDisplayId ?? null} />}
```
Add imports for `ProfileCanvas` and `ProfileCanvasBar`. **Add `profileDisplayId: true` to the `db.user.findUnique` select** at the top of the page (Sub-project A's select does not include it).

- [ ] **Step 4: tsc + manual check** — owner clicks "Customize your profile" → editor opens on the profile canvas → add a text element + save → return to profile → the element renders in Row 3; owner now sees "Edit canvas"; the canvas does not appear in dashboard/explore/feed/pages-scroll; a visitor sees the rendered canvas (no bar).

- [ ] **Step 5: Commit**
```bash
git add src/components/profile/ProfileCanvas.tsx src/components/profile/ProfileCanvasBar.tsx "src/app/[username]/page.tsx"
git commit -m "feat(profile): editable profile canvas render + owner controls"
```

---

## Self-Review

**Spec coverage (Sub-project B):**
- `Display.kind` + `User.profileDisplayId` → Task 1. ✅
- Create-or-get canvas (`kind:'profile'`, published, linked) → Task 2. ✅
- Public profile renders canvas sections + background via `renderElement` → Task 4 (`ProfileCanvas`). ✅
- Owner "Customize"/"Edit canvas" → Task 4 (`ProfileCanvasBar`). ✅
- Exclusions from dashboard/explore/feed/pages-scroll → Task 3. ✅
- Canvas always shown (no publish gate) → Task 4 renders whenever `canvas` exists. ✅
- ProfileCard total-views excludes canvas → handled transitively: `ProfileCard` fetches `GET /api/displays`, which Task 3 filters to `kind != 'profile'`. ✅

**Placeholder scan:** none — schema, API, filter edits, and components all have complete code/exact diffs.

**Type consistency:** `ProfileCanvas({ sections, background, displayId })` and `ProfileCanvasBar({ hasCanvas, profileDisplayId })` signatures match their Task 4 usages. `POST /api/profile/canvas → { id }` consumed by `ProfileCanvasBar`. `kind: { not: 'profile' }` filter shape consistent across all four Task 3 queries. `user.profileDisplayId` (added Task 1, selected in the profile page) consumed in Task 4.

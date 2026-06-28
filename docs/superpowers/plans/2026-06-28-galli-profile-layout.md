# Galli Profile Redesign — Sub-project A (Layout + Fields + Pages Scroll)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Rebuild `/[username]` into a two-column header (ID card + horizontal pages scroll), an About row (bio/interests/links/location), with owner editing via an Edit Profile modal.

**Architecture:** New `User` fields (location/interests/links/featuredDisplayId) + a `PATCH /api/profile` route guarded by a tested sanitizer. The profile page is a server component composing focused presentational components; owner-only editing is a client modal that refreshes the auth store.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + PostgreSQL, Vitest, lucide-react, Tailwind.

## Global Constraints

- **Fields:** `location` (free text role/location line), `interests` (string[], **max 12**), `links` (`[{label,url}]`, **max 10**, url must start `http://`/`https://`), `featuredDisplayId` (a published display owned by the user, else cleared).
- **Owner vs visitor:** owners see Edit Profile / Share / pin controls; visitors see read-only + Follow.
- **Reuse:** `ProfileFollowCounts` (counts→modal), `FollowButton`, `ScrollRow` pattern, `/api/upload` (avatar → `{url}`), store `setAuth(user)`.
- **DB safety + migrations (repo memory):** machine `DATABASE_URL` overrides `.env` — set inline each command: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; <cmd>`. Use `migrate diff … --script` → write `prisma/migrations/<ts>_<name>/migration.sql` → `migrate deploy`. Confirm datasource `pages`/`5434`.
- Verify: `pnpm exec tsc --noEmit`, `pnpm test`. Avoid `pnpm build` while a dev server runs (Windows `.next` lock). Auth: `getUser`. Async params.

---

### Task 1: Schema — profile fields + migration

**Files:** Modify `prisma/schema.prisma` (User); create `prisma/migrations/20260628030000_add_profile_fields/migration.sql`.

- [ ] **Step 1: Add fields** to `model User` (after `bio`/`emailVerified`):
```prisma
  location          String?
  interests         String[]  @default([])
  links             Json?
  featuredDisplayId String?
```
- [ ] **Step 2: Generate + inspect SQL** — `npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma\schema.prisma --script` (confirm datasource; additive ADD COLUMNs — `interests` is `TEXT[] DEFAULT ARRAY[]`, others nullable). Write to the migration.sql path.
- [ ] **Step 3: Apply** — `npx prisma migrate deploy`; then `npx prisma generate`.
- [ ] **Step 4: Verify column + commit**
```
docker exec pages-mvp-postgres-1 psql -U pages -d pages -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='User' AND column_name IN ('location','interests','links','featuredDisplayId');"
```
```bash
git add prisma/schema.prisma prisma/migrations/20260628030000_add_profile_fields
git commit -m "feat(profile): add location/interests/links/featuredDisplayId to User"
```

---

### Task 2: Profile helpers (TDD)

**Files:** Create `src/lib/profile.ts`, `src/__tests__/profile.test.ts`.

**Interfaces:**
- `detectLinkProvider(url: string): 'instagram'|'x'|'youtube'|'tiktok'|'linkedin'|'github'|'web'`
- `sanitizeInterests(input: unknown): string[]` (trim, drop empties, dedupe, max 12)
- `sanitizeLinks(input: unknown): { label: string; url: string }[]` (each must have non-empty label + http(s) url, max 10)

- [ ] **Step 1: Write failing tests**
```ts
// src/__tests__/profile.test.ts
import { describe, it, expect } from 'vitest'
import { detectLinkProvider, sanitizeInterests, sanitizeLinks } from '@/lib/profile'

describe('detectLinkProvider', () => {
  it('detects known providers', () => {
    expect(detectLinkProvider('https://instagram.com/x')).toBe('instagram')
    expect(detectLinkProvider('https://x.com/x')).toBe('x')
    expect(detectLinkProvider('https://twitter.com/x')).toBe('x')
    expect(detectLinkProvider('https://youtube.com/@x')).toBe('youtube')
    expect(detectLinkProvider('https://tiktok.com/@x')).toBe('tiktok')
    expect(detectLinkProvider('https://linkedin.com/in/x')).toBe('linkedin')
    expect(detectLinkProvider('https://github.com/x')).toBe('github')
    expect(detectLinkProvider('https://example.com')).toBe('web')
  })
})

describe('sanitizeInterests', () => {
  it('trims, drops empties, dedupes, caps at 12', () => {
    expect(sanitizeInterests([' Soccer ', 'soccer', '', 'Art'])).toEqual(['Soccer', 'soccer', 'Art'])
    expect(sanitizeInterests(Array.from({ length: 20 }, (_, i) => `t${i}`)).length).toBe(12)
    expect(sanitizeInterests('not-an-array')).toEqual([])
  })
})

describe('sanitizeLinks', () => {
  it('keeps valid http(s) links with labels, caps at 10', () => {
    expect(sanitizeLinks([{ label: 'IG', url: 'https://instagram.com/x' }, { label: '', url: 'https://a.com' }, { label: 'bad', url: 'ftp://a' }]))
      .toEqual([{ label: 'IG', url: 'https://instagram.com/x' }])
    expect(sanitizeLinks('nope')).toEqual([])
  })
})
```
- [ ] **Step 2: Run — expect fail.**
- [ ] **Step 3: Implement**
```ts
// src/lib/profile.ts
export type LinkProvider = 'instagram' | 'x' | 'youtube' | 'tiktok' | 'linkedin' | 'github' | 'web'

export function detectLinkProvider(url: string): LinkProvider {
  const u = url.toLowerCase()
  if (u.includes('instagram.com')) return 'instagram'
  if (u.includes('x.com') || u.includes('twitter.com')) return 'x'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('tiktok.com')) return 'tiktok'
  if (u.includes('linkedin.com')) return 'linkedin'
  if (u.includes('github.com')) return 'github'
  return 'web'
}

export function sanitizeInterests(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const t = raw.trim()
    if (t && !out.includes(t)) out.push(t)
    if (out.length >= 12) break
  }
  return out
}

export function sanitizeLinks(input: unknown): { label: string; url: string }[] {
  if (!Array.isArray(input)) return []
  const out: { label: string; url: string }[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const label = typeof (raw as { label?: unknown }).label === 'string' ? (raw as { label: string }).label.trim() : ''
    const url = typeof (raw as { url?: unknown }).url === 'string' ? (raw as { url: string }).url.trim() : ''
    if (label && /^https?:\/\//i.test(url)) out.push({ label, url })
    if (out.length >= 10) break
  }
  return out
}
```
- [ ] **Step 4: Run — expect pass. Commit.**
```bash
git add src/lib/profile.ts src/__tests__/profile.test.ts
git commit -m "feat(profile): tested link/interests sanitizers + provider detection"
```

---

### Task 3: PATCH /api/profile

**Files:** Create `src/app/api/profile/route.ts`.

**Interfaces:** `PATCH /api/profile` body `{ name?, bio?, location?, interests?, links?, avatar?, featuredDisplayId? }` → updated public user `{ id, username, name, avatar, bio, location, interests, links, emailVerified }`. Uses `sanitizeInterests`/`sanitizeLinks`.

- [ ] **Step 1: Implement**
```ts
// src/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { sanitizeInterests, sanitizeLinks } from '@/lib/profile'

export async function PATCH(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 80)
    if (typeof body.bio === 'string') data.bio = body.bio.slice(0, 500)
    if (typeof body.location === 'string') data.location = body.location.trim().slice(0, 120)
    if (typeof body.avatar === 'string') data.avatar = body.avatar
    if (body.interests !== undefined) data.interests = sanitizeInterests(body.interests)
    if (body.links !== undefined) data.links = sanitizeLinks(body.links)

    if (body.featuredDisplayId !== undefined) {
      if (body.featuredDisplayId === null) {
        data.featuredDisplayId = null
      } else {
        const d = await db.display.findUnique({ where: { id: String(body.featuredDisplayId) }, select: { userId: true, published: true } })
        data.featuredDisplayId = d && d.userId === me.id && d.published ? String(body.featuredDisplayId) : null
      }
    }

    const updated = await db.user.update({
      where: { id: me.id },
      data,
      select: { id: true, username: true, name: true, avatar: true, bio: true, location: true, interests: true, links: true, emailVerified: true, featuredDisplayId: true },
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('Profile update error:', e)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
```
- [ ] **Step 2: Curl smoke** (logged-in jar): PATCH `{ "location":"QB · Westfield", "interests":["Football","Film"], "links":[{"label":"IG","url":"https://instagram.com/x"}] }` → returns those values; PATCH `{ "featuredDisplayId":"not-mine" }` → returns `featuredDisplayId: null`.
- [ ] **Step 3: Commit**
```bash
git add src/app/api/profile/route.ts
git commit -m "feat(profile): PATCH /api/profile to update own profile fields"
```

---

### Task 4: ProfileAbout component

**Files:** Create `src/components/profile/ProfileAbout.tsx`.

**Interfaces:** `<ProfileAbout bio?: string | null; interests: string[]; links: { label: string; url: string }[] />`. Uses `detectLinkProvider`.

- [ ] **Step 1: Implement** — render (only sections that have content): bio paragraph; interests as chips (`rounded-full bg-muted px-2.5 py-1 text-xs`); links as a row of pills, each with a provider icon (map `detectLinkProvider` → lucide `Instagram`/`Twitter`/`Youtube`/`Music`(tiktok)/`Linkedin`/`Github`/`Globe`), label, opening in a new tab. If all three are empty, render nothing. Use `bg-surface`/`border-border`/`rounded-2xl` card styling. Icon map example:
```tsx
import { Instagram, Twitter, Youtube, Music, Linkedin, Github, Globe } from 'lucide-react'
const ICONS = { instagram: Instagram, x: Twitter, youtube: Youtube, tiktok: Music, linkedin: Linkedin, github: Github, web: Globe } as const
```
- [ ] **Step 2: tsc + commit**
```bash
git add src/components/profile/ProfileAbout.tsx
git commit -m "feat(profile): ProfileAbout (bio, interests chips, links with icons)"
```

---

### Task 5: ProfileIdCard + ShareProfileButton

**Files:** Create `src/components/profile/ProfileIdCard.tsx`, `src/components/profile/ShareProfileButton.tsx`.

**Interfaces:**
- `<ShareProfileButton username: string />` — copies `https://galli.page/{username}` (use `NEXT_PUBLIC_APP_URL` if present via `window.location.origin` fallback) to clipboard; shows a brief "Copied".
- `<ProfileIdCard user; followerCount; followingCount; friendCount; isOwner; isFollowing; isFriend; onEdit?: () => void />` — avatar/initial, name, @username, `location` line (if set), `<ProfileFollowCounts>` for counts, and an action row: owner → "Edit profile" (calls `onEdit`) + `<ShareProfileButton>`; visitor → `<FollowButton>` + `<ShareProfileButton>`.

- [ ] **Step 1: Implement ShareProfileButton** (client; `navigator.clipboard.writeText`).
- [ ] **Step 2: Implement ProfileIdCard** (client wrapper so the owner Edit button can trigger the modal via `onEdit`). Reuse `ProfileFollowCounts`, `FollowButton`. Card style `bg-surface border border-border rounded-2xl p-5 shadow-soft`, width `w-full lg:w-80 shrink-0`.
- [ ] **Step 3: tsc + commit**
```bash
git add src/components/profile/ProfileIdCard.tsx src/components/profile/ShareProfileButton.tsx
git commit -m "feat(profile): ProfileIdCard + ShareProfileButton"
```

---

### Task 6: ProfilePagesScroll

**Files:** Create `src/components/profile/ProfilePagesScroll.tsx`.

**Interfaces:** `<ProfilePagesScroll username; pages: Array<{ id, slug, title, coverImage, views }>; featuredId?: string | null; isOwner: boolean />`. Featured page renders first; owner sees a "pin to profile" / "unpin" control on each card that PATCHes `/api/profile` with `featuredDisplayId` (and refetches via `router.refresh()`).

- [ ] **Step 1: Implement** — horizontal scroll (`flex gap-4 overflow-x-auto scrollbar-hide snap-x`); each card (`w-60 shrink-0 snap-start rounded-2xl border bg-surface shadow-soft`) shows cover/gradient + title + views, linking to `/${username}/${slug}`. Sort featured first. Owner pin control (a small `Pin`/`PinOff` button, `stopPropagation`) → `fetch('/api/profile', { method:'PATCH', body: JSON.stringify({ featuredDisplayId: isFeatured ? null : id }) })` then `router.refresh()`. Empty state: "No published pages yet."
- [ ] **Step 2: tsc + commit**
```bash
git add src/components/profile/ProfilePagesScroll.tsx
git commit -m "feat(profile): ProfilePagesScroll with featured-first + owner pin"
```

---

### Task 7: EditProfileModal + store type + profile page assembly

**Files:** Create `src/components/profile/EditProfileModal.tsx`; modify `src/lib/types.ts` (User type), `src/app/[username]/page.tsx` (new layout).

**Interfaces:** `<EditProfileModal isOpen; onClose; user />` — fields: name, location, bio (textarea), interests (tag input → string[]), links (rows of label+url with add/remove), avatar (file → `/api/upload` → url). On save: `PATCH /api/profile`, then `setAuth(updated)` (merge into store) and `router.refresh()`.

- [ ] **Step 1: Extend store User type** in `src/lib/types.ts`:
```ts
export interface User {
  id: string
  email: string
  username: string
  name?: string
  avatar?: string
  bio?: string
  emailVerified?: string | Date | null
  location?: string | null
  interests?: string[]
  links?: { label: string; url: string }[]
  featuredDisplayId?: string | null
}
```
- [ ] **Step 2: EditProfileModal** — client modal (project modal pattern: `fixed inset-0 bg-black/40`, surface card, X, Done). Local state seeded from `user`. Interests tag input (type + Enter adds a chip, max 12). Links: array of `{label,url}` rows with add/remove (max 10). Avatar: file input → upload → preview. Save → `PATCH /api/profile` with the assembled body → on ok, `useAuthStore.getState().setAuth({ ...user, ...updated })` and `router.refresh()` and `onClose()`.
- [ ] **Step 3: Rebuild `src/app/[username]/page.tsx`** — server component. Fetch user (incl. `location, interests, links, featuredDisplayId`), counts, friend flags (as today), and published `displays` (id, slug, title, coverImage, views). Compose:
  - A client wrapper `ProfileView` (new small client component, or make the page render `ProfileIdCard` with an `onEdit` that toggles a client `EditProfileModal`) — because Edit is client state. Simplest: create `src/components/profile/ProfileOwnerControls.tsx` (client) that holds modal open-state and renders `ProfileIdCard` (with onEdit) + `EditProfileModal`; pass it the data. Visitors get a static `ProfileIdCard` (no onEdit).
  - **Row 1:** `<div className="flex flex-col lg:flex-row gap-6">` → ID card (owner: `ProfileOwnerControls`; visitor: `ProfileIdCard`) + `<ProfilePagesScroll>` (flex-1, min-w-0).
  - **Row 2:** `<ProfileAbout bio interests links />`.
  - **Row 3:** placeholder comment `{/* Sub-project B: editable canvas mounts here */}`.
  - Wrap in `max-w-5xl mx-auto px-6 py-10` on `bg-background`.
- [ ] **Step 4: tsc; manual check** — owner sees Edit/Share, edits fields and they persist + reflect after refresh; visitor sees Follow + read-only; featured page sorts first.
- [ ] **Step 5: Commit**
```bash
git add src/lib/types.ts src/components/profile/EditProfileModal.tsx src/components/profile/ProfileOwnerControls.tsx "src/app/[username]/page.tsx"
git commit -m "feat(profile): edit modal + assembled profile layout"
```

---

## Self-Review

**Spec coverage (Sub-project A):**
- User fields location/interests/links/featuredDisplayId → Task 1. ✅
- `PATCH /api/profile` w/ featured validation + caps → Task 3 (uses Task 2 sanitizers). ✅
- ID card (identity, counts→modal, Follow/Edit/Share) → Task 5 (reuses `ProfileFollowCounts`, `FollowButton`). ✅
- Pages scroll, featured-first, owner pin → Task 6. ✅
- About (bio/interests/links w/ icons) → Task 4 (uses `detectLinkProvider`). ✅
- Edit Profile modal (name/location/bio/interests/links/avatar) + store refresh → Task 7. ✅
- Layout assembly (Row1/Row2, Row3 reserved for B) → Task 7. ✅
- Share button → Task 5. ✅

**Placeholder scan:** Tasks 4–7 give complete contracts + key code/snippets and styling tokens; the larger components (modal, page assembly) are specified at assembly level with exact data shapes and the precise save/refresh wiring — a conscious altitude choice, everything they call is fully defined.

**Type consistency:** `sanitizeInterests`/`sanitizeLinks`/`detectLinkProvider` signatures match Tasks 2/3/4. `links: {label,url}[]` and `interests: string[]` consistent across route, store type, and components. `featuredDisplayId` threaded through Task 3 (validate), Task 6 (pin), Task 7 (store type).

# Simplified Universal Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the profile page-builder with one fixed, universal profile layout (cover + identity + action cards + bio + horizontal projects row), editable only for cover image and avatar.

**Architecture:** The public profile (`src/app/[username]/page.tsx`) is a Server Component that fetches the user + published Displays and composes four presentational zones. Interactive/testable logic is pulled into pure helpers in `src/lib` (unit-tested, matching repo convention). The page-builder canvas is removed from the render/edit paths; its data (`profileDisplayId`, `kind:'profile'` Displays) stays dormant in the DB.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma/Postgres, Tailwind (galli.* tokens), vitest.

## Global Constraints

- Work exclusively in the worktree `C:\Users\whirl\pages-profile` on branch `profile-standard`. Never touch the main checkout `C:\Users\whirl\pages-mvp`.
- All Prisma/db commands need BOTH env vars set inline (schema uses `directUrl`), pointing at `127.0.0.1` (NOT `localhost`): `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages"`.
- Prisma migrations are non-interactive here: **hand-author** `migration.sql` with ONLY the new column, then `prisma migrate deploy`. Never `prisma migrate dev` (the shared dev DB contaminates diffs).
- Lint gates the prod build (tsc does not run ESLint). Use `<Link>` for static internal routes (`/data`, `/profile/edit`); dynamic `<a href={`/${x}/${y}`}>` is allowed. Escape apostrophes in JSX text.
- Styling: reuse existing tokens/classes — cards are `rounded-2xl border border-border bg-surface shadow-soft`; brand `galli.*`, gradient `bg-galli-gradient`, `text-galli-dark`; horizontal scroll `overflow-x-auto scrollbar-hide snap-x`.
- Exact copy: section heading `My Galli`, subtitle `Projects, pages, boards & more.`, action-card labels `Mailbox`/`View messages`, `Share Profile`/`Share your Galli`, `Edit`, `Message`, `Follow`.
- Commit after every task. Commit trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```

---

### Task 1: Add `coverImage` to the data layer

**Files:**
- Modify: `prisma/schema.prisma` (User model, ~line 21 near `avatar`)
- Create: `prisma/migrations/<timestamp>_user_cover_image/migration.sql`
- Modify: `src/lib/types.ts:70-83` (User interface)
- Modify: `src/app/api/profile/route.ts` (PATCH whitelist + return select)

**Interfaces:**
- Produces: `User.coverImage String?` (Prisma) / `coverImage?: string | null` (TS type); `PATCH /api/profile` accepts and persists `coverImage`.

- [ ] **Step 1: Add the column to the Prisma schema**

In `prisma/schema.prisma`, add `coverImage` to the `User` model directly under `avatar String?`:

```prisma
  avatar    String?
  coverImage String?
```

- [ ] **Step 2: Hand-author the migration SQL**

Get a UTC timestamp: `date -u +%Y%m%d%H%M%S`. Create `prisma/migrations/<timestamp>_user_cover_image/migration.sql` containing ONLY:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "coverImage" TEXT;
```

- [ ] **Step 3: Apply the migration and regenerate the client**

Run (single line, env inline):

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma migrate deploy
```
Expected: "1 migration found" / "Applying migration `<timestamp>_user_cover_image`" / "All migrations have been successfully applied." Then:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma generate
```
Expected: "Generated Prisma Client". (If EPERM on Windows because dev holds the engine dll, stop dev and retry — non-blocking.)

- [ ] **Step 4: Add `coverImage` to the `User` TS type**

In `src/lib/types.ts`, add to the `User` interface (after `avatar?: string`):

```ts
  avatar?: string
  coverImage?: string | null
```

- [ ] **Step 5: Accept and return `coverImage` in the profile API**

In `src/app/api/profile/route.ts`, add to the whitelist block (after the `avatar` line):

```ts
    if (typeof body.avatar === 'string') data.avatar = body.avatar
    if (typeof body.coverImage === 'string') data.coverImage = body.coverImage
```

And add `coverImage: true,` to the `select` of the `db.user.update(...)` return (after `avatar: true,`):

```ts
        id: true, username: true, name: true, avatar: true, coverImage: true, bio: true,
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/types.ts src/app/api/profile/route.ts
git commit -m "feat(profile): add User.coverImage column, type, and API field"
```

---

### Task 2: Pure projects mapper (`toProjectCards`)

**Files:**
- Create: `src/lib/profile-projects.ts`
- Test: `src/lib/profile-projects.test.ts`

**Interfaces:**
- Produces:
  - `interface ProjectDisplay { id: string; slug: string; title: string; coverImage: string | null; views: number; kind: string }`
  - `interface ProjectCard { id: string; slug: string; title: string; coverImage: string | null; views: number; kind: 'page' | 'collection'; typeLabel: 'Page' | 'Board' }`
  - `function toProjectCards(displays: ProjectDisplay[], featuredId?: string | null): ProjectCard[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/profile-projects.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toProjectCards, type ProjectDisplay } from './profile-projects'

const base = (over: Partial<ProjectDisplay>): ProjectDisplay => ({
  id: 'x', slug: 's', title: 'T', coverImage: null, views: 0, kind: 'page', ...over,
})

describe('toProjectCards', () => {
  it('labels pages "Page" and boards "Board"', () => {
    const cards = toProjectCards([
      base({ id: 'p', kind: 'page' }),
      base({ id: 'b', kind: 'collection' }),
    ])
    expect(cards.map((c) => [c.id, c.typeLabel])).toEqual([['p', 'Page'], ['b', 'Board']])
  })

  it('excludes non page/board kinds (e.g. profile)', () => {
    const cards = toProjectCards([base({ id: 'pr', kind: 'profile' }), base({ id: 'p', kind: 'page' })])
    expect(cards.map((c) => c.id)).toEqual(['p'])
  })

  it('floats the featured id to the front, preserving the rest', () => {
    const cards = toProjectCards(
      [base({ id: 'a' }), base({ id: 'b' }), base({ id: 'c' })],
      'b',
    )
    expect(cards.map((c) => c.id)).toEqual(['b', 'a', 'c'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/profile-projects.test.ts`
Expected: FAIL — cannot find module `./profile-projects`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/profile-projects.ts`:

```ts
export type ProjectKind = 'page' | 'collection'

export interface ProjectDisplay {
  id: string
  slug: string
  title: string
  coverImage: string | null
  views: number
  kind: string
}

export interface ProjectCard {
  id: string
  slug: string
  title: string
  coverImage: string | null
  views: number
  kind: ProjectKind
  typeLabel: 'Page' | 'Board'
}

const INCLUDED: string[] = ['page', 'collection']

export function toProjectCards(
  displays: ProjectDisplay[],
  featuredId?: string | null,
): ProjectCard[] {
  const cards: ProjectCard[] = displays
    .filter((d) => INCLUDED.includes(d.kind))
    .map((d) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      coverImage: d.coverImage,
      views: d.views,
      kind: d.kind as ProjectKind,
      typeLabel: d.kind === 'collection' ? 'Board' : 'Page',
    }))
  if (!featuredId) return cards
  const featured = cards.filter((c) => c.id === featuredId)
  const rest = cards.filter((c) => c.id !== featuredId)
  return [...featured, ...rest]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/profile-projects.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile-projects.ts src/lib/profile-projects.test.ts
git commit -m "feat(profile): add toProjectCards mapper with type labels"
```

---

### Task 3: Pure action-card specs (`getProfileActionCards`)

**Files:**
- Create: `src/lib/profile-actions.ts`
- Test: `src/lib/profile-actions.test.ts`

**Interfaces:**
- Produces:
  - `type ProfileActionKey = 'mailbox' | 'message' | 'share' | 'follow' | 'edit'`
  - `interface ProfileActionSpec { key: ProfileActionKey; label: string; sublabel: string }`
  - `function getProfileActionCards(isOwner: boolean): ProfileActionSpec[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/profile-actions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getProfileActionCards } from './profile-actions'

describe('getProfileActionCards', () => {
  it('gives the owner Mailbox, Share, Edit', () => {
    expect(getProfileActionCards(true).map((c) => c.key)).toEqual(['mailbox', 'share', 'edit'])
  })

  it('gives a visitor Message, Share, Follow', () => {
    expect(getProfileActionCards(false).map((c) => c.key)).toEqual(['message', 'share', 'follow'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/profile-actions.test.ts`
Expected: FAIL — cannot find module `./profile-actions`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/profile-actions.ts`:

```ts
export type ProfileActionKey = 'mailbox' | 'message' | 'share' | 'follow' | 'edit'

export interface ProfileActionSpec {
  key: ProfileActionKey
  label: string
  sublabel: string
}

export function getProfileActionCards(isOwner: boolean): ProfileActionSpec[] {
  if (isOwner) {
    return [
      { key: 'mailbox', label: 'Mailbox', sublabel: 'View messages' },
      { key: 'share', label: 'Share Profile', sublabel: 'Share your Galli' },
      { key: 'edit', label: 'Edit', sublabel: 'Edit your profile' },
    ]
  }
  return [
    { key: 'message', label: 'Message', sublabel: 'Send a message' },
    { key: 'share', label: 'Share Profile', sublabel: 'Share your Galli' },
    { key: 'follow', label: 'Follow', sublabel: 'Follow this Galli' },
  ]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/profile-actions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile-actions.ts src/lib/profile-actions.test.ts
git commit -m "feat(profile): add getProfileActionCards owner/visitor specs"
```

---

### Task 4: `ProfileActionCards` component

**Files:**
- Create: `src/components/profile/ProfileActionCards.tsx`

**Interfaces:**
- Consumes: `getProfileActionCards` (Task 3); `FollowButton` (`@/components/social/FollowButton`, props `{ username, initialIsFollowing, initialIsFriend }`); `ProfileMailboxModal` (`@/components/profile/ProfileMailboxModal`, props `{ username, name, onClose }`).
- Produces: `function ProfileActionCards(props: { isOwner: boolean; username: string; name: string | null; isFollowing: boolean; isFriend: boolean }): JSX.Element`

- [ ] **Step 1: Write the component**

Create `src/components/profile/ProfileActionCards.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Share2, Pencil, Check } from 'lucide-react'
import { FollowButton } from '@/components/social/FollowButton'
import { ProfileMailboxModal } from '@/components/profile/ProfileMailboxModal'
import { getProfileActionCards } from '@/lib/profile-actions'

const cardCls =
  'flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-soft hover:shadow-soft-lg transition-all min-w-[190px]'

export function ProfileActionCards({
  isOwner,
  username,
  name,
  isFollowing,
  isFriend,
}: {
  isOwner: boolean
  username: string
  name: string | null
  isFollowing: boolean
  isFriend: boolean
}) {
  const [mailboxOpen, setMailboxOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const cards = getProfileActionCards(isOwner)

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${username}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  const Body = ({ label, sublabel }: { label: string; sublabel: string }) => (
    <div className="flex flex-col">
      <span className="font-bold text-sm">{label}</span>
      <span className="text-xs text-muted-foreground">{sublabel}</span>
    </div>
  )

  return (
    <div className="flex flex-wrap gap-3">
      {cards.map((c) => {
        if (c.key === 'mailbox') {
          return (
            <Link key={c.key} href="/data?tab=messages" className={`${cardCls} cursor-pointer`}>
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <Body label={c.label} sublabel={c.sublabel} />
            </Link>
          )
        }
        if (c.key === 'edit') {
          return (
            <Link key={c.key} href="/profile/edit" className={`${cardCls} cursor-pointer`}>
              <Pencil className="w-5 h-5 text-primary shrink-0" />
              <Body label={c.label} sublabel={c.sublabel} />
            </Link>
          )
        }
        if (c.key === 'message') {
          return (
            <button key={c.key} onClick={() => setMailboxOpen(true)} className={`${cardCls} cursor-pointer text-left`}>
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <Body label={c.label} sublabel={c.sublabel} />
            </button>
          )
        }
        if (c.key === 'share') {
          return (
            <button key={c.key} onClick={copyShare} className={`${cardCls} cursor-pointer text-left`}>
              {copied ? <Check className="w-5 h-5 text-primary shrink-0" /> : <Share2 className="w-5 h-5 text-primary shrink-0" />}
              <Body label={c.label} sublabel={copied ? 'Copied!' : c.sublabel} />
            </button>
          )
        }
        // follow
        return (
          <div key={c.key} className={cardCls}>
            <Body label={c.label} sublabel={`Follow ${name || `@${username}`}`} />
            <div className="ml-auto">
              <FollowButton username={username} initialIsFollowing={isFollowing} initialIsFriend={isFriend} />
            </div>
          </div>
        )
      })}

      {mailboxOpen && (
        <ProfileMailboxModal username={username} name={name} onClose={() => setMailboxOpen(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/ProfileActionCards.tsx
git commit -m "feat(profile): add ProfileActionCards (owner/visitor variants)"
```

---

### Task 5: `ProfileCover` component (owner cover upload)

**Files:**
- Create: `src/components/profile/ProfileCover.tsx`

**Interfaces:**
- Consumes: `POST /api/upload` (returns `{ url }`); `PATCH /api/profile` (accepts `{ coverImage }`, Task 1).
- Produces: `function ProfileCover(props: { coverImage: string | null; isOwner: boolean }): JSX.Element`

- [ ] **Step 1: Write the component**

Create `src/components/profile/ProfileCover.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus } from 'lucide-react'

export function ProfileCover({
  coverImage,
  isOwner,
}: {
  coverImage: string | null
  isOwner: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!up.ok) return
      const { url } = await up.json()
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImage: url }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative h-44 sm:h-56 w-full rounded-b-3xl overflow-hidden bg-galli-gradient">
      {coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {isOwner && (
        <label className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-surface/85 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-galli-dark cursor-pointer hover:bg-surface transition">
          <ImagePlus className="w-4 h-4" />
          {busy ? 'Uploading…' : 'Change cover'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/ProfileCover.tsx
git commit -m "feat(profile): add ProfileCover with owner upload"
```

---

### Task 6: `ProfileBioBar` + `ProfileProjectsSection`

**Files:**
- Create: `src/components/profile/ProfileBioBar.tsx`
- Create: `src/components/profile/ProfileProjectsSection.tsx`

**Interfaces:**
- Consumes: `toProjectCards`, `ProjectDisplay` (Task 2); `PATCH /api/profile` (`{ featuredDisplayId }`).
- Produces:
  - `function ProfileBioBar(props: { bio: string | null }): JSX.Element | null`
  - `function ProfileProjectsSection(props: { username: string; displays: ProjectDisplay[]; featuredId?: string | null; isOwner: boolean }): JSX.Element`

- [ ] **Step 1: Write `ProfileBioBar`**

Create `src/components/profile/ProfileBioBar.tsx`:

```tsx
import { Leaf } from 'lucide-react'

export function ProfileBioBar({ bio }: { bio: string | null }) {
  if (!bio) return null
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-soft">
      <Leaf className="w-4 h-4 text-primary shrink-0" />
      <p className="text-sm text-foreground">{bio}</p>
    </div>
  )
}
```

- [ ] **Step 2: Write `ProfileProjectsSection`**

Create `src/components/profile/ProfileProjectsSection.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Pin, PinOff, Leaf } from 'lucide-react'
import { toProjectCards, type ProjectDisplay } from '@/lib/profile-projects'

const GRADIENTS = [
  'from-galli/20 via-galli-aqua/10 to-galli-violet/10',
  'from-galli-aqua/20 via-galli-violet/10 to-galli/10',
  'from-galli-violet/20 via-galli/10 to-galli-aqua/10',
]

export function ProfileProjectsSection({
  username,
  displays,
  featuredId,
  isOwner,
}: {
  username: string
  displays: ProjectDisplay[]
  featuredId?: string | null
  isOwner: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const cards = useMemo(() => toProjectCards(displays, featuredId), [displays, featuredId])

  const togglePin = async (id: string, isFeatured: boolean) => {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featuredDisplayId: isFeatured ? null : id }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        <Leaf className="w-4 h-4 text-primary" />
        <h2 className="text-lg font-extrabold text-galli-dark">My Galli</h2>
      </div>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">Projects, pages, boards &amp; more.</p>

      {cards.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground py-10">
          Nothing published yet.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x pb-1">
          {cards.map((p, i) => {
            const isFeatured = p.id === featuredId
            return (
              <div
                key={p.id}
                className="group relative shrink-0 w-60 snap-start rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all"
              >
                <a href={`/${username}/${p.slug}`} className="block cursor-pointer">
                  <div className={`h-36 relative ${p.coverImage ? '' : `bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`}`}>
                    {p.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/35 to-transparent" />
                    <h3 className="absolute bottom-2.5 left-3 right-3 text-white font-semibold text-sm truncate drop-shadow">{p.title}</h3>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-semibold text-galli-dark">{p.typeLabel}</span>
                    <span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {p.views}</span>
                  </div>
                </a>
                {isOwner && (
                  <button
                    onClick={() => togglePin(p.id, isFeatured)}
                    disabled={busy}
                    aria-label={isFeatured ? 'Unpin from profile' : 'Pin to profile'}
                    title={isFeatured ? 'Unpin from profile' : 'Pin to profile'}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-surface/85 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isFeatured ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/ProfileBioBar.tsx src/components/profile/ProfileProjectsSection.tsx
git commit -m "feat(profile): add ProfileBioBar and ProfileProjectsSection"
```

---

### Task 7: `ProfileHeaderCard` + rewrite the public profile page

**Files:**
- Create: `src/components/profile/ProfileHeaderCard.tsx`
- Modify (rewrite): `src/app/[username]/page.tsx`

**Interfaces:**
- Consumes: `ProfileCover` (T5), `ProfileActionCards` (T4), `ProfileBioBar` + `ProfileProjectsSection` (T6), `ProfileFollowCounts` (`@/components/social/ProfileFollowCounts`, props `{ username, followerCount, followingCount }`).
- Produces: `function ProfileHeaderCard(props: { username: string; name: string | null; avatar: string | null; followerCount: number; followingCount: number; isOwner: boolean; isFollowing: boolean; isFriend: boolean }): JSX.Element`

- [ ] **Step 1: Write `ProfileHeaderCard`**

Create `src/components/profile/ProfileHeaderCard.tsx`:

```tsx
import { ProfileFollowCounts } from '@/components/social/ProfileFollowCounts'
import { ProfileActionCards } from '@/components/profile/ProfileActionCards'

export function ProfileHeaderCard({
  username,
  name,
  avatar,
  followerCount,
  followingCount,
  isOwner,
  isFollowing,
  isFriend,
}: {
  username: string
  name: string | null
  avatar: string | null
  followerCount: number
  followingCount: number
  isOwner: boolean
  isFollowing: boolean
  isFriend: boolean
}) {
  const initial = (name || username).charAt(0).toUpperCase()
  return (
    <div className="relative -mt-12 rounded-3xl border border-border bg-surface shadow-soft px-6 py-5 flex flex-col lg:flex-row lg:items-center gap-5">
      <div className="flex items-center gap-4 shrink-0">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-surface shrink-0" />
        ) : (
          <span className="w-20 h-20 rounded-full ring-4 ring-surface bg-gradient-to-br from-galli/30 to-galli-violet/30 text-galli-dark font-bold text-2xl flex items-center justify-center shrink-0">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold truncate">{name || username}</h1>
          <p className="text-sm text-muted-foreground truncate">@{username}</p>
          <ProfileFollowCounts username={username} followerCount={followerCount} followingCount={followingCount} />
        </div>
      </div>

      <div className="lg:ml-auto">
        <ProfileActionCards
          isOwner={isOwner}
          username={username}
          name={name}
          isFollowing={isFollowing}
          isFriend={isFriend}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the profile page**

Replace the ENTIRE contents of `src/app/[username]/page.tsx` with:

```tsx
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'
import { deriveFriend } from '@/lib/social'
import { AUTH_COOKIE } from '@/lib/constants'
import { ProfileCover } from '@/components/profile/ProfileCover'
import { ProfileHeaderCard } from '@/components/profile/ProfileHeaderCard'
import { ProfileBioBar } from '@/components/profile/ProfileBioBar'
import { ProfileProjectsSection } from '@/components/profile/ProfileProjectsSection'

async function getMeId(): Promise<string | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  if (!token) return null
  try {
    return (verify(token, getJwtSecret()) as { userId: string }).userId
  } catch {
    return null
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true, username: true, name: true, avatar: true, bio: true,
      coverImage: true, featuredDisplayId: true,
    },
  })
  if (!user) notFound()

  const meId = await getMeId()
  const [followerCount, followingCount, displays, iFollow, followsMe] = await Promise.all([
    db.follow.count({ where: { followingId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    db.display.findMany({
      where: { userId: user.id, published: true, kind: { in: ['page', 'collection'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, slug: true, title: true, coverImage: true, views: true, kind: true },
    }),
    meId ? db.follow.findUnique({ where: { followerId_followingId: { followerId: meId, followingId: user.id } }, select: { id: true } }) : null,
    meId ? db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: meId } }, select: { id: true } }) : null,
  ])
  const isFollowing = !!iFollow
  const isFriend = deriveFriend(isFollowing, !!followsMe)
  const isMe = meId === user.id

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
        <ProfileCover coverImage={user.coverImage} isOwner={isMe} />
        <div className="space-y-5">
          <ProfileHeaderCard
            username={user.username}
            name={user.name}
            avatar={user.avatar}
            followerCount={followerCount}
            followingCount={followingCount}
            isOwner={isMe}
            isFollowing={isFollowing}
            isFriend={isFriend}
          />
          <ProfileBioBar bio={user.bio} />
          <ProfileProjectsSection
            username={user.username}
            displays={displays}
            featuredId={user.featuredDisplayId}
            isOwner={isMe}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: no errors (the old `ProfileIdCard`/`ProfileAbout`/`ProfileCanvas` imports are gone; those files still exist unused — that is fine).
Run: `npx next lint`
Expected: no errors for the touched files.

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/ProfileHeaderCard.tsx src/app/[username]/page.tsx
git commit -m "feat(profile): fixed universal profile layout; remove canvas/about from page"
```

---

### Task 8: Slim down the profile editor (remove canvas, add cover)

**Files:**
- Modify: `src/components/profile/ProfileEditor.tsx`
- Modify: `src/app/profile/edit/page.tsx`
- Modify: `src/components/profile/ProfileFieldsPanel.tsx`

**Interfaces:**
- Consumes: `ProfileFieldsPanel` (updated to take `user` with `coverImage`); `User` type with `coverImage` (Task 1).
- Produces: `function ProfileEditor(props: { username: string; user: User }): JSX.Element` (canvas props removed).

- [ ] **Step 1: Rewrite `ProfileEditor` (drop the canvas editor)**

Replace the ENTIRE contents of `src/components/profile/ProfileEditor.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Save, Eye } from 'lucide-react'
import { ProfileFieldsPanel } from '@/components/profile/ProfileFieldsPanel'
import type { User } from '@/lib/types'

export function ProfileEditor({ username, user }: { username: string; user: User }) {
  const [saving, setSaving] = useState(false)
  const [everSaved, setEverSaved] = useState(false)
  const onFields = (s: boolean) => {
    setSaving(s)
    if (!s) setEverSaved(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/${username}`} className="p-2 hover:bg-muted rounded-lg transition" aria-label="Back to profile">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-lg font-bold">Edit profile</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {saving ? (
              <><Save className="w-4 h-4 animate-pulse" /><span>Saving…</span></>
            ) : everSaved ? (
              <><Check className="w-4 h-4 text-green-500" /><span>Saved</span></>
            ) : null}
          </div>
          <Link href={`/${username}`} className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:brightness-105 transition">
            <Eye className="w-4 h-4" /> View Profile
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <ProfileFieldsPanel user={user} onSavingChange={onFields} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `src/app/profile/edit/page.tsx` (drop canvas fetch)**

Replace the ENTIRE contents with:

```tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { db } from '@/lib/db'
import { getJwtSecret } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import type { User } from '@/lib/types'

export default async function ProfileEditPage() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  let meId: string | null = null
  if (token) {
    try { meId = (verify(token, getJwtSecret()) as { userId: string }).userId } catch { meId = null }
  }
  if (!meId) redirect('/login')

  const user = await db.user.findUnique({
    where: { id: meId },
    select: {
      id: true, email: true, username: true, name: true, avatar: true, bio: true,
      coverImage: true, location: true, interests: true, links: true, featuredDisplayId: true,
    },
  })
  if (!user) redirect('/login')

  const ownerUser: User = {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name ?? undefined,
    avatar: user.avatar ?? undefined,
    bio: user.bio ?? undefined,
    coverImage: user.coverImage ?? undefined,
    location: user.location,
    interests: user.interests,
    links: (user.links as { label: string; url: string }[] | null) || [],
    featuredDisplayId: user.featuredDisplayId,
  }

  return <ProfileEditor username={user.username} user={ownerUser} />
}
```

- [ ] **Step 3: Update `ProfileFieldsPanel` — add cover, remove interests/links/location editors**

In `src/components/profile/ProfileFieldsPanel.tsx`:

(a) Update the imports line to drop the now-unused `Plus, Trash2, X` and add `ImagePlus`:

```tsx
import { ImageIcon, ImagePlus } from 'lucide-react'
```

(b) Replace the state block (the `useState` lines for name/location/bio/avatar/interests/interestDraft/links) with:

```tsx
  const setAuth = useAuthStore((s) => s.setAuth)
  const [name, setName] = useState(user.name || '')
  const [bio, setBio] = useState(user.bio || '')
  const [avatar, setAvatar] = useState<string | null>(user.avatar || null)
  const [coverImage, setCoverImage] = useState<string | null>(user.coverImage || null)

  const firstRender = useRef(true)
```

(c) Replace the debounced autosave `useEffect` body's `fetch` payload and its dependency array so it saves only the four fields:

```tsx
    const t = setTimeout(async () => {
      onSavingChange(true)
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, bio, avatar, coverImage }),
        })
        if (res.ok) {
          const updated = await res.json()
          setAuth({ ...user, ...updated })
        }
      } finally {
        onSavingChange(false)
      }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, bio, avatar, coverImage])
```

(d) Delete the `addInterest` function. Keep `uploadAvatar`, and add a parallel `uploadCover` right after it:

```tsx
  const uploadCover = async (file: File) => {
    onSavingChange(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) setCoverImage((await res.json()).url)
    } finally {
      onSavingChange(false)
    }
  }
```

(e) Replace the returned JSX with this trimmed form (avatar, cover, name, bio only — no location/interests/links):

```tsx
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
      <h2 className="font-bold">Profile details</h2>

      {/* Avatar */}
      <div className="flex items-center gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" />
        ) : (
          <span className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-6 h-6" />
          </span>
        )}
        <label className="text-sm font-medium text-primary cursor-pointer hover:underline">
          Change photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadAvatar(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {/* Cover */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Cover image</label>
        <div className="relative h-28 w-full rounded-xl overflow-hidden bg-galli-gradient">
          {coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <label className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-surface/85 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-galli-dark cursor-pointer hover:bg-surface transition">
            <ImagePlus className="w-4 h-4" /> Change cover
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadCover(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Name</label>
        <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Bio</label>
        <textarea aria-label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
      </div>
    </div>
  )
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npx next lint`
Expected: no errors for the touched files.

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/ProfileEditor.tsx src/app/profile/edit/page.tsx src/components/profile/ProfileFieldsPanel.tsx
git commit -m "feat(profile): slim edit page — cover+avatar+name+bio, drop canvas"
```

---

### Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including `profile-projects` and `profile-actions`.

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit` → no errors.
Run: `npx next lint` → no errors.
(Stop any running dev server first to avoid the Windows `.next` race.) Run: `pnpm build` → succeeds.

- [ ] **Step 3: Manual end-to-end in the dev server**

Start dev (env inline, 127.0.0.1):
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm dev
```
Then verify at `http://localhost:3000/joshuawhirley`:
- **Logged out (visitor):** header shows avatar/name/@handle/counts; action cards are **Message · Share Profile · Follow**; Follow toggles; Share copies the URL; only the projects row scrolls horizontally; each project card shows a `Page`/`Board` badge.
- **Logged in as owner:** action cards are **Mailbox · Share Profile · Edit**; Mailbox → `/data?tab=messages`; "Change cover" and Edit work; `/profile/edit` shows only avatar/cover/name/bio (no canvas); editing autosaves and reflects on the profile after refresh.
- Confirm a `kind:'collection'` (Board) and a `kind:'page'` both appear in the row with correct badges.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "test(profile): verification fixes"
```

---

## Self-Review

**Spec coverage:**
- Fixed universal layout (cover/header/bio/projects) → Tasks 5,6,7. ✅
- Cover + avatar editing only → Tasks 1,5,8 (backgrounds deferred — not built). ✅
- Projects row = Pages + Boards → Tasks 2,6,7 (`kind:{ in:['page','collection'] }`). ✅
- Owner vs visitor action cards → Tasks 3,4. ✅
- Canvas removed from profile + edit, data kept → Tasks 7,8 (no migration touching `profileDisplayId`/`kind:'profile'`). ✅
- Interests/links hidden and dropped from editor → Task 8. ✅
- Only projects scroll → Task 6 (`overflow-x-auto` only on the row). ✅

**Placeholder scan:** No TBD/TODO; every code step is complete. The only `<timestamp>` is a real value the implementer generates via `date -u +%Y%m%d%H%M%S` in Task 1 Step 2. ✅

**Type consistency:** `ProjectDisplay`/`ProjectCard`/`toProjectCards` (T2) used identically in T6. `getProfileActionCards`/`ProfileActionKey` (T3) used in T4. `ProfileEditor(props:{username,user})` (T8 def) matches its call site in `edit/page.tsx` (T8). `User.coverImage` (T1) consumed in T7 select, T8 select/type. `ProfileFollowCounts` props match existing usage. ✅

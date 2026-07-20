# Community Hub M3b — Kollab Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a member content **drop-zone** ("Kollab pool") to community hub pages — members drop photos & video into a shared, attributed per-community pool rendered as a full-width section, with owner moderation.

**Architecture:** New `HubDrop` Prisma model (attributed pool). Members upload photos/video **client-direct-to-Vercel-Blob** via a membership-gated `handleUpload` token route (bypasses the 4.5MB serverless body limit), then create a `HubDrop` row via a REST route that mirrors the existing events/posts conventions (`canParticipate` gate, rate-limit, `hub_drop` notification, `canViewCommunityHub` read-gate). A new top-level `kollab` block in `HubConfig` toggles the section and controls `whoCanDrop`. The public surface is a new `CommunityKollab` client component (grid + uploader + lightbox), wired into `CommunityHubView` above the feed grid. Owner moderation via a builder modal mirroring `HubEventsModal`.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma/PostgreSQL, Vercel Blob (`@vercel/blob` + `@vercel/blob/client`), Tailwind, Vitest.

## Global Constraints

- Prisma migrations are non-interactive here: **never `prisma migrate dev`**. Hand-author `prisma/migrations/<ts>_<name>/migration.sql` with ONLY the new table's statements, then `prisma migrate deploy`. Prisma commands need both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` set inline. Dev DB: `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (127.0.0.1, not localhost).
- Work in a **dedicated git worktree from the start** (shared-checkout hazard). Branch `feat/community-m3b` already exists with the spec committed; create the worktree from it.
- Never import `src/lib/notifications.ts` into a client component (server-only). `notifications-format.ts` is the db-free client-safe module.
- Content types are **`image` and `video` only**. No links/files/audio/PDF in the pool.
- Video size cap: **100MB**. Author DTO exposes only `userId/username/name/avatar`.
- After each task: `npx tsc --noEmit` must be clean before commit. Run lint (`npx next lint`) from the **top-level** checkout, not the nested worktree (nested ESLint config conflict).
- Spec: `docs/superpowers/specs/2026-07-19-community-hub-m3b-kollab-pool-design.md`.

---

### Task 1: `HubDrop` model + migration

**Files:**
- Modify: `prisma/schema.prisma` (add `HubDrop` model + back-relations on `Hub` and `User`)
- Create: `prisma/migrations/20260719000000_hub_drop/migration.sql`

**Interfaces:**
- Produces: Prisma model `HubDrop { id, hubId, authorId, type, url, thumbnailUrl?, caption?, mimeType?, width?, height?, hidden, createdAt }` accessible as `db.hubDrop`.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Add after the `HubNote` model block:

```prisma
model HubDrop {
  id           String   @id @default(cuid())
  hubId        String
  hub          Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  authorId     String
  author       User     @relation(fields: [authorId], references: [id])
  type         String
  url          String
  thumbnailUrl String?
  caption      String?
  mimeType     String?
  width        Int?
  height       Int?
  hidden       Boolean  @default(false)
  createdAt    DateTime @default(now())
  @@index([hubId, createdAt])
}
```

Add the back-relation field to the `Hub` model (alongside its other `Hub...[]` relations, e.g. near `events HubEvent[]`):

```prisma
  drops HubDrop[]
```

Add the back-relation field to the `User` model (alongside its other relations):

```prisma
  hubDrops HubDrop[]
```

- [ ] **Step 2: Hand-author the migration SQL**

Create `prisma/migrations/20260719000000_hub_drop/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "HubDrop" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubDrop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HubDrop_hubId_createdAt_idx" ON "HubDrop"("hubId", "createdAt");

-- AddForeignKey
ALTER TABLE "HubDrop" ADD CONSTRAINT "HubDrop_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubDrop" ADD CONSTRAINT "HubDrop_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply migration + regenerate client**

Run:
```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
npx prisma migrate deploy
npx prisma generate
```
Expected: migration `20260719000000_hub_drop` applied; client regenerated with `db.hubDrop`.

- [ ] **Step 4: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean (no errors referencing `hubDrop`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260719000000_hub_drop
git commit -m "feat(m3b): add HubDrop model + migration"
```

---

### Task 2: `hub-drops` helper (validate + DTO)

**Files:**
- Create: `src/lib/hub-drops.ts`
- Create: `src/lib/hub-drops.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type DropType = 'image' | 'video'`
  - `type NormalizedDrop = { type: DropType; url: string; thumbnailUrl: string | null; caption: string | null; mimeType: string | null; width: number | null; height: number | null }`
  - `validateDropInput(raw: unknown): { ok: true; value: NormalizedDrop } | { ok: false; error: string }`
  - `type DropAuthor = { userId: string; username: string; name: string | null; avatar: string | null }`
  - `type DropDTO = { id: string; type: DropType; url: string; thumbnailUrl: string | null; caption: string | null; mimeType: string | null; width: number | null; height: number | null; hidden: boolean; createdAt: string; author: DropAuthor }`
  - `toDropDTO(row): DropDTO`

- [ ] **Step 1: Write the failing test**

Create `src/lib/hub-drops.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateDropInput, toDropDTO } from './hub-drops'

describe('validateDropInput', () => {
  it('accepts a valid image drop', () => {
    const r = validateDropInput({ type: 'image', url: 'https://blob.example/x.jpg', caption: 'hi' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.type).toBe('image')
      expect(r.value.url).toBe('https://blob.example/x.jpg')
      expect(r.value.caption).toBe('hi')
      expect(r.value.thumbnailUrl).toBeNull()
    }
  })

  it('accepts a video drop with thumbnail + dimensions', () => {
    const r = validateDropInput({ type: 'video', url: 'https://blob.example/x.mp4', thumbnailUrl: 'https://blob.example/x.jpg', width: 720, height: 1280, mimeType: 'video/mp4' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.width).toBe(720)
      expect(r.value.mimeType).toBe('video/mp4')
    }
  })

  it('rejects an unknown type', () => {
    expect(validateDropInput({ type: 'link', url: 'https://x' })).toEqual({ ok: false, error: 'Invalid drop type' })
  })

  it('rejects a missing url', () => {
    expect(validateDropInput({ type: 'image', url: '' })).toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('rejects a non-string url', () => {
    expect(validateDropInput({ type: 'image', url: 123 })).toEqual({ ok: false, error: 'A file URL is required' })
  })

  it('truncates an overlong caption to 500 chars', () => {
    const r = validateDropInput({ type: 'image', url: 'https://x/y.jpg', caption: 'a'.repeat(600) })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.caption?.length).toBe(500)
  })
})

describe('toDropDTO', () => {
  it('maps a row + author to a DTO with iso date', () => {
    const dto = toDropDTO({
      id: 'd1', type: 'video', url: 'u', thumbnailUrl: 't', caption: 'c', mimeType: 'video/mp4',
      width: 1, height: 2, hidden: false, createdAt: new Date('2026-07-19T00:00:00.000Z'),
      author: { id: 'u1', username: 'joe', name: 'Joe', avatar: null },
    })
    expect(dto).toEqual({
      id: 'd1', type: 'video', url: 'u', thumbnailUrl: 't', caption: 'c', mimeType: 'video/mp4',
      width: 1, height: 2, hidden: false, createdAt: '2026-07-19T00:00:00.000Z',
      author: { userId: 'u1', username: 'joe', name: 'Joe', avatar: null },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/hub-drops.test.ts`
Expected: FAIL — cannot resolve `./hub-drops`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/hub-drops.ts`:

```ts
export type DropType = 'image' | 'video'

export type NormalizedDrop = {
  type: DropType
  url: string
  thumbnailUrl: string | null
  caption: string | null
  mimeType: string | null
  width: number | null
  height: number | null
}

const intOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : null

export function validateDropInput(raw: unknown): { ok: true; value: NormalizedDrop } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const type = r.type
  if (type !== 'image' && type !== 'video') return { ok: false, error: 'Invalid drop type' }
  const url = typeof r.url === 'string' ? r.url.trim() : ''
  if (!url) return { ok: false, error: 'A file URL is required' }
  const thumbnailUrl = typeof r.thumbnailUrl === 'string' && r.thumbnailUrl.trim() ? r.thumbnailUrl.trim() : null
  const caption = typeof r.caption === 'string' && r.caption.trim() ? r.caption.trim().slice(0, 500) : null
  const mimeType = typeof r.mimeType === 'string' && r.mimeType.trim() ? r.mimeType.trim().slice(0, 100) : null
  return { ok: true, value: { type, url, thumbnailUrl, caption, mimeType, width: intOrNull(r.width), height: intOrNull(r.height) } }
}

export type DropAuthor = { userId: string; username: string; name: string | null; avatar: string | null }

export type DropDTO = {
  id: string
  type: DropType
  url: string
  thumbnailUrl: string | null
  caption: string | null
  mimeType: string | null
  width: number | null
  height: number | null
  hidden: boolean
  createdAt: string
  author: DropAuthor
}

export function toDropDTO(row: {
  id: string; type: string; url: string; thumbnailUrl: string | null; caption: string | null
  mimeType: string | null; width: number | null; height: number | null; hidden: boolean; createdAt: Date
  author: { id: string; username: string; name: string | null; avatar: string | null }
}): DropDTO {
  return {
    id: row.id,
    type: row.type as DropType,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    caption: row.caption,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    hidden: row.hidden,
    createdAt: row.createdAt.toISOString(),
    author: { userId: row.author.id, username: row.author.username, name: row.author.name, avatar: row.author.avatar },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/hub-drops.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-drops.ts src/lib/hub-drops.test.ts
git commit -m "feat(m3b): hub-drops validate + DTO helpers"
```

---

### Task 3: Video support in `upload-validate`

**Files:**
- Modify: `src/lib/upload-validate.ts`
- Create: `src/lib/upload-validate.video.test.ts`

**Interfaces:**
- Produces: `validateUpload` now accepts `video/mp4`, `video/webm`, `video/quicktime` up to 100MB; `extensionForMime` returns extensions for those. Exports a new constant `VIDEO_TYPES: string[]` and `MAX_VIDEO: number` for reuse by the token route (Task 8).

- [ ] **Step 1: Write the failing test**

Create `src/lib/upload-validate.video.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateUpload, extensionForMime, VIDEO_TYPES, MAX_VIDEO } from './upload-validate'

describe('validateUpload video', () => {
  it('accepts mp4 under the cap', () => {
    expect(validateUpload('video/mp4', 50 * 1024 * 1024)).toEqual({ ok: true })
  })
  it('rejects video over 100MB', () => {
    const r = validateUpload('video/mp4', 101 * 1024 * 1024)
    expect(r.ok).toBe(false)
  })
  it('exposes VIDEO_TYPES and a 100MB cap', () => {
    expect(VIDEO_TYPES).toContain('video/mp4')
    expect(MAX_VIDEO).toBe(100 * 1024 * 1024)
  })
  it('maps mp4/webm/mov extensions', () => {
    expect(extensionForMime('video/mp4')).toBe('.mp4')
    expect(extensionForMime('video/webm')).toBe('.webm')
    expect(extensionForMime('video/quicktime')).toBe('.mov')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/upload-validate.video.test.ts`
Expected: FAIL — `VIDEO_TYPES` undefined / video rejected.

- [ ] **Step 3: Edit `src/lib/upload-validate.ts`**

Add the constants and wire them into `validateUpload` and the extension map:

```ts
// add near the other *_TYPES consts
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
export const MAX_VIDEO = 100 * 1024 * 1024
```

Extend the `EXT` record with:

```ts
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
```

In `validateUpload`, add video handling:

```ts
export function validateUpload(type: string, size: number): { ok: true } | { ok: false; error: string } {
  const isImage = IMAGE_TYPES.includes(type)
  const isAudio = AUDIO_TYPES.includes(type)
  const isDoc = DOC_TYPES.includes(type)
  const isVideo = VIDEO_TYPES.includes(type)
  if (!isImage && !isAudio && !isDoc && !isVideo) {
    return { ok: false, error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, audio (MP3, M4A, AAC, OGG, WAV), PDF, or video (MP4, WebM, MOV).' }
  }
  const max = isVideo ? MAX_VIDEO : isDoc ? MAX_DOC : isAudio ? MAX_AUDIO : MAX_IMAGE
  if (size > max) {
    return { ok: false, error: `File too large. Maximum size is ${Math.round(max / 1024 / 1024)}MB` }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/upload-validate.video.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/upload-validate.ts src/lib/upload-validate.video.test.ts
git commit -m "feat(m3b): allow video uploads (mp4/webm/mov, 100MB)"
```

---

### Task 4: `kollab` config block + `canDropToPool`

**Files:**
- Modify: `src/lib/types/hub-config.ts`
- Modify: `src/lib/hub-config.ts`
- Create: `src/lib/hub-config.kollab.test.ts`

**Interfaces:**
- Consumes: `HubConfig`, `sanitizeHubConfig` from earlier code.
- Produces:
  - `HubConfig` gains `kollab: { enabled: boolean; whoCanDrop: 'members' | 'owner-only' }`.
  - `DEFAULT_HUB_CONFIG.kollab = { enabled: true, whoCanDrop: 'members' }`.
  - `sanitizeHubConfig` always returns a valid `kollab` block.
  - `canDropToPool({ canParticipate, whoCanDrop, isPrivileged }): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/hub-config.kollab.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sanitizeHubConfig, canDropToPool } from './hub-config'
import { DEFAULT_HUB_CONFIG } from './types/hub-config'

describe('sanitizeHubConfig kollab', () => {
  it('defaults kollab for a config missing it (old configs)', () => {
    const c = sanitizeHubConfig({ sidebar: [], feed: {}, access: {} })
    expect(c.kollab).toEqual({ enabled: true, whoCanDrop: 'members' })
  })
  it('preserves an owner-only whoCanDrop and disabled flag', () => {
    const c = sanitizeHubConfig({ kollab: { enabled: false, whoCanDrop: 'owner-only' } })
    expect(c.kollab).toEqual({ enabled: false, whoCanDrop: 'owner-only' })
  })
  it('coerces a bogus whoCanDrop to members', () => {
    const c = sanitizeHubConfig({ kollab: { enabled: true, whoCanDrop: 'anyone' } })
    expect(c.kollab.whoCanDrop).toBe('members')
  })
  it('DEFAULT_HUB_CONFIG has kollab enabled', () => {
    expect(DEFAULT_HUB_CONFIG.kollab).toEqual({ enabled: true, whoCanDrop: 'members' })
  })
})

describe('canDropToPool', () => {
  it('members mode: any participant can drop', () => {
    expect(canDropToPool({ canParticipate: true, whoCanDrop: 'members', isPrivileged: false })).toBe(true)
  })
  it('members mode: non-participant cannot', () => {
    expect(canDropToPool({ canParticipate: false, whoCanDrop: 'members', isPrivileged: false })).toBe(false)
  })
  it('owner-only mode: only privileged', () => {
    expect(canDropToPool({ canParticipate: true, whoCanDrop: 'owner-only', isPrivileged: false })).toBe(false)
    expect(canDropToPool({ canParticipate: true, whoCanDrop: 'owner-only', isPrivileged: true })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/hub-config.kollab.test.ts`
Expected: FAIL — `kollab` undefined / `canDropToPool` not exported.

- [ ] **Step 3: Edit `src/lib/types/hub-config.ts`**

Add the type + default:

```ts
export type HubWhoCanDrop = 'members' | 'owner-only'

export type HubConfig = {
  sidebar: HubSidebarWidget[]
  feed: { composerEnabled: boolean; loadMoreEnabled: boolean; emptyStateText?: string }
  access: { whoCanPost: HubWhoCanPost }
  kollab: { enabled: boolean; whoCanDrop: HubWhoCanDrop }
}
```

And in `DEFAULT_HUB_CONFIG`, add:

```ts
  kollab: { enabled: true, whoCanDrop: 'members' },
```

- [ ] **Step 4: Edit `src/lib/hub-config.ts`**

Import the new type and build the `kollab` block in `sanitizeHubConfig`'s return. Before the `return`, add:

```ts
  const kollabRaw = (r.kollab && typeof r.kollab === 'object' ? r.kollab : {}) as Record<string, any>
  const whoCanDrop: HubWhoCanDrop = kollabRaw.whoCanDrop === 'owner-only' ? 'owner-only' : 'members'
```

Add to the returned object (after `access`):

```ts
    kollab: {
      enabled: bool(kollabRaw.enabled, DEFAULT_HUB_CONFIG.kollab.enabled),
      whoCanDrop,
    },
```

Update the import line to include `HubWhoCanDrop`:

```ts
import {
  HUB_SIDEBAR_KEYS,
  DEFAULT_HUB_CONFIG,
  type HubConfig,
  type HubSidebarKey,
  type HubWhoCanPost,
  type HubWhoCanDrop,
} from './types/hub-config'
```

Add the helper at the end of the file:

```ts
export function canDropToPool(input: {
  canParticipate: boolean
  whoCanDrop: HubWhoCanDrop
  isPrivileged: boolean
}): boolean {
  if (input.whoCanDrop === 'owner-only') return input.isPrivileged
  return input.canParticipate
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/hub-config.kollab.test.ts`
Expected: PASS. Also run the existing config test to confirm no regression: `npx vitest run src/lib/hub-config` (all pass).

- [ ] **Step 6: Verify tsc + commit**

Run: `npx tsc --noEmit` (clean).
```bash
git add src/lib/types/hub-config.ts src/lib/hub-config.ts src/lib/hub-config.kollab.test.ts
git commit -m "feat(m3b): kollab config block + canDropToPool"
```

---

### Task 5: `hub_drop` notification type

**Files:**
- Modify: `src/lib/notifications-format.ts`
- Create: `src/lib/notifications-format.drop.test.ts`

**Interfaces:**
- Produces: `NotificationType` includes `'hub_drop'`; `formatNotification` renders it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/notifications-format.drop.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatNotification } from './notifications-format'

describe('formatNotification hub_drop', () => {
  it('formats with a community name', () => {
    expect(formatNotification({ type: 'hub_drop', actorName: 'Joe', contextText: 'Runners' }))
      .toBe('Joe dropped content in “Runners”')
  })
  it('formats without a community name', () => {
    expect(formatNotification({ type: 'hub_drop', actorName: 'Joe' }))
      .toBe('Joe dropped content in a community')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notifications-format.drop.test.ts`
Expected: FAIL — falls through to `default` (returns just `'Joe'`).

- [ ] **Step 3: Edit `src/lib/notifications-format.ts`**

Add `'hub_drop'` to the union:

```ts
export type NotificationType = 'follow' | 'bulletin' | 'page_published' | 'comment' | 'hub_collaborator' | 'message' | 'hub_member' | 'hub_post' | 'hub_comment' | 'hub_event' | 'hub_drop'
```

Add the case before `default`:

```ts
    case 'hub_drop':
      return `${n.actorName} dropped content in ${n.contextText ? `“${n.contextText}”` : 'a community'}`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notifications-format.drop.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications-format.ts src/lib/notifications-format.drop.test.ts
git commit -m "feat(m3b): hub_drop notification type"
```

---

### Task 6: Create + list drops route

**Files:**
- Create: `src/app/api/hubs/[id]/drops/route.ts`
- Create: `src/app/api/hubs/[id]/drops/route.test.ts`

**Interfaces:**
- Consumes: `validateDropInput`, `toDropDTO` (Task 2); `canParticipate`, `canModerate`, `canViewCommunityHub`, `postNotifyTargets` (`src/lib/community.ts`); `canDropToPool`, `sanitizeHubConfig` (Task 4); `rateLimit`; `notifyHubMembers`.
- Produces: `POST /api/hubs/[id]/drops` → `{ id }` 201; `GET /api/hubs/[id]/drops?before=<iso>` → `{ drops: DropDTO[], nextCursor: string | null }`.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/hubs/[id]/drops/route.test.ts`. Mirror the mocking style of `src/app/api/hubs/[id]/events/route.test.ts` (read it first for the exact `vi.mock('@/lib/db')` / `getUser` shape used in this repo). The tests to cover:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(async () => null) }))
vi.mock('@/lib/notifications', () => ({ notifyHubMembers: vi.fn(async () => {}) }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubMember: { findUnique: vi.fn(), findMany: vi.fn(async () => []) },
    hubDrop: { create: vi.fn(), findMany: vi.fn(async () => []) },
  },
}))

import { GET, POST } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

const params = { params: Promise.resolve({ id: 'hub1' }) }
const req = (body?: any, url = 'http://localhost/api/hubs/hub1/drops') =>
  ({ url, json: async () => body } as any)

beforeEach(() => vi.clearAllMocks())

describe('POST /drops', () => {
  it('401 when logged out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true, published: true, title: 'T', slug: 's', config: null, user: { username: 'o' } })
    const res = await POST(req({ type: 'image', url: 'https://x/y.jpg' }), params)
    expect(res.status).toBe(401)
  })

  it('403 for a non-member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger', username: 's', name: null, avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true, published: true, title: 'T', slug: 's', config: null, user: { username: 'o' } })
    ;(db.hubMember.findUnique as any).mockResolvedValue(null)
    const res = await POST(req({ type: 'image', url: 'https://x/y.jpg' }), params)
    expect(res.status).toBe(403)
  })

  it('403 in owner-only mode for a plain member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true, published: true, title: 'T', slug: 's', config: { kollab: { enabled: true, whoCanDrop: 'owner-only' } }, user: { username: 'o' } })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    const res = await POST(req({ type: 'image', url: 'https://x/y.jpg' }), params)
    expect(res.status).toBe(403)
  })

  it('201 for a member drop + notifies', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: 'M', avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true, published: true, title: 'T', slug: 's', config: null, user: { username: 'o' } })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    ;(db.hubDrop.create as any).mockResolvedValue({ id: 'drop1' })
    const res = await POST(req({ type: 'image', url: 'https://x/y.jpg', caption: 'hi' }), params)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'drop1' })
  })

  it('400 on invalid type', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: null, avatar: null })
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true, published: true, title: 'T', slug: 's', config: null, user: { username: 'o' } })
    ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem1' })
    const res = await POST(req({ type: 'link', url: 'https://x' }), params)
    expect(res.status).toBe(400)
  })
})

describe('GET /drops', () => {
  it('404 for a draft community to anon', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true, published: false })
    const res = await GET(req(undefined), params)
    expect(res.status).toBe(404)
  })

  it('excludes hidden drops for the public', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true, published: true })
    ;(db.hubDrop.findMany as any).mockResolvedValue([])
    await GET(req(undefined), params)
    const call = (db.hubDrop.findMany as any).mock.calls[0][0]
    expect(call.where).toMatchObject({ hubId: 'hub1', hidden: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/hubs/[id]/drops/route.test.ts"`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Write `src/app/api/hubs/[id]/drops/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate, canModerate, canViewCommunityHub, postNotifyTargets } from '@/lib/community'
import { sanitizeHubConfig, canDropToPool } from '@/lib/hub-config'
import { rateLimit } from '@/lib/rate-limit'
import { notifyHubMembers } from '@/lib/notifications'
import { validateDropInput, toDropDTO } from '@/lib/hub-drops'

const PAGE = 24

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  const collabIds = await collaboratorIds(id)
  const isPrivileged = !!me && (me.id === hub.userId || collabIds.includes(me.id))
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const before = new URL(request.url).searchParams.get('before')
  const where: any = { hubId: id }
  if (!isPrivileged) where.hidden = false
  if (before) { const d = new Date(before); if (!isNaN(d.getTime())) where.createdAt = { lt: d } }

  const rows = await db.hubDrop.findMany({
    where, orderBy: { createdAt: 'desc' }, take: PAGE + 1,
    include: { author: { select: { id: true, username: true, name: true, avatar: true } } },
  })
  const hasMore = rows.length > PAGE
  const page = hasMore ? rows.slice(0, PAGE) : rows
  const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null
  return NextResponse.json({ drops: page.map(toDropDTO), nextCursor })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-drop-create' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, title: true, slug: true, config: true, user: { select: { username: true } } } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabIds = await collaboratorIds(id)
  const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
  const isPrivileged = me.id === hub.userId || collabIds.includes(me.id)
  const participates = canParticipate(me.id, hub, collabIds, isMember)
  const config = sanitizeHubConfig(hub.config)
  if (!canDropToPool({ canParticipate: participates, whoCanDrop: config.kollab.whoCanDrop, isPrivileged })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = validateDropInput(await request.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value
  const drop = await db.hubDrop.create({
    data: { hubId: id, authorId: me.id, type: v.type, url: v.url, thumbnailUrl: v.thumbnailUrl, caption: v.caption, mimeType: v.mimeType, width: v.width, height: v.height },
  })
  const memberIds = (await db.hubMember.findMany({ where: { hubId: id }, select: { userId: true } })).map((m) => m.userId)
  const targets = postNotifyTargets({ authorId: me.id, ownerId: hub.userId, collabIds, memberIds })
  await notifyHubMembers(targets, {
    type: 'hub_drop',
    actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
    entityUrl: `/${hub.user.username}/hub/${hub.slug}`,
    contextText: hub.title,
  })
  return NextResponse.json({ id: drop.id }, { status: 201 })
}
```

> Note: `canModerate` import is used by the sibling `[dropId]` route (Task 7), not here — do not import it in this file if unused (tsc/lint will flag). Keep this file's imports to exactly what it uses.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "src/app/api/hubs/[id]/drops/route.test.ts"`
Expected: PASS. Then `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/drops/route.ts" "src/app/api/hubs/[id]/drops/route.test.ts"
git commit -m "feat(m3b): create + list drops API"
```

---

### Task 7: Delete + hide drop route

**Files:**
- Create: `src/app/api/hubs/[id]/drops/[dropId]/route.ts`
- Create: `src/app/api/hubs/[id]/drops/[dropId]/route.test.ts`

**Interfaces:**
- Consumes: `canModerate` (`src/lib/community.ts`).
- Produces: `DELETE /api/hubs/[id]/drops/[dropId]` → `{ ok: true }`; `PATCH …` body `{ hidden: boolean }` → `{ ok: true }`. Both IDOR-scoped `findFirst({ id: dropId, hubId })` → 404.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/hubs/[id]/drops/[dropId]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubDrop: { findFirst: vi.fn(), delete: vi.fn(async () => ({})), update: vi.fn(async () => ({})) },
  },
}))

import { DELETE, PATCH } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

const params = { params: Promise.resolve({ id: 'hub1', dropId: 'drop1' }) }
const req = (body?: any) => ({ json: async () => body } as any)
beforeEach(() => vi.clearAllMocks())

it('DELETE 404 when drop not in this hub (IDOR scope)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubDrop.findFirst as any).mockResolvedValue(null)
  const res = await DELETE(req(), params)
  expect(res.status).toBe(404)
})

it('DELETE 403 when neither author nor moderator', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'someoneElse', hubId: 'hub1' })
  const res = await DELETE(req(), params)
  expect(res.status).toBe(403)
})

it('DELETE 200 for the author', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'author' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1' })
  const res = await DELETE(req(), params)
  expect(res.status).toBe(200)
  expect(db.hubDrop.delete).toHaveBeenCalledWith({ where: { id: 'drop1' } })
})

it('PATCH 403 hide by a plain author (not moderator)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'author' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1' })
  const res = await PATCH(req({ hidden: true }), params)
  expect(res.status).toBe(403)
})

it('PATCH 200 hide by owner', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1' })
  const res = await PATCH(req({ hidden: true }), params)
  expect(res.status).toBe(200)
  expect(db.hubDrop.update).toHaveBeenCalledWith({ where: { id: 'drop1' }, data: { hidden: true } })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/hubs/[id]/drops/[dropId]/route.test.ts"`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Write `src/app/api/hubs/[id]/drops/[dropId]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'

async function load(hubId: string, dropId: string, userId: string) {
  const hub = await db.hub.findUnique({ where: { id: hubId }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const drop = await db.hubDrop.findFirst({ where: { id: dropId, hubId }, select: { id: true, authorId: true } })
  if (!drop) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const collabIds = (await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })).map((r) => r.userId)
  return { hub, drop, collabIds }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; dropId: string }> }) {
  const { id, dropId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await load(id, dropId, me.id)
  if ('error' in r) return r.error
  const isAuthor = r.drop.authorId === me.id
  if (!isAuthor && !canModerate(me.id, r.hub, r.collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.hubDrop.delete({ where: { id: dropId } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; dropId: string }> }) {
  const { id, dropId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await load(id, dropId, me.id)
  if ('error' in r) return r.error
  if (!canModerate(me.id, r.hub, r.collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const hidden = body?.hidden === true
  await db.hubDrop.update({ where: { id: dropId }, data: { hidden } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run tests + tsc**

Run: `npx vitest run "src/app/api/hubs/[id]/drops/[dropId]/route.test.ts"` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/drops/[dropId]"
git commit -m "feat(m3b): delete + hide drop API (IDOR-scoped)"
```

---

### Task 8: Blob upload token route

**Files:**
- Create: `src/app/api/hubs/[id]/drops/upload/route.ts`

**Interfaces:**
- Consumes: `@vercel/blob/client` `handleUpload`; `canParticipate`, `canDropToPool`, `sanitizeHubConfig`; `VIDEO_TYPES`, `MAX_VIDEO`, `IMAGE_TYPES`/`MAX_IMAGE` (export `IMAGE_TYPES` + `MAX_IMAGE` from `upload-validate.ts` if not already exported).
- Produces: `POST /api/hubs/[id]/drops/upload` — issues a client upload token gated on hub-drop permission, restricted to image/video MIME up to 100MB.

- [ ] **Step 1: Export the image constants from `upload-validate.ts`**

Ensure `IMAGE_TYPES` and `MAX_IMAGE` are exported (add `export` to their declarations if needed):

```ts
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
export const MAX_IMAGE = 10 * 1024 * 1024
```

- [ ] **Step 2: Write the route**

Create `src/app/api/hubs/[id]/drops/upload/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate } from '@/lib/community'
import { sanitizeHubConfig, canDropToPool } from '@/lib/hub-config'
import { blobReadWriteToken } from '@/lib/storage-env'
import { IMAGE_TYPES, MAX_IMAGE, VIDEO_TYPES, MAX_VIDEO } from '@/lib/upload-validate'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = blobReadWriteToken()
  if (!token) return NextResponse.json({ error: 'Uploads unavailable' }, { status: 503 })
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, config: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabIds = (await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })).map((r) => r.userId)
  const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
  const isPrivileged = me.id === hub.userId || collabIds.includes(me.id)
  const config = sanitizeHubConfig(hub.config)
  const allowed = canDropToPool({ canParticipate: canParticipate(me.id, hub, collabIds, isMember), whoCanDrop: config.kollab.whoCanDrop, isPrivileged })
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json()) as HandleUploadBody
  try {
    const json = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [...IMAGE_TYPES, ...VIDEO_TYPES],
        maximumSizeInBytes: Math.max(MAX_IMAGE, MAX_VIDEO),
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId: me.id, hubId: id }),
      }),
      onUploadCompleted: async () => { /* no-op: client creates the HubDrop row */ },
    })
    return NextResponse.json(json)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
```

> `handleUpload` accepts an explicit `token` param so we can reuse `blobReadWriteToken()` (prod uses a Sensitive-named var — see storage-env). Confirm the installed `@vercel/blob` version's `handleUpload` signature accepts `token`; if it reads `BLOB_READ_WRITE_TOKEN` from env instead, set that env resolution in `storage-env` usage accordingly.

- [ ] **Step 3: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean. (No unit test here — the gating logic is covered by `canDropToPool` tests; this route is verified in the E2E task.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/hubs/[id]/drops/upload/route.ts" src/lib/upload-validate.ts
git commit -m "feat(m3b): membership-gated Blob upload token route for drops"
```

---

### Task 9: `CommunityKollab` public component + uploader

**Files:**
- Create: `src/components/hub/community/CommunityKollab.tsx`

**Interfaces:**
- Consumes: `DropDTO` type (Task 2); `GET/POST /api/hubs/[id]/drops`, `DELETE /api/hubs/[id]/drops/[dropId]`, `POST /api/hubs/[id]/drops/upload`; `@vercel/blob/client` `upload`.
- Produces: `<CommunityKollab hubId canDrop isPrivileged currentUserId enabled initialDrops preview />`.

- [ ] **Step 1: Write the component**

Create `src/components/hub/community/CommunityKollab.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { ImagePlus, Loader2, Play, X, Trash2 } from 'lucide-react'
import type { DropDTO } from '@/lib/hub-drops'

async function captureVideoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.src = URL.createObjectURL(file)
      video.onloadeddata = () => { video.currentTime = Math.min(0.1, video.duration || 0.1) }
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth; canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(video, 0, 0)
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8)
      }
      video.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
}

export function CommunityKollab({
  hubId, canDrop, isPrivileged, currentUserId, enabled, initialDrops, preview,
}: {
  hubId: string
  canDrop: boolean
  isPrivileged: boolean
  currentUserId?: string
  enabled: boolean
  initialDrops: DropDTO[]
  preview?: boolean
}) {
  const [drops, setDrops] = useState<DropDTO[]>(initialDrops)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<DropDTO | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!enabled) return null

  const uploadUrl = `/api/hubs/${hubId}/drops/upload`

  async function handleFiles(files: FileList | null) {
    if (!files || preview) return
    setError(null)
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      if (!isVideo && !isImage) { setError('Only photos and video are allowed'); continue }
      setUploading(true)
      try {
        const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: uploadUrl })
        let thumbnailUrl: string | null = null
        if (isVideo) {
          const poster = await captureVideoPoster(file)
          if (poster) {
            const pb = await upload(`${file.name}.poster.jpg`, poster, { access: 'public', handleUploadUrl: uploadUrl })
            thumbnailUrl = pb.url
          }
        }
        const res = await fetch(`/api/hubs/${hubId}/drops`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: isVideo ? 'video' : 'image', url: blob.url, thumbnailUrl, mimeType: file.type }),
        })
        if (!res.ok) { setError((await res.json()).error || 'Upload failed'); continue }
        const { id } = await res.json()
        const me = { userId: currentUserId || '', username: 'you', name: null, avatar: null }
        setDrops((cur) => [{ id, type: isVideo ? 'video' : 'image', url: blob.url, thumbnailUrl, caption: null, mimeType: file.type, width: null, height: null, hidden: false, createdAt: new Date().toISOString(), author: me }, ...cur])
      } catch (e) {
        setError((e as Error).message || 'Upload failed')
      } finally {
        setUploading(false)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function remove(id: string) {
    if (!confirm('Remove this from the pool?')) return
    const res = await fetch(`/api/hubs/${hubId}/drops/${id}`, { method: 'DELETE' })
    if (res.ok) setDrops((cur) => cur.filter((d) => d.id !== id))
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Kollab</h2>
          <p className="text-sm text-muted-foreground">Drop your clips &amp; photos into the community pool.</p>
        </div>
        {canDrop && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Drop content'}
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

      {drops.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {canDrop ? 'Be the first to drop a clip or photo.' : 'Nothing in the pool yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {drops.map((d) => (
            <div key={d.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
              <button onClick={() => setLightbox(d)} className="block h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.thumbnailUrl || (d.type === 'image' ? d.url : '')} alt={d.caption || ''} className="h-full w-full object-cover" />
                {d.type === 'video' && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Play className="h-8 w-8 text-white drop-shadow" fill="currentColor" />
                  </span>
                )}
              </button>
              {(isPrivileged || d.author.userId === currentUserId) && (
                <button onClick={() => remove(d.id)} title="Remove" className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 text-white" onClick={() => setLightbox(null)}><X className="h-6 w-6" /></button>
          <div className="max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {lightbox.type === 'video' ? (
              <video src={lightbox.url} controls autoPlay className="max-h-[80vh] w-full rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt={lightbox.caption || ''} className="max-h-[80vh] w-full rounded-lg object-contain" />
            )}
            <p className="mt-2 text-center text-sm text-white/80">{lightbox.caption} <span className="text-white/50">· {lightbox.author.name || lightbox.author.username}</span></p>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/community/CommunityKollab.tsx
git commit -m "feat(m3b): CommunityKollab pool component + uploader + lightbox"
```

---

### Task 10: Wire the pool into the public page

**Files:**
- Modify: `src/components/hub/community/CommunityHubView.tsx`
- Modify: `src/app/[username]/hub/[slug]/page.tsx`
- Modify: `src/components/hub/community/CommunityHeader.tsx` (add Kollab stat)

**Interfaces:**
- Consumes: `CommunityKollab` (Task 9), `DropDTO`.
- Produces: the pool renders above the feed grid when `config.kollab.enabled`; header shows a Kollab count.

- [ ] **Step 1: Extend the page data fetch**

In `src/app/[username]/hub/[slug]/page.tsx`, inside the `if (hub.community)` block's `Promise.all` (currently fetches memberRows, items, postsCount, mine, eventRows, eventsCount), add two more reads:

```ts
      db.hubDrop.findMany({
        where: { hubId: hub.id, hidden: false },
        orderBy: { createdAt: 'desc' }, take: 24,
        include: { author: { select: { id: true, username: true, name: true, avatar: true } } },
      }),
      db.hubDrop.count({ where: { hubId: hub.id, hidden: false } }),
```

Destructure them (append to the array): `..., dropRows, dropsCount]`. Import `toDropDTO`:

```ts
import { toDropDTO } from '@/lib/hub-drops'
```

Compute `const drops = dropRows.map(toDropDTO)`. Pass to `CommunityHubView`:

```tsx
        drops={drops}
        counts={{ posts: postsCount, members: members.length, resources: resources.length, events: eventsCount, kollab: dropsCount }}
```

- [ ] **Step 2: Render the pool in `CommunityHubView`**

Add to the props type: `drops: DropDTO[]` and extend `counts` with `kollab: number`. Import:

```tsx
import { CommunityKollab } from './CommunityKollab'
import type { DropDTO } from '@/lib/hub-drops'
```

Render `CommunityKollab` full-width, directly under `CommunityHeader` and **before** the feed+sidebar grid. Compute `canDrop` the same way the feed computes `canPost` (participant AND `config.kollab.whoCanDrop` allows — reuse the `canDropToPool` helper if the view already knows `isPrivileged`/`joined`; a member is `joined`):

```tsx
{config.kollab.enabled && (
  <div className="mx-auto w-full max-w-6xl px-4">
    <CommunityKollab
      hubId={hub.id}
      canDrop={(config.kollab.whoCanDrop === 'owner-only' ? isPrivileged : (isPrivileged || joined))}
      isPrivileged={isPrivileged}
      currentUserId={currentUserId}
      enabled={config.kollab.enabled}
      initialDrops={drops}
      preview={preview}
    />
  </div>
)}
```

(Match the existing container width/padding classes `CommunityHubView` uses for its sections — read the file and mirror them exactly; the `max-w-6xl px-4` above is a placeholder for whatever the surrounding sections use.)

- [ ] **Step 3: Add the Kollab stat to the header**

In `src/components/hub/community/CommunityHeader.tsx`, the stats row renders posts/members/resources/events from `counts`. Add a Kollab entry mirroring the events stat exactly (label "Kollab", value `counts.kollab`). Update the header's `counts` prop type to include `kollab: number`.

- [ ] **Step 4: Verify tsc + build**

Run: `npx tsc --noEmit` → clean.
Run (top-level checkout): `npx next lint` → no new errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[username]/hub/[slug]/page.tsx" src/components/hub/community/CommunityHubView.tsx src/components/hub/community/CommunityHeader.tsx
git commit -m "feat(m3b): render Kollab pool on community page + header stat"
```

---

### Task 11: Builder — toggle, whoCanDrop, Manage drops modal

**Files:**
- Create: `src/components/hub/builder/HubDropsModal.tsx`
- Modify: the Layout & Sections builder section component (find it under `src/components/hub/builder/` — the one that renders the sidebar widget toggles and the events "Manage" button, mirroring `HubEventsModal` usage).

**Interfaces:**
- Consumes: `HubConfig` (writes `config.kollab`), `GET/DELETE/PATCH /api/hubs/[id]/drops`.
- Produces: an owner UI row to enable/disable the pool + set `whoCanDrop`, and a modal to review/hide/delete drops.

- [ ] **Step 1: Read `HubEventsModal.tsx` for the exact pattern**

Read `src/components/hub/builder/HubEventsModal.tsx` and the Layout & Sections section that opens it. Mirror its structure (fetch with `?scope=all` equivalent, list, delete). For drops, owner view fetches `GET /api/hubs/{id}/drops` (privileged → includes hidden).

- [ ] **Step 2: Write `HubDropsModal.tsx`**

Create `src/components/hub/builder/HubDropsModal.tsx` — a modal that:
- On open, `fetch('/api/hubs/'+hubId+'/drops')` and shows a grid of thumbnails (image `url`/video `thumbnailUrl`), each with the author name, a hide/unhide toggle (`PATCH {hidden}`) and a delete button (`DELETE`).
- Uses the same modal shell pattern as `HubEventsModal` (copy its overlay/close/structure; do not invent a new one).

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Trash2, Eye, EyeOff } from 'lucide-react'
import type { DropDTO } from '@/lib/hub-drops'

export function HubDropsModal({ hubId, onClose }: { hubId: string; onClose: () => void }) {
  const [drops, setDrops] = useState<DropDTO[]>([])
  useEffect(() => {
    fetch(`/api/hubs/${hubId}/drops`).then((r) => (r.ok ? r.json() : { drops: [] })).then((d) => setDrops(d.drops || []))
  }, [hubId])

  async function toggleHide(d: DropDTO) {
    const res = await fetch(`/api/hubs/${hubId}/drops/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden: !d.hidden }) })
    if (res.ok) setDrops((cur) => cur.map((x) => (x.id === d.id ? { ...x, hidden: !x.hidden } : x)))
  }
  async function remove(d: DropDTO) {
    if (!confirm('Delete permanently?')) return
    const res = await fetch(`/api/hubs/${hubId}/drops/${d.id}`, { method: 'DELETE' })
    if (res.ok) setDrops((cur) => cur.filter((x) => x.id !== d.id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-bold">Manage drops ({drops.length})</h2>
        {drops.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">The pool is empty.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {drops.map((d) => (
              <div key={d.id} className={`relative aspect-square overflow-hidden rounded-lg bg-muted ${d.hidden ? 'opacity-50' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.thumbnailUrl || (d.type === 'image' ? d.url : '')} alt="" className="h-full w-full object-cover" />
                <div className="absolute bottom-1 right-1 flex gap-1">
                  <button onClick={() => toggleHide(d)} title={d.hidden ? 'Unhide' : 'Hide'} className="rounded bg-black/60 p-1 text-white">
                    {d.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => remove(d)} title="Delete" className="rounded bg-black/60 p-1 text-white"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-border py-2 text-sm">Close</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add the Kollab row to Layout & Sections**

In the Layout & Sections builder section, add a "Kollab pool" row (mirroring the events widget row) with:
- an enable toggle bound to `config.kollab.enabled` (updates config via the section's existing `onChange`/update mechanism — mirror how the sidebar widget toggles write config),
- a `whoCanDrop` `<select>` (`members` / `owner-only`) bound to `config.kollab.whoCanDrop`,
- a "Manage drops" button that opens `HubDropsModal`.

Follow the exact config-update pattern the surrounding toggles use (read the file; do not introduce a new state mechanism).

- [ ] **Step 4: Verify tsc + lint + commit**

Run: `npx tsc --noEmit` → clean; `npx next lint` (top-level) → no new errors.
```bash
git add src/components/hub/builder/HubDropsModal.tsx src/components/hub/builder/
git commit -m "feat(m3b): builder Kollab toggle + whoCanDrop + Manage drops modal"
```

---

### Task 12: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Scoped unit suite**

Run:
```bash
npx vitest run src/lib/hub-drops.test.ts src/lib/hub-config.kollab.test.ts src/lib/notifications-format.drop.test.ts src/lib/upload-validate.video.test.ts "src/app/api/hubs/[id]/drops/route.test.ts" "src/app/api/hubs/[id]/drops/[dropId]/route.test.ts"
```
Expected: all PASS.

- [ ] **Step 2: Real-login E2E on a throwaway DB**

Spin up a fresh `pages_m3b` database, `prisma migrate deploy`, seed an owner + a member (follow the E2E harness used for M3a — cookie `galli-auth=<jwt>` signed with `.env` JWT_SECRET). Verify, against server truth:
1. Member `POST /drops` (image) → 201; row exists; `hub_drop` notification rows created for owner (not the author).
2. `GET /drops` as anon on a **published** community → the drop present; on a **draft** community → 404.
3. Owner sets `config.kollab.whoCanDrop = 'owner-only'` via `PATCH /api/hubs/[id]` → member `POST /drops` → 403; owner `POST /drops` → 201.
4. Owner `PATCH /drops/[dropId] {hidden:true}` → anon `GET /drops` no longer returns it; owner `GET /drops` still does.
5. Cross-hub IDOR: `DELETE /api/hubs/otherHub/drops/[dropId]` → 404.
6. Author deletes own drop → 200; non-author non-mod → 403.

- [ ] **Step 3: Prod-shape smoke (after deploy)**

`GET /api/hubs/<bogus-id>/drops` → 404 (route live, table exists, not 500).

- [ ] **Step 4: Full gate before merge**

From the top-level checkout on the merged code: `npx tsc --noEmit`, `npx next lint`, `npx next build` all clean. Then the Vercel deploy (tsc+lint+build+`prisma migrate deploy`) is the real prod gate.

---

## Self-review notes (author)

- **Spec coverage:** HubDrop model (T1) ✓; helper (T2) ✓; video upload (T3, T8) ✓; kollab config + access (T4) ✓; hub_drop notification (T5) ✓; create/list + read-gate + rate-limit + whoCanDrop (T6) ✓; delete/hide + IDOR (T7) ✓; membership-gated Blob token (T8) ✓; full-width public section + grid + lightbox + uploader + header stat (T9, T10) ✓; builder toggle + whoCanDrop + moderation modal (T11) ✓; E2E (T12) ✓.
- **Deferred per spec:** AI engine, Notes surfacing, Tools, reactions/comments on drops, albums — none appear as tasks (correct).
- **Type consistency:** `DropDTO`/`DropType`/`DropAuthor` defined in T2 and consumed unchanged in T6/T9/T10/T11. `canDropToPool` signature identical across T4/T6/T8. `counts.kollab` added in T10 page + view + header.
- **Known implementer checkpoints (call out, not placeholders):** exact container classes in `CommunityHubView` (T10 S2) and the config-update mechanism + modal shell in the builder (T11) must be read from the existing files and mirrored — the plan says so explicitly and gives the surrounding pattern to copy. `handleUpload` `token` param (T8) must be confirmed against the installed `@vercel/blob` version.
```

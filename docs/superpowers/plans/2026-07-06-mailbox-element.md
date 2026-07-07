# Mailbox Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `mailbox` element: visitors leave private written or audio messages that go straight to the publisher's dedicated `/messages` inbox (never shown on the page), with a bell notification on arrival.

**Architecture:** A new `Message` Prisma model (with a denormalized `ownerId` for a one-query cross-page inbox). A public, rate-limited submit route; owner-only list/read/delete/unread-count routes. A public capture element (text + in-browser MediaRecorder audio with an upload fallback, reusing the existing `/api/upload`). An owner inbox page + a sidebar nav item with an unread badge. A new `'message'` notification type.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma/PostgreSQL, Tailwind, Vitest + Testing Library.

## Global Constraints

- Package manager **pnpm**. Adds **NO new npm dependencies**.
- DB access needs `DATABASE_URL` set inline per command, IPv4: `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (also `export DATABASE_URL_UNPOOLED="$DATABASE_URL"` for `migrate deploy`). NEVER `prisma migrate dev`; hand-write the migration folder + SQL then `prisma migrate deploy`.
- Message types v1: `'text'` and `'audio'` only (`kind` column is kind-agnostic for future `'video'`).
- Public audio uploads go to a NEW public, rate-limited `POST /api/messages/upload` route (audio-only, validated at 25MB via `validateUpload`, reuses the same Blob/local-fs logic as `/api/upload`). The EXISTING `/api/upload` is OWNER-ONLY (returns 401 for anonymous callers), so a public visitor cannot use it — this new route is required.
- Public submit is the only unauthenticated surface: rate-limited (`rateLimit` from `@/lib/rate-limit`), **honeypot** (`hp`) → silent 200 no-persist, `ipHash` (hashed, `createHash('sha256').update(ip + getJwtSecret()).digest('hex').substring(0,16)`), and the display must exist **and be published**.
- Owner routes verify `getUser` + `message.ownerId === user.id`.
- Notification: `createNotification({ userId: ownerId, type: 'message', actor: { id: null, name: senderName || 'Someone' }, entityUrl: '/messages', contextText: display.title })`. Never import `notifications.ts` into a client component (client uses `notifications-format.ts`).
- Standard add-an-element seams; NO `PageEditor` edit (its `default:` handles it). Slash-menu category **Forms**.
- Editor props `{ element, onChange, onDelete, isSelected, onSelect }`; public props `{ element }`. Components are `'use client'`.
- Verify with `npx tsc --noEmit` + `npx vitest run <file>`. Don't run `pnpm build` while a dev server runs. Commit after each task.

---

## File Structure

**Create:**
- `prisma/migrations/20260706130000_add_message/migration.sql`
- `src/app/api/messages/route.ts` — `POST` (public submit) + `GET` (owner list)
- `src/app/api/messages/route.test.ts`
- `src/app/api/messages/upload/route.ts` — `POST` public, rate-limited, audio-only upload
- `src/app/api/messages/upload/route.test.ts`
- `src/app/api/messages/[id]/route.ts` — `PATCH` + `DELETE` (owner)
- `src/app/api/messages/[id]/route.test.ts`
- `src/app/api/messages/unread-count/route.ts`
- `src/components/elements/MailboxElement.tsx` (editor) + `PublicMailboxElement.tsx` (public)
- `src/components/elements/PublicMailboxElement.test.tsx`
- `src/app/(dashboard)/messages/page.tsx` — inbox
- `src/components/dashboard/MessagesInbox.tsx` — inbox client + test `MessagesInbox.test.tsx`
- `src/components/dashboard/MessagesNavBadge.tsx` — sidebar unread badge

**Modify:**
- `prisma/schema.prisma` — `Message` model.
- `src/lib/notifications-format.ts` — add `'message'` to the union + a `formatNotification` case.
- `src/lib/types/canvas.ts` — `ElementType 'mailbox'` + `mailbox*` fields + `createElement` default.
- `src/components/canvas/SlashCommandMenu.tsx`, `src/components/canvas/ColumnCanvas.tsx`, `src/components/elements/index.ts`, `src/lib/render-elements.tsx` — wiring.
- `src/components/dashboard/SidebarContent.tsx` — a "Messages" nav item + the badge.

---

## Task 1: `Message` model + migration

**Files:**
- Modify: `prisma/schema.prisma` (after the `Comment` model, ~line 258)
- Create: `prisma/migrations/20260706130000_add_message/migration.sql`

**Interfaces:**
- Produces: Prisma model `Message` accessible as `db.message` with fields `id, displayId, ownerId, elementId, kind, body?, mediaUrl?, senderName?, senderEmail?, read, createdAt, ipHash?`.

- [ ] **Step 1: Add the model**

Append after the `Comment` model in `prisma/schema.prisma`:

```prisma
model Message {
  id          String   @id @default(cuid())
  displayId   String
  display     Display  @relation(fields: [displayId], references: [id], onDelete: Cascade)
  ownerId     String   // = display.userId, denormalized for the cross-page inbox
  elementId   String
  kind        String   // 'text' | 'audio' (future 'video')
  body        String?
  mediaUrl    String?
  senderName  String?
  senderEmail String?
  read        Boolean  @default(false)
  createdAt   DateTime @default(now())
  ipHash      String?

  @@index([ownerId, read])
  @@index([ownerId, createdAt])
  @@index([displayId])
}
```

(No back-relation is added to `Display`/`User` beyond the existing `Display.messages`? — the `display Message[]` back-relation is REQUIRED by Prisma for the `Message.display` relation. Add `messages Message[]` to the `Display` model, next to its other relations e.g. after `liveFeeds LiveFeed[]`.)

- [ ] **Step 2: Add the Display back-relation**

In the `Display` model, add:
```prisma
  messages        Message[]
```

- [ ] **Step 3: Create the migration SQL**

Create `prisma/migrations/20260706130000_add_message/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT,
    "mediaUrl" TEXT,
    "senderName" TEXT,
    "senderEmail" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_ownerId_read_idx" ON "Message"("ownerId", "read");
CREATE INDEX "Message_ownerId_createdAt_idx" ON "Message"("ownerId", "createdAt");
CREATE INDEX "Message_displayId_idx" ON "Message"("displayId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Apply + regenerate**

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
npx prisma migrate deploy
npx prisma generate
```
Expected: "All migrations have been successfully applied." + "Generated Prisma Client".

- [ ] **Step 5: Verify no drift**

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
```
Expected: exit 0, "No difference detected".

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260706130000_add_message
git commit -m "feat(mailbox): Message prisma model + migration"
```

---

## Task 2: `'message'` notification type + formatter

**Files:**
- Modify: `src/lib/notifications-format.ts`
- Test: `src/lib/notifications-format.test.ts` (create if absent; else append)

**Interfaces:**
- Consumes: nothing.
- Produces: `NotificationType` includes `'message'`; `formatNotification({type:'message', actorName, contextText})` → a string mentioning the page.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/notifications-format.test.ts
import { describe, it, expect } from 'vitest'
import { formatNotification } from './notifications-format'

describe('formatNotification message', () => {
  it('formats a message notification with the page title', () => {
    expect(formatNotification({ type: 'message', actorName: 'Someone', contextText: 'My Page' }))
      .toBe('Someone sent you a message on “My Page”')
  })
  it('falls back when no page title', () => {
    expect(formatNotification({ type: 'message', actorName: 'Ann', contextText: null }))
      .toBe('Ann sent you a message')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notifications-format.test.ts`
Expected: FAIL (returns just the actorName via the `default` case).

- [ ] **Step 3: Implement**

In `src/lib/notifications-format.ts`, add `'message'` to the union:
```ts
export type NotificationType = 'follow' | 'bulletin' | 'page_published' | 'comment' | 'message'
```
And add a case before `default:`:
```ts
    case 'message':
      return `${n.actorName} sent you a message${n.contextText ? ` on “${n.contextText}”` : ''}`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notifications-format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications-format.ts src/lib/notifications-format.test.ts
git commit -m "feat(mailbox): 'message' notification type + formatter"
```

---

## Task 3: Public message API — submit + audio upload (+ owner list)

**Files:**
- Create: `src/app/api/messages/route.ts`
- Create: `src/app/api/messages/upload/route.ts`
- Test: `src/app/api/messages/route.test.ts`, `src/app/api/messages/upload/route.test.ts`

**Interfaces:**
- Consumes: `db.message` (T1); `createNotification` (`@/lib/notifications`); `rateLimit` (`@/lib/rate-limit`); `getUser`, `getJwtSecret` (`@/lib/auth`); `validateUpload`, `extensionForMime` (`@/lib/upload-validate`); `blobReadWriteToken` (`@/lib/storage-env`).
- Produces: `POST /api/messages` (public submit), `GET /api/messages` (owner list, `?filter=unread`), `POST /api/messages/upload` (public audio upload → `{ url }`).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/messages/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getUser: vi.fn(), getJwtSecret: () => 'test-secret' }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    message: { create: vi.fn().mockResolvedValue({ id: 'm1' }), findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { POST, GET } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'

const mailboxDisplay = {
  id: 'd1', userId: 'owner1', title: 'My Page', published: true,
  sections: [{ columns: [{ elements: [{ id: 'el-mb', type: 'mailbox', mailboxRequireName: false }] }] }],
  tabs: null,
}
const post = (body: unknown) => new NextRequest('http://localhost/api/messages', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => vi.clearAllMocks())

describe('POST /api/messages', () => {
  it('persists a text message, sets ownerId, fires a notification', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(mailboxDisplay)
    const res = await POST(post({ displayId: 'd1', elementId: 'el-mb', kind: 'text', body: 'hi' }))
    expect(res.status).toBe(201)
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ displayId: 'd1', ownerId: 'owner1', elementId: 'el-mb', kind: 'text', body: 'hi' }),
    }))
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner1', type: 'message' }))
  })

  it('honeypot filled → 200 and nothing persisted', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(mailboxDisplay)
    const res = await POST(post({ displayId: 'd1', elementId: 'el-mb', kind: 'text', body: 'hi', hp: 'bot' }))
    expect(res.status).toBe(200)
    expect(db.message.create).not.toHaveBeenCalled()
  })

  it('unpublished display → 404', async () => {
    ;(db.display.findUnique as any).mockResolvedValue({ ...mailboxDisplay, published: false })
    const res = await POST(post({ displayId: 'd1', elementId: 'el-mb', kind: 'text', body: 'hi' }))
    expect(res.status).toBe(404)
  })

  it('no mailbox element with that id → 400', async () => {
    ;(db.display.findUnique as any).mockResolvedValue({ ...mailboxDisplay, sections: [] })
    const res = await POST(post({ displayId: 'd1', elementId: 'ghost', kind: 'text', body: 'hi' }))
    expect(res.status).toBe(400)
  })

  it('empty text and no media → 400', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(mailboxDisplay)
    const res = await POST(post({ displayId: 'd1', elementId: 'el-mb', kind: 'text' }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/messages', () => {
  it('401 when not signed in', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/messages'))
    expect(res.status).toBe(401)
  })
  it('lists only the caller’s messages', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner1' })
    await GET(new NextRequest('http://localhost/api/messages'))
    expect(db.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ownerId: 'owner1' }),
    }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/messages/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Implement**

```ts
// src/app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { getUser, getJwtSecret } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'

interface MailboxNode { id: string; type: string; mailboxRequireName?: boolean }

// Deep-walk the display JSON for a `mailbox` element with the given id.
function findMailboxElement(json: unknown, elementId: string): MailboxNode | null {
  let found: MailboxNode | null = null
  const walk = (node: unknown) => {
    if (found) return
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      if (obj.type === 'mailbox' && obj.id === elementId) { found = obj as MailboxNode; return }
      for (const v of Object.values(obj)) walk(v)
    }
  }
  walk(json)
  return found
}

// POST — public submit
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'messages-submit' })
  if (limited) return limited

  let b: Record<string, unknown>
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  // Honeypot: silently accept, do not persist.
  if (typeof b.hp === 'string' && b.hp.trim() !== '') return NextResponse.json({ ok: true })

  const displayId = String(b.displayId ?? '')
  const elementId = String(b.elementId ?? '')
  const kind = b.kind === 'audio' ? 'audio' : 'text'
  const body = typeof b.body === 'string' ? b.body.trim() : ''
  const mediaUrl = typeof b.mediaUrl === 'string' ? b.mediaUrl : ''
  const senderName = typeof b.senderName === 'string' ? b.senderName.trim() : ''
  const senderEmail = typeof b.senderEmail === 'string' ? b.senderEmail.trim() : ''

  if (!displayId || !elementId) return NextResponse.json({ error: 'Missing target' }, { status: 400 })
  if (!body && !mediaUrl) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const display = await db.display.findUnique({
    where: { id: displayId },
    select: { id: true, userId: true, title: true, published: true, sections: true, tabs: true },
  })
  if (!display || !display.published) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const el = findMailboxElement(display.sections, elementId) || findMailboxElement(display.tabs, elementId)
  if (!el) return NextResponse.json({ error: 'No such mailbox' }, { status: 400 })
  if (el.mailboxRequireName && !senderName) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipHash = createHash('sha256').update(ip + getJwtSecret()).digest('hex').substring(0, 16)

  await db.message.create({
    data: {
      displayId, ownerId: display.userId, elementId, kind,
      body: body || null, mediaUrl: mediaUrl || null,
      senderName: senderName || null, senderEmail: senderEmail || null, ipHash,
    },
  })

  await createNotification({
    userId: display.userId, type: 'message',
    actor: { id: null, name: senderName || 'Someone' },
    entityUrl: '/messages', contextText: display.title,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}

// GET — owner list
export async function GET(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const filter = request.nextUrl.searchParams.get('filter')
  const messages = await db.message.findMany({
    where: { ownerId: me.id, ...(filter === 'unread' ? { read: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { display: { select: { title: true, slug: true } } },
  })
  return NextResponse.json({ messages })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/messages/route.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing test for the public upload route**

```ts
// src/app/api/messages/upload/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/storage-env', () => ({ blobReadWriteToken: () => null })) // force local path; gating returns before fs anyway
vi.mock('@/lib/upload-validate', () => ({
  validateUpload: (type: string) => (type.startsWith('audio/') ? { ok: true } : { ok: false, error: 'bad' }),
  extensionForMime: () => '.webm',
}))

import { POST } from './route'

function withFile(file: File | null): NextRequest {
  const fd = new FormData()
  if (file) fd.append('file', file)
  return new NextRequest('http://localhost/api/messages/upload', { method: 'POST', body: fd })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/messages/upload', () => {
  it('400 when no file', async () => {
    const res = await POST(withFile(null))
    expect(res.status).toBe(400)
  })
  it('400 when the file is not audio', async () => {
    const res = await POST(withFile(new File(['x'], 'a.png', { type: 'image/png' })))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/app/api/messages/upload/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 7: Implement the public upload route**

```ts
// src/app/api/messages/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { rateLimit } from '@/lib/rate-limit'
import { blobReadWriteToken } from '@/lib/storage-env'
import { validateUpload, extensionForMime } from '@/lib/upload-validate'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// Public (unauthenticated) audio upload for mailbox voice messages. Rate-limited,
// audio-only, size-capped via validateUpload. Stored under a non-user `messages/` prefix.
// (The owner-only /api/upload cannot be used by anonymous visitors.)
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'messages-upload' })
  if (limited) return limited
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.type.startsWith('audio/')) return NextResponse.json({ error: 'Audio files only' }, { status: 400 })
    const check = validateUpload(file.type, file.size)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

    const ext = path.extname(file.name) || extensionForMime(file.type)
    const name = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`

    const blobToken = blobReadWriteToken()
    if (blobToken) {
      const { put } = await import('@vercel/blob')
      const blob = await put(`messages/${name}`, file, { access: 'public', contentType: file.type, token: blobToken })
      return NextResponse.json({ url: blob.url })
    }

    // Local dev fallback (served by the existing GET /api/upload/[...] handler).
    const dir = path.join(UPLOAD_DIR, 'messages')
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()))
    return NextResponse.json({ url: `/api/upload/messages/${name}` })
  } catch (e) {
    console.error('message upload error', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
```

Note (local dev only): if the existing `GET /api/upload/[...]` handler scopes serving to user-id dirs, locally-stored `messages/` audio may not play back in dev; production (Vercel Blob) returns a direct public URL and is unaffected. Not a blocker.

- [ ] **Step 8: Run both test files to verify they pass**

Run: `npx vitest run src/app/api/messages/route.test.ts src/app/api/messages/upload/route.test.ts`
Expected: PASS (7 + 2 tests).

- [ ] **Step 9: Commit**

```bash
git add src/app/api/messages/route.ts src/app/api/messages/route.test.ts src/app/api/messages/upload
git commit -m "feat(mailbox): public submit + owner list + public audio upload"
```

---

## Task 4: Owner routes `PATCH`/`DELETE /api/messages/[id]` + `unread-count`

**Files:**
- Create: `src/app/api/messages/[id]/route.ts`
- Create: `src/app/api/messages/unread-count/route.ts`
- Test: `src/app/api/messages/[id]/route.test.ts`

**Interfaces:**
- Consumes: `db.message`, `getUser`.
- Produces: `PATCH /api/messages/[id]` `{ read }`; `DELETE /api/messages/[id]`; `GET /api/messages/unread-count` → `{ count }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/messages/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { message: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) } },
}))

import { PATCH, DELETE } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
beforeEach(() => vi.clearAllMocks())

describe('PATCH /api/messages/[id]', () => {
  it('401 unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await PATCH(new NextRequest('http://localhost/api/messages/m1', { method: 'PATCH', body: '{"read":true}' }), ctx('m1'))
    expect(res.status).toBe(401)
  })
  it('scopes the update to the caller (ownerId in where) so non-owners cannot touch it', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner1' })
    await PATCH(new NextRequest('http://localhost/api/messages/m1', { method: 'PATCH', body: '{"read":true}' }), ctx('m1'))
    expect(db.message.updateMany).toHaveBeenCalledWith({ where: { id: 'm1', ownerId: 'owner1' }, data: { read: true } })
  })
})

describe('DELETE /api/messages/[id]', () => {
  it('scopes the delete to the caller', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner1' })
    await DELETE(new NextRequest('http://localhost/api/messages/m1', { method: 'DELETE' }), ctx('m1'))
    expect(db.message.deleteMany).toHaveBeenCalledWith({ where: { id: 'm1', ownerId: 'owner1' } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/messages/[id]/route.test.ts"`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Implement**

```ts
// src/app/api/messages/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  let body: { read?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  // updateMany with ownerId in the where scopes to the caller — a non-owner's update matches 0 rows.
  const result = await db.message.updateMany({ where: { id, ownerId: me.id }, data: { read: !!body.read } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const result = await db.message.deleteMany({ where: { id, ownerId: me.id } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

```ts
// src/app/api/messages/unread-count/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const count = await db.message.count({ where: { ownerId: me.id, read: false } })
  return NextResponse.json({ count })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/messages/[id]/route.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/messages/[id]" src/app/api/messages/unread-count
git commit -m "feat(mailbox): owner PATCH/DELETE + unread-count routes"
```

---

## Task 5: Element type, fields, and default

**Files:**
- Modify: `src/lib/types/canvas.ts`

**Interfaces:**
- Produces: `ElementType` includes `'mailbox'`; `CanvasElement` gains `mailboxTitle?`, `mailboxPrompt?`, `mailboxAllowAudio?`, `mailboxRequireName?`, `mailboxButtonLabel?`, `mailboxThankYou?`; `createElement('mailbox')` default.

- [ ] **Step 1: Add to the `ElementType` union**

After the `'flowchart'` entry, add:
```ts
  | 'mailbox'      // Private written/voice messages → owner inbox (not shown on page)
```

- [ ] **Step 2: Add fields to `CanvasElement`**

After the flowchart fields block (the `flowNodes?: FlowNode[]` line), add:
```ts
  // Mailbox specific (private inbound messages; never rendered on the page)
  mailboxTitle?: string
  mailboxPrompt?: string
  mailboxAllowAudio?: boolean
  mailboxRequireName?: boolean
  mailboxButtonLabel?: string
  mailboxThankYou?: string
```

- [ ] **Step 3: Add the `createElement` default**

After the `case 'flowchart':` return, add:
```ts
    case 'mailbox':
      return {
        ...base,
        mailboxTitle: 'Send me a message',
        mailboxPrompt: 'Leave a written or voice message — it comes straight to me, privately.',
        mailboxAllowAudio: true,
        mailboxRequireName: false,
        mailboxButtonLabel: 'Send',
        mailboxThankYou: 'Thanks — your message was sent!',
      }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (render switches have `default` cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/canvas.ts
git commit -m "feat(mailbox): element type, fields, and createElement default"
```

---

## Task 6: Public + editor element components

**Files:**
- Create: `src/components/elements/PublicMailboxElement.tsx`
- Create: `src/components/elements/MailboxElement.tsx`
- Test: `src/components/elements/PublicMailboxElement.test.tsx`

**Interfaces:**
- Consumes: `CanvasElement` (T5); `POST /api/messages` (T3); `POST /api/upload` (existing, returns `{ url }`).
- Produces: `PublicMailboxElement({ element })`, `MailboxElement({ element, onChange, onDelete, isSelected, onSelect })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/elements/PublicMailboxElement.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PublicMailboxElement } from './PublicMailboxElement'
import type { CanvasElement } from '@/lib/types/canvas'

function el(over: Partial<CanvasElement> = {}): CanvasElement {
  return { id: 'el-mb', type: 'mailbox', mailboxTitle: 'Msg me', mailboxPrompt: 'say hi', mailboxButtonLabel: 'Send', mailboxThankYou: 'Thanks!', displayId: 'd1', ...over } as CanvasElement
}

beforeEach(() => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ ok: true }) })) })
afterEach(() => vi.unstubAllGlobals())

describe('PublicMailboxElement', () => {
  it('renders the prompt and a hidden honeypot', () => {
    const { container } = render(<PublicMailboxElement element={el()} />)
    expect(screen.getByText('say hi')).toBeTruthy()
    const hp = container.querySelector('input[name="hp"]') as HTMLInputElement
    expect(hp).toBeTruthy()
    expect(hp.tabIndex).toBe(-1)
  })

  it('submits a text message and shows the thank-you', async () => {
    render(<PublicMailboxElement element={el()} />)
    fireEvent.change(screen.getByPlaceholderText(/message/i), { target: { value: 'hello there' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(screen.getByText('Thanks!')).toBeTruthy())
    const call = (fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/messages'))
    expect(call).toBeTruthy()
    expect(JSON.parse(call[1].body)).toMatchObject({ displayId: 'd1', elementId: 'el-mb', kind: 'text', body: 'hello there' })
  })

  it('blocks submit when the message is empty', () => {
    render(<PublicMailboxElement element={el()} />)
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    const called = (fetch as any).mock.calls.some((c: any[]) => String(c[0]).includes('/api/messages'))
    expect(called).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/elements/PublicMailboxElement.test.tsx`
Expected: FAIL — cannot find module `./PublicMailboxElement`.

- [ ] **Step 3: Implement the public element**

```tsx
// src/components/elements/PublicMailboxElement.tsx
'use client'

import { useRef, useState } from 'react'
import { Mic, Square, Upload, Send, Inbox } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

export function PublicMailboxElement({ element }: { element: CanvasElement }) {
  const displayId = (element as { displayId?: string }).displayId || ''
  const allowAudio = element.mailboxAllowAudio ?? true
  const requireName = element.mailboxRequireName ?? false

  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [hp, setHp] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRec = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      rec.start(); recRef.current = rec; setRecording(true)
    } catch { setError('Microphone unavailable — you can upload a file instead.') }
  }
  const stopRec = () => { recRef.current?.stop(); setRecording(false) }
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setAudioBlob(f); setAudioUrl(URL.createObjectURL(f))
  }

  const submit = async () => {
    setError(null)
    if (!text.trim() && !audioBlob) { setError('Write or record a message first.'); return }
    if (requireName && !name.trim()) { setError('Please add your name.'); return }
    setSending(true)
    try {
      let mediaUrl = ''
      let kind: 'text' | 'audio' = 'text'
      if (audioBlob) {
        const fd = new FormData()
        fd.append('file', audioBlob, 'message.webm')
        const up = await fetch('/api/messages/upload', { method: 'POST', body: fd })
        if (up.ok) { const d = await up.json(); mediaUrl = d.url; kind = 'audio' }
        else { setError('Could not upload the audio.'); setSending(false); return }
      }
      const res = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayId, elementId: element.id, kind, body: text.trim() || undefined, mediaUrl: mediaUrl || undefined, senderName: name.trim() || undefined, senderEmail: email.trim() || undefined, hp }),
      })
      if (res.ok) setSent(true)
      else setError('Something went wrong — try again.')
    } catch { setError('Network error — try again.') }
    finally { setSending(false) }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <Inbox className="w-6 h-6 mx-auto text-primary mb-2" />
        <p className="text-sm font-medium text-slate-700">{element.mailboxThankYou || 'Thanks — your message was sent!'}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {element.mailboxTitle && <h3 className="text-base font-bold text-slate-900">{element.mailboxTitle}</h3>}
      {element.mailboxPrompt && <p className="mt-1 text-sm text-slate-500">{element.mailboxPrompt}</p>}

      <textarea
        value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Your message…" rows={3}
        className="mt-3 w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
      />

      {allowAudio && (
        <div className="mt-2 flex items-center gap-2">
          {!recording ? (
            <button type="button" onClick={startRec} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
              <Mic className="w-3.5 h-3.5" /> Record
            </button>
          ) : (
            <button type="button" onClick={stopRec} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700">
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Upload
            <input type="file" accept="audio/*" className="hidden" onChange={onFile} />
          </label>
          {audioUrl && <audio src={audioUrl} controls className="h-8" />}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={requireName ? 'Your name *' : 'Your name (optional)'} className="text-sm border border-slate-200 rounded-lg px-3 py-2" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="text-sm border border-slate-200 rounded-lg px-3 py-2" />
      </div>

      {/* Honeypot — hidden from humans, bots fill it */}
      <input type="text" name="hp" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <button type="button" onClick={submit} disabled={sending} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : (element.mailboxButtonLabel || 'Send')}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/elements/PublicMailboxElement.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the editor element**

```tsx
// src/components/elements/MailboxElement.tsx
'use client'

import { Trash2, Inbox } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { PublicMailboxElement } from './PublicMailboxElement'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function MailboxElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const field = (label: string, key: keyof CanvasElement, placeholder = '') => (
    <label className="block">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <input
        value={(element[key] as string) ?? ''}
        onChange={(e) => onChange({ [key]: e.target.value } as Partial<CanvasElement>)}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className="mt-0.5 w-full text-sm border border-border rounded-lg px-2 py-1.5"
      />
    </label>
  )

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      className={`relative rounded-xl border-2 bg-white p-4 cursor-pointer ${isSelected ? 'border-primary' : 'border-slate-200'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Inbox className="w-4 h-4 text-primary" /> Mailbox</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1 text-slate-400 hover:text-red-500" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="space-y-2">
        {field('Title', 'mailboxTitle')}
        {field('Prompt', 'mailboxPrompt')}
        {field('Button label', 'mailboxButtonLabel')}
        {field('Thank-you message', 'mailboxThankYou')}
        <div className="flex items-center gap-4 pt-1">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={element.mailboxAllowAudio ?? true} onChange={(e) => onChange({ mailboxAllowAudio: e.target.checked })} onClick={(e) => e.stopPropagation()} /> Allow audio
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={element.mailboxRequireName ?? false} onChange={(e) => onChange({ mailboxRequireName: e.target.checked })} onClick={(e) => e.stopPropagation()} /> Require name
          </label>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">Preview</div>
        <div className="pointer-events-none"><PublicMailboxElement element={element} /></div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Typecheck + re-run test**

Run:
```bash
npx tsc --noEmit
npx vitest run src/components/elements/PublicMailboxElement.test.tsx
```
Expected: tsc clean; tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/elements/PublicMailboxElement.tsx src/components/elements/MailboxElement.tsx src/components/elements/PublicMailboxElement.test.tsx
git commit -m "feat(mailbox): public capture element (text + audio) + editor"
```

---

## Task 7: Wiring (slash menu, canvas, exports, published page)

**Files:**
- Modify: `src/components/elements/index.ts`, `src/components/canvas/SlashCommandMenu.tsx`, `src/components/canvas/ColumnCanvas.tsx`, `src/lib/render-elements.tsx`

**Interfaces:**
- Consumes: `MailboxElement`, `PublicMailboxElement` (T6).

- [ ] **Step 1: Exports** — in `src/components/elements/index.ts` add:
```ts
export { MailboxElement } from './MailboxElement'
export { PublicMailboxElement } from './PublicMailboxElement'
```

- [ ] **Step 2: Slash menu** — in `src/components/canvas/SlashCommandMenu.tsx`:
(a) add `Inbox` to the lucide-react import list.
(b) In the **Forms** category group of the `commands` array, add:
```ts
  { id: 'mailbox', label: 'Mailbox', icon: Inbox, description: 'Collect private written/voice messages', category: 'Forms' },
```

- [ ] **Step 3: ColumnCanvas** — in `src/components/canvas/ColumnCanvas.tsx`:
(a) imports:
```ts
import { MailboxElement } from '@/components/elements/MailboxElement'
import { PublicMailboxElement } from '@/components/elements/PublicMailboxElement'
```
(b) case (mirror `kit-profile` — preview → Public, no displayId):
```tsx
      case 'mailbox':
        if (isPreviewMode) {
          return <PublicMailboxElement element={element} />
        }
        return (
          <MailboxElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

- [ ] **Step 4: render-elements** — in `src/lib/render-elements.tsx`:
(a) import `PublicMailboxElement`.
(b) The published page must pass `displayId` so the public element can submit. Confirm how `renderElement(element, displayId?)` is called on the published page and pass it through:
```tsx
    case 'mailbox':
      return <PublicMailboxElement element={{ ...element, displayId } as typeof element} />
```
(`displayId` is the function's existing param — inject it onto the element the same way, so the submit body has the right `displayId`. In `ColumnCanvas` preview the submit is inert, so passing no displayId there is fine.)

- [ ] **Step 5: Typecheck + tests**

Run:
```bash
npx tsc --noEmit
npx vitest run src/components/elements/PublicMailboxElement.test.tsx src/app/api/messages/route.test.ts
```
Expected: tsc clean; tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx
git commit -m "feat(mailbox): wire element into slash menu, canvas, exports, published page"
```

---

## Task 8: Owner inbox page + sidebar nav + unread badge

**Files:**
- Create: `src/app/(dashboard)/messages/page.tsx`
- Create: `src/components/dashboard/MessagesInbox.tsx`
- Create: `src/components/dashboard/MessagesInbox.test.tsx`
- Create: `src/components/dashboard/MessagesNavBadge.tsx`
- Modify: `src/components/dashboard/SidebarContent.tsx`

**Interfaces:**
- Consumes: `GET /api/messages`, `PATCH /api/messages/[id]`, `DELETE /api/messages/[id]`, `GET /api/messages/unread-count` (T3/T4).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/dashboard/MessagesInbox.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MessagesInbox } from './MessagesInbox'

const messages = [
  { id: 'm1', kind: 'text', body: 'hello', senderName: 'Ann', read: false, createdAt: '2026-07-06T00:00:00Z', display: { title: 'My Page' } },
  { id: 'm2', kind: 'audio', mediaUrl: 'https://blob/x.webm', senderName: null, read: true, createdAt: '2026-07-05T00:00:00Z', display: { title: 'Other' } },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string, opts?: any) => {
    if (String(url).includes('/api/messages') && (!opts || opts.method === undefined)) {
      return Promise.resolve({ ok: true, json: async () => ({ messages }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('MessagesInbox', () => {
  it('renders messages, emphasizing unread', async () => {
    render(<MessagesInbox />)
    await waitFor(() => expect(screen.getByText('hello')).toBeTruthy())
    expect(screen.getByText('Ann')).toBeTruthy()
    expect(screen.getByText('Anonymous')).toBeTruthy() // m2 has no sender name
  })

  it('deletes a message via the delete button', async () => {
    render(<MessagesInbox />)
    await waitFor(() => expect(screen.getByText('hello')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('delete-m1'))
    await waitFor(() => {
      const call = (fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/messages/m1') && c[1]?.method === 'DELETE')
      expect(call).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/MessagesInbox.test.tsx`
Expected: FAIL — cannot find module `./MessagesInbox`.

- [ ] **Step 3: Implement the inbox client**

```tsx
// src/components/dashboard/MessagesInbox.tsx
'use client'

import { useEffect, useState } from 'react'
import { Trash2, Mail, MailOpen } from 'lucide-react'

interface Msg {
  id: string; kind: string; body?: string | null; mediaUrl?: string | null
  senderName?: string | null; senderEmail?: string | null; read: boolean
  createdAt: string; display?: { title?: string | null } | null
}

export function MessagesInbox() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/messages', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => { if (!cancelled) setMessages(Array.isArray(d.messages) ? d.messages : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const markRead = async (m: Msg) => {
    if (m.read) return
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read: true } : x)))
    await fetch(`/api/messages/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) }).catch(() => {})
  }
  const remove = async (id: string) => {
    setMessages((prev) => prev.filter((x) => x.id !== id))
    await fetch(`/api/messages/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (messages.length === 0) return <p className="text-sm text-muted-foreground">No messages yet.</p>

  return (
    <ul className="space-y-2">
      {messages.map((m) => (
        <li key={m.id} onClick={() => markRead(m)}
          className={`rounded-xl border p-4 cursor-pointer ${m.read ? 'border-border bg-background' : 'border-primary/30 bg-primary/5'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                {m.read ? <MailOpen className="w-4 h-4 text-muted-foreground" /> : <Mail className="w-4 h-4 text-primary" />}
                <span className={`font-semibold ${m.read ? 'text-foreground' : 'text-foreground'}`}>{m.senderName || 'Anonymous'}</span>
                {m.display?.title && <span className="text-xs text-muted-foreground">· {m.display.title}</span>}
              </div>
              {m.body && <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">{m.body}</p>}
              {m.mediaUrl && <audio src={m.mediaUrl} controls className="mt-2 h-8" />}
              {m.senderEmail && <p className="mt-1 text-xs text-muted-foreground">{m.senderEmail}</p>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); remove(m.id) }} aria-label={`delete-${m.id}`} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/MessagesInbox.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the page + nav badge**

```tsx
// src/app/(dashboard)/messages/page.tsx
import { MessagesInbox } from '@/components/dashboard/MessagesInbox'

export default function MessagesPage() {
  return (
    <div className="px-6 lg:px-8 py-7">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-1">Messages</h1>
      <p className="text-muted-foreground mb-6">Private messages people sent you through your pages.</p>
      <MessagesInbox />
    </div>
  )
}
```

```tsx
// src/components/dashboard/MessagesNavBadge.tsx
'use client'

import { useEffect, useState } from 'react'

export function MessagesNavBadge() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    const load = () => fetch('/api/messages/unread-count', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => { if (!cancelled) setCount(Number(d.count) || 0) })
      .catch(() => {})
    load()
    const t = setInterval(load, 45000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])
  if (count <= 0) return null
  return <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">{count > 99 ? '99+' : count}</span>
}
```

- [ ] **Step 6: Add the sidebar nav item + badge**

In `src/components/dashboard/SidebarContent.tsx`:
(a) add `Inbox` to the lucide-react import and import the badge:
```ts
import { MessagesNavBadge } from '@/components/dashboard/MessagesNavBadge'
```
(b) add to the `NAV` array (after `Analytics`):
```ts
  { label: 'Messages', icon: Inbox, href: '/messages', match: (p) => p.startsWith('/messages') },
```
(c) In the default nav `<Link>` render (the block starting ~line 110), render the badge for this item when expanded. Inside the returned `<Link>`, after the label span, add:
```tsx
              {item.href === '/messages' && !collapsed && <MessagesNavBadge />}
```
(Confirm the label is rendered as a sibling you can place the badge after; match the existing structure — the badge should sit at the row's right via its `ml-auto`.)

- [ ] **Step 7: Typecheck + inbox test**

Run:
```bash
npx tsc --noEmit
npx vitest run src/components/dashboard/MessagesInbox.test.tsx
```
Expected: tsc clean; tests pass.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)/messages" src/components/dashboard/MessagesInbox.tsx src/components/dashboard/MessagesInbox.test.tsx src/components/dashboard/MessagesNavBadge.tsx src/components/dashboard/SidebarContent.tsx
git commit -m "feat(mailbox): /messages inbox page + sidebar nav item + unread badge"
```

---

## Self-Review

**Spec coverage:**
- `Message` model + denormalized `ownerId` → Task 1. ✓
- Public capture (text + in-browser audio + upload fallback + honeypot), reuse `/api/upload` → Task 6. ✓
- Submit route (published+element validation, honeypot, rate-limit, ipHash, ownerId, notification) → Task 3. ✓
- Owner routes (list/read/delete/unread-count, ownership-scoped) → Task 3 (GET) + Task 4. ✓
- `'message'` notification type + formatter → Task 2. ✓
- Dedicated `/messages` inbox + sidebar nav + unread badge → Task 8. ✓
- Element type/fields/default + wiring, category Forms → Tasks 5 + 7. ✓
- Security (rate-limit, honeypot, ipHash, published gate, ownership) → Tasks 3/4. ✓
- Tests: submit paths, ownership scoping, formatter, public element, inbox → Tasks 2–8. ✓

**Deviations from spec (intentional, noted):**
- **The spec said audio "reuses the existing `/api/upload`" — that endpoint is OWNER-ONLY (401 for anonymous), so public visitors cannot use it.** Corrected: a new public, rate-limited, audio-only `POST /api/messages/upload` route (Task 3) handles visitor audio. Same Blob/local logic, no new dependency. This is the one material correction from the spec.
- Ownership on `PATCH`/`DELETE` uses `updateMany`/`deleteMany` with `ownerId` in the `where` (the existing codebase's IDOR-safe pattern) rather than a find-then-check — a non-owner simply matches 0 rows (→ 404). Documented in Task 4.
- The public element reads `displayId` off the element object (injected by `render-elements` on the published page, Task 7); in the editor preview the submit is inert.

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `Message` fields (T1) match the route writes (T3) and inbox reads (T8). `mailbox*` field names (T5) match editor/public usage (T6). `NotificationType 'message'` (T2) matches the submit's `createNotification` call (T3). Route paths consistent (`/api/messages`, `/api/messages/[id]`, `/api/messages/unread-count`).

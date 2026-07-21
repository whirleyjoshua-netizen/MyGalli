# Messages M1 — Core DM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-way visitor inbox at `/messages` with a working member-to-member direct-messaging system: threaded conversations, text replies, a Requests bucket for strangers, and adaptive polling.

**Architecture:** Three new Prisma models (`Conversation`, `ConversationParticipant`, `DirectMessage`) plus `User.lastSeenAt`. All per-person state (read position, star, mute, accepted/requested) lives on the participant row, never the conversation. A new `/api/dm/*` route family leaves the existing `/api/messages/*` visitor mailbox untouched. The UI is a 3-column client component whose selection lives in the URL as `?c=<id>`, refreshed by one polling hook.

**Tech Stack:** Next.js 15.5 App Router, React 19, TypeScript, Prisma 5 + PostgreSQL, Tailwind, Vitest + @testing-library/react 16, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-20-messages-m1-core-dm-design.md`

## Global Constraints

- **Never modify the `Message` model or `/api/messages/*`.** That is the public visitor mailbox and must keep working unchanged. New work goes in `DirectMessage` / `/api/dm/*`.
- **Database URL must be set inline for every Prisma or dev command.** The machine-level `DATABASE_URL` points at a different database and overrides `.env`. Use `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` — `127.0.0.1`, never `localhost` (Node resolves `localhost` to IPv6, where Postgres 5434 is not listening). Prisma CLI commands also need `DATABASE_URL_UNPOOLED` set to the same value.
- **Never run `prisma migrate dev`.** It is interactive and will hang. Hand-author `migration.sql` and run `prisma migrate deploy`.
- **Never run `prisma migrate diff --from-url` against the shared dev database.** It is contaminated by concurrent branches and emits spurious `DROP TABLE` statements.
- **Every `/api/dm/conversations/[id]/*` route must verify participation from the database before any read or write, and return 404 (not 403) to non-participants** so conversation ids cannot be probed for existence.
- **Route handler files may export ONLY route handlers** (`GET`, `POST`, `PATCH`, `DELETE`, `dynamic`, etc.). Exporting a helper from a `route.ts` passes `tsc` but fails `next build` and has broken production before. Put shared helpers in `src/lib/`.
- **Run `pnpm exec next lint` before any deploy.** `tsc --noEmit` does not run ESLint, and lint errors fail the production build.
- Message bodies are capped at **4000 characters**; empty or whitespace-only bodies are rejected with 400.
- Presence window is **2 minutes** (`ONLINE_WINDOW_MS`). Poll cadences are **5s** (open thread) and **20s** (conversation list), backing off to **30s** after 3 consecutive failures.
- Conversation list pages at **30** conversations; message history pages at **30** messages.

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/lib/types/dm.ts` | Shared wire types between API and client |
| `src/lib/dm.ts` | Pure, database-free DM logic (keys, unread math, gating, day grouping, presence) |
| `src/lib/dm.test.ts` | Unit tests for the above |
| `prisma/migrations/<ts>_messages_m1_core_dm/migration.sql` | Hand-authored additive migration |
| `src/app/api/dm/conversations/route.ts` | List conversations, find-or-create a conversation |
| `src/app/api/dm/conversations/route.test.ts` | Tests for the above |
| `src/app/api/dm/conversations/[id]/route.ts` | Accept / ignore / star / mute |
| `src/app/api/dm/conversations/[id]/route.test.ts` | Tests for the above |
| `src/app/api/dm/conversations/[id]/messages/route.ts` | Thread read + send |
| `src/app/api/dm/conversations/[id]/messages/route.test.ts` | Tests for the above |
| `src/app/api/dm/conversations/[id]/read/route.ts` | Mark thread read |
| `src/app/api/dm/unread-count/route.ts` | Nav badge count |
| `src/hooks/usePolling.ts` | Visibility-aware polling with failure backoff |
| `src/hooks/usePolling.test.ts` | Tests for the above |
| `src/components/messages/ConversationRow.tsx` | One row in the list |
| `src/components/messages/ConversationList.tsx` | The list column |
| `src/components/messages/ConversationList.test.tsx` | Tests for both |
| `src/components/messages/MessageBubble.tsx` | One message bubble |
| `src/components/messages/MessageThread.tsx` | Transcript with day separators |
| `src/components/messages/MessageThread.test.tsx` | Tests for both |
| `src/components/messages/MessageComposer.tsx` | Textarea + send |
| `src/components/messages/RequestBanner.tsx` | Accept / Ignore for requests |
| `src/components/messages/MessageComposer.test.tsx` | Tests for both |
| `src/components/messages/PersonPanel.tsx` | Right-hand context column |
| `src/components/messages/MessagesEmpty.tsx` | Illustrated empty states |
| `src/components/messages/MessagesClient.tsx` | Stateful assembly: selection, polling, optimistic send |
| `src/components/messages/MessagesClient.test.tsx` | Tests for the above |

**Modified:**

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add three models, `User.lastSeenAt`, two `User` back-relations |
| `src/app/(dashboard)/messages/page.tsx` | Render `MessagesClient` instead of `MessagesInbox` |
| `src/components/dashboard/MessagesInbox.tsx` | Keep as-is, reused inside the Visitor-notes tab |

---

### Task 1: Pure DM logic and shared types

**Files:**
- Create: `src/lib/types/dm.ts`
- Create: `src/lib/dm.ts`
- Test: `src/lib/dm.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `conversationKey(a: string, b: string): string`
  - `unreadCount(messages: DmMessageLike[], lastReadAt: Date | string | null, myId: string): number`
  - `initialParticipantState(f: { recipientFollowsSender: boolean; hasAcceptedHistory: boolean }): 'accepted' | 'requested'`
  - `dayKey(d: Date | string): string`
  - `groupByDay<T extends { createdAt: Date | string }>(messages: T[]): { key: string; items: T[] }[]`
  - `dayLabel(key: string, now?: Date): string`
  - `isOnline(lastSeenAt: Date | string | null | undefined, now?: Date | number): boolean`
  - `ONLINE_WINDOW_MS: number`
  - types `DmParticipantState`, `DmConversationSummary`, `DmMessage`, `DmMessageLike`

- [ ] **Step 1: Write the shared types**

Create `src/lib/types/dm.ts`:

```ts
export type DmParticipantState = 'accepted' | 'requested' | 'blocked'

export type DmMessageKind = 'text' | 'image' | 'audio' | 'file'

/** A conversation as returned by GET /api/dm/conversations. */
export interface DmConversationSummary {
  id: string
  state: DmParticipantState
  starred: boolean
  muted: boolean
  unreadCount: number
  lastMessageAt: string
  other: {
    id: string
    username: string
    name: string | null
    avatar: string | null
    lastSeenAt: string | null
    /** Does the other person follow me? Drives the "Follows you" line. */
    followsYou: boolean
  }
  preview: {
    body: string | null
    kind: DmMessageKind
    senderId: string
    createdAt: string
  } | null
}

/** A message as returned by GET /api/dm/conversations/[id]/messages. */
export interface DmMessage {
  id: string
  conversationId: string
  senderId: string
  kind: DmMessageKind
  body: string | null
  mediaUrl: string | null
  createdAt: string
  /** Client-only: set while an optimistic send is in flight. */
  pending?: boolean
  /** Client-only: set when an optimistic send failed. */
  failed?: boolean
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/dm.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  conversationKey,
  unreadCount,
  initialParticipantState,
  dayKey,
  groupByDay,
  dayLabel,
  isOnline,
  ONLINE_WINDOW_MS,
} from './dm'

describe('conversationKey', () => {
  it('is stable regardless of argument order', () => {
    expect(conversationKey('userB', 'userA')).toBe(conversationKey('userA', 'userB'))
  })
  it('joins the sorted ids with a colon', () => {
    expect(conversationKey('a', 'b')).toBe('a:b')
  })
})

describe('unreadCount', () => {
  const msgs = [
    { id: '1', senderId: 'them', createdAt: '2026-07-20T10:00:00.000Z' },
    { id: '2', senderId: 'me', createdAt: '2026-07-20T11:00:00.000Z' },
    { id: '3', senderId: 'them', createdAt: '2026-07-20T12:00:00.000Z' },
  ]
  it('counts only messages from the other person after lastReadAt', () => {
    expect(unreadCount(msgs, '2026-07-20T10:30:00.000Z', 'me')).toBe(1)
  })
  it('never counts my own messages', () => {
    expect(unreadCount(msgs, null, 'me')).toBe(2)
  })
  it('treats a null lastReadAt as never read', () => {
    expect(unreadCount(msgs, null, 'them')).toBe(1)
  })
  it('returns 0 when everything is already read', () => {
    expect(unreadCount(msgs, '2026-07-20T23:00:00.000Z', 'me')).toBe(0)
  })
})

describe('initialParticipantState', () => {
  it('accepts when the recipient already follows the sender', () => {
    expect(initialParticipantState({ recipientFollowsSender: true, hasAcceptedHistory: false })).toBe('accepted')
  })
  it('accepts when an accepted conversation already exists', () => {
    expect(initialParticipantState({ recipientFollowsSender: false, hasAcceptedHistory: true })).toBe('accepted')
  })
  it('requests for a total stranger', () => {
    expect(initialParticipantState({ recipientFollowsSender: false, hasAcceptedHistory: false })).toBe('requested')
  })
})

describe('groupByDay', () => {
  it('groups consecutive messages from the same local day', () => {
    const groups = groupByDay([
      { createdAt: new Date(2026, 6, 20, 9, 0) },
      { createdAt: new Date(2026, 6, 20, 23, 59) },
      { createdAt: new Date(2026, 6, 21, 0, 1) },
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].items).toHaveLength(1)
  })
  it('returns an empty array for no messages', () => {
    expect(groupByDay([])).toEqual([])
  })
})

describe('dayLabel', () => {
  const now = new Date(2026, 6, 20, 12, 0)
  it('labels today', () => {
    expect(dayLabel(dayKey(now), now)).toBe('Today')
  })
  it('labels yesterday', () => {
    expect(dayLabel(dayKey(new Date(2026, 6, 19)), now)).toBe('Yesterday')
  })
  it('falls back to a date for anything older', () => {
    expect(dayLabel(dayKey(new Date(2026, 6, 1)), now)).not.toMatch(/Today|Yesterday/)
  })
})

describe('isOnline', () => {
  const now = new Date('2026-07-20T12:00:00.000Z').getTime()
  it('is online just inside the window', () => {
    expect(isOnline(new Date(now - ONLINE_WINDOW_MS + 1000), now)).toBe(true)
  })
  it('is offline just outside the window', () => {
    expect(isOnline(new Date(now - ONLINE_WINDOW_MS - 1000), now)).toBe(false)
  })
  it('is offline for null', () => {
    expect(isOnline(null, now)).toBe(false)
  })
  it('is offline for an unparseable value', () => {
    expect(isOnline('not-a-date', now)).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/lib/dm.test.ts
```

Expected: FAIL — `Failed to resolve import "./dm"`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/dm.ts`:

```ts
import type { DmParticipantState } from './types/dm'

export interface DmMessageLike {
  senderId: string
  createdAt: Date | string
}

/**
 * Stable identity for a 1:1 conversation. Sorting means the same pair always
 * produces the same key regardless of who starts, which lets a UNIQUE index
 * make duplicate conversations impossible even under a race.
 */
export function conversationKey(a: string, b: string): string {
  return [a, b].sort().join(':')
}

/** Messages from the other person newer than my read position. */
export function unreadCount(
  messages: DmMessageLike[],
  lastReadAt: Date | string | null,
  myId: string
): number {
  const floor = lastReadAt ? new Date(lastReadAt).getTime() : 0
  return messages.filter(
    (m) => m.senderId !== myId && new Date(m.createdAt).getTime() > floor
  ).length
}

/**
 * A stranger's first message lands in Requests; someone who already follows
 * you (or who you've already conversed with) goes straight to the inbox.
 */
export function initialParticipantState(f: {
  recipientFollowsSender: boolean
  hasAcceptedHistory: boolean
}): Extract<DmParticipantState, 'accepted' | 'requested'> {
  return f.recipientFollowsSender || f.hasAcceptedHistory ? 'accepted' : 'requested'
}

/** Local-time YYYY-MM-DD. Local, not UTC, so separators match the reader's day. */
export function dayKey(d: Date | string): string {
  const date = new Date(d)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${day}`
}

export function groupByDay<T extends { createdAt: Date | string }>(
  messages: T[]
): { key: string; items: T[] }[] {
  const out: { key: string; items: T[] }[] = []
  for (const m of messages) {
    const key = dayKey(m.createdAt)
    const last = out[out.length - 1]
    if (last && last.key === key) last.items.push(m)
    else out.push({ key, items: [m] })
  }
  return out
}

export function dayLabel(key: string, now: Date = new Date()): string {
  if (key === dayKey(now)) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === dayKey(yesterday)) return 'Yesterday'
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Presence is a heartbeat, not a socket: seen within this window reads as online. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000

export function isOnline(
  lastSeenAt: Date | string | null | undefined,
  now: Date | number = Date.now()
): boolean {
  if (!lastSeenAt) return false
  const seen = new Date(lastSeenAt).getTime()
  if (Number.isNaN(seen)) return false
  const nowMs = typeof now === 'number' ? now : now.getTime()
  return nowMs - seen < ONLINE_WINDOW_MS
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/lib/dm.test.ts
```

Expected: PASS, 16 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dm.ts src/lib/dm.test.ts src/lib/types/dm.ts
git commit -m "feat(dm): pure conversation logic and shared types"
```

---

### Task 2: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260720120000_messages_m1_core_dm/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma client models `db.conversation`, `db.conversationParticipant`, `db.directMessage`, and the `User.lastSeenAt` field. Compound unique accessor is `conversationId_userId`.

- [ ] **Step 1: Add the models to the schema**

Append to `prisma/schema.prisma`:

```prisma
model Conversation {
  id            String   @id @default(cuid())
  key           String   @unique
  lastMessageAt DateTime @default(now())
  createdAt     DateTime @default(now())

  participants ConversationParticipant[]
  messages     DirectMessage[]

  @@index([lastMessageAt])
}

model ConversationParticipant {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation("UserConversations", fields: [userId], references: [id], onDelete: Cascade)
  state          String       @default("accepted")
  lastReadAt     DateTime?
  starred        Boolean      @default(false)
  muted          Boolean      @default(false)
  createdAt      DateTime     @default(now())

  @@unique([conversationId, userId])
  @@index([userId, state])
}

model DirectMessage {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId       String
  sender         User         @relation("UserDirectMessages", fields: [senderId], references: [id], onDelete: Cascade)
  kind           String       @default("text")
  body           String?
  mediaUrl       String?
  createdAt      DateTime     @default(now())
  deletedAt      DateTime?

  @@index([conversationId, createdAt])
}
```

- [ ] **Step 2: Add the field and back-relations to `User`**

In the `model User` block in `prisma/schema.prisma`, add the field after `updatedAt`:

```prisma
  lastSeenAt DateTime?
```

and these two relations alongside the other relation fields (e.g. after `notifications`):

```prisma
  conversations  ConversationParticipant[] @relation("UserConversations")
  directMessages DirectMessage[]           @relation("UserDirectMessages")
```

- [ ] **Step 3: Hand-author the migration**

Create `prisma/migrations/20260720120000_messages_m1_core_dm/migration.sql`. Write only these statements — do NOT generate it with `migrate diff --from-url`, which is contaminated on the shared dev database:

```sql
-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'accepted',
    "lastReadAt" TIMESTAMP(3),
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT,
    "mediaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_key_key" ON "Conversation"("key");
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");
CREATE INDEX "ConversationParticipant_userId_state_idx" ON "ConversationParticipant"("userId", "state");
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Apply the migration**

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
npx prisma migrate deploy
```

Expected: `The following migration(s) have been applied` listing `20260720120000_messages_m1_core_dm`.

If this errors with `EPERM` on the query engine DLL, stop `next dev` first — it holds the file open on Windows.

- [ ] **Step 5: Regenerate the client and verify there is no drift**

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
npx prisma generate
# The shadow database is RESET by Prisma. Never point it at the dev database.
docker exec pages-mvp-postgres-1 psql -U pages -d postgres -c "DROP DATABASE IF EXISTS pages_shadow;" -c "CREATE DATABASE pages_shadow OWNER pages;"
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "postgresql://pages:pages@127.0.0.1:5434/pages_shadow" --script
```

Expected: the diff prints no `CREATE`/`ALTER`/`DROP` statements. Any output here means the migration and the schema disagree — fix the SQL before continuing, because a drifted baseline causes P2022 500s on a fresh production database.

- [ ] **Step 6: Verify the types compile**

```bash
npx tsc --noEmit
```

Expected: no errors mentioning `conversation`, `conversationParticipant`, or `directMessage`. (Pre-existing errors about `.next/types/app/explore/page.js` are unrelated stale build artifacts and can be ignored; `rm -rf .next` clears them.)

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260720120000_messages_m1_core_dm/migration.sql
git commit -m "feat(dm): Conversation, ConversationParticipant, DirectMessage models"
```

---

### Task 3: Conversation list and creation API

**Files:**
- Create: `src/app/api/dm/conversations/route.ts`
- Test: `src/app/api/dm/conversations/route.test.ts`

**Interfaces:**
- Consumes: `conversationKey`, `initialParticipantState` from `src/lib/dm.ts`; `DmConversationSummary` from `src/lib/types/dm.ts`; `getUser` from `src/lib/auth.ts`; `rateLimit` from `src/lib/rate-limit.ts`; `db` from `src/lib/db.ts`.
- Produces: `GET /api/dm/conversations?filter=all|unread|requests` → `{ conversations: DmConversationSummary[] }`. `POST /api/dm/conversations` with `{ username }` → `{ id }` of the conversation, status 200 (existing) or 201 (created).

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/dm/conversations/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    user: { update: vi.fn().mockResolvedValue({}), findUnique: vi.fn() },
    conversationParticipant: { findMany: vi.fn().mockResolvedValue([]) },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    follow: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    directMessage: { count: vi.fn().mockResolvedValue(0) },
  },
}))

import { GET, POST } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const get = (url = 'http://localhost/api/dm/conversations') => new NextRequest(url)
const post = (body: unknown) =>
  new NextRequest('http://localhost/api/dm/conversations', {
    method: 'POST',
    body: JSON.stringify(body),
  })

beforeEach(() => vi.clearAllMocks())

describe('GET /api/dm/conversations', () => {
  it('401 unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(get())).status).toBe(401)
  })

  it('stamps lastSeenAt as the presence heartbeat', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(get())
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'me' } })
    )
  })

  it('lists accepted conversations by default', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(get())
    expect(db.conversationParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'me', state: 'accepted' }),
      })
    )
  })

  it('lists requested conversations for filter=requests', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(get('http://localhost/api/dm/conversations?filter=requests'))
    expect(db.conversationParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'me', state: 'requested' }),
      })
    )
  })

  it('resolves follows-you for the whole page in one query', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findMany as any).mockResolvedValue([
      {
        conversationId: 'c1',
        state: 'accepted',
        starred: false,
        muted: false,
        lastReadAt: null,
        conversation: {
          lastMessageAt: new Date('2026-07-20T10:00:00Z'),
          participants: [
            {
              userId: 'them',
              user: { id: 'them', username: 'sarah', name: 'Sarah', avatar: null, lastSeenAt: null },
            },
          ],
          messages: [],
        },
      },
    ])
    ;(db.follow.findMany as any).mockResolvedValue([{ followerId: 'them' }])

    const res = await GET(get())
    const data = await res.json()
    expect(db.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { followingId: 'me', followerId: { in: ['them'] } },
      })
    )
    expect(data.conversations[0].other.followsYou).toBe(true)
  })
})

describe('POST /api/dm/conversations', () => {
  it('401 unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await POST(post({ username: 'sarah' }))).status).toBe(401)
  })

  it('404 for an unknown username', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue(null)
    expect((await POST(post({ username: 'nobody' }))).status).toBe(404)
  })

  it('400 when messaging yourself', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue({ id: 'me' })
    expect((await POST(post({ username: 'me' }))).status).toBe(400)
  })

  it('returns the existing conversation instead of creating a duplicate', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue({ id: 'them' })
    ;(db.conversation.findUnique as any).mockResolvedValue({ id: 'c1' })
    const res = await POST(post({ username: 'sarah' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'c1' })
    expect(db.conversation.create).not.toHaveBeenCalled()
  })

  it("marks a stranger's first message as a request for the recipient only", async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue({ id: 'them' })
    ;(db.conversation.findUnique as any).mockResolvedValue(null)
    ;(db.follow.findFirst as any).mockResolvedValue(null)
    ;(db.conversation.create as any).mockResolvedValue({ id: 'c2' })
    await POST(post({ username: 'sarah' }))
    const arg = (db.conversation.create as any).mock.calls[0][0]
    const rows = arg.data.participants.create
    expect(rows).toEqual(
      expect.arrayContaining([
        { userId: 'me', state: 'accepted' },
        { userId: 'them', state: 'requested' },
      ])
    )
  })

  it('accepts immediately when the recipient already follows the sender', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue({ id: 'them' })
    ;(db.conversation.findUnique as any).mockResolvedValue(null)
    ;(db.follow.findFirst as any).mockResolvedValue({ id: 'f1' })
    ;(db.conversation.create as any).mockResolvedValue({ id: 'c3' })
    await POST(post({ username: 'sarah' }))
    const rows = (db.conversation.create as any).mock.calls[0][0].data.participants.create
    expect(rows).toEqual(
      expect.arrayContaining([{ userId: 'them', state: 'accepted' }])
    )
  })

  it('recovers from the unique-key race by returning the winner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.user.findUnique as any).mockResolvedValue({ id: 'them' })
    ;(db.conversation.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'winner' })
    ;(db.conversation.create as any).mockRejectedValue({ code: 'P2002' })
    const res = await POST(post({ username: 'sarah' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'winner' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/api/dm/conversations/route.test.ts
```

Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/dm/conversations/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { conversationKey, initialParticipantState } from '@/lib/dm'
import type { DmConversationSummary, DmMessageKind, DmParticipantState } from '@/lib/types/dm'

const PAGE_SIZE = 30

export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Presence heartbeat rides along with the list poll — no separate endpoint.
  await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })

  const filter = request.nextUrl.searchParams.get('filter') || 'all'
  const state = filter === 'requests' ? 'requested' : 'accepted'

  const rows = await db.conversationParticipant.findMany({
    where: { userId: user.id, state },
    orderBy: { conversation: { lastMessageAt: 'desc' } },
    take: PAGE_SIZE,
    include: {
      conversation: {
        include: {
          participants: {
            where: { userId: { not: user.id } },
            include: {
              user: {
                select: { id: true, username: true, name: true, avatar: true, lastSeenAt: true },
              },
            },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  // One query answers "which of these people follow me" for the whole page,
  // rather than a follow lookup per conversation.
  const otherIds = rows
    .map((r) => r.conversation.participants[0]?.userId)
    .filter((v): v is string => !!v)
  const followBack = await db.follow.findMany({
    where: { followingId: user.id, followerId: { in: otherIds } },
    select: { followerId: true },
  })
  const followers = new Set(followBack.map((f) => f.followerId))

  // Unread is per-participant, so each row needs its own count against its own
  // lastReadAt. Bounded by PAGE_SIZE and served by the
  // (conversationId, createdAt) index; revisit if the page size grows.
  const counts = await Promise.all(
    rows.map((row) =>
      db.directMessage.count({
        where: {
          conversationId: row.conversationId,
          senderId: { not: user.id },
          deletedAt: null,
          ...(row.lastReadAt ? { createdAt: { gt: row.lastReadAt } } : {}),
        },
      })
    )
  )

  const conversations: DmConversationSummary[] = rows.map((row, i) => {
    const other = row.conversation.participants[0]?.user
    const last = row.conversation.messages[0]
    return {
      id: row.conversationId,
      state: row.state as DmParticipantState,
      starred: row.starred,
      muted: row.muted,
      unreadCount: counts[i],
      lastMessageAt: row.conversation.lastMessageAt.toISOString(),
      other: {
        id: other?.id ?? '',
        username: other?.username ?? '',
        name: other?.name ?? null,
        avatar: other?.avatar ?? null,
        lastSeenAt: other?.lastSeenAt ? other.lastSeenAt.toISOString() : null,
        followsYou: other ? followers.has(other.id) : false,
      },
      preview: last
        ? {
            body: last.body,
            kind: last.kind as DmMessageKind,
            senderId: last.senderId,
            createdAt: last.createdAt.toISOString(),
          }
        : null,
    }
  })

  const filtered = filter === 'unread' ? conversations.filter((c) => c.unreadCount > 0) : conversations

  return NextResponse.json({ conversations: filtered })
}

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await rateLimit(request, {
    limit: 20,
    windowMs: 60_000,
    prefix: 'dm-create',
    identifier: user.id,
  })
  if (limited) return limited

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const username = typeof body.username === 'string' ? body.username.trim() : ''
  if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

  const target = await db.user.findUnique({ where: { username }, select: { id: true } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.id === user.id) {
    return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
  }

  const key = conversationKey(user.id, target.id)

  const existing = await db.conversation.findUnique({ where: { key }, select: { id: true } })
  if (existing) return NextResponse.json({ id: existing.id })

  const follows = await db.follow.findFirst({
    where: { followerId: target.id, followingId: user.id },
    select: { id: true },
  })
  const recipientState = initialParticipantState({
    recipientFollowsSender: !!follows,
    hasAcceptedHistory: false,
  })

  try {
    const created = await db.conversation.create({
      data: {
        key,
        participants: {
          create: [
            { userId: user.id, state: 'accepted' },
            { userId: target.id, state: recipientState },
          ],
        },
      },
      select: { id: true },
    })
    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (e) {
    // Someone else won the race on the unique key — use their conversation.
    if ((e as { code?: string }).code === 'P2002') {
      const winner = await db.conversation.findUnique({ where: { key }, select: { id: true } })
      if (winner) return NextResponse.json({ id: winner.id })
    }
    throw e
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/dm/conversations/route.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dm/conversations/route.ts src/app/api/dm/conversations/route.test.ts
git commit -m "feat(dm): conversation list and find-or-create API"
```

---

### Task 4: Thread read, send, and mark-read API

**Files:**
- Create: `src/app/api/dm/conversations/[id]/messages/route.ts`
- Create: `src/app/api/dm/conversations/[id]/read/route.ts`
- Test: `src/app/api/dm/conversations/[id]/messages/route.test.ts`

**Interfaces:**
- Consumes: `db`, `getUser`, `rateLimit`, `createNotification` from `src/lib/notifications.ts`, `DmMessage` type.
- Produces: `GET .../messages?after=&cursor=&limit=` → `{ messages: DmMessage[] }` oldest-first. `POST .../messages` with `{ body }` → `{ message: DmMessage }` status 201. `POST .../read` → `{ ok: true }`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/dm/conversations/[id]/messages/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/db', () => ({
  db: {
    conversationParticipant: { findUnique: vi.fn(), findFirst: vi.fn() },
    directMessage: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), count: vi.fn().mockResolvedValue(1) },
    conversation: { update: vi.fn().mockResolvedValue({}) },
  },
}))

import { GET, POST } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const get = (url = 'http://localhost/api/dm/conversations/c1/messages') => new NextRequest(url)
const post = (body: unknown) =>
  new NextRequest('http://localhost/api/dm/conversations/c1/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  })

const meParticipant = { id: 'p1', conversationId: 'c1', userId: 'me', state: 'accepted', lastReadAt: null }

beforeEach(() => vi.clearAllMocks())

describe('GET messages', () => {
  it('401 unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(get(), ctx('c1'))).status).toBe(401)
  })

  it('404 (not 403) for a non-participant, so ids cannot be probed', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(null)
    const res = await GET(get(), ctx('c1'))
    expect(res.status).toBe(404)
    expect(db.directMessage.findMany).not.toHaveBeenCalled()
  })

  it('verifies participation against the database before reading', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(meParticipant)
    await GET(get(), ctx('c1'))
    expect(db.conversationParticipant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId_userId: { conversationId: 'c1', userId: 'me' } },
      })
    )
  })

  it('excludes soft-deleted messages', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(meParticipant)
    await GET(get(), ctx('c1'))
    expect(db.directMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ conversationId: 'c1', deletedAt: null }),
      })
    )
  })
})

describe('POST message', () => {
  const ok = () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(meParticipant)
    ;(db.conversationParticipant.findFirst as any).mockResolvedValue({
      userId: 'them', state: 'accepted', muted: false, lastReadAt: null,
    })
    ;(db.directMessage.create as any).mockResolvedValue({
      id: 'm1', conversationId: 'c1', senderId: 'me', kind: 'text',
      body: 'hi', mediaUrl: null, createdAt: new Date('2026-07-20T10:00:00Z'),
    })
  }

  it('404 for a non-participant', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    ;(db.conversationParticipant.findUnique as any).mockResolvedValue(null)
    const res = await POST(post({ body: 'hi' }), ctx('c1'))
    expect(res.status).toBe(404)
    expect(db.directMessage.create).not.toHaveBeenCalled()
  })

  it('403 when the sender has been blocked by the other participant', async () => {
    ok()
    ;(db.conversationParticipant.findFirst as any).mockResolvedValue({
      userId: 'them', state: 'blocked', muted: false, lastReadAt: null,
    })
    const res = await POST(post({ body: 'hi' }), ctx('c1'))
    expect(res.status).toBe(403)
    expect(db.directMessage.create).not.toHaveBeenCalled()
  })

  it('400 for an empty body', async () => {
    ok()
    expect((await POST(post({ body: '   ' }), ctx('c1'))).status).toBe(400)
  })

  it('400 for a body over 4000 characters', async () => {
    ok()
    expect((await POST(post({ body: 'x'.repeat(4001) }), ctx('c1'))).status).toBe(400)
  })

  it('creates the message and bumps lastMessageAt', async () => {
    ok()
    const res = await POST(post({ body: 'hi' }), ctx('c1'))
    expect(res.status).toBe(201)
    expect(db.directMessage.create).toHaveBeenCalled()
    expect(db.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' } })
    )
  })

  it('notifies on the first unread message in a thread', async () => {
    ok()
    ;(db.directMessage.count as any).mockResolvedValue(1)
    await POST(post({ body: 'hi' }), ctx('c1'))
    expect(createNotification).toHaveBeenCalled()
  })

  it('does not notify again while the thread is already unread', async () => {
    ok()
    ;(db.directMessage.count as any).mockResolvedValue(4)
    await POST(post({ body: 'hi' }), ctx('c1'))
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('does not notify a muted recipient', async () => {
    ok()
    ;(db.conversationParticipant.findFirst as any).mockResolvedValue({
      userId: 'them', state: 'accepted', muted: true, lastReadAt: null,
    })
    ;(db.directMessage.count as any).mockResolvedValue(1)
    await POST(post({ body: 'hi' }), ctx('c1'))
    expect(createNotification).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run "src/app/api/dm/conversations/[id]/messages/route.test.ts"
```

Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Write the messages route**

Create `src/app/api/dm/conversations/[id]/messages/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'
import type { DmMessage, DmMessageKind } from '@/lib/types/dm'

const PAGE_SIZE = 30
const MAX_BODY = 4000

type Ctx = { params: Promise<{ id: string }> }

function toWire(m: {
  id: string
  conversationId: string
  senderId: string
  kind: string
  body: string | null
  mediaUrl: string | null
  createdAt: Date
}): DmMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    kind: m.kind as DmMessageKind,
    body: m.body,
    mediaUrl: m.mediaUrl,
    createdAt: m.createdAt.toISOString(),
  }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Participation is re-verified from the database on every request. A
  // non-participant gets 404 rather than 403 so ids cannot be probed.
  const me = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    select: { id: true },
  })
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sp = request.nextUrl.searchParams
  const after = sp.get('after')
  const cursor = sp.get('cursor')

  const rows = await db.directMessage.findMany({
    where: {
      conversationId: id,
      deletedAt: null,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: after ? 'asc' : 'desc' },
    take: PAGE_SIZE,
  })

  // Always hand the client oldest-first; only the query direction differs.
  const ordered = after ? rows : [...rows].reverse()
  return NextResponse.json({ messages: ordered.map(toWire) })
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const me = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    select: { id: true, state: true },
  })
  if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const limited = await rateLimit(request, {
    limit: 30,
    windowMs: 60_000,
    prefix: 'dm-send',
    identifier: user.id,
  })
  if (limited) return limited

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  if (!body) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  if (body.length > MAX_BODY) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }

  const other = await db.conversationParticipant.findFirst({
    where: { conversationId: id, userId: { not: user.id } },
    select: { userId: true, state: true, muted: true, lastReadAt: true },
  })
  if (!other || other.state === 'blocked' || me.state === 'blocked') {
    return NextResponse.json({ error: 'Cannot send to this conversation' }, { status: 403 })
  }

  const created = await db.directMessage.create({
    data: { conversationId: id, senderId: user.id, kind: 'text', body },
  })

  await db.conversation.update({
    where: { id },
    data: { lastMessageAt: created.createdAt },
  })

  // First-unread rule: one notification per thread until they read it again.
  // Without this, a burst of ten messages becomes ten bell rows.
  const unreadFromMe = await db.directMessage.count({
    where: {
      conversationId: id,
      senderId: user.id,
      deletedAt: null,
      ...(other.lastReadAt ? { createdAt: { gt: other.lastReadAt } } : {}),
    },
  })

  if (unreadFromMe === 1 && !other.muted && other.state === 'accepted') {
    await createNotification({
      userId: other.userId,
      type: 'message',
      actor: { id: user.id, name: user.name || user.username },
      entityUrl: `/messages?c=${id}`,
      contextText: body.slice(0, 80),
    })
  }

  return NextResponse.json({ message: toWire(created) }, { status: 201 })
}
```

- [ ] **Step 4: Write the read route**

Create `src/app/api/dm/conversations/[id]/read/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // updateMany scopes the write to the caller's own participant row, so a
  // non-participant silently updates nothing rather than touching someone else.
  const result = await db.conversationParticipant.updateMany({
    where: { conversationId: id, userId: user.id },
    data: { lastReadAt: new Date() },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run "src/app/api/dm/conversations/[id]/messages/route.test.ts"
```

Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/dm/conversations/[id]"
git commit -m "feat(dm): thread read, send, and mark-read API"
```

---

### Task 5: Conversation state API and unread badge

**Files:**
- Create: `src/app/api/dm/conversations/[id]/route.ts`
- Create: `src/app/api/dm/unread-count/route.ts`
- Test: `src/app/api/dm/conversations/[id]/route.test.ts`

**Interfaces:**
- Consumes: `db`, `getUser`.
- Produces: `PATCH /api/dm/conversations/[id]` with `{ state?: 'accepted' | 'blocked'; starred?: boolean; muted?: boolean }` → `{ ok: true }`. `GET /api/dm/unread-count` → `{ count: number }` where count is the **number of conversations** containing unread messages (not the number of messages).

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/dm/conversations/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { conversationParticipant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } },
}))

import { PATCH } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const patch = (body: unknown) =>
  new NextRequest('http://localhost/api/dm/conversations/c1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

beforeEach(() => vi.clearAllMocks())

describe('PATCH /api/dm/conversations/[id]', () => {
  it('401 unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await PATCH(patch({ starred: true }), ctx('c1'))).status).toBe(401)
  })

  it('scopes the update to the caller so nobody can flip another person’s row', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await PATCH(patch({ starred: true }), ctx('c1'))
    expect(db.conversationParticipant.updateMany).toHaveBeenCalledWith({
      where: { conversationId: 'c1', userId: 'me' },
      data: { starred: true },
    })
  })

  it('accepts a request', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await PATCH(patch({ state: 'accepted' }), ctx('c1'))
    expect(db.conversationParticipant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: 'accepted' } })
    )
  })

  it('rejects an unknown state', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    expect((await PATCH(patch({ state: 'nonsense' }), ctx('c1'))).status).toBe(400)
  })

  it('400 when no updatable field is supplied', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    expect((await PATCH(patch({}), ctx('c1'))).status).toBe(400)
  })

  it('404 when the caller is not a participant', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    ;(db.conversationParticipant.updateMany as any).mockResolvedValue({ count: 0 })
    expect((await PATCH(patch({ starred: true }), ctx('c1'))).status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run "src/app/api/dm/conversations/[id]/route.test.ts"
```

Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Write the PATCH route**

Create `src/app/api/dm/conversations/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

// Only these transitions are reachable from the UI: accepting a request, or
// ignoring it (which blocks). 'requested' is set by the server on creation.
const ALLOWED_STATES = ['accepted', 'blocked'] as const

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const data: { state?: string; starred?: boolean; muted?: boolean } = {}

  if (payload.state !== undefined) {
    const next = String(payload.state)
    if (!ALLOWED_STATES.includes(next as (typeof ALLOWED_STATES)[number])) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
    }
    data.state = next
  }
  if (typeof payload.starred === 'boolean') data.starred = payload.starred
  if (typeof payload.muted === 'boolean') data.muted = payload.muted

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Scoping by userId means a non-participant updates zero rows.
  const result = await db.conversationParticipant.updateMany({
    where: { conversationId: id, userId: user.id },
    data,
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Write the unread-count route**

Create `src/app/api/dm/unread-count/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ count: 0 })

  const rows = await db.conversationParticipant.findMany({
    where: { userId: user.id, state: 'accepted' },
    select: { conversationId: true, lastReadAt: true },
    take: 100,
  })

  const counts = await Promise.all(
    rows.map((row) =>
      db.directMessage.count({
        where: {
          conversationId: row.conversationId,
          senderId: { not: user.id },
          deletedAt: null,
          ...(row.lastReadAt ? { createdAt: { gt: row.lastReadAt } } : {}),
        },
        take: 1,
      })
    )
  )

  // The badge counts conversations with unread messages, matching the number
  // shown on the Unread filter tab.
  return NextResponse.json({ count: counts.filter((c) => c > 0).length })
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run "src/app/api/dm/conversations/[id]/route.test.ts"
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/dm/conversations/[id]/route.ts" "src/app/api/dm/conversations/[id]/route.test.ts" src/app/api/dm/unread-count/route.ts
git commit -m "feat(dm): conversation state API and unread badge count"
```

---

### Task 6: Visibility-aware polling hook

**Files:**
- Create: `src/hooks/usePolling.ts`
- Test: `src/hooks/usePolling.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `usePolling(callback: () => Promise<unknown>, opts: { intervalMs: number; enabled?: boolean }): { failures: number }`. Also exports `BACKOFF_MS = 30_000` and `FAILURE_THRESHOLD = 3`.

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/usePolling.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePolling } from './usePolling'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('usePolling', () => {
  it('does not fire before the first interval elapses', () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: 5000 }))
    expect(fn).not.toHaveBeenCalled()
  })

  it('fires once per interval', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: 5000 }))
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does not poll when disabled', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: 5000, enabled: false }))
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(fn).not.toHaveBeenCalled()
  })

  it('stops polling while the tab is hidden', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: 5000 }))
    act(() => setHidden(true))
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(fn).not.toHaveBeenCalled()
    act(() => setHidden(false))
  })

  it('refetches immediately when the tab becomes visible again', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: 5000 }))
    act(() => setHidden(true))
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    fn.mockClear()
    act(() => setHidden(false))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('counts consecutive failures and resets on success', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => usePolling(fn, { intervalMs: 1000 }))
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    await waitFor(() => expect(result.current.failures).toBeGreaterThanOrEqual(3))
    fn.mockResolvedValue(undefined)
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    await waitFor(() => expect(result.current.failures).toBe(0))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/usePolling.test.ts
```

Expected: FAIL — `Failed to resolve import "./usePolling"`.

- [ ] **Step 3: Write the implementation**

Create `src/hooks/usePolling.ts`:

```ts
'use client'

import { useEffect, useRef, useState } from 'react'

export const FAILURE_THRESHOLD = 3
export const BACKOFF_MS = 30_000

/**
 * Calls `callback` on an interval, but only while the tab is visible. A hidden
 * tab costs nothing, which is what makes polling affordable in place of
 * sockets. After FAILURE_THRESHOLD consecutive failures the interval stretches
 * to BACKOFF_MS instead of hammering a server that is already unhappy.
 */
export function usePolling(
  callback: () => Promise<unknown>,
  { intervalMs, enabled = true }: { intervalMs: number; enabled?: boolean }
): { failures: number } {
  const [failures, setFailures] = useState(0)
  // Keeping the callback in a ref means a new closure each render does not
  // restart the interval.
  const cbRef = useRef(callback)
  cbRef.current = callback

  const failureRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    let timer: ReturnType<typeof setInterval> | undefined

    const run = async () => {
      try {
        await cbRef.current()
        if (failureRef.current !== 0) {
          failureRef.current = 0
          setFailures(0)
        }
      } catch {
        failureRef.current += 1
        setFailures(failureRef.current)
      }
    }

    const start = () => {
      if (timer) clearInterval(timer)
      const period = failureRef.current >= FAILURE_THRESHOLD ? BACKOFF_MS : intervalMs
      timer = setInterval(run, period)
    }

    const onVisibility = () => {
      if (document.hidden) {
        if (timer) clearInterval(timer)
        timer = undefined
      } else {
        void run()
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, enabled, failures >= FAILURE_THRESHOLD])

  return { failures }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/usePolling.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePolling.ts src/hooks/usePolling.test.ts
git commit -m "feat(dm): visibility-aware polling hook with failure backoff"
```

---

### Task 7: Conversation list column

**Files:**
- Create: `src/components/messages/ConversationRow.tsx`
- Create: `src/components/messages/ConversationList.tsx`
- Test: `src/components/messages/ConversationList.test.tsx`

**Interfaces:**
- Consumes: `DmConversationSummary` from `src/lib/types/dm.ts`; `isOnline` from `src/lib/dm.ts`.
- Produces:
  - `<ConversationRow conversation={DmConversationSummary} active={boolean} onSelect={(id: string) => void} />`
  - `<ConversationList conversations={DmConversationSummary[]} activeId={string | null} onSelect={(id: string) => void} loading={boolean} />`
  - `relativeTime(iso: string, now?: Date): string` exported from `ConversationRow.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/messages/ConversationList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConversationList } from './ConversationList'
import type { DmConversationSummary } from '@/lib/types/dm'

const convo = (over: Partial<DmConversationSummary> = {}): DmConversationSummary => ({
  id: 'c1',
  state: 'accepted',
  starred: false,
  muted: false,
  unreadCount: 0,
  lastMessageAt: new Date().toISOString(),
  other: { id: 'u2', username: 'sarah', name: 'Sarah Johnson', avatar: null, lastSeenAt: null, followsYou: false },
  preview: { body: 'Love your page!', kind: 'text', senderId: 'u2', createdAt: new Date().toISOString() },
  ...over,
})

describe('ConversationList', () => {
  it('renders the other person’s name and the last message preview', () => {
    render(<ConversationList conversations={[convo()]} activeId={null} onSelect={() => {}} loading={false} />)
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument()
    expect(screen.getByText('Love your page!')).toBeInTheDocument()
  })

  it('falls back to the @username when there is no display name', () => {
    render(
      <ConversationList
        conversations={[convo({ other: { id: 'u2', username: 'sarah', name: null, avatar: null, lastSeenAt: null, followsYou: false } })]}
        activeId={null}
        onSelect={() => {}}
        loading={false}
      />
    )
    expect(screen.getByText('@sarah')).toBeInTheDocument()
  })

  it('shows an unread pill only when there are unread messages', () => {
    const { rerender } = render(
      <ConversationList conversations={[convo({ unreadCount: 2 })]} activeId={null} onSelect={() => {}} loading={false} />
    )
    expect(screen.getByText('2')).toBeInTheDocument()
    rerender(
      <ConversationList conversations={[convo({ unreadCount: 0 })]} activeId={null} onSelect={() => {}} loading={false} />
    )
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('marks the online dot when the other person was seen recently', () => {
    render(
      <ConversationList
        conversations={[convo({ other: { id: 'u2', username: 'sarah', name: 'Sarah', avatar: null, lastSeenAt: new Date().toISOString(), followsYou: false } })]}
        activeId={null}
        onSelect={() => {}}
        loading={false}
      />
    )
    expect(screen.getByLabelText('Online')).toBeInTheDocument()
  })

  it('calls onSelect with the conversation id when clicked', () => {
    const onSelect = vi.fn()
    render(<ConversationList conversations={[convo()]} activeId={null} onSelect={onSelect} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Sarah Johnson/ }))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('shows an empty message when there are no conversations', () => {
    render(<ConversationList conversations={[]} activeId={null} onSelect={() => {}} loading={false} />)
    expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/messages/ConversationList.test.tsx
```

Expected: FAIL — `Failed to resolve import "./ConversationList"`.

- [ ] **Step 3: Write ConversationRow**

Create `src/components/messages/ConversationRow.tsx`:

```tsx
'use client'

import { isOnline } from '@/lib/dm'
import type { DmConversationSummary } from '@/lib/types/dm'

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return then.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function initials(name: string | null, username: string): string {
  const source = name?.trim() || username
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function ConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: DmConversationSummary
  active: boolean
  onSelect: (id: string) => void
}) {
  const { other, preview, unreadCount } = conversation
  const display = other.name || `@${other.username}`
  const online = isOnline(other.lastSeenAt)

  return (
    <button
      onClick={() => onSelect(conversation.id)}
      className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors ${
        active ? 'bg-muted' : 'hover:bg-muted/60'
      }`}
    >
      <span className="relative shrink-0">
        {other.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={other.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-galli/15 text-sm font-bold text-galli-dark">
            {initials(other.name, other.username)}
          </span>
        )}
        {online && (
          <span
            aria-label="Online"
            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-galli"
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm ${unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>
            {display}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {relativeTime(conversation.lastMessageAt)}
          </span>
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={`truncate text-sm ${
              unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {preview?.body || 'No messages yet'}
          </span>
          {unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-galli px-2 py-0.5 text-xs font-bold text-white">
              {unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}
```

- [ ] **Step 4: Write ConversationList**

Create `src/components/messages/ConversationList.tsx`:

```tsx
'use client'

import type { DmConversationSummary } from '@/lib/types/dm'
import { ConversationRow } from './ConversationRow'

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  loading,
}: {
  conversations: DmConversationSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  loading: boolean
}) {
  if (loading && conversations.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Loading conversations…</p>
  }

  if (conversations.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No conversations yet.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border overflow-y-auto">
      {conversations.map((c) => (
        <ConversationRow
          key={c.id}
          conversation={c}
          active={c.id === activeId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/components/messages/ConversationList.test.tsx
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/messages/ConversationRow.tsx src/components/messages/ConversationList.tsx src/components/messages/ConversationList.test.tsx
git commit -m "feat(dm): conversation list column"
```

---

### Task 8: Message thread and bubbles

**Files:**
- Create: `src/components/messages/MessageBubble.tsx`
- Create: `src/components/messages/MessageThread.tsx`
- Test: `src/components/messages/MessageThread.test.tsx`

**Interfaces:**
- Consumes: `DmMessage`, `DmConversationSummary`; `groupByDay`, `dayLabel`, `isOnline` from `src/lib/dm.ts`.
- Produces:
  - `<MessageBubble message={DmMessage} mine={boolean} onRetry={(m: DmMessage) => void} />`
  - `<MessageThread messages={DmMessage[]} myId={string} conversation={DmConversationSummary} onRetry={(m: DmMessage) => void} />`

- [ ] **Step 1: Write the failing tests**

Create `src/components/messages/MessageThread.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageThread } from './MessageThread'
import type { DmConversationSummary, DmMessage } from '@/lib/types/dm'

const conversation: DmConversationSummary = {
  id: 'c1',
  state: 'accepted',
  starred: false,
  muted: false,
  unreadCount: 0,
  lastMessageAt: new Date().toISOString(),
  other: { id: 'them', username: 'sarah', name: 'Sarah Johnson', avatar: null, lastSeenAt: null, followsYou: false },
  preview: null,
}

const msg = (over: Partial<DmMessage> = {}): DmMessage => ({
  id: 'm1',
  conversationId: 'c1',
  senderId: 'them',
  kind: 'text',
  body: 'Hey Josh!',
  mediaUrl: null,
  createdAt: new Date().toISOString(),
  ...over,
})

describe('MessageThread', () => {
  it('renders the other person in the header', () => {
    render(<MessageThread messages={[]} myId="me" conversation={conversation} onRetry={() => {}} />)
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument()
  })

  it('renders message bodies', () => {
    render(<MessageThread messages={[msg()]} myId="me" conversation={conversation} onRetry={() => {}} />)
    expect(screen.getByText('Hey Josh!')).toBeInTheDocument()
  })

  it('shows a Today separator for messages sent today', () => {
    render(<MessageThread messages={[msg()]} myId="me" conversation={conversation} onRetry={() => {}} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('separates messages from different days', () => {
    const older = msg({ id: 'm0', createdAt: new Date(2026, 0, 5).toISOString() })
    render(<MessageThread messages={[older, msg()]} myId="me" conversation={conversation} onRetry={() => {}} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getAllByTestId('day-separator')).toHaveLength(2)
  })

  it('offers a retry on a failed message', () => {
    const onRetry = vi.fn()
    render(
      <MessageThread
        messages={[msg({ senderId: 'me', failed: true })]}
        myId="me"
        conversation={conversation}
        onRetry={onRetry}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('prompts to say hello when the thread is empty', () => {
    render(<MessageThread messages={[]} myId="me" conversation={conversation} onRetry={() => {}} />)
    expect(screen.getByText(/No messages yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/messages/MessageThread.test.tsx
```

Expected: FAIL — `Failed to resolve import "./MessageThread"`.

- [ ] **Step 3: Write MessageBubble**

Create `src/components/messages/MessageBubble.tsx`:

```tsx
'use client'

import { AlertCircle } from 'lucide-react'
import type { DmMessage } from '@/lib/types/dm'

export function MessageBubble({
  message,
  mine,
  onRetry,
}: {
  message: DmMessage
  mine: boolean
  onRetry: (m: DmMessage) => void
}) {
  const time = new Date(message.createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          mine ? 'bg-galli/15 text-foreground' : 'bg-muted text-foreground'
        } ${message.pending ? 'opacity-60' : ''}`}
      >
        {message.body && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
        )}
        <div className="mt-1 flex items-center justify-end gap-2">
          {message.failed ? (
            <button
              onClick={() => onRetry(message)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"
            >
              <AlertCircle className="h-3 w-3" /> Not sent · Retry
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {message.pending ? 'Sending…' : time}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write MessageThread**

Create `src/components/messages/MessageThread.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { groupByDay, dayLabel, isOnline } from '@/lib/dm'
import type { DmConversationSummary, DmMessage } from '@/lib/types/dm'
import { MessageBubble } from './MessageBubble'

export function MessageThread({
  messages,
  myId,
  conversation,
  onRetry,
}: {
  messages: DmMessage[]
  myId: string
  conversation: DmConversationSummary
  onRetry: (m: DmMessage) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedToBottom = useRef(true)

  // Follow new messages only when the reader is already at the bottom —
  // yanking someone out of history they are reading is worse than not scrolling.
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const { other } = conversation
  const display = other.name || `@${other.username}`
  const online = isOnline(other.lastSeenAt)
  const groups = groupByDay(messages)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        {other.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={other.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-galli/15 text-xs font-bold text-galli-dark">
            {display.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{display}</p>
          <p className="text-xs text-muted-foreground">{online ? 'Active now' : 'Offline'}</p>
        </div>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet — say hello.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="space-y-3">
              <p data-testid="day-separator" className="text-center text-xs text-muted-foreground">
                {dayLabel(group.key)}
              </p>
              {group.items.map((m) => (
                <MessageBubble key={m.id} message={m} mine={m.senderId === myId} onRetry={onRetry} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/components/messages/MessageThread.test.tsx
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/messages/MessageBubble.tsx src/components/messages/MessageThread.tsx src/components/messages/MessageThread.test.tsx
git commit -m "feat(dm): message thread with day separators and bubbles"
```

---

### Task 9: Composer and request banner

**Files:**
- Create: `src/components/messages/MessageComposer.tsx`
- Create: `src/components/messages/RequestBanner.tsx`
- Test: `src/components/messages/MessageComposer.test.tsx`

**Interfaces:**
- Consumes: nothing beyond React and lucide icons.
- Produces:
  - `<MessageComposer onSend={(body: string) => void} disabled={boolean} />`
  - `<RequestBanner name={string} onAccept={() => void} onIgnore={() => void} busy={boolean} />`

- [ ] **Step 1: Write the failing tests**

Create `src/components/messages/MessageComposer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageComposer } from './MessageComposer'
import { RequestBanner } from './RequestBanner'

describe('MessageComposer', () => {
  it('sends on click and clears the field', () => {
    const onSend = vi.fn()
    render(<MessageComposer onSend={onSend} disabled={false} />)
    const box = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).toHaveBeenCalledWith('hello')
    expect(box.value).toBe('')
  })

  it('sends on Enter', () => {
    const onSend = vi.fn()
    render(<MessageComposer onSend={onSend} disabled={false} />)
    const box = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(box, { target: { value: 'hello' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hello')
  })

  it('inserts a newline on Shift+Enter instead of sending', () => {
    const onSend = vi.fn()
    render(<MessageComposer onSend={onSend} disabled={false} />)
    const box = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(box, { target: { value: 'hello' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('refuses to send whitespace', () => {
    const onSend = vi.fn()
    render(<MessageComposer onSend={onSend} disabled={false} />)
    fireEvent.change(screen.getByPlaceholderText('Type a message...'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('renders the M3 attachment buttons disabled', () => {
    render(<MessageComposer onSend={() => {}} disabled={false} />)
    expect(screen.getByRole('button', { name: /attach/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /voice/i })).toBeDisabled()
  })

  it('disables the field entirely when disabled', () => {
    render(<MessageComposer onSend={() => {}} disabled />)
    expect(screen.getByPlaceholderText('Type a message...')).toBeDisabled()
  })
})

describe('RequestBanner', () => {
  it('offers Accept and Ignore', () => {
    const onAccept = vi.fn()
    const onIgnore = vi.fn()
    render(<RequestBanner name="Sarah" onAccept={onAccept} onIgnore={onIgnore} busy={false} />)
    expect(screen.getByText(/Sarah wants to message you/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    expect(onAccept).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /ignore/i }))
    expect(onIgnore).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/messages/MessageComposer.test.tsx
```

Expected: FAIL — `Failed to resolve import "./MessageComposer"`.

- [ ] **Step 3: Write MessageComposer**

Create `src/components/messages/MessageComposer.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'
import { Plus, Image as ImageIcon, Smile, Mic, Send } from 'lucide-react'

/**
 * The attachment row renders disabled in M1 so the composer's final shape is
 * built once — M3 fills these in rather than re-flowing the layout.
 */
const PENDING_TOOLS = [
  { key: 'attach', label: 'Attach a file', Icon: Plus },
  { key: 'image', label: 'Add an image', Icon: ImageIcon },
  { key: 'emoji', label: 'Add an emoji', Icon: Smile },
  { key: 'voice', label: 'Record a voice note', Icon: Mic },
] as const

export function MessageComposer({
  onSend,
  disabled,
}: {
  onSend: (body: string) => void
  disabled: boolean
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  const send = () => {
    const body = value.trim()
    if (!body) return
    onSend(body)
    setValue('')
    if (ref.current) ref.current.style.height = 'auto'
  }

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="border-t border-border p-3">
      <div className="rounded-2xl border border-border bg-surface px-3 py-2">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder="Type a message..."
          aria-label="Message"
          onChange={(e) => {
            setValue(e.target.value)
            grow(e.target)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {PENDING_TOOLS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                disabled
                aria-label={label}
                title={`${label} — coming soon`}
                className="cursor-not-allowed rounded-lg p-2 text-muted-foreground opacity-50"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={send}
            disabled={disabled}
            aria-label="Send message"
            className="rounded-full bg-galli p-2 text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write RequestBanner**

Create `src/components/messages/RequestBanner.tsx`:

```tsx
'use client'

export function RequestBanner({
  name,
  onAccept,
  onIgnore,
  busy,
}: {
  name: string
  onAccept: () => void
  onIgnore: () => void
  busy: boolean
}) {
  return (
    <div className="border-t border-border p-4 text-center">
      <p className="text-sm font-semibold text-foreground">{name} wants to message you</p>
      <p className="mt-1 text-xs text-muted-foreground">
        They can&apos;t see whether you&apos;ve read this until you accept.
      </p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          onClick={onIgnore}
          disabled={busy}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          Ignore
        </button>
        <button
          onClick={onAccept}
          disabled={busy}
          className="rounded-full bg-galli px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Accept
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/components/messages/MessageComposer.test.tsx
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/messages/MessageComposer.tsx src/components/messages/RequestBanner.tsx src/components/messages/MessageComposer.test.tsx
git commit -m "feat(dm): composer and request banner"
```

---

### Task 10: Person panel and empty states

**Files:**
- Create: `src/components/messages/PersonPanel.tsx`
- Create: `src/components/messages/MessagesEmpty.tsx`

**Interfaces:**
- Consumes: `DmConversationSummary`; `isOnline` from `src/lib/dm.ts`; `Link` from `next/link`.
- Produces:
  - `<PersonPanel conversation={DmConversationSummary} />` — reads `conversation.other.followsYou`, no separate prop
  - `<MessagesEmpty variant={'inbox' | 'thread'} />`

- [ ] **Step 1: Write PersonPanel**

Create `src/components/messages/PersonPanel.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { User as UserIcon } from 'lucide-react'
import { isOnline } from '@/lib/dm'
import type { DmConversationSummary } from '@/lib/types/dm'

export function PersonPanel({ conversation }: { conversation: DmConversationSummary }) {
  const { other } = conversation
  const display = other.name || `@${other.username}`
  const followsYou = other.followsYou

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col gap-4 border-l border-border p-5 xl:flex">
      <div className="flex flex-col items-center text-center">
        {other.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={other.avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-galli/15 text-lg font-bold text-galli-dark">
            {display.slice(0, 2).toUpperCase()}
          </span>
        )}
        <p className="mt-3 text-base font-bold">{display}</p>
        <p className="text-sm text-muted-foreground">@{other.username}</p>
        {followsYou && <p className="mt-1 text-sm font-medium text-galli-dark">Follows you</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {isOnline(other.lastSeenAt) ? 'Active now' : 'Offline'}
        </p>
      </div>

      <Link
        href={`/${other.username}`}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
      >
        <UserIcon className="h-4 w-4" /> Profile
      </Link>

      {/* Conversation Notes and Shared Content land here in M2. */}
    </aside>
  )
}
```

- [ ] **Step 2: Write MessagesEmpty**

Create `src/components/messages/MessagesEmpty.tsx`:

```tsx
'use client'

import { MessageSquare, Inbox } from 'lucide-react'

export function MessagesEmpty({ variant }: { variant: 'inbox' | 'thread' }) {
  const copy =
    variant === 'inbox'
      ? {
          Icon: Inbox,
          title: 'No conversations yet',
          body: 'Start one from someone’s profile, or wait for a message to arrive.',
        }
      : {
          Icon: MessageSquare,
          title: 'Pick a conversation',
          body: 'Choose someone on the left to read and reply.',
        }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-galli/10 text-galli-dark">
        <copy.Icon className="h-6 w-6" />
      </span>
      <p className="text-sm font-bold text-foreground">{copy.title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{copy.body}</p>
    </div>
  )
}
```

- [ ] **Step 3: Verify both compile**

```bash
npx tsc --noEmit
```

Expected: no errors in `src/components/messages/`.

- [ ] **Step 4: Commit**

```bash
git add src/components/messages/PersonPanel.tsx src/components/messages/MessagesEmpty.tsx
git commit -m "feat(dm): person panel and empty states"
```

---

### Task 11: Assemble MessagesClient and wire the page

**Files:**
- Create: `src/components/messages/MessagesClient.tsx`
- Test: `src/components/messages/MessagesClient.test.tsx`
- Modify: `src/app/(dashboard)/messages/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1 and 6–10, plus `MessagesInbox` from `src/components/dashboard/MessagesInbox.tsx` for the Visitor-notes tab.
- Produces: `<MessagesClient myId={string} />`, default-exported page rendering it.

- [ ] **Step 1: Write the failing tests**

Create `src/components/messages/MessagesClient.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MessagesClient } from './MessagesClient'

const push = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: push }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/messages',
}))
vi.mock('@/components/dashboard/MessagesInbox', () => ({
  MessagesInbox: () => <div>visitor notes list</div>,
}))

const conversation = {
  id: 'c1',
  state: 'accepted',
  starred: false,
  muted: false,
  unreadCount: 0,
  lastMessageAt: new Date().toISOString(),
  other: { id: 'them', username: 'sarah', name: 'Sarah Johnson', avatar: null, lastSeenAt: null, followsYou: false },
  preview: { body: 'Love your page!', kind: 'text', senderId: 'them', createdAt: new Date().toISOString() },
}

beforeEach(() => {
  vi.clearAllMocks()
  search = ''
  global.fetch = vi.fn(async (url: any, init?: any) => {
    const href = String(url)
    if (href.includes('/messages') && init?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          message: {
            id: 'server1', conversationId: 'c1', senderId: 'me', kind: 'text',
            body: 'hi there', mediaUrl: null, createdAt: new Date().toISOString(),
          },
        }),
      } as any
    }
    if (href.includes('/messages')) return { ok: true, json: async () => ({ messages: [] }) } as any
    if (href.includes('/conversations')) {
      return { ok: true, json: async () => ({ conversations: [conversation] }) } as any
    }
    return { ok: true, json: async () => ({}) } as any
  }) as any
})

describe('MessagesClient', () => {
  it('loads and lists conversations', async () => {
    render(<MessagesClient myId="me" />)
    await waitFor(() => expect(screen.getByText('Sarah Johnson')).toBeInTheDocument())
  })

  it('puts the selected conversation in the URL', async () => {
    render(<MessagesClient myId="me" />)
    await waitFor(() => expect(screen.getByText('Sarah Johnson')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Sarah Johnson/ }))
    expect(push).toHaveBeenCalledWith('/messages?c=c1')
  })

  it('shows the visitor notes tab content when selected', async () => {
    render(<MessagesClient myId="me" />)
    fireEvent.click(screen.getByRole('button', { name: /Visitor notes/i }))
    await waitFor(() => expect(screen.getByText('visitor notes list')).toBeInTheDocument())
  })

  it('appends an optimistic message immediately on send', async () => {
    search = 'c=c1'
    render(<MessagesClient myId="me" />)
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Type a message...'), { target: { value: 'hi there' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    expect(screen.getByText('hi there')).toBeInTheDocument()
  })

  it('keeps the text and marks the message failed when the send fails', async () => {
    search = 'c=c1'
    global.fetch = vi.fn(async (url: any, init?: any) => {
      const href = String(url)
      if (href.includes('/messages') && init?.method === 'POST') return { ok: false, status: 500 } as any
      if (href.includes('/messages')) return { ok: true, json: async () => ({ messages: [] }) } as any
      return { ok: true, json: async () => ({ conversations: [conversation] }) } as any
    }) as any

    render(<MessagesClient myId="me" />)
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Type a message...'), { target: { value: 'oops' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/messages/MessagesClient.test.tsx
```

Expected: FAIL — `Failed to resolve import "./MessagesClient"`.

- [ ] **Step 3: Write MessagesClient**

Create `src/components/messages/MessagesClient.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { usePolling } from '@/hooks/usePolling'
import type { DmConversationSummary, DmMessage } from '@/lib/types/dm'
import { MessagesInbox } from '@/components/dashboard/MessagesInbox'
import { ConversationList } from './ConversationList'
import { MessageThread } from './MessageThread'
import { MessageComposer } from './MessageComposer'
import { RequestBanner } from './RequestBanner'
import { PersonPanel } from './PersonPanel'
import { MessagesEmpty } from './MessagesEmpty'

type Tab = 'all' | 'unread' | 'requests' | 'visitor'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'requests', label: 'Requests' },
  { id: 'visitor', label: 'Visitor notes' },
]

const LIST_INTERVAL_MS = 20_000
const THREAD_INTERVAL_MS = 5_000

export function MessagesClient({ myId }: { myId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const activeId = params.get('c')

  const [tab, setTab] = useState<Tab>('all')
  const [conversations, setConversations] = useState<DmConversationSummary[]>([])
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [busy, setBusy] = useState(false)
  const [missing, setMissing] = useState(false)

  const active = conversations.find((c) => c.id === activeId) || null

  const loadConversations = useCallback(async () => {
    const res = await fetch(`/api/dm/conversations?filter=${tab === 'visitor' ? 'all' : tab}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('list failed')
    const data = await res.json()
    setConversations(Array.isArray(data.conversations) ? data.conversations : [])
  }, [tab])

  const loadThread = useCallback(async () => {
    if (!activeId) return
    const res = await fetch(`/api/dm/conversations/${activeId}/messages`, { cache: 'no-store' })
    // A stale or hand-typed ?c= must not leave the reader staring at a blank
    // column — say so and drop the selection.
    if (res.status === 404) {
      setMissing(true)
      return
    }
    if (!res.ok) throw new Error('thread failed')
    setMissing(false)
    const data = await res.json()
    setMessages(Array.isArray(data.messages) ? data.messages : [])
  }, [activeId])

  // Poll only for new messages once the thread is loaded, so a long transcript
  // is not re-fetched every 5 seconds.
  const pollThread = useCallback(async () => {
    if (!activeId) return
    const newest = [...messages].reverse().find((m) => !m.pending && !m.failed)
    const qs = newest ? `?after=${encodeURIComponent(newest.createdAt)}` : ''
    const res = await fetch(`/api/dm/conversations/${activeId}/messages${qs}`, { cache: 'no-store' })
    if (!res.ok) throw new Error('poll failed')
    const data = await res.json()
    const incoming: DmMessage[] = Array.isArray(data.messages) ? data.messages : []
    if (incoming.length === 0) return
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      return [...prev, ...incoming.filter((m) => !seen.has(m.id))]
    })
  }, [activeId, messages])

  useEffect(() => {
    setLoadingList(true)
    loadConversations()
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }, [loadConversations])

  useEffect(() => {
    setMessages([])
    setMissing(false)
    if (!activeId) return
    loadThread().catch(() => {})
    fetch(`/api/dm/conversations/${activeId}/read`, { method: 'POST' }).catch(() => {})
  }, [activeId, loadThread])

  const { failures } = usePolling(loadConversations, {
    intervalMs: LIST_INTERVAL_MS,
    enabled: tab !== 'visitor',
  })
  usePolling(pollThread, { intervalMs: THREAD_INTERVAL_MS, enabled: !!activeId })

  const select = (id: string) => router.push(`/messages?c=${id}`)
  const clearSelection = () => router.push('/messages')

  const deliver = useCallback(
    async (optimistic: DmMessage) => {
      try {
        const res = await fetch(`/api/dm/conversations/${optimistic.conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: optimistic.body }),
        })
        if (!res.ok) throw new Error('send failed')
        const data = await res.json()
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? data.message : m)))
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false, failed: true } : m))
        )
      }
    },
    []
  )

  const send = (body: string) => {
    if (!activeId) return
    const optimistic: DmMessage = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversationId: activeId,
      senderId: myId,
      kind: 'text',
      body,
      mediaUrl: null,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    void deliver(optimistic)
  }

  const retry = (m: DmMessage) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, failed: false, pending: true } : x)))
    void deliver({ ...m, failed: false, pending: true })
  }

  const setState = async (state: 'accepted' | 'blocked') => {
    if (!activeId) return
    setBusy(true)
    try {
      await fetch(`/api/dm/conversations/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      })
      if (state === 'blocked') clearSelection()
      await loadConversations()
    } catch {
      // The row stays as-is; the next poll reconciles.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-6 pb-10 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? 'bg-galli text-white'
                : 'border border-border bg-surface text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {failures >= 3 && (
        <p className="mb-3 text-xs text-muted-foreground">Reconnecting…</p>
      )}

      {tab === 'visitor' ? (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <MessagesInbox />
        </div>
      ) : (
        <div className="flex h-[calc(100vh-16rem)] min-h-[520px] overflow-hidden rounded-2xl border border-border bg-surface">
          <div className={`w-full shrink-0 border-r border-border lg:w-[320px] ${activeId ? 'hidden lg:block' : 'block'}`}>
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={select}
              loading={loadingList}
            />
          </div>

          <div className={`min-w-0 flex-1 flex-col ${activeId ? 'flex' : 'hidden lg:flex'}`}>
            {missing ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                <p className="text-sm font-bold">This conversation isn&apos;t available</p>
                <button
                  onClick={clearSelection}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
                >
                  Back to inbox
                </button>
              </div>
            ) : active ? (
              <>
                <button
                  onClick={clearSelection}
                  className="flex items-center gap-1 border-b border-border px-4 py-2 text-sm text-muted-foreground lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <MessageThread
                  messages={messages}
                  myId={myId}
                  conversation={active}
                  onRetry={retry}
                />
                {active.state === 'requested' ? (
                  <RequestBanner
                    name={active.other.name || `@${active.other.username}`}
                    onAccept={() => setState('accepted')}
                    onIgnore={() => setState('blocked')}
                    busy={busy}
                  />
                ) : (
                  <MessageComposer onSend={send} disabled={active.state === 'blocked'} />
                )}
              </>
            ) : (
              <MessagesEmpty variant={conversations.length === 0 ? 'inbox' : 'thread'} />
            )}
          </div>

          {active && <PersonPanel conversation={active} />}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire the page**

Replace `src/app/(dashboard)/messages/page.tsx` entirely:

```tsx
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { Mail } from 'lucide-react'
import { verifyAuth } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'
import { PageHero } from '@/components/dashboard/PageHero'
import { MessagesClient } from '@/components/messages/MessagesClient'

export default async function MessagesPage() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  const auth = token ? await verifyAuth(token) : null

  return (
    <div className="min-h-screen bg-background">
      <PageHero
        icon={<Mail className="w-7 h-7 text-primary" />}
        title="Messages"
        subtitle="Conversations with members, plus written and voice notes from your visitors."
      />
      {/* useSearchParams needs a Suspense boundary to avoid opting the whole
          route into client-side rendering at build time. */}
      <Suspense fallback={<p className="px-6 py-8 text-sm text-muted-foreground lg:px-8">Loading…</p>}>
        <MessagesClient myId={auth?.userId ?? ''} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 5: Confirm `verifyAuth` returns `userId`**

```bash
sed -n '15,45p' src/lib/auth.ts
```

Expected: the function decodes a JWT and returns an object containing `userId`. If it returns a different shape (for example the whole user), adjust the `auth?.userId` access in the page to match — the value passed as `myId` must be the caller's user id.

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run src/components/messages/MessagesClient.test.tsx
```

Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/messages/MessagesClient.tsx src/components/messages/MessagesClient.test.tsx "src/app/(dashboard)/messages/page.tsx"
git commit -m "feat(dm): assemble messages client and wire the page"
```

---

### Task 12: Start a conversation from a profile, and full verification

**Files:**
- Modify: `src/components/messages/MessagesClient.tsx` (add the New Message control)
- Test: `src/components/messages/MessagesClient.test.tsx` (extend)

**Interfaces:**
- Consumes: `POST /api/dm/conversations` from Task 3.
- Produces: a "New Message" button that prompts for a username, creates or finds the conversation, and selects it.

- [ ] **Step 1: Write the failing test**

Append to `src/components/messages/MessagesClient.test.tsx`:

```tsx
describe('starting a conversation', () => {
  it('creates the conversation and selects it', async () => {
    const created = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'cNew' }) }))
    global.fetch = vi.fn(async (url: any, init?: any) => {
      const href = String(url)
      if (href.endsWith('/api/dm/conversations') && init?.method === 'POST') return created() as any
      if (href.includes('/messages')) return { ok: true, json: async () => ({ messages: [] }) } as any
      return { ok: true, json: async () => ({ conversations: [] }) } as any
    }) as any
    vi.spyOn(window, 'prompt').mockReturnValue('sarah')

    render(<MessagesClient myId="me" />)
    fireEvent.click(screen.getByRole('button', { name: /new message/i }))

    await waitFor(() => expect(created).toHaveBeenCalled())
    await waitFor(() => expect(push).toHaveBeenCalledWith('/messages?c=cNew'))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/components/messages/MessagesClient.test.tsx
```

Expected: FAIL — no button named "New Message".

- [ ] **Step 3: Add the control**

In `src/components/messages/MessagesClient.tsx`, add `PenSquare` to the lucide import:

```tsx
import { ArrowLeft, PenSquare } from 'lucide-react'
```

Add this handler next to `setState`:

```tsx
  const startConversation = async () => {
    const username = window.prompt('Message which member? Enter their username.')?.trim()
    if (!username) return
    setBusy(true)
    try {
      const res = await fetch('/api/dm/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!res.ok) {
        window.alert(res.status === 404 ? 'No member with that username.' : 'Could not start that conversation.')
        return
      }
      const data = await res.json()
      await loadConversations()
      router.push(`/messages?c=${data.id}`)
    } catch {
      window.alert('Could not start that conversation.')
    } finally {
      setBusy(false)
    }
  }
```

Then change the tab row's wrapper so the button sits at the end. Replace the opening `<div className="mb-4 flex flex-wrap items-center gap-2">` block's closing `</div>` region with:

```tsx
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? 'bg-galli text-white'
                : 'border border-border bg-surface text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={startConversation}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-galli px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          <PenSquare className="h-4 w-4" /> New Message
        </button>
      </div>
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/components/messages/MessagesClient.test.tsx
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Run the full verification sweep**

```bash
npx vitest run src/lib/dm.test.ts src/hooks src/components/messages "src/app/api/dm"
npx tsc --noEmit
npx next lint
```

Expected: all test files pass; `tsc` reports no errors outside the pre-existing stale `.next/types/app/explore/page.js` entries; lint reports `✔ No ESLint warnings or errors`.

If a full-suite run reports phantom "errors" or `1 failed` with no failing assertion, that is the known worker-spawn timeout under machine load — check whether passed + errors equals the total file count and re-run the skipped files individually.

- [ ] **Step 6: Verify the production build compiles**

```bash
npx next build
```

Expected: `✓ Compiled successfully`. Stop `next dev` first — on Windows a running dev server races the build on `.next` and produces phantom errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/messages/MessagesClient.tsx src/components/messages/MessagesClient.test.tsx
git commit -m "feat(dm): start a conversation from the inbox"
```

---

## Known loose end

`GET /api/dm/unread-count` is built and tested but **not consumed by any UI in M1** — the
sidebar "Messages" item keeps its current appearance. Wiring a badge into `Sidebar.tsx` and
`MobileNav.tsx` means merging this count with the existing visitor-mailbox count from
`/api/messages/unread-count`, which is a decision about what the badge means rather than a
piece of core DM plumbing. It belongs with the rest of the inbox chrome in M2. The route
exists now so M2 does not have to touch the API layer again.

## Manual verification before shipping

Run the dev server with the correct database URL and confirm the flow end to end with two accounts:

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
pnpm dev
```

1. As user A, open `/messages`, press **New Message**, enter user B's username. The conversation appears and is selected; the URL shows `?c=<id>`.
2. Send a message. It appears immediately, then settles from "Sending…" to a timestamp.
3. As user B (a different browser profile), open `/messages`. The thread is under **Requests** with an Accept / Ignore banner and no composer.
4. Accept. The thread moves to **All** and the composer appears. Reply.
5. Back in user A's still-open tab, the reply arrives within ~5 seconds without a refresh.
6. Switch to another browser tab for a minute, then return: polling resumes and refetches immediately.
7. Confirm the **Visitor notes** tab still lists anonymous mailbox messages exactly as before.
8. Narrow the window below 1024px: the list and thread swap with a working Back arrow.

If the dev server 500s on the new models right after the migration, restart it — Next.js holds a stale Prisma client until it is restarted.

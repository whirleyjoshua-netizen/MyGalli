# Acknowledgment Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an `acknowledgment` canvas element that records which logged-in users have confirmed they read the information presented, with an owner-only roster gated behind Pro.

**Architecture:** A new element type added through the project's seven element seams, backed by two new Prisma models. All acknowledgment reads and writes go through a dedicated `/api/acknowledgments` route group rather than the shared form/response plumbing, because `FormResponse` is deliberately anonymous and identity is the whole point here. Every record is keyed by a non-null `scopeKey` that folds the containing page or hub post into the identifier, so the same element id appearing in two hub posts stays isolated. Resets bump a round counter instead of deleting rows, so the audit trail survives.

**Tech Stack:** Next.js 15.5.19 App Router, React 19, TypeScript, Prisma/PostgreSQL, Tailwind, Vitest, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-20-acknowledgment-element-design.md`

## Global Constraints

- **Element type name:** `acknowledgment` (singular, no abbreviation), used identically in the `ElementType` union, the slash menu, the API, and the analytics card.
- **Default copy:** confirm label `"I have read and understood this"`, button label `"Acknowledge"`. Define once in `src/lib/acknowledgment.ts` as exported constants; never re-type these strings elsewhere.
- **A `route.ts` may export ONLY route handlers** (`GET`, `POST`, etc.). Exporting a helper from a route file passes `tsc` but fails `next build` and has shipped a red main before. All shared logic goes in `src/lib/acknowledgment.ts`.
- **Prisma migrations are non-interactive here.** Never run `migrate dev`. Hand-author `prisma/migrations/<timestamp>_<name>/migration.sql` containing only the new statements, then `migrate deploy`. `migrate diff --from-url` against the shared dev DB is contaminated and emits spurious `DROP TABLE`.
- **Database URL must be set inline for every command** and must use `127.0.0.1`, not `localhost`:
  `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"`. Prisma CLI commands also need `DATABASE_URL_UNPOOLED` set to the same value.
- **`tsc` does not run ESLint.** Before declaring the work done, run `pnpm exec next lint` — `no-html-link-for-pages` and `react/no-unescaped-entities` have broken production deploys. Escape apostrophes in JSX as `&apos;`.
- **Pro gating** uses the existing `isPro()` from `src/lib/plan.ts`. Never compare `user.plan` to a string directly.
- **Never commit** `Documents/`, `Images/`, `g1t.json`, `nul`, or `.claude/settings.local.json`. Stage files explicitly by path; never `git add -A`.
- **Do not push.** `main` carries unpushed work and pushing deploys production. Commit locally only.

## File Structure

**Create:**
- `src/lib/acknowledgment.ts` — all pure logic: scope keys, status resolution, roster shaping, CSV. No database imports.
- `src/lib/acknowledgment.test.ts` — unit tests for the above.
- `src/app/api/acknowledgments/route.ts` — `POST` to record an acknowledgment.
- `src/app/api/acknowledgments/route.test.ts`
- `src/app/api/acknowledgments/[elementId]/route.ts` — `GET` count/status/roster.
- `src/app/api/acknowledgments/[elementId]/route.test.ts`
- `src/app/api/acknowledgments/[elementId]/reset/route.ts` — `POST` to bump the round.
- `src/app/api/acknowledgments/[elementId]/reset/route.test.ts`
- `src/app/api/acknowledgments/[elementId]/export/route.ts` — `GET` CSV.
- `src/components/elements/AcknowledgmentElement.tsx` — editor component.
- `src/components/elements/PublicAcknowledgmentElement.tsx` — public component.
- `src/components/analytics/element-cards/AcknowledgmentCard.tsx` — Data tab card.
- `src/components/bulletin/blocks/BulletinAcknowledgment.tsx` — hub post block.

**Modify:**
- `prisma/schema.prisma` — two new models plus a `User` back-relation.
- `src/lib/types/canvas.ts` — `ElementType` union, `CanvasElement` fields, `createElement()` case.
- `src/components/canvas/SlashCommandMenu.tsx:113` area — Social category entry.
- `src/components/canvas/ColumnCanvas.tsx:787` area — `renderElement` case.
- `src/components/elements/index.ts` — two exports.
- `src/lib/render-elements.tsx` — import plus `case 'acknowledgment'`.
- `src/app/api/analytics/[displayId]/elements/route.ts` — discovery-only card payload.
- `src/components/analytics/element-cards/index.ts` — one export.
- `src/components/analytics/ElementsTab.tsx` — import plus switch case.
- `src/lib/bulletin.ts` — add to `BULLETIN_BLOCK_TYPES`.
- `src/components/bulletin/BlockEditor.tsx` — `makeBlock` case plus editor field.
- `src/components/bulletin/BulletinBlock.tsx` — switch case.

**Deliberately not modified:** `src/app/api/forms/submit`, `FormResponse`, and the `HubPostResponse` response plumbing. Acknowledgments need identity and rounds; those paths carry neither.

---

### Task 1: Pure acknowledgment logic

Everything in this task is database-free and test-first. Later tasks import from here rather than re-deriving scope keys or status.

**Files:**
- Create: `src/lib/acknowledgment.ts`
- Test: `src/lib/acknowledgment.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ACK_CONFIRM_LABEL_DEFAULT: string`, `ACK_BUTTON_LABEL_DEFAULT: string`, `ACK_STATEMENT_DEFAULT: string`
  - `type AckScope = { displayId: string } | { hubPostId: string }`
  - `parseScope(input: { displayId?: unknown; hubPostId?: unknown }): AckScope | null`
  - `scopeKeyFor(elementId: string, scope: AckScope): string`
  - `type AckRecord = { userId: string; round: number; createdAt: Date | string; user?: { name: string | null; username: string | null } }`
  - `type AckStatus = 'none' | 'current' | 'stale'`
  - `ackStatus(records: AckRecord[], currentRound: number, userId: string | null): AckStatus`
  - `type RosterEntry = { userId: string; name: string; username: string; acknowledgedAt: string }`
  - `buildRoster(records: AckRecord[], currentRound: number): RosterEntry[]`
  - `reAckProgress(records: AckRecord[], currentRound: number): { current: number; previous: number }`
  - `rosterCsv(entries: RosterEntry[]): string`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/acknowledgment.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  parseScope,
  scopeKeyFor,
  ackStatus,
  buildRoster,
  reAckProgress,
  rosterCsv,
} from './acknowledgment'

describe('parseScope', () => {
  it('accepts a display context', () => {
    expect(parseScope({ displayId: 'd1' })).toEqual({ displayId: 'd1' })
  })

  it('accepts a hub post context', () => {
    expect(parseScope({ hubPostId: 'p1' })).toEqual({ hubPostId: 'p1' })
  })

  it('rejects both contexts at once', () => {
    expect(parseScope({ displayId: 'd1', hubPostId: 'p1' })).toBeNull()
  })

  it('rejects neither', () => {
    expect(parseScope({})).toBeNull()
  })

  it('rejects non-string ids', () => {
    expect(parseScope({ displayId: 42 })).toBeNull()
    expect(parseScope({ displayId: '' })).toBeNull()
  })
})

describe('scopeKeyFor', () => {
  it('namespaces a display element', () => {
    expect(scopeKeyFor('el-1', { displayId: 'd1' })).toBe('display:d1:el-1')
  })

  it('namespaces a hub post element', () => {
    expect(scopeKeyFor('blk-acknowledgment-7', { hubPostId: 'p1' })).toBe('hubpost:p1:blk-acknowledgment-7')
  })

  it('keeps the same element id in two posts distinct', () => {
    const a = scopeKeyFor('blk-acknowledgment-7', { hubPostId: 'p1' })
    const b = scopeKeyFor('blk-acknowledgment-7', { hubPostId: 'p2' })
    expect(a).not.toBe(b)
  })
})

const rec = (userId: string, round: number, createdAt = '2026-07-20T10:00:00.000Z', name = 'Ada Lovelace', username = 'ada') =>
  ({ userId, round, createdAt, user: { name, username } })

describe('ackStatus', () => {
  it('is none for a signed-out viewer', () => {
    expect(ackStatus([rec('u1', 0)], 0, null)).toBe('none')
  })

  it('is none when the viewer has no record', () => {
    expect(ackStatus([rec('u1', 0)], 0, 'u2')).toBe('none')
  })

  it('is current when the viewer acknowledged this round', () => {
    expect(ackStatus([rec('u1', 2)], 2, 'u1')).toBe('current')
  })

  it('is stale when the viewer only acknowledged an earlier round', () => {
    expect(ackStatus([rec('u1', 1)], 2, 'u1')).toBe('stale')
  })

  it('prefers the current round when the viewer has records in both', () => {
    expect(ackStatus([rec('u1', 1), rec('u1', 2)], 2, 'u1')).toBe('current')
  })
})

describe('buildRoster', () => {
  it('includes only current-round records, newest first', () => {
    const records = [
      rec('u1', 1, '2026-07-19T10:00:00.000Z', 'Old Round', 'old'),
      rec('u2', 2, '2026-07-20T09:00:00.000Z', 'Grace Hopper', 'grace'),
      rec('u3', 2, '2026-07-20T11:00:00.000Z', 'Alan Turing', 'alan'),
    ]
    const roster = buildRoster(records, 2)
    expect(roster.map((r) => r.username)).toEqual(['alan', 'grace'])
  })

  it('falls back to the username when the name is missing', () => {
    const roster = buildRoster([rec('u1', 0, '2026-07-20T10:00:00.000Z', null as unknown as string, 'ada')], 0)
    expect(roster[0].name).toBe('ada')
  })

  it('serializes the timestamp as an ISO string', () => {
    const roster = buildRoster([{ userId: 'u1', round: 0, createdAt: new Date('2026-07-20T10:00:00.000Z') }], 0)
    expect(roster[0].acknowledgedAt).toBe('2026-07-20T10:00:00.000Z')
  })
})

describe('reAckProgress', () => {
  it('counts the current round against the previous one', () => {
    const records = [rec('u1', 0), rec('u2', 0), rec('u3', 0), rec('u1', 1)]
    expect(reAckProgress(records, 1)).toEqual({ current: 1, previous: 3 })
  })

  it('reports no previous round at round zero', () => {
    expect(reAckProgress([rec('u1', 0)], 0)).toEqual({ current: 1, previous: 0 })
  })
})

describe('rosterCsv', () => {
  it('writes a header and one row per entry', () => {
    const csv = rosterCsv([
      { userId: 'u1', name: 'Ada Lovelace', username: 'ada', acknowledgedAt: '2026-07-20T10:00:00.000Z' },
    ])
    expect(csv).toBe('Name,Username,Acknowledged At\r\nAda Lovelace,ada,2026-07-20T10:00:00.000Z')
  })

  it('quotes and escapes fields containing commas or quotes', () => {
    const csv = rosterCsv([
      { userId: 'u1', name: 'Lovelace, Ada "The Countess"', username: 'ada', acknowledgedAt: '2026-07-20T10:00:00.000Z' },
    ])
    expect(csv).toContain('"Lovelace, Ada ""The Countess"""')
  })

  it('returns only the header for an empty roster', () => {
    expect(rosterCsv([])).toBe('Name,Username,Acknowledged At')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec vitest run src/lib/acknowledgment.test.ts
```

Expected: FAIL — `Failed to resolve import "./acknowledgment"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/acknowledgment.ts`:

```typescript
// Pure acknowledgment logic. No database imports — every consumer (API routes,
// analytics card, hub post block) shares these definitions so scope keys and
// status resolution can never drift between surfaces.

export const ACK_STATEMENT_DEFAULT = 'Please confirm you have read the information above.'
export const ACK_CONFIRM_LABEL_DEFAULT = 'I have read and understood this'
export const ACK_BUTTON_LABEL_DEFAULT = 'Acknowledge'

export type AckScope = { displayId: string } | { hubPostId: string }

/**
 * Validates a request's context. Exactly one of displayId/hubPostId must be a
 * non-empty string; anything else is a malformed request.
 */
export function parseScope(input: { displayId?: unknown; hubPostId?: unknown }): AckScope | null {
  const displayId = typeof input.displayId === 'string' && input.displayId ? input.displayId : null
  const hubPostId = typeof input.hubPostId === 'string' && input.hubPostId ? input.hubPostId : null
  if (displayId && hubPostId) return null
  if (displayId) return { displayId }
  if (hubPostId) return { hubPostId }
  return null
}

/**
 * Element ids are only unique within their container: makeBlock() in
 * BlockEditor.tsx assigns deterministic ids, so the same acknowledgment block id
 * appears in every hub post that uses one. Folding the container into the key is
 * what keeps those records isolated.
 */
export function scopeKeyFor(elementId: string, scope: AckScope): string {
  return 'displayId' in scope
    ? `display:${scope.displayId}:${elementId}`
    : `hubpost:${scope.hubPostId}:${elementId}`
}

export type AckRecord = {
  userId: string
  round: number
  createdAt: Date | string
  user?: { name: string | null; username: string | null } | null
}

export type AckStatus = 'none' | 'current' | 'stale'

export function ackStatus(records: AckRecord[], currentRound: number, userId: string | null): AckStatus {
  if (!userId) return 'none'
  const mine = records.filter((r) => r.userId === userId)
  if (mine.length === 0) return 'none'
  return mine.some((r) => r.round === currentRound) ? 'current' : 'stale'
}

export type RosterEntry = {
  userId: string
  name: string
  username: string
  acknowledgedAt: string
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function buildRoster(records: AckRecord[], currentRound: number): RosterEntry[] {
  return records
    .filter((r) => r.round === currentRound)
    .map((r) => ({
      userId: r.userId,
      name: r.user?.name || r.user?.username || 'Unknown',
      username: r.user?.username || '',
      acknowledgedAt: toIso(r.createdAt),
    }))
    .sort((a, b) => b.acknowledgedAt.localeCompare(a.acknowledgedAt))
}

export function reAckProgress(
  records: AckRecord[],
  currentRound: number
): { current: number; previous: number } {
  const current = records.filter((r) => r.round === currentRound).length
  const previous = currentRound > 0 ? records.filter((r) => r.round === currentRound - 1).length : 0
  return { current, previous }
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function rosterCsv(entries: RosterEntry[]): string {
  const rows = [
    'Name,Username,Acknowledged At',
    ...entries.map((e) => [e.name, e.username, e.acknowledgedAt].map(csvCell).join(',')),
  ]
  return rows.join('\r\n')
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec vitest run src/lib/acknowledgment.test.ts
```

Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/whirl/pages-mvp
git add src/lib/acknowledgment.ts src/lib/acknowledgment.test.ts
git commit -m "feat(acknowledgment): pure scope, status, roster and CSV logic"
```

---

### Task 2: Prisma models and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260720120000_add_acknowledgment/migration.sql`

**Interfaces:**
- Consumes: nothing from Task 1 (the schema stands alone).
- Produces: `db.acknowledgment` and `db.acknowledgmentRound` Prisma clients used by Tasks 3–5, with fields `scopeKey`, `elementId`, `displayId`, `hubPostId`, `userId`, `round`, `createdAt`.

- [ ] **Step 1: Add the models to the schema**

Append to `prisma/schema.prisma`:

```prisma
model Acknowledgment {
  id        String   @id @default(cuid())
  scopeKey  String
  elementId String
  displayId String?
  hubPostId String?
  userId    String
  user      User     @relation("UserAcknowledgments", fields: [userId], references: [id], onDelete: Cascade)
  round     Int      @default(0)
  createdAt DateTime @default(now())

  @@unique([scopeKey, userId, round])
  @@index([scopeKey, round])
  @@index([userId])
}

model AcknowledgmentRound {
  scopeKey String   @id
  round    Int      @default(0)
  resetAt  DateTime @updatedAt
}
```

- [ ] **Step 2: Add the back-relation on User**

In `prisma/schema.prisma`, find the `model User {` block and add this line alongside the other relation fields (for example just after the existing `notifications` or hub relations):

```prisma
  acknowledgments Acknowledgment[] @relation("UserAcknowledgments")
```

- [ ] **Step 3: Hand-author the migration SQL**

Create `prisma/migrations/20260720120000_add_acknowledgment/migration.sql` with only these statements. Do not generate it with `migrate diff --from-url` — the shared dev database is contaminated by other branches' tables and would emit spurious `DROP TABLE`.

```sql
-- CreateTable
CREATE TABLE "Acknowledgment" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "displayId" TEXT,
    "hubPostId" TEXT,
    "userId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Acknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcknowledgmentRound" (
    "scopeKey" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcknowledgmentRound_pkey" PRIMARY KEY ("scopeKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "Acknowledgment_scopeKey_userId_round_key" ON "Acknowledgment"("scopeKey", "userId", "round");

-- CreateIndex
CREATE INDEX "Acknowledgment_scopeKey_round_idx" ON "Acknowledgment"("scopeKey", "round");

-- CreateIndex
CREATE INDEX "Acknowledgment_userId_idx" ON "Acknowledgment"("userId");

-- AddForeignKey
ALTER TABLE "Acknowledgment" ADD CONSTRAINT "Acknowledgment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Validate the schema and generate the client**

```bash
cd /c/Users/whirl/pages-mvp
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma validate
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma generate
```

Expected: `The schema at prisma/schema.prisma is valid` then `Generated Prisma Client`.

If `prisma generate` fails with `EPERM`, a running `next dev` is holding the query engine DLL. Stop the dev server and retry.

- [ ] **Step 5: Apply the migration**

```bash
cd /c/Users/whirl/pages-mvp
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma migrate deploy
```

Expected: `1 migration found` and `Applied migration(s)`.

If this fails with `P3005`/drift because the local dev database was previously modified with `db push`, do **not** reset the database. Apply just this migration's SQL directly with `psql` and record it as applied:

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma migrate resolve --applied 20260720120000_add_acknowledgment
```

- [ ] **Step 6: Commit**

```bash
cd /c/Users/whirl/pages-mvp
git add prisma/schema.prisma prisma/migrations/20260720120000_add_acknowledgment/migration.sql
git commit -m "feat(acknowledgment): Acknowledgment and AcknowledgmentRound models"
```

---

### Task 3: POST /api/acknowledgments

Records an acknowledgment for the signed-in user at the element's current round.

**Files:**
- Create: `src/app/api/acknowledgments/route.ts`
- Test: `src/app/api/acknowledgments/route.test.ts`

**Interfaces:**
- Consumes: `parseScope`, `scopeKeyFor` from `src/lib/acknowledgment.ts`; `db.acknowledgment`, `db.acknowledgmentRound` from Task 2.
- Produces: `POST` handler. Request body `{ elementId: string, displayId?: string, hubPostId?: string }`. Responses: `201 { ok: true }` on create, `200 { ok: true }` when already acknowledged this round, `400` on a malformed body, `401` when signed out.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/acknowledgments/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    acknowledgment: { create: vi.fn() },
    acknowledgmentRound: { findUnique: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'

const post = (b: unknown) =>
  new Request('http://localhost/api/acknowledgments', { method: 'POST', body: JSON.stringify(b) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue({ id: 'u1' })
  ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue(null)
  ;(db.acknowledgment.create as any).mockResolvedValue({ id: 'a1' })
})

describe('POST /api/acknowledgments', () => {
  it('401 when signed out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(post({ elementId: 'el-1', displayId: 'd1' }))
    expect(res.status).toBe(401)
    expect(db.acknowledgment.create).not.toHaveBeenCalled()
  })

  it('400 when no context is given', async () => {
    const res = await POST(post({ elementId: 'el-1' }))
    expect(res.status).toBe(400)
    expect(db.acknowledgment.create).not.toHaveBeenCalled()
  })

  it('400 when both contexts are given', async () => {
    const res = await POST(post({ elementId: 'el-1', displayId: 'd1', hubPostId: 'p1' }))
    expect(res.status).toBe(400)
  })

  it('400 when elementId is missing', async () => {
    const res = await POST(post({ displayId: 'd1' }))
    expect(res.status).toBe(400)
  })

  it('201 records at round 0 when no reset has happened', async () => {
    const res = await POST(post({ elementId: 'el-1', displayId: 'd1' }))
    expect(res.status).toBe(201)
    expect(db.acknowledgment.create).toHaveBeenCalledWith({
      data: {
        scopeKey: 'display:d1:el-1',
        elementId: 'el-1',
        displayId: 'd1',
        hubPostId: null,
        userId: 'u1',
        round: 0,
      },
    })
  })

  it('records at the current round after a reset', async () => {
    ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue({ scopeKey: 'display:d1:el-1', round: 3 })
    const res = await POST(post({ elementId: 'el-1', displayId: 'd1' }))
    expect(res.status).toBe(201)
    expect((db.acknowledgment.create as any).mock.calls[0][0].data.round).toBe(3)
  })

  it('scopes a hub post acknowledgment by post id', async () => {
    await POST(post({ elementId: 'blk-acknowledgment-7', hubPostId: 'p1' }))
    expect((db.acknowledgment.create as any).mock.calls[0][0].data).toMatchObject({
      scopeKey: 'hubpost:p1:blk-acknowledgment-7',
      displayId: null,
      hubPostId: 'p1',
    })
  })

  it('200 and no duplicate row when already acknowledged this round', async () => {
    const err: any = new Error('unique violation')
    err.code = 'P2002'
    ;(db.acknowledgment.create as any).mockRejectedValue(err)
    const res = await POST(post({ elementId: 'el-1', displayId: 'd1' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec vitest run src/app/api/acknowledgments/route.test.ts
```

Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/acknowledgments/route.ts`. This file exports only `POST` — no helpers, or `next build` will fail.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { parseScope, scopeKeyFor } from '@/lib/acknowledgment'

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limited = await rateLimit(request, {
      limit: 30,
      windowMs: 60_000,
      prefix: 'ack',
      identifier: user.id,
    })
    if (limited) return limited

    const body = await request.json().catch(() => ({}))
    const elementId = typeof body.elementId === 'string' && body.elementId ? body.elementId : null
    const scope = parseScope(body)
    if (!elementId || !scope) {
      return NextResponse.json({ error: 'elementId and exactly one of displayId/hubPostId are required' }, { status: 400 })
    }

    const scopeKey = scopeKeyFor(elementId, scope)
    const roundRow = await db.acknowledgmentRound.findUnique({ where: { scopeKey } })
    const round = roundRow?.round ?? 0

    try {
      await db.acknowledgment.create({
        data: {
          scopeKey,
          elementId,
          displayId: 'displayId' in scope ? scope.displayId : null,
          hubPostId: 'hubPostId' in scope ? scope.hubPostId : null,
          userId: user.id,
          round,
        },
      })
    } catch (error) {
      // Already acknowledged this round — the unique constraint makes the
      // endpoint idempotent, so a repeat submit is a success, not an error.
      if ((error as { code?: string }).code === 'P2002') {
        return NextResponse.json({ ok: true })
      }
      throw error
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/acknowledgments error:', error)
    return NextResponse.json({ error: 'Failed to record acknowledgment' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec vitest run src/app/api/acknowledgments/route.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/whirl/pages-mvp
git add src/app/api/acknowledgments/route.ts src/app/api/acknowledgments/route.test.ts
git commit -m "feat(acknowledgment): POST endpoint records an acknowledgment"
```

---

### Task 4: GET /api/acknowledgments/[elementId]

Returns the count and the viewer's own status to anyone, and the named roster only to a Pro owner.

**Files:**
- Create: `src/app/api/acknowledgments/[elementId]/route.ts`
- Test: `src/app/api/acknowledgments/[elementId]/route.test.ts`

**Interfaces:**
- Consumes: `parseScope`, `scopeKeyFor`, `ackStatus`, `buildRoster`, `reAckProgress` from `src/lib/acknowledgment.ts`; `isPro` from `src/lib/plan.ts`.
- Produces: `GET` handler. Query `?displayId=` or `?hubPostId=`. Response `{ count, round, mine, isOwner, canSeeRoster, roster, progress }` where `roster` is `RosterEntry[]` (empty unless `canSeeRoster`) and `progress` is `{ current, previous }`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/acknowledgments/[elementId]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    acknowledgment: { findMany: vi.fn() },
    acknowledgmentRound: { findUnique: vi.fn() },
    display: { findUnique: vi.fn() },
    hubPost: { findUnique: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from './route'

const ctx = { params: Promise.resolve({ elementId: 'el-1' }) }
const get = (qs: string) => new Request(`http://localhost/api/acknowledgments/el-1?${qs}`) as any

const records = [
  { userId: 'u1', round: 0, createdAt: new Date('2026-07-20T10:00:00.000Z'), user: { name: 'Ada Lovelace', username: 'ada' } },
  { userId: 'u2', round: 0, createdAt: new Date('2026-07-20T11:00:00.000Z'), user: { name: 'Grace Hopper', username: 'grace' } },
]

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue(null)
  ;(db.acknowledgment.findMany as any).mockResolvedValue(records)
  ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue(null)
  ;(db.display.findUnique as any).mockResolvedValue({ id: 'd1', userId: 'owner' })
  ;(db.hubPost.findUnique as any).mockResolvedValue({ id: 'p1', hub: { userId: 'owner' } })
})

describe('GET /api/acknowledgments/[elementId]', () => {
  it('400 without a context param', async () => {
    const res = await GET(get(''), ctx)
    expect(res.status).toBe(400)
  })

  it('returns the count to a signed-out visitor without any roster', async () => {
    const res = await GET(get('displayId=d1'), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(2)
    expect(body.mine).toBe('none')
    expect(body.roster).toEqual([])
    expect(body.canSeeRoster).toBe(false)
  })

  it('reports the viewer own status', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'free' })
    const body = await (await GET(get('displayId=d1'), ctx)).json()
    expect(body.mine).toBe('current')
  })

  it('reports stale when the viewer acknowledged an earlier round', async () => {
    ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue({ scopeKey: 'display:d1:el-1', round: 1 })
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'free' })
    const body = await (await GET(get('displayId=d1'), ctx)).json()
    expect(body.mine).toBe('stale')
  })

  it('hides the roster from a non-owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'someone-else', plan: 'pro' })
    const body = await (await GET(get('displayId=d1'), ctx)).json()
    expect(body.isOwner).toBe(false)
    expect(body.roster).toEqual([])
  })

  it('hides the roster from a free owner but still gives the count', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', plan: 'free' })
    const body = await (await GET(get('displayId=d1'), ctx)).json()
    expect(body.isOwner).toBe(true)
    expect(body.canSeeRoster).toBe(false)
    expect(body.roster).toEqual([])
    expect(body.count).toBe(2)
  })

  it('gives a Pro owner the named roster newest first', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', plan: 'pro' })
    const body = await (await GET(get('displayId=d1'), ctx)).json()
    expect(body.canSeeRoster).toBe(true)
    expect(body.roster.map((r: any) => r.username)).toEqual(['grace', 'ada'])
  })

  it('resolves hub post ownership through the hub', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', plan: 'pro' })
    const body = await (await GET(get('hubPostId=p1'), ctx)).json()
    expect(body.isOwner).toBe(true)
    expect(db.hubPost.findUnique).toHaveBeenCalled()
  })

  it('404 when the display does not exist', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(null)
    const res = await GET(get('displayId=d1'), ctx)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec vitest run "src/app/api/acknowledgments/[elementId]/route.test.ts"
```

Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/acknowledgments/[elementId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isPro } from '@/lib/plan'
import { parseScope, scopeKeyFor, ackStatus, buildRoster, reAckProgress } from '@/lib/acknowledgment'

interface Props {
  params: Promise<{ elementId: string }>
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { elementId } = await params
    const url = new URL(request.url)
    const scope = parseScope({
      displayId: url.searchParams.get('displayId') ?? undefined,
      hubPostId: url.searchParams.get('hubPostId') ?? undefined,
    })
    if (!scope) {
      return NextResponse.json({ error: 'Exactly one of displayId/hubPostId is required' }, { status: 400 })
    }

    // Resolve the owner of the container so the roster can be gated.
    let ownerId: string | null = null
    if ('displayId' in scope) {
      const display = await db.display.findUnique({
        where: { id: scope.displayId },
        select: { userId: true },
      })
      if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      ownerId = display.userId
    } else {
      const post = await db.hubPost.findUnique({
        where: { id: scope.hubPostId },
        select: { hub: { select: { userId: true } } },
      })
      if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      ownerId = post.hub.userId
    }

    const user = await getUser(request)
    const scopeKey = scopeKeyFor(elementId, scope)

    const roundRow = await db.acknowledgmentRound.findUnique({ where: { scopeKey } })
    const round = roundRow?.round ?? 0

    const records = await db.acknowledgment.findMany({
      where: { scopeKey },
      select: {
        userId: true,
        round: true,
        createdAt: true,
        user: { select: { name: true, username: true } },
      },
    })

    const isOwner = !!user && user.id === ownerId
    const canSeeRoster = isOwner && isPro(user)

    return NextResponse.json({
      count: records.filter((r) => r.round === round).length,
      round,
      mine: ackStatus(records, round, user?.id ?? null),
      isOwner,
      canSeeRoster,
      roster: canSeeRoster ? buildRoster(records, round) : [],
      progress: reAckProgress(records, round),
    })
  } catch (error) {
    console.error('GET /api/acknowledgments/[elementId] error:', error)
    return NextResponse.json({ error: 'Failed to load acknowledgments' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec vitest run "src/app/api/acknowledgments/[elementId]/route.test.ts"
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/whirl/pages-mvp
git add "src/app/api/acknowledgments/[elementId]/route.ts" "src/app/api/acknowledgments/[elementId]/route.test.ts"
git commit -m "feat(acknowledgment): GET endpoint with owner+Pro gated roster"
```

---

### Task 5: Reset and CSV export endpoints

**Files:**
- Create: `src/app/api/acknowledgments/[elementId]/reset/route.ts`
- Create: `src/app/api/acknowledgments/[elementId]/export/route.ts`
- Test: `src/app/api/acknowledgments/[elementId]/reset/route.test.ts`

**Interfaces:**
- Consumes: the same helpers as Task 4.
- Produces: `POST .../reset` returning `{ ok: true, round }`; `GET .../export` returning `text/csv`. Both are owner + Pro only.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/acknowledgments/[elementId]/reset/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    acknowledgmentRound: { findUnique: vi.fn(), upsert: vi.fn() },
    acknowledgment: { deleteMany: vi.fn() },
    display: { findUnique: vi.fn() },
    hubPost: { findUnique: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'

const ctx = { params: Promise.resolve({ elementId: 'el-1' }) }
const post = () =>
  new Request('http://localhost/api/acknowledgments/el-1/reset?displayId=d1', { method: 'POST' }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as any).mockResolvedValue({ userId: 'owner' })
  ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue(null)
  ;(db.acknowledgmentRound.upsert as any).mockResolvedValue({ scopeKey: 'display:d1:el-1', round: 1 })
  ;(getUser as any).mockResolvedValue({ id: 'owner', plan: 'pro' })
})

describe('POST /api/acknowledgments/[elementId]/reset', () => {
  it('401 when signed out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(post(), ctx)
    expect(res.status).toBe(401)
    expect(db.acknowledgmentRound.upsert).not.toHaveBeenCalled()
  })

  it('403 for a non-owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'someone-else', plan: 'pro' })
    const res = await POST(post(), ctx)
    expect(res.status).toBe(403)
    expect(db.acknowledgmentRound.upsert).not.toHaveBeenCalled()
  })

  it('403 for a free owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', plan: 'free' })
    const res = await POST(post(), ctx)
    expect(res.status).toBe(403)
    expect(db.acknowledgmentRound.upsert).not.toHaveBeenCalled()
  })

  it('bumps round 0 to 1 for a Pro owner', async () => {
    const res = await POST(post(), ctx)
    expect(res.status).toBe(200)
    expect(db.acknowledgmentRound.upsert).toHaveBeenCalledWith({
      where: { scopeKey: 'display:d1:el-1' },
      create: { scopeKey: 'display:d1:el-1', round: 1 },
      update: { round: 1 },
    })
  })

  it('bumps an existing round', async () => {
    ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue({ round: 4 })
    await POST(post(), ctx)
    expect((db.acknowledgmentRound.upsert as any).mock.calls[0][0].update).toEqual({ round: 5 })
  })

  it('never deletes prior acknowledgments', async () => {
    await POST(post(), ctx)
    expect(db.acknowledgment.deleteMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec vitest run "src/app/api/acknowledgments/[elementId]/reset/route.test.ts"
```

Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Write the reset route**

Create `src/app/api/acknowledgments/[elementId]/reset/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isPro } from '@/lib/plan'
import { parseScope, scopeKeyFor } from '@/lib/acknowledgment'

interface Props {
  params: Promise<{ elementId: string }>
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { elementId } = await params
    const url = new URL(request.url)
    const scope = parseScope({
      displayId: url.searchParams.get('displayId') ?? undefined,
      hubPostId: url.searchParams.get('hubPostId') ?? undefined,
    })
    if (!scope) {
      return NextResponse.json({ error: 'Exactly one of displayId/hubPostId is required' }, { status: 400 })
    }

    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let ownerId: string | null = null
    if ('displayId' in scope) {
      const display = await db.display.findUnique({ where: { id: scope.displayId }, select: { userId: true } })
      if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      ownerId = display.userId
    } else {
      const post = await db.hubPost.findUnique({
        where: { id: scope.hubPostId },
        select: { hub: { select: { userId: true } } },
      })
      if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      ownerId = post.hub.userId
    }

    if (user.id !== ownerId || !isPro(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const scopeKey = scopeKeyFor(elementId, scope)
    const existing = await db.acknowledgmentRound.findUnique({ where: { scopeKey } })
    const next = (existing?.round ?? 0) + 1

    // Prior rounds are deliberately left in place: a reset supersedes the old
    // receipts rather than erasing them, which is what makes the record an
    // audit trail.
    await db.acknowledgmentRound.upsert({
      where: { scopeKey },
      create: { scopeKey, round: next },
      update: { round: next },
    })

    return NextResponse.json({ ok: true, round: next })
  } catch (error) {
    console.error('POST /api/acknowledgments/[elementId]/reset error:', error)
    return NextResponse.json({ error: 'Failed to reset acknowledgments' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec vitest run "src/app/api/acknowledgments/[elementId]/reset/route.test.ts"
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Write the export route**

Create `src/app/api/acknowledgments/[elementId]/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isPro } from '@/lib/plan'
import { parseScope, scopeKeyFor, buildRoster, rosterCsv } from '@/lib/acknowledgment'

interface Props {
  params: Promise<{ elementId: string }>
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { elementId } = await params
    const url = new URL(request.url)
    const scope = parseScope({
      displayId: url.searchParams.get('displayId') ?? undefined,
      hubPostId: url.searchParams.get('hubPostId') ?? undefined,
    })
    if (!scope) {
      return NextResponse.json({ error: 'Exactly one of displayId/hubPostId is required' }, { status: 400 })
    }

    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let ownerId: string | null = null
    if ('displayId' in scope) {
      const display = await db.display.findUnique({ where: { id: scope.displayId }, select: { userId: true } })
      if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      ownerId = display.userId
    } else {
      const post = await db.hubPost.findUnique({
        where: { id: scope.hubPostId },
        select: { hub: { select: { userId: true } } },
      })
      if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      ownerId = post.hub.userId
    }

    if (user.id !== ownerId || !isPro(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const scopeKey = scopeKeyFor(elementId, scope)
    const roundRow = await db.acknowledgmentRound.findUnique({ where: { scopeKey } })
    const round = roundRow?.round ?? 0

    const records = await db.acknowledgment.findMany({
      where: { scopeKey, round },
      select: {
        userId: true,
        round: true,
        createdAt: true,
        user: { select: { name: true, username: true } },
      },
    })

    return new NextResponse(rosterCsv(buildRoster(records, round)), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="acknowledgments-${elementId}.csv"`,
      },
    })
  } catch (error) {
    console.error('GET /api/acknowledgments/[elementId]/export error:', error)
    return NextResponse.json({ error: 'Failed to export acknowledgments' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Typecheck**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec tsc --noEmit
```

Expected: no output (success).

- [ ] **Step 7: Commit**

```bash
cd /c/Users/whirl/pages-mvp
git add "src/app/api/acknowledgments/[elementId]/reset" "src/app/api/acknowledgments/[elementId]/export"
git commit -m "feat(acknowledgment): Pro-gated reset and CSV export endpoints"
```

---

### Task 6: Element type and editor component

**Files:**
- Modify: `src/lib/types/canvas.ts` (`ElementType` union around line 113, `CanvasElement` fields around line 319, `createElement()` around line 918)
- Create: `src/components/elements/AcknowledgmentElement.tsx`

**Interfaces:**
- Consumes: `ACK_STATEMENT_DEFAULT`, `ACK_CONFIRM_LABEL_DEFAULT`, `ACK_BUTTON_LABEL_DEFAULT` from Task 1.
- Produces: `ElementType` member `'acknowledgment'`; `CanvasElement` optional fields `ackStatement`, `ackDescription`, `ackConfirmLabel`, `ackButtonLabel`; component `AcknowledgmentElement` with the standard editor props `{ element, onChange, onDelete, isSelected, onSelect }`.

- [ ] **Step 1: Add the type to the union**

In `src/lib/types/canvas.ts`, find the Tier 4 Social block containing `| 'poll'` and add the new member directly after it:

```typescript
  | 'poll'      // Poll with voting
  | 'acknowledgment' // Logged-in visitors confirm they have read the content
```

- [ ] **Step 2: Add the config fields**

In the same file, find the `pollShowResultsBeforeVote?: boolean` field and add these below it:

```typescript
  // Acknowledgment
  ackStatement?: string
  ackDescription?: string
  ackConfirmLabel?: string
  ackButtonLabel?: string
```

- [ ] **Step 3: Add the createElement case**

Add the import at the top of `src/lib/types/canvas.ts`:

```typescript
import { ACK_STATEMENT_DEFAULT, ACK_CONFIRM_LABEL_DEFAULT, ACK_BUTTON_LABEL_DEFAULT } from '@/lib/acknowledgment'
```

Then in `createElement()`, directly after the `case 'poll':` block, add:

```typescript
    case 'acknowledgment':
      return {
        ...base,
        ackStatement: ACK_STATEMENT_DEFAULT,
        ackDescription: '',
        ackConfirmLabel: ACK_CONFIRM_LABEL_DEFAULT,
        ackButtonLabel: ACK_BUTTON_LABEL_DEFAULT,
      }
```

- [ ] **Step 4: Write the editor component**

Create `src/components/elements/AcknowledgmentElement.tsx`:

```tsx
'use client'

import { BadgeCheck, Trash2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { ACK_CONFIRM_LABEL_DEFAULT, ACK_BUTTON_LABEL_DEFAULT } from '@/lib/acknowledgment'

interface AcknowledgmentElementProps {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function AcknowledgmentElement({
  element,
  onChange,
  onDelete,
  isSelected,
  onSelect,
}: AcknowledgmentElementProps) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border bg-white p-4 space-y-3 transition ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Acknowledgment
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-slate-400 hover:text-red-500"
          aria-label="Delete acknowledgment"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-600">What are they acknowledging?</span>
        <textarea
          value={element.ackStatement || ''}
          onChange={(e) => onChange({ ackStatement: e.target.value })}
          rows={2}
          placeholder="Please confirm you have read the information above."
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-600">Supporting text (optional)</span>
        <input
          value={element.ackDescription || ''}
          onChange={(e) => onChange({ ackDescription: e.target.value })}
          placeholder="Adds a line of context below the statement"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Confirm label</span>
          <input
            value={element.ackConfirmLabel || ''}
            onChange={(e) => onChange({ ackConfirmLabel: e.target.value })}
            placeholder={ACK_CONFIRM_LABEL_DEFAULT}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Button label</span>
          <input
            value={element.ackButtonLabel || ''}
            onChange={(e) => onChange({ ackButtonLabel: e.target.value })}
            placeholder={ACK_BUTTON_LABEL_DEFAULT}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
        </label>
      </div>

      <p className="text-xs text-slate-400">
        Visitors must be signed in to acknowledge. Only you can see who did.
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Typecheck**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec tsc --noEmit
```

Expected: no output (success).

- [ ] **Step 6: Commit**

```bash
cd /c/Users/whirl/pages-mvp
git add src/lib/types/canvas.ts src/components/elements/AcknowledgmentElement.tsx
git commit -m "feat(acknowledgment): element type, defaults and editor component"
```

---

### Task 7: Public component and canvas wiring

**Files:**
- Create: `src/components/elements/PublicAcknowledgmentElement.tsx`
- Modify: `src/components/elements/index.ts`
- Modify: `src/components/canvas/SlashCommandMenu.tsx` (Social category, near line 113)
- Modify: `src/components/canvas/ColumnCanvas.tsx` (`renderElement`, near line 787)
- Modify: `src/lib/render-elements.tsx` (import near line 9, case near line 433)

**Interfaces:**
- Consumes: `ACK_CONFIRM_LABEL_DEFAULT`, `ACK_BUTTON_LABEL_DEFAULT`, `ACK_STATEMENT_DEFAULT` and the `AckStatus` type from Task 1; `GET`/`POST /api/acknowledgments` from Tasks 3–4.
- Produces: `PublicAcknowledgmentElement` with props `{ element: CanvasElement; displayId: string }`, matching how `PublicPollElement` is invoked.

- [ ] **Step 1: Write the public component**

Create `src/components/elements/PublicAcknowledgmentElement.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { BadgeCheck, Check, AlertCircle } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import {
  ACK_STATEMENT_DEFAULT,
  ACK_CONFIRM_LABEL_DEFAULT,
  ACK_BUTTON_LABEL_DEFAULT,
  type AckStatus,
} from '@/lib/acknowledgment'

interface PublicAcknowledgmentElementProps {
  element: CanvasElement
  displayId: string
}

export function PublicAcknowledgmentElement({ element, displayId }: PublicAcknowledgmentElementProps) {
  const [status, setStatus] = useState<AckStatus>('none')
  const [count, setCount] = useState(0)
  const [isOwner, setIsOwner] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null)

  const statement = element.ackStatement || ACK_STATEMENT_DEFAULT
  const confirmLabel = element.ackConfirmLabel || ACK_CONFIRM_LABEL_DEFAULT
  const buttonLabel = element.ackButtonLabel || ACK_BUTTON_LABEL_DEFAULT

  const load = useCallback(async () => {
    if (!displayId) return
    try {
      const res = await fetch(`/api/acknowledgments/${element.id}?displayId=${displayId}`)
      if (!res.ok) return
      const data = await res.json()
      setStatus(data.mine as AckStatus)
      setCount(data.count)
      setIsOwner(!!data.isOwner)
    } catch {
      // Leave the element in its default state if the fetch fails.
    }
  }, [displayId, element.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => setSignedIn(r.ok))
      .catch(() => setSignedIn(false))
  }, [])

  const submit = async () => {
    if (!checked || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/acknowledgments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementId: element.id, displayId }),
      })
      if (res.ok) {
        setAcknowledgedAt(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }))
        setChecked(false)
        await load()
      }
    } catch {
      // Silently fail — the visitor can retry.
    } finally {
      setSubmitting(false)
    }
  }

  const acknowledged = status === 'current'
  const stale = status === 'stale'

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-2">
        <BadgeCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-slate-900">{statement}</p>
          {element.ackDescription && (
            <p className="text-xs text-slate-500 mt-1">{element.ackDescription}</p>
          )}
        </div>
      </div>

      <div className="p-5">
        {acknowledged ? (
          <div className="flex items-center gap-2 text-sm font-medium text-green-600">
            <Check className="w-4 h-4" />
            {acknowledgedAt ? `You acknowledged this on ${acknowledgedAt}` : 'You acknowledged this'}
          </div>
        ) : signedIn === false ? (
          <a
            href={`/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/' : window.location.pathname)}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Sign in to acknowledge
          </a>
        ) : (
          <div className="space-y-3">
            {stale && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                This was updated &mdash; please acknowledge again.
              </div>
            )}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-700">{confirmLabel}</span>
            </label>
            <button
              onClick={submit}
              disabled={!checked || submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Recording…' : buttonLabel}
            </button>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
          {count} {count === 1 ? 'person has' : 'people have'} acknowledged &middot;{' '}
          <span className="text-slate-400">View the roster in your Data tab</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Export both components**

Append to `src/components/elements/index.ts`:

```typescript
export { AcknowledgmentElement } from './AcknowledgmentElement'
export { PublicAcknowledgmentElement } from './PublicAcknowledgmentElement'
```

- [ ] **Step 3: Add the slash menu entry**

In `src/components/canvas/SlashCommandMenu.tsx`, add `BadgeCheck` to the existing `lucide-react` import, then add this line immediately after the `poll` entry in the Social block:

```typescript
  { id: 'acknowledgment', label: 'Acknowledgment', icon: BadgeCheck, description: 'Ask readers to confirm they have read this', category: 'Social' },
```

`'Social'` is already in `CATEGORY_ORDER` at line 171, so no change is needed there.

- [ ] **Step 4: Add the ColumnCanvas case**

In `src/components/canvas/ColumnCanvas.tsx`, add both components to the existing import from `@/components/elements`, then add this case immediately after the `case 'poll':` block:

```tsx
      case 'acknowledgment':
        if (isPreviewMode && displayId) {
          return <PublicAcknowledgmentElement element={element} displayId={displayId} />
        }
        return (
          <AcknowledgmentElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

- [ ] **Step 5: Add the public renderer case**

In `src/lib/render-elements.tsx`, add the import next to the `PublicPollElement` import:

```typescript
import { PublicAcknowledgmentElement } from '@/components/elements/PublicAcknowledgmentElement'
```

Then add this case immediately after `case 'poll':`:

```tsx
    case 'acknowledgment':
      return <PublicAcknowledgmentElement element={element} displayId={displayId || ''} />
```

- [ ] **Step 6: Typecheck and lint**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec tsc --noEmit && pnpm exec next lint
```

Expected: no type errors; lint reports no errors for the new files. `tsc` alone will not catch the lint rules that have broken production deploys, so both must run.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/whirl/pages-mvp
git add src/components/elements/PublicAcknowledgmentElement.tsx src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx
git commit -m "feat(acknowledgment): public element and canvas wiring"
```

---

### Task 8: Data tab reporting card

The analytics route only announces that an acknowledgment element exists; the card fetches its own counts and roster from `/api/acknowledgments/[elementId]`, so the Pro gate lives in exactly one place.

**Files:**
- Modify: `src/app/api/analytics/[displayId]/elements/route.ts`
- Create: `src/components/analytics/element-cards/AcknowledgmentCard.tsx`
- Modify: `src/components/analytics/element-cards/index.ts`
- Modify: `src/components/analytics/ElementsTab.tsx`
- Test: `src/app/api/analytics/[displayId]/elements/acknowledgment.test.ts`

**Interfaces:**
- Consumes: `collectElements` from `src/lib/waitlist.ts`; the `GET`, reset and export endpoints from Tasks 4–5.
- Produces: analytics card payload `{ elementId: string, type: 'acknowledgment', statement: string, tabLabel?: string }`; component `AcknowledgmentCard` with props `{ data: AcknowledgmentCardData; displayId: string }`.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/analytics/[displayId]/elements/acknowledgment.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    formResponse: { findMany: vi.fn() },
    comment: { findMany: vi.fn() },
    waitlistSignup: { findMany: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from './route'

const ctx = { params: Promise.resolve({ displayId: 'd1' }) }
const req = () => new Request('http://localhost/api/analytics/d1/elements') as any

const sections = [
  {
    columns: [
      {
        elements: [
          { id: 'el-ack', type: 'acknowledgment', ackStatement: 'Read the team rules' },
        ],
      },
    ],
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue({
    id: 'd1',
    userId: 'owner',
    title: 'Team page',
    sections,
    tabs: null,
  })
  ;(db.formResponse.findMany as any).mockResolvedValue([])
  ;(db.comment.findMany as any).mockResolvedValue([])
  ;(db.waitlistSignup.findMany as any).mockResolvedValue([])
})

describe('GET /api/analytics/[displayId]/elements with an acknowledgment', () => {
  it('emits a discovery card carrying the statement', async () => {
    const body = await (await GET(req(), ctx)).json()
    const card = body.elements.find((e: any) => e.type === 'acknowledgment')
    expect(card).toEqual({ elementId: 'el-ack', type: 'acknowledgment', statement: 'Read the team rules', tabLabel: undefined })
  })

  it('does not aggregate acknowledgments through the form response path', async () => {
    await GET(req(), ctx)
    // The card is discovery-only; if this route ever starts aggregating
    // acknowledgments it would need form responses keyed by the element.
    const card = (await (await GET(req(), ctx)).json()).elements.find((e: any) => e.type === 'acknowledgment')
    expect(card.count).toBeUndefined()
    expect(card.roster).toBeUndefined()
  })

  it('403 for a non-owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'someone-else' })
    const res = await GET(req(), ctx)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec vitest run "src/app/api/analytics/[displayId]/elements/acknowledgment.test.ts"
```

Expected: FAIL — the first test finds no acknowledgment card (`card` is `undefined`).

- [ ] **Step 3: Emit the discovery card from the analytics route**

In `src/app/api/analytics/[displayId]/elements/route.ts`, immediately after the `waitlistCards` block that ends around line 109, insert:

```typescript
    // Acknowledgment elements are discovery-only here: the card fetches its own
    // counts and roster from /api/acknowledgments so the Pro gate lives in one
    // place rather than being duplicated in this route.
    const ackCards = [
      ...collectElements(mainSections).map((el) => ({ el, tabLabel: undefined as string | undefined })),
      ...((tabsConfig?.tabs || []).flatMap((t) =>
        collectElements(t.sections).map((el) => ({ el, tabLabel: t.label as string | undefined }))
      )),
    ]
      .filter(({ el }) => el.type === 'acknowledgment')
      .map(({ el, tabLabel }) => ({
        elementId: String(el.id),
        type: 'acknowledgment' as const,
        statement: (el.ackStatement as string) || 'Acknowledgment',
        tabLabel,
      }))
```

Then include them in both return statements. Change the early return at line 112 to:

```typescript
      return NextResponse.json({ display: { id: display.id, title: display.title }, elements: [...waitlistCards, ...ackCards] })
```

and the final return at line 142 to:

```typescript
    return NextResponse.json({
      display: { id: display.id, title: display.title },
      elements: [...elements, ...waitlistCards, ...ackCards],
    })
```

Do not add `'acknowledgment'` to `INTERACTIVE_TYPES` — that constant drives the `formResponse` aggregation path, which acknowledgments do not use.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec vitest run "src/app/api/analytics/[displayId]/elements/acknowledgment.test.ts"
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Write the card component**

Create `src/components/analytics/element-cards/AcknowledgmentCard.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { BadgeCheck, Download, RotateCcw, Lock } from 'lucide-react'

export interface AcknowledgmentCardData {
  elementId: string
  type: 'acknowledgment'
  statement: string
  tabLabel?: string
}

interface RosterEntry {
  userId: string
  name: string
  username: string
  acknowledgedAt: string
}

export function AcknowledgmentCard({ data, displayId }: { data: AcknowledgmentCardData; displayId: string }) {
  const [count, setCount] = useState(0)
  const [round, setRound] = useState(0)
  const [canSeeRoster, setCanSeeRoster] = useState(false)
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [progress, setProgress] = useState<{ current: number; previous: number }>({ current: 0, previous: 0 })
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/acknowledgments/${data.elementId}?displayId=${displayId}`)
      if (!res.ok) return
      const body = await res.json()
      setCount(body.count)
      setRound(body.round)
      setCanSeeRoster(!!body.canSeeRoster)
      setRoster(body.roster || [])
      setProgress(body.progress || { current: 0, previous: 0 })
    } catch {
      // Leave the card empty if the fetch fails.
    }
  }, [data.elementId, displayId])

  useEffect(() => {
    void load()
  }, [load])

  const requestReAck = async () => {
    if (resetting) return
    setResetting(true)
    try {
      const res = await fetch(`/api/acknowledgments/${data.elementId}/reset?displayId=${displayId}`, { method: 'POST' })
      if (res.ok) await load()
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="bg-background border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-primary" />
            {data.statement}
          </h3>
          {data.tabLabel && <span className="text-xs text-muted-foreground">Tab: {data.tabLabel}</span>}
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full whitespace-nowrap">
          {count} acknowledged
        </span>
      </div>

      {round > 0 && (
        <p className="text-xs text-muted-foreground">
          Re-acknowledgment requested &middot; {progress.current} of {progress.previous} have acknowledged again
        </p>
      )}

      {canSeeRoster ? (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={requestReAck}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {resetting ? 'Requesting…' : 'Request re-acknowledgment'}
            </button>
            <a
              href={`/api/acknowledgments/${data.elementId}/export?displayId=${displayId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
          </div>

          {roster.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Acknowledged</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r.userId} className="border-t border-border">
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(r.acknowledgedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No one has acknowledged this yet.</p>
          )}
        </>
      ) : (
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
          <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Upgrade to Pro to see exactly who acknowledged, export the list, and request
            re-acknowledgment when the content changes.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Register the card**

Append to `src/components/analytics/element-cards/index.ts`:

```typescript
export { AcknowledgmentCard } from './AcknowledgmentCard'
```

In `src/components/analytics/ElementsTab.tsx`, add `AcknowledgmentCard` to the existing import from `'./element-cards'`, then add this case to the switch immediately before `default:`:

```tsx
          case 'acknowledgment':
            return <AcknowledgmentCard key={element.elementId} data={element} displayId={displayId} />
```

- [ ] **Step 7: Typecheck, lint and run the full suite**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec tsc --noEmit && pnpm exec next lint && pnpm exec vitest run src/lib/acknowledgment.test.ts src/app/api/acknowledgments "src/app/api/analytics/[displayId]/elements"
```

Expected: no type errors, no lint errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/whirl/pages-mvp
git add "src/app/api/analytics/[displayId]/elements/route.ts" "src/app/api/analytics/[displayId]/elements/acknowledgment.test.ts" src/components/analytics/element-cards/AcknowledgmentCard.tsx src/components/analytics/element-cards/index.ts src/components/analytics/ElementsTab.tsx
git commit -m "feat(acknowledgment): Data tab card with Pro roster, export and reset"
```

---

### Task 9: Hub post surface

Makes the acknowledgment available as a block inside a community post, reusing the existing `BulletinPostCard` block plumbing.

**Files:**
- Modify: `src/lib/bulletin.ts:6`
- Modify: `src/components/bulletin/BlockEditor.tsx`
- Modify: `src/components/bulletin/BulletinBlock.tsx`
- Create: `src/components/bulletin/blocks/BulletinAcknowledgment.tsx`

**Interfaces:**
- Consumes: `BulletinBlockProps` from `src/components/bulletin/BulletinBlock.tsx`; `POST /api/acknowledgments` and `GET /api/acknowledgments/[elementId]` from Tasks 3–4.
- Produces: `'acknowledgment'` as a member of `BULLETIN_BLOCK_TYPES`; component `BulletinAcknowledgment`.

Note: unlike the poll, rating and short-answer blocks, this block does **not** post to `${basePath}/${postId}/respond`. It calls `/api/acknowledgments` with `hubPostId`, because acknowledgments need their own identity and round semantics. `basePath` is therefore unused by this block; `postId` supplies the scope.

- [ ] **Step 1: Add the block type**

In `src/lib/bulletin.ts` line 6, extend the tuple:

```typescript
export const BULLETIN_BLOCK_TYPES = ['poll', 'rating', 'shortanswer', 'acknowledgment'] as const
```

- [ ] **Step 2: Teach makeBlock and BlockEditor about it**

In `src/components/bulletin/BlockEditor.tsx`, add the import:

```typescript
import { ACK_STATEMENT_DEFAULT, ACK_CONFIRM_LABEL_DEFAULT, ACK_BUTTON_LABEL_DEFAULT } from '@/lib/acknowledgment'
```

Then in `makeBlock`, add this line directly after the `rating` line and before the trailing `return`:

```typescript
  if (type === 'acknowledgment') return { id, type, ackStatement: ACK_STATEMENT_DEFAULT, ackConfirmLabel: ACK_CONFIRM_LABEL_DEFAULT, ackButtonLabel: ACK_BUTTON_LABEL_DEFAULT }
```

And add this editor field after the `shortanswer` block:

```tsx
      {block.type === 'acknowledgment' && (
        <input value={block.ackStatement || ''} onChange={(e) => set({ ackStatement: e.target.value })} placeholder="What are they acknowledging?" className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary/50" />
      )}
```

- [ ] **Step 3: Write the block component**

Create `src/components/bulletin/blocks/BulletinAcknowledgment.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { BadgeCheck, Check } from 'lucide-react'
import type { BulletinBlockProps } from '../BulletinBlock'
import {
  ACK_STATEMENT_DEFAULT,
  ACK_CONFIRM_LABEL_DEFAULT,
  ACK_BUTTON_LABEL_DEFAULT,
  type AckStatus,
} from '@/lib/acknowledgment'

export function BulletinAcknowledgment({ postId, block }: BulletinBlockProps) {
  const [status, setStatus] = useState<AckStatus>('none')
  const [count, setCount] = useState(0)
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const statement = block.ackStatement || ACK_STATEMENT_DEFAULT
  const confirmLabel = block.ackConfirmLabel || ACK_CONFIRM_LABEL_DEFAULT
  const buttonLabel = block.ackButtonLabel || ACK_BUTTON_LABEL_DEFAULT

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/acknowledgments/${block.id}?hubPostId=${postId}`)
      if (!res.ok) return
      const data = await res.json()
      setStatus(data.mine as AckStatus)
      setCount(data.count)
    } catch {
      // Leave the block in its default state if the fetch fails.
    }
  }, [block.id, postId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    if (!checked || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/acknowledgments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementId: block.id, hubPostId: postId }),
      })
      if (res.ok) {
        setChecked(false)
        await load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2.5">
      <p className="text-sm font-medium text-foreground flex items-start gap-2">
        <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        {statement}
      </p>

      {status === 'current' ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
          <Check className="w-3.5 h-3.5" /> You acknowledged this
        </span>
      ) : (
        <div className="space-y-2">
          {status === 'stale' && (
            <p className="text-xs text-amber-700">This was updated &mdash; please acknowledge again.</p>
          )}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">{confirmLabel}</span>
          </label>
          <button
            onClick={submit}
            disabled={!checked || submitting}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Recording…' : buttonLabel}
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{count} acknowledged</p>
    </div>
  )
}
```

- [ ] **Step 4: Register the block in the switch**

In `src/components/bulletin/BulletinBlock.tsx`, add the import and the case:

```tsx
import { BulletinAcknowledgment } from './blocks/BulletinAcknowledgment'
```

```tsx
    case 'acknowledgment':
      return <BulletinAcknowledgment {...props} />
```

- [ ] **Step 5: Typecheck and lint**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec tsc --noEmit && pnpm exec next lint
```

Expected: no type errors, no lint errors.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/whirl/pages-mvp
git add src/lib/bulletin.ts src/components/bulletin/BlockEditor.tsx src/components/bulletin/BulletinBlock.tsx src/components/bulletin/blocks/BulletinAcknowledgment.tsx
git commit -m "feat(acknowledgment): acknowledgment block for hub and bulletin posts"
```

---

### Task 10: Full verification

No new code — this task proves the feature works before anyone claims it does.

**Files:** none created or modified (unless a check fails).

- [ ] **Step 1: Run the full test suite**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec vitest run
```

Expected: all files pass. If the run reports "errors" or a stray `1 failed` where passed + errors equals the total file count, those are worker-spawn timeouts under machine load, not real failures — re-run the specific files that were skipped to confirm.

- [ ] **Step 2: Typecheck and lint**

```bash
cd /c/Users/whirl/pages-mvp && pnpm exec tsc --noEmit && pnpm exec next lint
```

Expected: clean. Lint must pass independently — `tsc` does not run ESLint, and lint failures have shipped a red production deploy before.

- [ ] **Step 3: Production build**

```bash
cd /c/Users/whirl/pages-mvp && pnpm build
```

Expected: `Compiled successfully`. Stop any running `pnpm dev` first — on Windows the two race on `.next` and produce phantom errors. This step is what catches a `route.ts` exporting something other than a handler.

- [ ] **Step 4: Manual smoke test**

Start the dev server with the correct database:

```bash
cd /c/Users/whirl/pages-mvp && DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm dev
```

Then verify, in order:

1. Add an Acknowledgment element to a page from the slash menu under **Social**; set a statement; publish the page.
2. Open the published page while signed out — the element shows "Sign in to acknowledge".
3. Sign in as a different account, tick the checkbox, press Acknowledge — the element switches to the green confirmed state and survives a page reload.
4. As the page owner, open the Data tab — the card shows a count of 1. On a free account the roster is replaced by the Pro upsell.
5. Set that owner's `plan` to `'pro'` in the database, reload — the named roster and both buttons appear.
6. Press **Request re-acknowledgment** — the acknowledging account now sees the amber "please acknowledge again" prompt, and the earlier record is still in the `Acknowledgment` table.
7. Press **Export CSV** — the file downloads with a header row and one row per acknowledger.

- [ ] **Step 5: Commit any fixes**

If any step above required a fix, commit it with a message describing what the verification caught. If everything passed, there is nothing to commit — do not create an empty commit.

---

## Self-Review Notes

- **Spec coverage:** data model → Task 2; element and seven seams → Tasks 6–7; four API routes → Tasks 3–5; Data tab card with free/Pro split → Task 8; hub post surface → Task 9; pure-logic TDD and API integration tests → Tasks 1, 3, 4, 5, 8; verification → Task 10.
- **Deviation from the spec as written:** the spec's `scopeKey` design was added during planning after `makeBlock()`'s deterministic block ids were found; the spec was updated to match before this plan was written.
- **Naming consistency:** `scopeKeyFor` (not `scopeKey`, which is the column name), `ackStatus`, `buildRoster`, `reAckProgress`, `rosterCsv`, `parseScope` are used identically in Tasks 1, 3, 4, 5. Element config fields are `ackStatement`, `ackDescription`, `ackConfirmLabel`, `ackButtonLabel` throughout.
- **Out of scope, per the spec:** hub file/item attachment, roster denominators, per-acknowledgment notifications, content snapshots, public acknowledger lists.

# Bulletin Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a follower-scoped "Bulletin" board to the dashboard right column where users post short, likeable posts holding a trackable block (poll / rating / short-answer), with responses tied to the responding follower's identity so the author sees *who* answered in their analytics.

**Architecture:** Bulletin posts are a new lightweight model (not Displays). Their interactive blocks reuse the existing `CanvasElement` config shapes, and the response aggregation logic is extracted into a shared pure module (`element-aggregate.ts`) reused by both the existing page analytics and the new bulletin analytics. Responses are stored **identified** (`userId`), which powers a respondent roster no anonymous page can produce. All reading/writing is gated to the follow graph.

**Tech Stack:** Next.js App Router (route handlers), Prisma + Neon Postgres, React client components, Tailwind (semantic tokens), Vitest + Testing Library (jsdom).

## Global Constraints

- **Test command:** `pnpm test` (runs `vitest run`); single file: `pnpm test <path>`. Tests are colocated `*.test.{ts,tsx}` under `src/`.
- **Auth:** every route handler calls `getUser(request)` from `@/lib/auth`; unauthenticated → `401`.
- **Migrations are non-interactive here.** Never run `prisma migrate dev`. Generate SQL via `prisma migrate diff`, write it to a new migration folder, then `prisma migrate deploy`. `DATABASE_URL` comes from `.env` (Postgres on port 5434). See Task 2.
- **Follow-graph scope:** a user may read/like/respond to posts authored by users they follow, plus their own. Out of scope → `403`.
- **Block types (v1):** `poll`, `rating`, `shortanswer` only. No MCQ. At most one block per post.
- **Theme tokens:** bulletin UI uses semantic classes (`surface`, `border`, `foreground`, `muted-foreground`, `primary`, `primary-foreground`) — never hardcoded `bg-white`/`text-slate-*`.
- **Desktop-only v1:** the panel is already `hidden xl:block`; no mobile bulletin surface.
- **Windows/dev-server note:** do not run `pnpm build` while `pnpm dev` is running (races `.next`). Use `pnpm test` + `pnpm tsc --noEmit` for verification.

---

### Task 1: Shared element aggregators (`element-aggregate.ts`)

Extract the poll/rating/short-answer aggregation into a shared, pure, identity-aware module, and refactor the existing page analytics route to use it (no behavior change; new `respondents` field is additive and ignored by page cards).

**Files:**
- Create: `src/lib/element-aggregate.ts`
- Create: `src/lib/element-aggregate.test.ts`
- Modify: `src/app/api/analytics/[displayId]/elements/route.ts` (replace the bodies of `aggregatePoll`, `aggregateRating`, `aggregateShortAnswer` with calls to the shared functions; keep `tabLabel` handling)

**Interfaces:**
- Produces:
  - `interface Respondent { userId: string; name: string; avatar?: string | null }`
  - `interface RespondentAnswer { user: Respondent; answer: unknown }`
  - `interface ResponseRecord { responses: unknown; submittedAt?: Date | string | null; identity?: Respondent }`
  - `aggregatePoll(config: CanvasElement, records: ResponseRecord[]): PollAggregate`
  - `aggregateRating(config: CanvasElement, records: ResponseRecord[]): RatingAggregate`
  - `aggregateShortAnswer(config: CanvasElement, records: ResponseRecord[]): ShortAnswerAggregate`
  - `aggregateBlock(config: CanvasElement, records: ResponseRecord[]): ElementAggregate | null`
  - `type ElementAggregate = PollAggregate | RatingAggregate | ShortAnswerAggregate`

- [ ] **Step 1: Write the failing test**

Create `src/lib/element-aggregate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { aggregatePoll, aggregateRating, aggregateShortAnswer, type ResponseRecord } from './element-aggregate'
import type { CanvasElement } from '@/lib/types/canvas'

const poll: CanvasElement = { id: 'b1', type: 'poll', pollQuestion: 'Pick', pollOptions: ['A', 'B'], pollAllowMultiple: false }
const rating: CanvasElement = { id: 'b2', type: 'rating', ratingQuestion: 'Rate', ratingMax: 5, ratingStyle: 'stars' }
const sa: CanvasElement = { id: 'b3', type: 'shortanswer', shortAnswerQuestion: 'Say' }

const who = (userId: string, name: string) => ({ userId, name, avatar: null })

describe('aggregatePoll', () => {
  it('counts selections, computes percentages, and builds an identified roster', () => {
    const records: ResponseRecord[] = [
      { responses: { b1: { type: 'poll', answer: ['A'] } }, identity: who('u1', 'Maya') },
      { responses: { b1: { type: 'poll', answer: ['B'] } }, identity: who('u2', 'Jon') },
      { responses: { b1: { type: 'poll', answer: ['A'] } }, identity: who('u3', 'Al') },
      { responses: { 'other': { type: 'poll', answer: ['A'] } }, identity: who('u4', 'X') }, // other element - ignored
    ]
    const out = aggregatePoll(poll, records)
    expect(out.totalVoters).toBe(3)
    expect(out.distribution).toEqual([
      { option: 'A', count: 2, percentage: 67 },
      { option: 'B', count: 1, percentage: 33 },
    ])
    expect(out.respondents.map((r) => r.user.name)).toEqual(['Maya', 'Jon', 'Al'])
    expect(out.respondents[0].answer).toEqual(['A'])
  })

  it('leaves the roster empty when responses are anonymous (page path)', () => {
    const out = aggregatePoll(poll, [{ responses: { b1: { type: 'poll', answer: ['A'] } } }])
    expect(out.totalVoters).toBe(1)
    expect(out.respondents).toEqual([])
  })
})

describe('aggregateRating', () => {
  it('averages valid ratings and rosters who gave what', () => {
    const records: ResponseRecord[] = [
      { responses: { b2: { type: 'rating', answer: 4 } }, identity: who('u1', 'Maya') },
      { responses: { b2: { type: 'rating', answer: 2 } }, identity: who('u2', 'Jon') },
      { responses: { b2: { type: 'rating', answer: 99 } }, identity: who('u3', 'Bad') }, // out of range - ignored
    ]
    const out = aggregateRating(rating, records)
    expect(out.responseCount).toBe(2)
    expect(out.average).toBe(3)
    expect(out.respondents.map((r) => [r.user.name, r.answer])).toEqual([['Maya', 4], ['Jon', 2]])
  })
})

describe('aggregateShortAnswer', () => {
  it('collects non-empty answers with an identified roster', () => {
    const records: ResponseRecord[] = [
      { responses: { b3: { type: 'shortanswer', answer: 'Hello' } }, submittedAt: new Date('2026-07-03T00:00:00Z'), identity: who('u1', 'Maya') },
      { responses: { b3: { type: 'shortanswer', answer: '' } }, identity: who('u2', 'Empty') }, // blank - ignored
    ]
    const out = aggregateShortAnswer(sa, records)
    expect(out.responseCount).toBe(1)
    expect(out.recentAnswers[0].answer).toBe('Hello')
    expect(out.respondents.map((r) => r.user.name)).toEqual(['Maya'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/element-aggregate.test.ts`
Expected: FAIL — cannot find module `./element-aggregate`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/element-aggregate.ts`:

```ts
// Shared, pure element-response aggregators. Used by both the page analytics
// route (anonymous FormResponse rows) and the bulletin surface (identified
// BulletinResponse rows). No IO — unit-testable. When a record carries an
// `identity`, it is added to the aggregate's `respondents` roster.
import type { CanvasElement } from '@/lib/types/canvas'

export interface Respondent {
  userId: string
  name: string
  avatar?: string | null
}

export interface RespondentAnswer {
  user: Respondent
  answer: unknown
}

export interface ResponseRecord {
  responses: unknown // { [elementId]: { type, question?, answer } }
  submittedAt?: Date | string | null
  identity?: Respondent
}

export interface PollAggregate {
  elementId: string
  type: 'poll'
  question: string
  options: string[]
  allowMultiple: boolean
  totalVoters: number
  distribution: { option: string; count: number; percentage: number }[]
  respondents: RespondentAnswer[]
}

export interface RatingAggregate {
  elementId: string
  type: 'rating'
  question: string
  ratingMax: number
  ratingStyle: 'stars' | 'numeric'
  responseCount: number
  average: number
  distribution: { value: number; count: number }[]
  respondents: RespondentAnswer[]
}

export interface ShortAnswerAggregate {
  elementId: string
  type: 'shortanswer'
  question: string
  responseCount: number
  recentAnswers: { answer: string; submittedAt: string }[]
  respondents: RespondentAnswer[]
}

export type ElementAggregate = PollAggregate | RatingAggregate | ShortAnswerAggregate

function entryFor(record: ResponseRecord, elementId: string): { type?: string; answer?: unknown } | null {
  const data = record.responses as Record<string, { type?: string; answer?: unknown }> | null
  return data?.[elementId] ?? null
}

function toIso(v: Date | string | null | undefined): string {
  if (v instanceof Date) return v.toISOString()
  return (v as string) || ''
}

export function aggregatePoll(config: CanvasElement, records: ResponseRecord[]): PollAggregate {
  const options = config.pollOptions || []
  const distribution: Record<string, number> = {}
  for (const o of options) distribution[o] = 0
  const respondents: RespondentAnswer[] = []
  let totalVoters = 0

  for (const rec of records) {
    const entry = entryFor(rec, config.id)
    if (!entry || entry.type !== 'poll') continue
    totalVoters++
    const selections = Array.isArray(entry.answer) ? (entry.answer as string[]) : [entry.answer as string]
    for (const s of selections) distribution[s] = (distribution[s] || 0) + 1
    if (rec.identity) respondents.push({ user: rec.identity, answer: selections })
  }

  return {
    elementId: config.id,
    type: 'poll',
    question: config.pollQuestion || 'What do you think?',
    options,
    allowMultiple: config.pollAllowMultiple || false,
    totalVoters,
    distribution: Object.entries(distribution).map(([option, count]) => ({
      option,
      count,
      percentage: totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0,
    })),
    respondents,
  }
}

export function aggregateRating(config: CanvasElement, records: ResponseRecord[]): RatingAggregate {
  const max = config.ratingMax || 5
  const distribution: Record<number, number> = {}
  for (let i = 1; i <= max; i++) distribution[i] = 0
  const respondents: RespondentAnswer[] = []
  let responseCount = 0
  let sum = 0

  for (const rec of records) {
    const entry = entryFor(rec, config.id)
    if (!entry || entry.type !== 'rating') continue
    const value = Number(entry.answer)
    if (!(value >= 1 && value <= max)) continue
    responseCount++
    sum += value
    distribution[value]++
    if (rec.identity) respondents.push({ user: rec.identity, answer: value })
  }

  return {
    elementId: config.id,
    type: 'rating',
    question: config.ratingQuestion || 'Untitled Rating',
    ratingMax: max,
    ratingStyle: config.ratingStyle || 'stars',
    responseCount,
    average: responseCount > 0 ? Math.round((sum / responseCount) * 10) / 10 : 0,
    distribution: Object.entries(distribution)
      .map(([value, count]) => ({ value: Number(value), count }))
      .sort((a, b) => b.value - a.value),
    respondents,
  }
}

export function aggregateShortAnswer(config: CanvasElement, records: ResponseRecord[]): ShortAnswerAggregate {
  const recentAnswers: { answer: string; submittedAt: string }[] = []
  const respondents: RespondentAnswer[] = []

  for (const rec of records) {
    const entry = entryFor(rec, config.id)
    if (!entry || entry.type !== 'shortanswer' || !entry.answer) continue
    const answer = String(entry.answer)
    recentAnswers.push({ answer, submittedAt: toIso(rec.submittedAt) })
    if (rec.identity) respondents.push({ user: rec.identity, answer })
  }

  return {
    elementId: config.id,
    type: 'shortanswer',
    question: config.shortAnswerQuestion || 'Untitled Question',
    responseCount: recentAnswers.length,
    recentAnswers: recentAnswers.slice(0, 50),
    respondents,
  }
}

export function aggregateBlock(config: CanvasElement, records: ResponseRecord[]): ElementAggregate | null {
  switch (config.type) {
    case 'poll':
      return aggregatePoll(config, records)
    case 'rating':
      return aggregateRating(config, records)
    case 'shortanswer':
      return aggregateShortAnswer(config, records)
    default:
      return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/element-aggregate.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Refactor the page route to use the shared functions**

In `src/app/api/analytics/[displayId]/elements/route.ts`:

1. Add the import at the top (after the existing imports):

```ts
import { aggregatePoll as sharedPoll, aggregateRating as sharedRating, aggregateShortAnswer as sharedShortAnswer, type ResponseRecord } from '@/lib/element-aggregate'
```

2. Replace the three functions `aggregateMCQ`-neighbors — specifically the **bodies** of `aggregatePoll`, `aggregateRating`, and `aggregateShortAnswer` — with wrappers that map `FormResponse` rows to anonymous `ResponseRecord`s, call the shared function, and re-attach `tabLabel`. Replace the existing `function aggregatePoll(...) { ... }` with:

```ts
function aggregatePoll(el: InteractiveElement, responses: any[]) {
  const records: ResponseRecord[] = responses.map((r) => ({ responses: r.responses, submittedAt: r.submittedAt }))
  return { ...sharedPoll(el.config as any, records), tabLabel: el.tabLabel }
}
```

Replace the existing `function aggregateRating(...)` with:

```ts
function aggregateRating(el: InteractiveElement, responses: any[]) {
  const records: ResponseRecord[] = responses.map((r) => ({ responses: r.responses, submittedAt: r.submittedAt }))
  return { ...sharedRating(el.config as any, records), tabLabel: el.tabLabel }
}
```

Replace the existing `function aggregateShortAnswer(...)` with:

```ts
function aggregateShortAnswer(el: InteractiveElement, responses: any[]) {
  const records: ResponseRecord[] = responses.map((r) => ({ responses: r.responses, submittedAt: r.submittedAt }))
  return { ...sharedShortAnswer(el.config as any, records), tabLabel: el.tabLabel }
}
```

Note: `el.config` carries `id` (the element id) plus the type-specific fields the shared functions read. Leave `aggregateMCQ`, `aggregatePoll`'s neighbors `aggregateComments`, `aggregateWeddingRsvp`, `aggregateBusinessReview`, `aggregateRSVP` untouched.

- [ ] **Step 6: Verify types and full suite**

Run: `pnpm tsc --noEmit`
Expected: no errors.
Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/element-aggregate.ts src/lib/element-aggregate.test.ts "src/app/api/analytics/[displayId]/elements/route.ts"
git commit -m "feat(analytics): extract shared identity-aware element aggregators"
```

---

### Task 2: Prisma models + migration

**Files:**
- Modify: `prisma/schema.prisma` (add 3 models + 3 `User` back-relations)
- Create: `prisma/migrations/<timestamp>_add_bulletin/migration.sql`

**Interfaces:**
- Produces: Prisma models `BulletinPost`, `BulletinLike`, `BulletinResponse` and generated client types.

- [ ] **Step 1: Add the models to the schema**

In `prisma/schema.prisma`, inside `model User { ... }` add these three relation fields (next to the existing `displays Display[]`):

```prisma
  bulletinPosts     BulletinPost[]     @relation("BulletinAuthor")
  bulletinLikes     BulletinLike[]
  bulletinResponses BulletinResponse[]
```

Then append these models at the end of the file:

```prisma
model BulletinPost {
  id        String   @id @default(cuid())
  authorId  String
  author    User     @relation("BulletinAuthor", fields: [authorId], references: [id], onDelete: Cascade)

  text     String?
  imageUrl String?

  // Zero or one CanvasElement-shaped block config (v1 UI allows at most one).
  blocks   Json     @default("[]")
  // { revealAfterAnswer: boolean, liveTally: boolean }
  settings Json     @default("{}")

  createdAt DateTime @default(now())

  likes     BulletinLike[]
  responses BulletinResponse[]

  @@index([authorId])
  @@index([createdAt])
}

model BulletinLike {
  id        String       @id @default(cuid())
  postId    String
  post      BulletinPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime     @default(now())

  @@unique([postId, userId])
  @@index([postId])
}

model BulletinResponse {
  id        String       @id @default(cuid())
  postId    String
  post      BulletinPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Same shape as FormResponse.responses: { [elementId]: { type, question, answer } }
  responses Json

  createdAt DateTime @default(now())

  @@unique([postId, userId])
  @@index([postId])
}
```

- [ ] **Step 2: Validate the schema**

Run: `pnpm prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀".

- [ ] **Step 3: Generate the migration SQL**

Load `DATABASE_URL` from `.env` and diff into a new migration folder. Run (Git Bash):

```bash
export DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_add_bulletin"
pnpm prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "prisma/migrations/${TS}_add_bulletin/migration.sql"
cat "prisma/migrations/${TS}_add_bulletin/migration.sql"
```

Expected: the printed SQL contains `CREATE TABLE "BulletinPost"`, `"BulletinLike"`, `"BulletinResponse"` with the unique indexes and foreign keys. If the file is empty, the DB already matches — stop and investigate.

- [ ] **Step 4: Apply the migration**

Run: `pnpm prisma migrate deploy`
Expected: "1 migration applied" (the `_add_bulletin` migration).

- [ ] **Step 5: Regenerate the client and typecheck**

Run: `pnpm prisma generate`
Run: `pnpm tsc --noEmit`
Expected: no errors; `db.bulletinPost` etc. are typed.

- [ ] **Step 6: Confirm no drift**

Run:

```bash
pnpm prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
```

Expected: `-- This is an empty migration.` (schema and DB agree).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add BulletinPost, BulletinLike, BulletinResponse models"
```

---

### Task 3: Bulletin domain helpers (`bulletin.ts`)

Pure helpers for validation, the reveal rule, and follow-scope. This isolates the gating logic as testable functions the routes call.

**Files:**
- Create: `src/lib/bulletin.ts`
- Create: `src/lib/bulletin.test.ts`

**Interfaces:**
- Produces:
  - `const BULLETIN_BLOCK_TYPES = ['poll', 'rating', 'shortanswer'] as const`
  - `type BulletinBlockType = (typeof BULLETIN_BLOCK_TYPES)[number]`
  - `interface BulletinSettings { revealAfterAnswer: boolean; liveTally: boolean }`
  - `isBulletinBlockType(t: unknown): t is BulletinBlockType`
  - `normalizeSettings(raw: unknown): BulletinSettings`
  - `isEmptyPost(input: { text?: string | null; imageUrl?: string | null; block?: unknown }): boolean`
  - `isInScope(authorId: string, followingIds: string[], myId: string): boolean`
  - `resultsVisible(p: { isAuthor: boolean; revealAfterAnswer: boolean; hasResponded: boolean }): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/bulletin.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isBulletinBlockType, normalizeSettings, isEmptyPost, isInScope, resultsVisible } from './bulletin'

describe('isBulletinBlockType', () => {
  it('accepts the three v1 types and rejects everything else', () => {
    expect(isBulletinBlockType('poll')).toBe(true)
    expect(isBulletinBlockType('rating')).toBe(true)
    expect(isBulletinBlockType('shortanswer')).toBe(true)
    expect(isBulletinBlockType('mcq')).toBe(false)
    expect(isBulletinBlockType('comment')).toBe(false)
    expect(isBulletinBlockType(null)).toBe(false)
  })
})

describe('normalizeSettings', () => {
  it('coerces to booleans and defaults to false', () => {
    expect(normalizeSettings({ revealAfterAnswer: true, liveTally: 1 })).toEqual({ revealAfterAnswer: true, liveTally: true })
    expect(normalizeSettings(null)).toEqual({ revealAfterAnswer: false, liveTally: false })
    expect(normalizeSettings('nope')).toEqual({ revealAfterAnswer: false, liveTally: false })
  })
})

describe('isEmptyPost', () => {
  it('is empty only when text, image, and block are all absent', () => {
    expect(isEmptyPost({})).toBe(true)
    expect(isEmptyPost({ text: '   ' })).toBe(true)
    expect(isEmptyPost({ text: 'hi' })).toBe(false)
    expect(isEmptyPost({ imageUrl: 'https://x/y.png' })).toBe(false)
    expect(isEmptyPost({ block: { id: 'b', type: 'poll' } })).toBe(false)
  })
})

describe('isInScope', () => {
  it('allows own posts and followed authors, rejects strangers', () => {
    expect(isInScope('me', ['a', 'b'], 'me')).toBe(true)
    expect(isInScope('a', ['a', 'b'], 'me')).toBe(true)
    expect(isInScope('stranger', ['a', 'b'], 'me')).toBe(false)
  })
})

describe('resultsVisible', () => {
  it('author always sees; otherwise gated by reveal + hasResponded', () => {
    expect(resultsVisible({ isAuthor: true, revealAfterAnswer: true, hasResponded: false })).toBe(true)
    expect(resultsVisible({ isAuthor: false, revealAfterAnswer: false, hasResponded: false })).toBe(true)
    expect(resultsVisible({ isAuthor: false, revealAfterAnswer: true, hasResponded: false })).toBe(false)
    expect(resultsVisible({ isAuthor: false, revealAfterAnswer: true, hasResponded: true })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/bulletin.test.ts`
Expected: FAIL — cannot find module `./bulletin`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/bulletin.ts`:

```ts
// Pure bulletin domain helpers: block validation, settings normalization,
// follow-scope, and the results-reveal rule. No IO — unit-testable.

export const BULLETIN_BLOCK_TYPES = ['poll', 'rating', 'shortanswer'] as const
export type BulletinBlockType = (typeof BULLETIN_BLOCK_TYPES)[number]

export interface BulletinSettings {
  revealAfterAnswer: boolean
  liveTally: boolean
}

export function isBulletinBlockType(t: unknown): t is BulletinBlockType {
  return typeof t === 'string' && (BULLETIN_BLOCK_TYPES as readonly string[]).includes(t)
}

export function normalizeSettings(raw: unknown): BulletinSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { revealAfterAnswer: !!s.revealAfterAnswer, liveTally: !!s.liveTally }
}

export function isEmptyPost(input: { text?: string | null; imageUrl?: string | null; block?: unknown }): boolean {
  const hasText = !!(input.text && input.text.trim())
  const hasImage = !!(input.imageUrl && input.imageUrl.trim())
  const hasBlock = !!input.block
  return !hasText && !hasImage && !hasBlock
}

export function isInScope(authorId: string, followingIds: string[], myId: string): boolean {
  return authorId === myId || followingIds.includes(authorId)
}

export function resultsVisible(p: { isAuthor: boolean; revealAfterAnswer: boolean; hasResponded: boolean }): boolean {
  return p.isAuthor || !p.revealAfterAnswer || p.hasResponded
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/bulletin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bulletin.ts src/lib/bulletin.test.ts
git commit -m "feat(bulletin): pure domain helpers (scope, reveal rule, validation)"
```

---

### Task 4: Create + delete post API

**Files:**
- Create: `src/app/api/bulletin/route.ts` (`POST`)
- Create: `src/app/api/bulletin/[id]/route.ts` (`DELETE`)

**Interfaces:**
- Consumes: `getUser` (`@/lib/auth`), `db` (`@/lib/db`), `isBulletinBlockType`, `normalizeSettings`, `isEmptyPost` (`@/lib/bulletin`).
- Produces: `POST /api/bulletin` → `201 { id }`; `DELETE /api/bulletin/[id]` → `200 { ok: true }`.

- [ ] **Step 1: Implement `POST /api/bulletin`**

Create `src/app/api/bulletin/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isBulletinBlockType, normalizeSettings, isEmptyPost } from '@/lib/bulletin'

export async function POST(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const text: string | null = typeof body.text === 'string' && body.text.trim() ? body.text.trim().slice(0, 2000) : null
    const imageUrl: string | null = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null
    const block = body.block && typeof body.block === 'object' ? body.block : null

    if (block) {
      if (!isBulletinBlockType(block.type)) {
        return NextResponse.json({ error: 'Unsupported block type' }, { status: 400 })
      }
      if (typeof block.id !== 'string' || !block.id) {
        block.id = `blk-${me.id.slice(-4)}-${text ? text.length : 0}-${Math.round(1000 * (block.type.length))}`
      }
    }

    if (isEmptyPost({ text, imageUrl, block })) {
      return NextResponse.json({ error: 'Post is empty' }, { status: 400 })
    }

    const post = await db.bulletinPost.create({
      data: {
        authorId: me.id,
        text,
        imageUrl,
        blocks: block ? [block] : [],
        settings: normalizeSettings(body.settings),
      },
      select: { id: true },
    })

    return NextResponse.json({ id: post.id }, { status: 201 })
  } catch (error) {
    console.error('Bulletin create error:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
```

Note: the client (Task 8 composer) always sends `block.id` (a stable id from `createElement`), so the fallback id branch is a defensive floor, not the normal path.

- [ ] **Step 2: Implement `DELETE /api/bulletin/[id]`**

Create `src/app/api/bulletin/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

interface Props {
  params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const post = await db.bulletinPost.findUnique({ where: { id }, select: { authorId: true } })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (post.authorId !== me.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await db.bulletinPost.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Bulletin delete error:', error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification (dev server running)**

With the dev server up, mint a JWT for a seed user and exercise the route. Using Git Bash:

```bash
# Mint a token for an existing user id (replace USERID); JWT_SECRET from .env
node -e "const {sign}=require('jsonwebtoken');console.log(sign({userId:process.argv[1]},process.env.JWT_SECRET))" USERID
```

```bash
# Create a post (replace TOKEN)
curl -s -X POST http://localhost:3000/api/bulletin \
  -H 'Content-Type: application/json' \
  -H 'Cookie: galli-auth=TOKEN' \
  -d '{"text":"Hello bulletin","block":{"id":"blk-1","type":"poll","pollQuestion":"Coffee or tea?","pollOptions":["Coffee","Tea"]},"settings":{"revealAfterAnswer":true,"liveTally":true}}'
```

Expected: `{"id":"..."}` with HTTP 201. An empty body `{}` returns 400; a `block.type:"mcq"` returns 400.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/bulletin/route.ts "src/app/api/bulletin/[id]/route.ts"
git commit -m "feat(bulletin): create and delete post endpoints"
```

---

### Task 5: Feed API (`GET /api/bulletin/feed`)

Returns followed-users' + own posts, newest first, each with likes, my-response, and reveal-gated results.

**Files:**
- Create: `src/app/api/bulletin/feed/route.ts`

**Interfaces:**
- Consumes: `getUser`, `db`, `normalizeSettings` + `resultsVisible` (`@/lib/bulletin`), `aggregateBlock` + `ResponseRecord` (`@/lib/element-aggregate`).
- Produces: `GET /api/bulletin/feed?page&limit` → `{ posts: FeedPost[]; hasMore: boolean; page: number }`. Shape of `FeedPost`:

```ts
interface FeedPost {
  id: string
  author: { id: string; name: string | null; username: string; avatar: string | null }
  text: string | null
  imageUrl: string | null
  block: any | null
  settings: { revealAfterAnswer: boolean; liveTally: boolean }
  createdAt: string
  likeCount: number
  likedByMe: boolean
  myResponse: Record<string, { type: string; answer: unknown }> | null
  results: import('@/lib/element-aggregate').ElementAggregate | null
}
```

- [ ] **Step 1: Implement the route**

Create `src/app/api/bulletin/feed/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { normalizeSettings, resultsVisible } from '@/lib/bulletin'
import { aggregateBlock, type ResponseRecord } from '@/lib/element-aggregate'

const PAGE_SIZE = 15

export async function GET(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10)))

    const followingIds = (
      await db.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } })
    ).map((f) => f.followingId)
    const authorIds = [me.id, ...followingIds]

    const where = { authorId: { in: authorIds } }
    const [total, posts] = await Promise.all([
      db.bulletinPost.count({ where }),
      db.bulletinPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          text: true,
          imageUrl: true,
          blocks: true,
          settings: true,
          createdAt: true,
          authorId: true,
          author: { select: { id: true, name: true, username: true, avatar: true } },
        },
      }),
    ])

    const postIds = posts.map((p) => p.id)
    const [likeGroups, myLikes, allResponses] = await Promise.all([
      db.bulletinLike.groupBy({ by: ['postId'], where: { postId: { in: postIds } }, _count: { postId: true } }),
      db.bulletinLike.findMany({ where: { postId: { in: postIds }, userId: me.id }, select: { postId: true } }),
      db.bulletinResponse.findMany({
        where: { postId: { in: postIds } },
        select: { postId: true, userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
      }),
    ])

    const likeCountByPost = new Map(likeGroups.map((g) => [g.postId, g._count.postId]))
    const likedSet = new Set(myLikes.map((l) => l.postId))
    const responsesByPost = new Map<string, typeof allResponses>()
    for (const r of allResponses) {
      const arr = responsesByPost.get(r.postId) || []
      arr.push(r)
      responsesByPost.set(r.postId, arr)
    }

    const feed = posts.map((p) => {
      const blocks = Array.isArray(p.blocks) ? (p.blocks as any[]) : []
      const block = blocks[0] || null
      const settings = normalizeSettings(p.settings)
      const rows = responsesByPost.get(p.id) || []
      const mine = rows.find((r) => r.userId === me.id)
      const isAuthor = p.authorId === me.id
      const hasResponded = !!mine

      let results = null
      if (block) {
        const canSee = resultsVisible({ isAuthor, revealAfterAnswer: settings.revealAfterAnswer, hasResponded })
        if (canSee) {
          const records: ResponseRecord[] = rows.map((r) => ({
            responses: r.responses,
            submittedAt: r.createdAt,
            identity: { userId: r.userId, name: r.user.name ?? r.user.username, avatar: r.user.avatar },
          }))
          results = aggregateBlock(block, records)
        }
      }

      return {
        id: p.id,
        author: { id: p.author.id, name: p.author.name, username: p.author.username, avatar: p.author.avatar },
        text: p.text,
        imageUrl: p.imageUrl,
        block,
        settings,
        createdAt: p.createdAt.toISOString(),
        likeCount: likeCountByPost.get(p.id) || 0,
        likedByMe: likedSet.has(p.id),
        myResponse: (mine?.responses as Record<string, { type: string; answer: unknown }>) || null,
        results,
      }
    })

    return NextResponse.json({ posts: feed, hasMore: page * limit < total, page })
  } catch (error) {
    console.error('Bulletin feed error:', error)
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

```bash
curl -s http://localhost:3000/api/bulletin/feed -H 'Cookie: galli-auth=TOKEN' | head -c 800
```

Expected: `{"posts":[{...,"results":null,...}], "hasMore":false, "page":1}`. For a `revealAfterAnswer` poll you authored, `results` is present (author always sees); for one you didn't author and haven't answered, `results` is `null`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bulletin/feed/route.ts
git commit -m "feat(bulletin): follow-scoped feed with reveal-gated results"
```

---

### Task 6: Like + respond API

**Files:**
- Create: `src/app/api/bulletin/[id]/like/route.ts` (`POST`, `DELETE`)
- Create: `src/app/api/bulletin/[id]/respond/route.ts` (`POST`)

**Interfaces:**
- Consumes: `getUser`, `db`, `isInScope` + `resultsVisible` + `normalizeSettings` (`@/lib/bulletin`), `aggregateBlock` + `ResponseRecord` (`@/lib/element-aggregate`).
- Produces:
  - `POST/DELETE /api/bulletin/[id]/like` → `{ likeCount, likedByMe }`
  - `POST /api/bulletin/[id]/respond` → `{ results, myResponse }`

- [ ] **Step 1: Implement like toggle**

Create `src/app/api/bulletin/[id]/like/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isInScope } from '@/lib/bulletin'

interface Props {
  params: Promise<{ id: string }>
}

async function scopeCheck(request: NextRequest, postId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const post = await db.bulletinPost.findUnique({ where: { id: postId }, select: { authorId: true } })
  if (!post) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const followingIds = (await db.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } })).map((f) => f.followingId)
  if (!isInScope(post.authorId, followingIds, me.id)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { me }
}

async function likeState(postId: string, userId: string) {
  const [likeCount, mine] = await Promise.all([
    db.bulletinLike.count({ where: { postId } }),
    db.bulletinLike.findUnique({ where: { postId_userId: { postId, userId } }, select: { id: true } }),
  ])
  return { likeCount, likedByMe: !!mine }
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params
    const check = await scopeCheck(request, id)
    if (check.error) return check.error
    const me = check.me!
    await db.bulletinLike.upsert({
      where: { postId_userId: { postId: id, userId: me.id } },
      create: { postId: id, userId: me.id },
      update: {},
    })
    return NextResponse.json(await likeState(id, me.id))
  } catch (error) {
    console.error('Bulletin like error:', error)
    return NextResponse.json({ error: 'Failed to like' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params
    const check = await scopeCheck(request, id)
    if (check.error) return check.error
    const me = check.me!
    await db.bulletinLike.deleteMany({ where: { postId: id, userId: me.id } })
    return NextResponse.json(await likeState(id, me.id))
  } catch (error) {
    console.error('Bulletin unlike error:', error)
    return NextResponse.json({ error: 'Failed to unlike' }, { status: 500 })
  }
}
```

Note: `postId_userId` is Prisma's generated compound-unique selector for `@@unique([postId, userId])`.

- [ ] **Step 2: Implement respond**

Create `src/app/api/bulletin/[id]/respond/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isInScope, normalizeSettings } from '@/lib/bulletin'
import { aggregateBlock, type ResponseRecord } from '@/lib/element-aggregate'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const responses = body.responses
    if (!responses || typeof responses !== 'object') {
      return NextResponse.json({ error: 'Missing responses' }, { status: 400 })
    }

    const post = await db.bulletinPost.findUnique({
      where: { id },
      select: { authorId: true, blocks: true },
    })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const followingIds = (await db.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } })).map((f) => f.followingId)
    if (!isInScope(post.authorId, followingIds, me.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.bulletinResponse.upsert({
      where: { postId_userId: { postId: id, userId: me.id } },
      create: { postId: id, userId: me.id, responses },
      update: { responses },
    })

    // Recompute results (the responder has now answered, so they may see them).
    const blocks = Array.isArray(post.blocks) ? (post.blocks as any[]) : []
    const block = blocks[0] || null
    let results = null
    if (block) {
      const rows = await db.bulletinResponse.findMany({
        where: { postId: id },
        select: { userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
      })
      const records: ResponseRecord[] = rows.map((r) => ({
        responses: r.responses,
        submittedAt: r.createdAt,
        identity: { userId: r.userId, name: r.user.name ?? r.user.username, avatar: r.user.avatar },
      }))
      results = aggregateBlock(block, records)
    }

    return NextResponse.json({ results, myResponse: responses })
  } catch (error) {
    console.error('Bulletin respond error:', error)
    return NextResponse.json({ error: 'Failed to respond' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

```bash
# Like (POST id from Task 4). Repeat POST — count stays 1 (idempotent).
curl -s -X POST http://localhost:3000/api/bulletin/POSTID/like -H 'Cookie: galli-auth=TOKEN'
# Respond to the poll block
curl -s -X POST http://localhost:3000/api/bulletin/POSTID/respond \
  -H 'Content-Type: application/json' -H 'Cookie: galli-auth=TOKEN' \
  -d '{"responses":{"blk-1":{"type":"poll","question":"Coffee or tea?","answer":["Coffee"]}}}'
```

Expected: like returns `{"likeCount":1,"likedByMe":true}` (POST twice → still 1). Respond returns `{"results":{"type":"poll","totalVoters":1,"distribution":[...],"respondents":[{"user":{...},"answer":["Coffee"]}]},"myResponse":{...}}`. A second respond with a different answer replaces the first (still `totalVoters:1`).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/bulletin/[id]/like/route.ts" "src/app/api/bulletin/[id]/respond/route.ts"
git commit -m "feat(bulletin): identified like toggle and respond (upsert) endpoints"
```

---

### Task 7: Compact bulletin blocks

Three feed-native, theme-aware block components + a dispatcher. Each submits an identified response and renders results when visible.

**Files:**
- Create: `src/components/bulletin/blocks/BulletinPoll.tsx`
- Create: `src/components/bulletin/blocks/BulletinRating.tsx`
- Create: `src/components/bulletin/blocks/BulletinShortAnswer.tsx`
- Create: `src/components/bulletin/BulletinBlock.tsx`
- Create: `src/components/bulletin/blocks/BulletinPoll.test.tsx`

**Interfaces:**
- Consumes: `ElementAggregate`, `PollAggregate`, `RatingAggregate`, `ShortAnswerAggregate` (`@/lib/element-aggregate`); `CanvasElement` (`@/lib/types/canvas`).
- Produces the shared block prop type (define in `BulletinBlock.tsx` and import into each block):

```ts
export interface BulletinBlockProps {
  postId: string
  block: CanvasElement
  results: import('@/lib/element-aggregate').ElementAggregate | null
  myResponse: Record<string, { type: string; answer: unknown }> | null
  onResults: (results: import('@/lib/element-aggregate').ElementAggregate) => void
}
```

- [ ] **Step 1: Write the failing component test**

Create `src/components/bulletin/blocks/BulletinPoll.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BulletinPoll } from './BulletinPoll'
import type { CanvasElement } from '@/lib/types/canvas'

const block: CanvasElement = { id: 'blk-1', type: 'poll', pollQuestion: 'Coffee or tea?', pollOptions: ['Coffee', 'Tea'] }

describe('BulletinPoll', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('submits an identified poll response for the selected option', async () => {
    const results = { elementId: 'blk-1', type: 'poll', question: 'Coffee or tea?', options: ['Coffee', 'Tea'], allowMultiple: false, totalVoters: 1, distribution: [{ option: 'Coffee', count: 1, percentage: 100 }, { option: 'Tea', count: 0, percentage: 0 }], respondents: [] }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results, myResponse: {} }) })
    vi.stubGlobal('fetch', fetchMock)
    const onResults = vi.fn()

    render(<BulletinPoll postId="p1" block={block} results={null} myResponse={null} onResults={onResults} />)

    fireEvent.click(screen.getByRole('button', { name: 'Coffee' }))
    fireEvent.click(screen.getByRole('button', { name: /vote/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/bulletin/p1/respond',
      expect.objectContaining({ method: 'POST' })
    ))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.responses['blk-1']).toMatchObject({ type: 'poll', answer: ['Coffee'] })
    await waitFor(() => expect(onResults).toHaveBeenCalledWith(results))
  })

  it('shows results (percentages) when results are already visible', () => {
    const results = { elementId: 'blk-1', type: 'poll', question: 'Coffee or tea?', options: ['Coffee', 'Tea'], allowMultiple: false, totalVoters: 4, distribution: [{ option: 'Coffee', count: 3, percentage: 75 }, { option: 'Tea', count: 1, percentage: 25 }], respondents: [] }
    render(<BulletinPoll postId="p1" block={block} results={results as any} myResponse={{ 'blk-1': { type: 'poll', answer: ['Coffee'] } }} onResults={() => {}} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/bulletin/blocks/BulletinPoll.test.tsx`
Expected: FAIL — cannot find module `./BulletinPoll`.

- [ ] **Step 3: Implement `BulletinPoll`**

Create `src/components/bulletin/blocks/BulletinPoll.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { PollAggregate } from '@/lib/element-aggregate'
import type { BulletinBlockProps } from '../BulletinBlock'

export function BulletinPoll({ postId, block, results, myResponse, onResults }: BulletinBlockProps) {
  const options = block.pollOptions || []
  const allowMultiple = block.pollAllowMultiple ?? false
  const priorAnswer = myResponse?.[block.id]?.answer
  const answered = !!priorAnswer

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [localResults, setLocalResults] = useState<PollAggregate | null>((results as PollAggregate) || null)

  const showResults = !!localResults
  const total = localResults?.totalVoters || 0
  const pctByOption = new Map((localResults?.distribution || []).map((d) => [d.option, d]))

  const toggle = (opt: string) => {
    if (answered) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(opt)) next.delete(opt)
      else {
        if (!allowMultiple) next.clear()
        next.add(opt)
      }
      return next
    })
  }

  const vote = async () => {
    if (selected.size === 0 || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bulletin/${postId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: { [block.id]: { type: 'poll', question: block.pollQuestion, answer: Array.from(selected) } },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.results) {
          setLocalResults(data.results)
          onResults(data.results)
        }
      }
    } catch {
      /* degrade quietly */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-sm font-semibold text-foreground mb-2">{block.pollQuestion || 'What do you think?'}</p>
      <div className="space-y-1.5">
        {options.map((opt) => {
          const d = pctByOption.get(opt)
          const isSel = selected.has(opt)
          const mineOpt = Array.isArray(priorAnswer) && (priorAnswer as string[]).includes(opt)
          return (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              disabled={answered || submitting}
              className={`relative w-full overflow-hidden rounded-lg border text-left transition-colors ${
                isSel ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              } ${answered ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {showResults && (
                <div className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500" style={{ width: `${d?.percentage ?? 0}%` }} />
              )}
              <div className="relative flex items-center gap-2 px-3 py-2">
                <span className="flex-1 text-sm text-foreground">{opt}</span>
                {mineOpt && <Check className="h-3.5 w-3.5 text-primary" />}
                {showResults && <span className="text-xs font-semibold text-muted-foreground">{d?.percentage ?? 0}%</span>}
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{total} {total === 1 ? 'vote' : 'votes'}</span>
        {!answered && (
          <button
            onClick={vote}
            disabled={selected.size === 0 || submitting}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Voting…' : 'Vote'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the poll test to verify it passes**

Run: `pnpm test src/components/bulletin/blocks/BulletinPoll.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Implement `BulletinRating`**

Create `src/components/bulletin/blocks/BulletinRating.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import type { RatingAggregate } from '@/lib/element-aggregate'
import type { BulletinBlockProps } from '../BulletinBlock'

export function BulletinRating({ postId, block, results, myResponse, onResults }: BulletinBlockProps) {
  const max = block.ratingMax || 5
  const priorAnswer = myResponse?.[block.id]?.answer
  const answered = priorAnswer != null
  const [rating, setRating] = useState<number | null>(answered ? Number(priorAnswer) : null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [localResults, setLocalResults] = useState<RatingAggregate | null>((results as RatingAggregate) || null)

  const submit = async () => {
    if (rating === null || submitting || answered) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bulletin/${postId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: { [block.id]: { type: 'rating', question: block.ratingQuestion, answer: rating } } }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.results) {
          setLocalResults(data.results)
          onResults(data.results)
        }
      }
    } catch {
      /* degrade quietly */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-sm font-semibold text-foreground mb-2">{block.ratingQuestion || 'How would you rate this?'}</p>
      <div className="flex items-center gap-1">
        {Array.from({ length: max }, (_, i) => {
          const value = i + 1
          const active = value <= (hovered ?? rating ?? 0)
          return (
            <button
              key={i}
              onClick={() => !answered && setRating(value)}
              onMouseEnter={() => !answered && setHovered(value)}
              onMouseLeave={() => setHovered(null)}
              disabled={answered}
              className="p-0.5 transition-transform hover:scale-110 disabled:hover:scale-100"
              aria-label={`Rate ${value}`}
            >
              <Star className={`h-6 w-6 ${active ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`} />
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {localResults ? `Avg ${localResults.average} · ${localResults.responseCount} ${localResults.responseCount === 1 ? 'rating' : 'ratings'}` : answered ? 'Thanks!' : ''}
        </span>
        {!answered && (
          <button
            onClick={submit}
            disabled={rating === null || submitting}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Implement `BulletinShortAnswer`**

Create `src/components/bulletin/blocks/BulletinShortAnswer.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { ShortAnswerAggregate } from '@/lib/element-aggregate'
import type { BulletinBlockProps } from '../BulletinBlock'

export function BulletinShortAnswer({ postId, block, results, myResponse, onResults }: BulletinBlockProps) {
  const priorAnswer = myResponse?.[block.id]?.answer
  const answered = priorAnswer != null && priorAnswer !== ''
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localResults, setLocalResults] = useState<ShortAnswerAggregate | null>((results as ShortAnswerAggregate) || null)

  const submit = async () => {
    const answer = value.trim()
    if (!answer || submitting || answered) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bulletin/${postId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: { [block.id]: { type: 'shortanswer', question: block.shortAnswerQuestion, answer } } }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.results) {
          setLocalResults(data.results)
          onResults(data.results)
        }
      }
    } catch {
      /* degrade quietly */
    } finally {
      setSubmitting(false)
    }
  }

  if (answered) {
    return (
      <div className="rounded-xl border border-border bg-surface p-3">
        <p className="text-sm font-semibold text-foreground mb-1">{block.shortAnswerQuestion || 'Your answer'}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-primary" /> Answered{localResults ? ` · ${localResults.responseCount} total` : ''}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-sm font-semibold text-foreground mb-2">{block.shortAnswerQuestion || 'Your answer'}</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={block.shortAnswerPlaceholder || 'Type your answer…'}
        rows={2}
        maxLength={block.shortAnswerMaxLength || 500}
        className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={submit}
          disabled={!value.trim() || submitting}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Implement the dispatcher**

Create `src/components/bulletin/BulletinBlock.tsx`:

```tsx
'use client'

import type { CanvasElement } from '@/lib/types/canvas'
import type { ElementAggregate } from '@/lib/element-aggregate'
import { BulletinPoll } from './blocks/BulletinPoll'
import { BulletinRating } from './blocks/BulletinRating'
import { BulletinShortAnswer } from './blocks/BulletinShortAnswer'

export interface BulletinBlockProps {
  postId: string
  block: CanvasElement
  results: ElementAggregate | null
  myResponse: Record<string, { type: string; answer: unknown }> | null
  onResults: (results: ElementAggregate) => void
}

export function BulletinBlock(props: BulletinBlockProps) {
  switch (props.block.type) {
    case 'poll':
      return <BulletinPoll {...props} />
    case 'rating':
      return <BulletinRating {...props} />
    case 'shortanswer':
      return <BulletinShortAnswer {...props} />
    default:
      return null
  }
}
```

- [ ] **Step 8: Run tests + typecheck**

Run: `pnpm test src/components/bulletin/blocks/BulletinPoll.test.tsx`
Expected: PASS.
Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/bulletin/
git commit -m "feat(bulletin): compact poll/rating/short-answer blocks + dispatcher"
```

---

### Task 8: Panel tab shell + composer + feed cards

Turn `AnalyticsPanel` into a two-tab shell and build the inline Bulletin tab (composer + feed).

**Files:**
- Create: `src/components/bulletin/BulletinComposer.tsx`
- Create: `src/components/bulletin/BulletinPostCard.tsx`
- Create: `src/components/bulletin/BulletinTab.tsx`
- Modify: `src/components/dashboard/AnalyticsPanel.tsx` (wrap existing body in a tab shell)

**Interfaces:**
- Consumes: `BulletinBlock` + `BulletinBlockProps` (`@/components/bulletin/BulletinBlock`), `ElementAggregate` (`@/lib/element-aggregate`), `CanvasElement` (`@/lib/types/canvas`), `useAuthStore` (`@/lib/store`).
- Produces: `BulletinTab` (default export not required; named export), used by `AnalyticsPanel`.

- [ ] **Step 1: Build the composer**

Create `src/components/bulletin/BulletinComposer.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'
import { ImagePlus, BarChart3, Star, MessageSquareText, X } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

type BlockType = 'poll' | 'rating' | 'shortanswer'

function makeBlock(type: BlockType): CanvasElement {
  const id = `blk-${type}-${String(Math.abs(hashStr(type + '-seed')))}`
  if (type === 'poll') return { id, type, pollQuestion: '', pollOptions: ['', ''] }
  if (type === 'rating') return { id, type, ratingQuestion: '', ratingMax: 5, ratingStyle: 'stars' }
  return { id, type, shortAnswerQuestion: '', shortAnswerPlaceholder: 'Type your answer…' }
}

// Deterministic id seed (no Math.random so ids are stable per render tree).
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function BulletinComposer({ onPosted }: { onPosted: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [block, setBlock] = useState<CanvasElement | null>(null)
  const [revealAfterAnswer, setReveal] = useState(false)
  const [liveTally, setLive] = useState(true)
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setText(''); setImageUrl(null); setBlock(null); setReveal(false); setLive(true); setExpanded(false)
  }

  const uploadImage = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (res.ok) setImageUrl((await res.json()).url)
  }

  const post = async () => {
    if (posting) return
    setPosting(true)
    try {
      const res = await fetch('/api/bulletin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageUrl, block, settings: { revealAfterAnswer, liveTally } }),
      })
      if (res.ok) {
        reset()
        onPosted()
      }
    } catch {
      /* degrade quietly */
    } finally {
      setPosting(false)
    }
  }

  const canPost = !!(text.trim() || imageUrl || block)

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm text-muted-foreground hover:border-primary/40"
      >
        Share something with your followers…
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3 space-y-2.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's on your mind?"
        rows={2}
        maxLength={2000}
        className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
      />

      {imageUrl && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="w-full rounded-lg" />
          <button onClick={() => setImageUrl(null)} className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {block && <BlockEditor block={block} onChange={setBlock} onRemove={() => setBlock(null)} />}

      {/* Toolbar */}
      <div className="flex items-center gap-1">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
        <ToolBtn label="Image" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /></ToolBtn>
        {!block && <ToolBtn label="Poll" onClick={() => setBlock(makeBlock('poll'))}><BarChart3 className="h-4 w-4" /></ToolBtn>}
        {!block && <ToolBtn label="Rating" onClick={() => setBlock(makeBlock('rating'))}><Star className="h-4 w-4" /></ToolBtn>}
        {!block && <ToolBtn label="Question" onClick={() => setBlock(makeBlock('shortanswer'))}><MessageSquareText className="h-4 w-4" /></ToolBtn>}
      </div>

      {block && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={revealAfterAnswer} onChange={(e) => setReveal(e.target.checked)} /> Reveal after answering
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={liveTally} onChange={(e) => setLive(e.target.checked)} /> Live tally
          </label>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button onClick={reset} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">Cancel</button>
        <button
          onClick={post}
          disabled={!canPost || posting}
          className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {posting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  )
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
      {children}
    </button>
  )
}

function BlockEditor({ block, onChange, onRemove }: { block: CanvasElement; onChange: (b: CanvasElement) => void; onRemove: () => void }) {
  const set = (patch: Partial<CanvasElement>) => onChange({ ...block, ...patch })
  return (
    <div className="rounded-lg border border-border bg-background p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{block.type}</span>
        <button onClick={onRemove} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      {block.type === 'poll' && (
        <>
          <input value={block.pollQuestion || ''} onChange={(e) => set({ pollQuestion: e.target.value })} placeholder="Poll question" className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary/50" />
          {(block.pollOptions || []).map((opt, i) => (
            <input
              key={i}
              value={opt}
              onChange={(e) => {
                const opts = [...(block.pollOptions || [])]
                opts[i] = e.target.value
                set({ pollOptions: opts })
              }}
              placeholder={`Option ${i + 1}`}
              className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary/50"
            />
          ))}
          <button onClick={() => set({ pollOptions: [...(block.pollOptions || []), ''] })} className="text-xs text-primary hover:underline">+ Add option</button>
        </>
      )}
      {block.type === 'rating' && (
        <input value={block.ratingQuestion || ''} onChange={(e) => set({ ratingQuestion: e.target.value })} placeholder="Rating question" className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary/50" />
      )}
      {block.type === 'shortanswer' && (
        <input value={block.shortAnswerQuestion || ''} onChange={(e) => set({ shortAnswerQuestion: e.target.value })} placeholder="Your question" className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary/50" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build the post card**

Create `src/components/bulletin/BulletinPostCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Heart, Trash2 } from 'lucide-react'
import type { ElementAggregate } from '@/lib/element-aggregate'
import { BulletinBlock } from './BulletinBlock'
import type { CanvasElement } from '@/lib/types/canvas'

export interface FeedPost {
  id: string
  author: { id: string; name: string | null; username: string; avatar: string | null }
  text: string | null
  imageUrl: string | null
  block: CanvasElement | null
  settings: { revealAfterAnswer: boolean; liveTally: boolean }
  createdAt: string
  likeCount: number
  likedByMe: boolean
  myResponse: Record<string, { type: string; answer: unknown }> | null
  results: ElementAggregate | null
}

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export function BulletinPostCard({ post, currentUserId, onDeleted }: { post: FeedPost; currentUserId?: string; onDeleted: (id: string) => void }) {
  const [liked, setLiked] = useState(post.likedByMe)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [results, setResults] = useState<ElementAggregate | null>(post.results)
  const [myResponse, setMyResponse] = useState(post.myResponse)

  const toggleLike = async () => {
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    try {
      const res = await fetch(`/api/bulletin/${post.id}/like`, { method: next ? 'POST' : 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        setLiked(data.likedByMe)
        setLikeCount(data.likeCount)
      }
    } catch {
      setLiked(!next)
      setLikeCount((c) => c + (next ? -1 : 1))
    }
  }

  const del = async () => {
    if (!window.confirm('Delete this post?')) return
    try {
      const res = await fetch(`/api/bulletin/${post.id}`, { method: 'DELETE' })
      if (res.ok) onDeleted(post.id)
    } catch {
      /* ignore */
    }
  }

  const name = post.author.name || post.author.username

  return (
    <div className="rounded-2xl border border-border bg-surface p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-galli/30 to-galli-violet/30">
          {post.author.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.author.avatar} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">@{post.author.username} · {timeAgo(post.createdAt)}</p>
        </div>
        {currentUserId === post.author.id && (
          <button onClick={del} title="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>

      {post.text && <p className="whitespace-pre-wrap text-sm text-foreground">{post.text}</p>}

      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="w-full rounded-lg" />
      )}

      {post.block && (
        <BulletinBlock
          postId={post.id}
          block={post.block}
          results={results}
          myResponse={myResponse}
          onResults={(r) => {
            setResults(r)
            setMyResponse((prev) => prev ?? {})
          }}
        />
      )}

      <div className="flex items-center gap-1 pt-0.5">
        <button onClick={toggleLike} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}>
          <Heart className={`h-4 w-4 ${liked ? 'fill-red-500' : ''}`} /> {likeCount > 0 ? likeCount : ''}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build the tab**

Create `src/components/bulletin/BulletinTab.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { BulletinComposer } from './BulletinComposer'
import { BulletinPostCard, type FeedPost } from './BulletinPostCard'

export function BulletinTab() {
  const { user } = useAuthStore()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/bulletin/feed')
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => setPosts(Array.isArray(d.posts) ? d.posts : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const onDeleted = (id: string) => setPosts((prev) => prev.filter((p) => p.id !== id))

  return (
    <div className="space-y-3">
      <BulletinComposer onPosted={load} />
      {loading && posts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No bulletins yet. Post one, or follow people to see theirs.
        </p>
      ) : (
        posts.map((p) => <BulletinPostCard key={p.id} post={p} currentUserId={user?.id} onDeleted={onDeleted} />)
      )}
    </div>
  )
}
```

Note: confirm `useAuthStore` exposes `user.id`. If the store user has no `id` field, use `user?.username` and pass `currentUserId={undefined}` (delete button simply won't show). Check `src/lib/store.ts` before wiring.

- [ ] **Step 4: Wrap `AnalyticsPanel` in a tab shell**

In `src/components/dashboard/AnalyticsPanel.tsx`:

1. Add imports at the top:

```tsx
import { BulletinTab } from '@/components/bulletin/BulletinTab'
```

2. Add a tab state hook inside the component, right after the existing `useState`/`useEffect` block (before the `if (!display)` early return):

```tsx
  const [tab, setTab] = useState<'glance' | 'bulletin'>('glance')
```

3. Replace the `if (!display) { return (<aside>…</aside>) }` early return AND the final `return (<aside>…</aside>)` with a single shell that always renders the tab bar. Concretely, wrap the whole render as:

```tsx
  const glanceBody = !display ? (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <BarChart3 className="mb-3 h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Select a page to see its audience at a glance.</p>
    </div>
  ) : (
    <div className="space-y-5 p-5">
      {/* ...the existing selected-page summary + audience + widget feedback + CTA JSX... */}
    </div>
  )

  return (
    <aside className="hidden xl:flex w-[360px] shrink-0 flex-col border-l border-border">
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('glance')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'glance' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          At a glance
        </button>
        <button
          onClick={() => setTab('bulletin')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'bulletin' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Bulletin
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'glance' ? glanceBody : <div className="p-4"><BulletinTab /></div>}
      </div>
    </aside>
  )
```

Move the existing summary/audience/widget/CTA markup (currently between the `<aside …>` open tag and its close in the final return) into the `glanceBody` `<div className="space-y-5 p-5">` wrapper. Keep all inner JSX and the existing `days`/`spark`/`views`/`visitors`/`engagement` computations exactly as they are (they must run only when `display` is set — keep them guarded as they already are, computed just above the `return`).

- [ ] **Step 5: Verify the auth store shape**

Read `src/lib/store.ts` and confirm the `user` object's identifier field. Adjust `currentUserId={user?.id}` in `BulletinTab.tsx` to the actual field if it differs. (No code shown here because it depends on the store; make the minimal change.)

- [ ] **Step 6: Typecheck + tests**

Run: `pnpm tsc --noEmit`
Expected: no errors.
Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 7: Manual verification (dev server)**

Open `http://localhost:3000/dashboard`. On a wide (`xl`) viewport, the right panel shows two tabs. On **Bulletin**: the composer posts a poll; the post appears; voting shows percentages; the heart toggles and persists on reload; the trash icon (own posts) deletes.

- [ ] **Step 8: Commit**

```bash
git add src/components/bulletin/BulletinComposer.tsx src/components/bulletin/BulletinPostCard.tsx src/components/bulletin/BulletinTab.tsx src/components/dashboard/AnalyticsPanel.tsx
git commit -m "feat(bulletin): tabbed panel with inline composer and feed"
```

---

### Task 9: Analytics Bulletin section (identified roster)

Surface the author's own bulletin posts as instruments on `/analytics`, each showing the results **plus who answered**.

**Files:**
- Create: `src/app/api/bulletin/analytics/route.ts` (`GET`)
- Create: `src/components/analytics/BulletinAnalyticsTab.tsx`
- Modify: `src/app/(dashboard)/analytics/page.tsx` (add a third tab)

**Interfaces:**
- Consumes: `getUser`, `db`, `aggregateBlock` + `ResponseRecord` + `ElementAggregate` (`@/lib/element-aggregate`).
- Produces: `GET /api/bulletin/analytics` → `{ posts: { id: string; createdAt: string; text: string | null; results: ElementAggregate }[] }` (only the caller's own posts that contain a block).

- [ ] **Step 1: Implement the analytics route**

Create `src/app/api/bulletin/analytics/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { aggregateBlock, type ResponseRecord } from '@/lib/element-aggregate'

export async function GET(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const posts = await db.bulletinPost.findMany({
      where: { authorId: me.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        text: true,
        createdAt: true,
        blocks: true,
        responses: {
          select: { userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
        },
      },
    })

    const out = posts
      .map((p) => {
        const blocks = Array.isArray(p.blocks) ? (p.blocks as any[]) : []
        const block = blocks[0] || null
        if (!block) return null
        const records: ResponseRecord[] = p.responses.map((r) => ({
          responses: r.responses,
          submittedAt: r.createdAt,
          identity: { userId: r.userId, name: r.user.name ?? r.user.username, avatar: r.user.avatar },
        }))
        const results = aggregateBlock(block, records)
        if (!results) return null
        return { id: p.id, createdAt: p.createdAt.toISOString(), text: p.text, results }
      })
      .filter(Boolean)

    return NextResponse.json({ posts: out })
  } catch (error) {
    console.error('Bulletin analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch bulletin analytics' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Build the analytics tab UI**

Create `src/components/analytics/BulletinAnalyticsTab.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import type { ElementAggregate, RespondentAnswer } from '@/lib/element-aggregate'

interface BulletinAnalyticsPost {
  id: string
  createdAt: string
  text: string | null
  results: ElementAggregate
}

function Avatar({ user }: { user: RespondentAnswer['user'] }) {
  return (
    <span title={user.name} className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
      {user.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        user.name.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}

function Roster({ results }: { results: ElementAggregate }) {
  if (results.respondents.length === 0) {
    return <p className="text-sm text-muted-foreground">No responses yet.</p>
  }
  if (results.type === 'poll') {
    return (
      <div className="space-y-2">
        {results.options.map((opt) => {
          const voters = results.respondents.filter((r) => Array.isArray(r.answer) && (r.answer as string[]).includes(opt))
          const d = results.distribution.find((x) => x.option === opt)
          return (
            <div key={opt}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-foreground">{opt}</span>
                <span className="text-muted-foreground">{d?.count ?? 0} · {d?.percentage ?? 0}%</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {voters.map((r) => <Avatar key={r.user.userId} user={r.user} />)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  if (results.type === 'rating') {
    return (
      <div className="space-y-1.5">
        <p className="text-sm text-muted-foreground">Average {results.average} · {results.responseCount} ratings</p>
        <div className="flex flex-wrap gap-2">
          {results.respondents.map((r) => (
            <span key={r.user.userId} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
              <Avatar user={r.user} /> {String(r.answer)}★
            </span>
          ))}
        </div>
      </div>
    )
  }
  // shortanswer
  return (
    <div className="space-y-2">
      {results.respondents.map((r) => (
        <div key={r.user.userId} className="flex items-start gap-2">
          <Avatar user={r.user} />
          <p className="text-sm text-foreground">{String(r.answer)}</p>
        </div>
      ))}
    </div>
  )
}

export function BulletinAnalyticsTab() {
  const [posts, setPosts] = useState<BulletinAnalyticsPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bulletin/analytics')
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => setPosts(Array.isArray(d.posts) ? d.posts : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading bulletin data…</div>
  if (posts.length === 0) {
    return (
      <div className="py-20 text-center">
        <Megaphone className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-lg font-medium">No bulletin instruments yet</h2>
        <p className="text-muted-foreground">Post a poll, rating, or question on your Bulletin to see who responds.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {posts.map((p) => {
        const title = p.results.type === 'poll' ? p.results.question : p.results.type === 'rating' ? p.results.question : p.results.question
        return (
          <div key={p.id} className="rounded-lg border border-border bg-muted/30 p-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-medium">{title}</h3>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{p.results.type}</span>
            </div>
            {p.text && <p className="mb-4 text-sm text-muted-foreground">{p.text}</p>}
            <Roster results={p.results} />
          </div>
        )
      })}
    </div>
  )
}
```

Note: export `RespondentAnswer` from `@/lib/element-aggregate` if not already exported (it is defined in Task 1 — confirm the `export interface RespondentAnswer` is present).

- [ ] **Step 3: Add the third tab to the analytics page**

In `src/app/(dashboard)/analytics/page.tsx`:

1. Add imports:

```tsx
import { Megaphone } from 'lucide-react'
import { BulletinAnalyticsTab } from '@/components/analytics/BulletinAnalyticsTab'
```

(`Megaphone` joins the existing `lucide-react` import list — add it there rather than a second import if you prefer.)

2. Widen the tab state type:

```tsx
  const [activeTab, setActiveTab] = useState<'overview' | 'elements' | 'bulletin'>(
    searchParams.get('tab') === 'elements' ? 'elements' : searchParams.get('tab') === 'bulletin' ? 'bulletin' : 'overview'
  )
```

3. Add a third tab button after the "Elements" button (inside the `.flex.gap-0` tab bar):

```tsx
            <button
              onClick={() => setActiveTab('bulletin')}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'bulletin'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              Bulletin
            </button>
```

4. Render the bulletin tab. Change the main body's leading conditional from:

```tsx
        {activeTab === 'elements' ? (
          <ElementsTab displayId={selectedDisplayId} />
        ) : loading && !analytics ? (
```

to:

```tsx
        {activeTab === 'bulletin' ? (
          <BulletinAnalyticsTab />
        ) : activeTab === 'elements' ? (
          <ElementsTab displayId={selectedDisplayId} />
        ) : loading && !analytics ? (
```

- [ ] **Step 4: Typecheck + tests**

Run: `pnpm tsc --noEmit`
Expected: no errors.
Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 5: Manual verification**

Open `http://localhost:3000/analytics`, click the **Bulletin** tab. A poll you posted (Task 8) that has responses shows each option with the responding followers' avatars beneath it; ratings show who gave what; short answers list who wrote what.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/bulletin/analytics/route.ts src/components/analytics/BulletinAnalyticsTab.tsx "src/app/(dashboard)/analytics/page.tsx"
git commit -m "feat(bulletin): analytics section with identified respondent roster"
```

---

## Self-Review

**Spec coverage:**
- §1 Concept (tab, inline, follower-scoped, likeable, blocks, identified) → Tasks 2,4,5,6,7,8.
- §2 Why new blocks → Task 7 (compact, theme-aware, identified submit).
- §3 Data model (3 models) → Task 2.
- §4 APIs (create/delete/feed/like/respond + reveal gating + scope) → Tasks 4,5,6 (+ helpers Task 3).
- §5 Analytics (shared aggregators extraction, identified roster, /analytics section) → Tasks 1,9.
- §6 Panel UI (two-tab shell, composer, feed) → Task 8.
- §7 Compact blocks (poll/rating/shortanswer) → Task 7.
- §8 Data flow end-to-end → covered across 4–9.
- §9 Error handling (401/403/404/400, quiet degrade) → Tasks 4,5,6,8 (catches).
- §10 Testing (aggregate unit, gating unit, like/respond, component) → Tasks 1,3,7.
- §11 YAGNI (desktop-only, no expiry, polling not sockets, one block) → honored (no expiry/socket code; single block).
- §12 Phasing → Tasks 1→9 match.

**Placeholder scan:** No TBD/TODO; every code step shows full code. The two spots that say "confirm the store shape" (Task 8 Step 5) and "add Megaphone to existing import" (Task 9) are explicit verification steps, not deferred implementation.

**Type consistency:** `ResponseRecord`, `Respondent`, `RespondentAnswer`, `ElementAggregate`, `aggregateBlock` are defined in Task 1 and consumed with the same names/signatures in Tasks 5,6,9. `BulletinBlockProps` is defined in Task 7 (`BulletinBlock.tsx`) and consumed by all three blocks. `FeedPost` is defined once in `BulletinPostCard.tsx` (Task 8) and reused by `BulletinTab`. Compound-unique selector `postId_userId` matches the `@@unique([postId, userId])` in Task 2. Response map shape `{ [elementId]: { type, question, answer } }` is consistent between blocks (Task 7 submit), respond route (Task 6), and aggregators (Task 1).

**Live tally note:** v1 ships the reveal gating and post-answer refetch; the optional focus-interval "live" refresh is intentionally minimal (feed reload on post + per-answer result refresh). A periodic poll can be added later without schema change.
```

- [ ] **Deferred detail:** the "live tally" periodic refresh is not wired to a timer in v1 (results update on answer and on tab reload). This matches spec §11 (polling, not sockets) and needs no new interfaces.

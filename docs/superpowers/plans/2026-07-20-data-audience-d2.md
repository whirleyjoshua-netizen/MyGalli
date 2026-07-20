# Data Intelligence Center D2 — Audience Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Audience tab to the Data page answering who visits, from where, on what device, and when — backed by a new persistent visitor identifier that also corrects the mislabelled "Visitors" metric shipped in D1.

**Architecture:** All derivation lives in one pure, dependency-free module (`src/lib/data-audience.ts`) unit-tested in isolation. A dedicated API route composes those functions so the Overview route stays untouched and audience work only runs when the tab is opened. React components are thin renderers. Visitor identity comes from a new `localStorage` id persisted on a new nullable column.

**Tech Stack:** Next.js 15.5.19 App Router, React 19, TypeScript, Prisma/PostgreSQL, Tailwind, Vitest + @testing-library/react, lucide-react.

## Global Constraints

- Work in worktree `C:\Users\whirl\pages-mvp\.claude\worktrees\data-audience` on branch `feat/data-audience-d2`. Verify with `git branch --show-current` before every commit — concurrent sessions share checkouts in this repo.
- **Never export anything from an App Router `route.ts` except route handlers and known config keys.** A stray export fails `next build` with `not assignable to type 'never'` from `.next/types/...`, and `tsc --noEmit` cannot see it. This broke a production deploy on 2026-07-19. Helpers go in sibling modules.
- **Never run `prisma migrate dev`.** Migrations here are hand-authored SQL then `migrate deploy`. `migrate diff --from-url` is contaminated on the shared dev database and emits spurious `DROP TABLE`s for other branches' tables.
- Prisma commands need `DATABASE_URL` set inline and pointed at `127.0.0.1`, not `localhost`: `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"`.
- `GET /api/analytics/[displayId]` (Overview) must not change shape — the Home dashboard's `AnalyticsPanel` shares it.
- Analytics must never block or break a visitor-facing interaction. Every tracking call is fire-and-forget inside try/catch.
- Country granularity only. Never store city or a raw IP. No panel may identify a visitor.
- No fabricated or sample data. Empty means an illustrated empty state via `DataIllustration` (variants: `device` | `browser` | `referrer` | `activity` | `sprout`).
- Brand colour tokens: `galli` (#39D98A), `galli-aqua` (#1FB6FF), `galli-violet` (#6C63FF).
- Run tests: `pnpm exec vitest run <path>`. Typecheck: `pnpm exec tsc --noEmit`. Some suites need `JWT_SECRET` set to any non-default value.
- ESLint is MASKED in this worktree — `next build` prints `⨯ ESLint: Plugin "@next/next" was conflicted` and skips linting, while Vercel lints for real. Authoritative run: `$env:ESLINT_USE_FLAT_CONFIG='false'; pnpm exec eslint --no-eslintrc -c .eslintrc.json "src/**/*.ts" "src/**/*.tsx"`.

---

### Task 1: Add the visitorId column

Additive schema change. Nothing reads it yet.

**Files:**
- Modify: `prisma/schema.prisma` (the `AnalyticsEvent` model)
- Create: `prisma/migrations/20260720000000_analytics_visitor_id/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `AnalyticsEvent.visitorId` (nullable text) plus index `AnalyticsEvent_displayId_visitorId_idx`.

- [ ] **Step 1: Edit the Prisma model**

In `prisma/schema.prisma`, inside `model AnalyticsEvent`, add `visitorId` immediately after the existing `sessionId` line:

```prisma
  // Session tracking (anonymous visitor identification)
  sessionId   String?

  // Persistent per-browser id (localStorage). Distinguishes a returning person
  // from a new tab: sessionId is per-tab and dies with it. Null on every event
  // recorded before 2026-07-20 — reads fall back to sessionId for those.
  visitorId   String?
```

Then add the index alongside the existing ones at the bottom of the model:

```prisma
  @@index([displayId])
  @@index([displayId, createdAt])
  @@index([sessionId])
  @@index([displayId, visitorId])
```

- [ ] **Step 2: Hand-author the migration SQL**

Create `prisma/migrations/20260720000000_analytics_visitor_id/migration.sql` with EXACTLY these two statements and nothing else. Do not generate this with `migrate diff --from-url` — on this shared dev database it emits unrelated `DROP TABLE`s for other branches' tables.

```sql
-- Persistent per-browser visitor id. Nullable: pre-existing rows have none.
ALTER TABLE "AnalyticsEvent" ADD COLUMN "visitorId" TEXT;

CREATE INDEX "AnalyticsEvent_displayId_visitorId_idx" ON "AnalyticsEvent"("displayId", "visitorId");
```

- [ ] **Step 3: Apply it and regenerate the client**

Run:

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma migrate deploy
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma generate
```

Expected: migrate reports the new migration applied; generate completes.

If `prisma generate` fails with `EPERM`, a dev server is holding the engine DLL — stop it and retry.

- [ ] **Step 4: Verify there is no schema drift**

Run:

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma migrate status
```

Expected: reports the database is up to date, no pending migrations. Then confirm the client picked up the field:

```bash
pnpm exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260720000000_analytics_visitor_id/
git commit -m "feat(analytics): add visitorId column for persistent visitor identity"
```

---

### Task 2: Validate and persist the visitor id

**Files:**
- Modify: `src/lib/analytics-events.ts` (append)
- Modify: `src/lib/analytics-events.test.ts` (append)
- Modify: `src/app/api/analytics/track/route.ts`

**Interfaces:**
- Consumes: `MAX_METADATA_FIELD_LENGTH` and the module-private `trimmedString` already in `analytics-events.ts`.
- Produces: `parseVisitorId(raw: unknown): string | null`; the track route persisting `visitorId`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/analytics-events.test.ts`:

```ts
describe('parseVisitorId', () => {
  it('accepts a normal id', () => {
    expect(parseVisitorId('vis_abc123')).toBe('vis_abc123')
  })

  it('trims surrounding whitespace', () => {
    expect(parseVisitorId('  vis_abc123  ')).toBe('vis_abc123')
  })

  it('rejects a missing, empty or non-string value', () => {
    expect(parseVisitorId(undefined)).toBeNull()
    expect(parseVisitorId(null)).toBeNull()
    expect(parseVisitorId('')).toBeNull()
    expect(parseVisitorId('   ')).toBeNull()
    expect(parseVisitorId(42)).toBeNull()
    expect(parseVisitorId({ id: 'x' })).toBeNull()
  })

  it('rejects rather than truncates an over-length id', () => {
    expect(parseVisitorId('v'.repeat(64))).toBe('v'.repeat(64))
    expect(parseVisitorId('v'.repeat(65))).toBeNull()
  })
})
```

Add `parseVisitorId` to the existing import at the top of that file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/analytics-events.test.ts`
Expected: FAIL — `parseVisitorId is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/analytics-events.ts`:

```ts
// Persistent per-browser id supplied by the client. Same rejection-not-
// truncation policy as interact metadata: this arrives from a public,
// unauthenticated endpoint.
export function parseVisitorId(raw: unknown): string | null {
  return trimmedString(raw)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/analytics-events.test.ts`
Expected: PASS.

- [ ] **Step 5: Persist it in the track route**

In `src/app/api/analytics/track/route.ts`:

Add `parseVisitorId` to the existing `@/lib/analytics-events` import.

Change the body destructuring line to pull the new field:

```ts
    const { displayId, eventType = 'view', sessionId, visitorId, metadata } = body
```

Immediately before the `// Verify display exists` comment, add:

```ts
    // Absent or malformed ids are simply not recorded — never a 400, since an
    // older client or a browser with localStorage disabled must still be able
    // to send events.
    const storedVisitorId = parseVisitorId(visitorId)
```

Then add the field to the `db.analyticsEvent.create` data object, immediately after `sessionId,`:

```ts
        visitorId: storedVisitorId,
```

- [ ] **Step 6: Verify the route still passes**

Run: `pnpm exec vitest run src/app/api/analytics/track/ && pnpm exec tsc --noEmit`
Expected: all track tests PASS, tsc silent.

- [ ] **Step 7: Commit**

```bash
git add src/lib/analytics-events.ts src/lib/analytics-events.test.ts src/app/api/analytics/track/route.ts
git commit -m "feat(analytics): validate and persist visitorId on tracked events"
```

---

### Task 3: Send the visitor id from the browser

**Files:**
- Modify: `src/lib/analytics.ts`
- Modify: `src/lib/analytics.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every event body sent by `trackPageView` and `trackEvent` carries `visitorId`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/analytics.test.ts`:

```ts
describe('visitor id', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function bodyOf(call: number) {
    return JSON.parse(fetchMock.mock.calls[call][1].body as string)
  }

  it('sends a visitorId with a page view', async () => {
    await trackPageView('disp_1')
    expect(bodyOf(0).visitorId).toMatch(/^vis_/)
  })

  it('reuses the same visitorId across separate events', async () => {
    await trackPageView('disp_1')
    await trackInteraction('disp_1', 'el_1', 'poll', 'vote')
    expect(bodyOf(1).visitorId).toBe(bodyOf(0).visitorId)
  })

  it('persists the visitorId in localStorage so it survives a new session', async () => {
    await trackPageView('disp_1')
    const stored = localStorage.getItem('galli_visitor_id')
    expect(stored).toBe(bodyOf(0).visitorId)

    // A new tab clears sessionStorage but not localStorage.
    sessionStorage.clear()
    await trackPageView('disp_1')
    expect(bodyOf(1).visitorId).toBe(stored)
    expect(bodyOf(1).sessionId).not.toBe(bodyOf(0).sessionId)
  })

  it('still sends the event when localStorage throws', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    await trackPageView('disp_1')
    expect(fetchMock).toHaveBeenCalled()
    spy.mockRestore()
  })
})
```

Add `trackPageView` and `trackInteraction` to the existing import at the top of that file if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/analytics.test.ts`
Expected: FAIL — `visitorId` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/analytics.ts`, add this helper directly below the existing `getSessionId` function:

```ts
// Persistent per-browser id. Unlike the session id (sessionStorage, dies with
// the tab) this survives across visits, which is what makes "returning
// visitor" answerable. Opaque random value — no PII.
// Wrapped in try/catch because localStorage throws in some privacy modes;
// analytics must never break the page.
function getVisitorId(): string {
  if (typeof window === 'undefined') return ''

  try {
    let visitorId = localStorage.getItem('galli_visitor_id')
    if (!visitorId) {
      visitorId = `vis_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      localStorage.setItem('galli_visitor_id', visitorId)
    }
    return visitorId
  } catch {
    return ''
  }
}
```

Then in `trackPageView`, change the body to include it:

```ts
      body: JSON.stringify({
        displayId,
        eventType: 'view',
        sessionId,
        visitorId: getVisitorId(),
      }),
```

And in `trackEvent`, likewise:

```ts
      body: JSON.stringify({
        displayId,
        eventType,
        sessionId,
        visitorId: getVisitorId(),
        metadata,
      }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/analytics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics.ts src/lib/analytics.test.ts
git commit -m "feat(analytics): persist and send a per-browser visitor id"
```

---

### Task 4: Session statistics and the new-vs-returning split

Pure module, first half. No I/O, no framework imports — imported by both a server route and client components.

**Files:**
- Create: `src/lib/data-audience.ts`
- Test: `src/lib/data-audience.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `AudienceEvent { sessionId: string | null; visitorId: string | null; at: string }`
  - `SessionStats { avgSessionSeconds: number | null; bounceRate: number; measuredSessions: number }`
  - `sessionStats(events: AudienceEvent[]): SessionStats`
  - `identityKey(event: AudienceEvent): string | null`
  - `visitorSplit(current: AudienceEvent[], priorKeys: Set<string>): { visitors: number; newVisitors: number; returningVisitors: number }`

`avgSessionSeconds` is `null`, not `0`, when nothing is measurable. Single-event sessions count toward `bounceRate` but are excluded from the average — averaging in zeros would report a duration no visitor experienced and would fall as bounces rise, collapsing two independent signals into one misleading number.

- [ ] **Step 1: Write the failing test**

Create `src/lib/data-audience.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  identityKey,
  sessionStats,
  visitorSplit,
  type AudienceEvent,
} from './data-audience'

const ev = (sessionId: string | null, at: string, visitorId: string | null = null): AudienceEvent =>
  ({ sessionId, visitorId, at })

describe('sessionStats', () => {
  it('measures a session as last minus first event', () => {
    const out = sessionStats([
      ev('s1', '2026-07-20T10:00:00Z'),
      ev('s1', '2026-07-20T10:02:30Z'),
    ])
    expect(out.avgSessionSeconds).toBe(150)
    expect(out.measuredSessions).toBe(1)
  })

  it('does not assume events arrive in order', () => {
    const out = sessionStats([
      ev('s1', '2026-07-20T10:02:30Z'),
      ev('s1', '2026-07-20T10:00:00Z'),
    ])
    expect(out.avgSessionSeconds).toBe(150)
  })

  it('averages across sessions, excluding single-event ones', () => {
    const out = sessionStats([
      ev('s1', '2026-07-20T10:00:00Z'),
      ev('s1', '2026-07-20T10:00:10Z'),
      ev('s2', '2026-07-20T11:00:00Z'),
      ev('s2', '2026-07-20T11:00:30Z'),
      ev('s3', '2026-07-20T12:00:00Z'),
    ])
    // (10 + 30) / 2 measured sessions — s3 excluded, not averaged in as zero
    expect(out.avgSessionSeconds).toBe(20)
    expect(out.measuredSessions).toBe(2)
  })

  it('counts single-event sessions as bounces', () => {
    const out = sessionStats([
      ev('s1', '2026-07-20T10:00:00Z'),
      ev('s1', '2026-07-20T10:00:10Z'),
      ev('s2', '2026-07-20T12:00:00Z'),
    ])
    expect(out.bounceRate).toBeCloseTo(50)
  })

  it('returns null duration when no session has two events', () => {
    const out = sessionStats([ev('s1', '2026-07-20T10:00:00Z')])
    expect(out.avgSessionSeconds).toBeNull()
    expect(out.measuredSessions).toBe(0)
    expect(out.bounceRate).toBe(100)
  })

  it('handles no events without dividing by zero', () => {
    const out = sessionStats([])
    expect(out.avgSessionSeconds).toBeNull()
    expect(out.bounceRate).toBe(0)
    expect(out.measuredSessions).toBe(0)
  })

  it('ignores events with no session id', () => {
    const out = sessionStats([ev(null, '2026-07-20T10:00:00Z'), ev(null, '2026-07-20T10:05:00Z')])
    expect(out.avgSessionSeconds).toBeNull()
    expect(out.bounceRate).toBe(0)
  })
})

describe('identityKey', () => {
  it('prefers visitorId', () => {
    expect(identityKey(ev('s1', '2026-07-20T10:00:00Z', 'v1'))).toBe('v:v1')
  })

  it('falls back to sessionId for pre-visitorId events', () => {
    expect(identityKey(ev('s1', '2026-07-20T10:00:00Z', null))).toBe('s:s1')
  })

  it('returns null when neither is present', () => {
    expect(identityKey(ev(null, '2026-07-20T10:00:00Z', null))).toBeNull()
  })

  it('never collides a visitor id with an identical session id', () => {
    expect(identityKey(ev('x', '2026-07-20T10:00:00Z', null)))
      .not.toBe(identityKey(ev(null, '2026-07-20T10:00:00Z', 'x')))
  })
})

describe('visitorSplit', () => {
  it('counts a visitor seen before the window as returning', () => {
    const out = visitorSplit(
      [ev('s1', '2026-07-20T10:00:00Z', 'v1'), ev('s2', '2026-07-20T11:00:00Z', 'v2')],
      new Set(['v:v1'])
    )
    expect(out).toEqual({ visitors: 2, newVisitors: 1, returningVisitors: 1 })
  })

  it('deduplicates a visitor appearing many times in the window', () => {
    const out = visitorSplit(
      [
        ev('s1', '2026-07-20T10:00:00Z', 'v1'),
        ev('s2', '2026-07-20T11:00:00Z', 'v1'),
        ev('s3', '2026-07-20T12:00:00Z', 'v1'),
      ],
      new Set()
    )
    expect(out).toEqual({ visitors: 1, newVisitors: 1, returningVisitors: 0 })
  })

  it('counts everyone as new when there is no prior history', () => {
    const out = visitorSplit([ev('s1', '2026-07-20T10:00:00Z', 'v1')], new Set())
    expect(out).toEqual({ visitors: 1, newVisitors: 1, returningVisitors: 0 })
  })

  it('ignores events with no usable identity', () => {
    const out = visitorSplit([ev(null, '2026-07-20T10:00:00Z', null)], new Set())
    expect(out).toEqual({ visitors: 0, newVisitors: 0, returningVisitors: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/data-audience.test.ts`
Expected: FAIL — `Failed to resolve import "./data-audience"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/data-audience.ts`:

```ts
// Pure audience aggregation. No I/O, no database, no framework imports — this
// module is consumed by both an API route and client components.

export interface AudienceEvent {
  sessionId: string | null
  visitorId: string | null
  at: string
}

export interface SessionStats {
  // null (not 0) when no session had two or more events, so the UI can show an
  // empty state rather than claim an average of zero.
  avgSessionSeconds: number | null
  bounceRate: number
  measuredSessions: number
}

// A stable identity for one person. Prefers the persistent visitor id; falls
// back to the per-tab session id for events recorded before visitorId existed
// (which overcounts, and the UI discloses that). Prefixed so a visitor id can
// never collide with an identical session id.
export function identityKey(event: AudienceEvent): string | null {
  if (event.visitorId) return `v:${event.visitorId}`
  if (event.sessionId) return `s:${event.sessionId}`
  return null
}

export function sessionStats(events: AudienceEvent[]): SessionStats {
  const bySession = new Map<string, number[]>()
  for (const event of events) {
    if (!event.sessionId) continue
    const time = new Date(event.at).getTime()
    if (Number.isNaN(time)) continue
    const bucket = bySession.get(event.sessionId) ?? []
    bucket.push(time)
    bySession.set(event.sessionId, bucket)
  }

  if (bySession.size === 0) {
    return { avgSessionSeconds: null, bounceRate: 0, measuredSessions: 0 }
  }

  let bounces = 0
  let totalSeconds = 0
  let measuredSessions = 0

  for (const times of bySession.values()) {
    if (times.length < 2) {
      bounces += 1
      continue
    }
    // Do not assume arrival order.
    totalSeconds += (Math.max(...times) - Math.min(...times)) / 1000
    measuredSessions += 1
  }

  return {
    avgSessionSeconds: measuredSessions > 0 ? totalSeconds / measuredSessions : null,
    bounceRate: (bounces / bySession.size) * 100,
    measuredSessions,
  }
}

export function visitorSplit(
  current: AudienceEvent[],
  priorKeys: Set<string>
): { visitors: number; newVisitors: number; returningVisitors: number } {
  const keys = new Set<string>()
  for (const event of current) {
    const key = identityKey(event)
    if (key) keys.add(key)
  }

  let returningVisitors = 0
  for (const key of keys) {
    if (priorKeys.has(key)) returningVisitors += 1
  }

  return {
    visitors: keys.size,
    newVisitors: keys.size - returningVisitors,
    returningVisitors,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/data-audience.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-audience.ts src/lib/data-audience.test.ts
git commit -m "feat(data): session stats and new-vs-returning visitor split"
```

---

### Task 5: Peak hours, source classification and country labels

Pure module, second half. Same file as Task 4.

**Files:**
- Modify: `src/lib/data-audience.ts` (append)
- Modify: `src/lib/data-audience.test.ts` (append)

**Interfaces:**
- Consumes: nothing from Task 4.
- Produces:
  - `peakHours(hourCountsUtc: number[], utcOffsetMinutes: number): number[]` — 24 local buckets
  - `SourceCategory = 'search' | 'social' | 'direct' | 'community' | 'referral'`
  - `classifySource(referrer: string | null, utmSource: string | null, ownHost: string): SourceCategory`
  - `SOURCE_LABELS: Record<SourceCategory, string>`
  - `countryLabel(code: string): { flag: string; name: string }`

`utcOffsetMinutes` is exactly what `Date.prototype.getTimezoneOffset()` returns: **minutes behind UTC**, so UTC−5 is `300`. Sub-hour zones round to the nearest hour.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/data-audience.test.ts`. **Do not add a second `import` statement from
`./data-audience`** — extend the existing one at the top of the file to also pull in
`classifySource`, `countryLabel`, `peakHours` and `SOURCE_LABELS`, so the file keeps a single import
from that module.

```ts
describe('peakHours', () => {
  const counts = (pairs: Record<number, number>) =>
    Array.from({ length: 24 }, (_, h) => pairs[h] ?? 0)

  it('returns the input unchanged at UTC', () => {
    const input = counts({ 9: 5 })
    expect(peakHours(input, 0)[9]).toBe(5)
  })

  it('shifts back for a western offset (UTC-5, getTimezoneOffset 300)', () => {
    // 14:00 UTC is 09:00 local
    expect(peakHours(counts({ 14: 7 }), 300)[9]).toBe(7)
  })

  it('shifts forward for an eastern offset (UTC+2, getTimezoneOffset -120)', () => {
    // 08:00 UTC is 10:00 local
    expect(peakHours(counts({ 8: 3 }), -120)[10]).toBe(3)
  })

  it('wraps across midnight in both directions', () => {
    // 02:00 UTC at UTC-5 is 21:00 the previous day
    expect(peakHours(counts({ 2: 4 }), 300)[21]).toBe(4)
    // 23:00 UTC at UTC+2 is 01:00 the next day
    expect(peakHours(counts({ 23: 6 }), -120)[1]).toBe(6)
  })

  it('rounds a sub-hour offset to the nearest hour (UTC+5:30)', () => {
    // getTimezoneOffset for UTC+5:30 is -330 -> rounds to +6
    expect(peakHours(counts({ 0: 2 }), -330)[6]).toBe(2)
  })

  it('always returns 24 buckets preserving the total', () => {
    const out = peakHours(counts({ 3: 1, 15: 2 }), 300)
    expect(out).toHaveLength(24)
    expect(out.reduce((a, b) => a + b, 0)).toBe(3)
  })
})

describe('classifySource', () => {
  const own = 'mygalli.com'

  it('treats a missing referrer as direct', () => {
    expect(classifySource(null, null, own)).toBe('direct')
    expect(classifySource('', null, own)).toBe('direct')
  })

  it('recognises search engines', () => {
    expect(classifySource('https://www.google.com/search?q=x', null, own)).toBe('search')
    expect(classifySource('https://duckduckgo.com/', null, own)).toBe('search')
    expect(classifySource('https://www.bing.com/', null, own)).toBe('search')
  })

  it('recognises social networks', () => {
    expect(classifySource('https://instagram.com/p/1', null, own)).toBe('social')
    expect(classifySource('https://www.tiktok.com/@a', null, own)).toBe('social')
    expect(classifySource('https://t.co/abc', null, own)).toBe('social')
  })

  it('treats our own host as community traffic', () => {
    expect(classifySource('https://mygalli.com/explore', null, own)).toBe('community')
  })

  it('falls back to referral for an unknown host', () => {
    expect(classifySource('https://some-blog.example/post', null, own)).toBe('referral')
  })

  it('lets an explicit utm_source override the referrer', () => {
    expect(classifySource('https://some-blog.example/post', 'instagram', own)).toBe('social')
    expect(classifySource(null, 'google', own)).toBe('search')
  })

  it('treats a malformed referrer as direct rather than throwing', () => {
    expect(classifySource('not a url', null, own)).toBe('direct')
  })

  it('matches subdomains of a known host', () => {
    expect(classifySource('https://m.facebook.com/x', null, own)).toBe('social')
  })

  it('has a label for every category', () => {
    for (const category of ['search', 'social', 'direct', 'community', 'referral'] as const) {
      expect(SOURCE_LABELS[category]).toBeTruthy()
    }
  })
})

describe('countryLabel', () => {
  it('builds a flag emoji from the ISO code', () => {
    expect(countryLabel('US').flag).toBe('🇺🇸')
    expect(countryLabel('JP').flag).toBe('🇯🇵')
  })

  it('names known countries', () => {
    expect(countryLabel('GB').name).toBe('United Kingdom')
  })

  it('falls back to the raw code for an unmapped country', () => {
    expect(countryLabel('ZZ').name).toBe('ZZ')
  })

  it('is case insensitive', () => {
    expect(countryLabel('us').flag).toBe('🇺🇸')
    expect(countryLabel('us').name).toBe('United States')
  })

  it('degrades gracefully on a malformed code', () => {
    const out = countryLabel('XYZ')
    expect(out.name).toBe('XYZ')
    expect(typeof out.flag).toBe('string')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/data-audience.test.ts`
Expected: FAIL — `peakHours` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/data-audience.ts`:

```ts
// `utcOffsetMinutes` is Date.prototype.getTimezoneOffset(): minutes BEHIND UTC,
// so UTC-5 is +300. Zones with a sub-hour offset round to the nearest hour.
export function peakHours(hourCountsUtc: number[], utcOffsetMinutes: number): number[] {
  const shift = Math.round(-utcOffsetMinutes / 60)
  const local = new Array<number>(24).fill(0)
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    const localHour = (((utcHour + shift) % 24) + 24) % 24
    local[localHour] += hourCountsUtc[utcHour] ?? 0
  }
  return local
}

export type SourceCategory = 'search' | 'social' | 'direct' | 'community' | 'referral'

export const SOURCE_LABELS: Record<SourceCategory, string> = {
  search: 'Search',
  social: 'Social',
  direct: 'Direct',
  community: 'Galli community',
  referral: 'Other sites',
}

const SEARCH_HOSTS = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.', 'brave.']
const SOCIAL_HOSTS = [
  'instagram.', 'tiktok.', 'facebook.', 'twitter.', 'x.com', 't.co',
  'linkedin.', 'pinterest.', 'reddit.', 'youtube.', 'threads.',
]

function matchesHost(host: string, needles: string[]): boolean {
  return needles.some((needle) => host === needle || host.includes(needle))
}

export function classifySource(
  referrer: string | null,
  utmSource: string | null,
  ownHost: string
): SourceCategory {
  // An explicit campaign tag is more trustworthy than the referrer header.
  const utm = utmSource?.trim().toLowerCase()
  if (utm) {
    if (matchesHost(utm, SEARCH_HOSTS.map((h) => h.replace('.', '')))) return 'search'
    if (matchesHost(utm, SOCIAL_HOSTS.map((h) => h.replace('.', '')))) return 'social'
  }

  if (!referrer) return 'direct'

  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase()
  } catch {
    // A referrer we cannot parse tells us nothing; do not invent a source.
    return 'direct'
  }

  if (host === ownHost.toLowerCase() || host.endsWith(`.${ownHost.toLowerCase()}`)) return 'community'
  if (matchesHost(host, SEARCH_HOSTS)) return 'search'
  if (matchesHost(host, SOCIAL_HOSTS)) return 'social'
  return 'referral'
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', DE: 'Germany', FR: 'France',
  CA: 'Canada', AU: 'Australia', JP: 'Japan', BR: 'Brazil', IN: 'India',
  NL: 'Netherlands', ES: 'Spain', IT: 'Italy', SE: 'Sweden', MX: 'Mexico',
  KR: 'South Korea', IE: 'Ireland', NZ: 'New Zealand', ZA: 'South Africa',
  NG: 'Nigeria', PL: 'Poland', PT: 'Portugal', NO: 'Norway', DK: 'Denmark',
  FI: 'Finland', CH: 'Switzerland', AT: 'Austria', BE: 'Belgium', SG: 'Singapore',
}

// Regional-indicator symbols: 'US' -> 🇺🇸. Only well-formed two-letter codes
// produce a flag; anything else renders a globe so the row never looks broken.
export function countryLabel(code: string): { flag: string; name: string } {
  const upper = (code ?? '').trim().toUpperCase()
  const name = COUNTRY_NAMES[upper] ?? upper

  if (!/^[A-Z]{2}$/.test(upper)) return { flag: '🌐', name }

  const flag = String.fromCodePoint(
    ...Array.from(upper).map((ch) => 0x1f1e6 + (ch.charCodeAt(0) - 65))
  )
  return { flag, name }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/data-audience.test.ts`
Expected: PASS, all tests from Tasks 4 and 5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-audience.ts src/lib/data-audience.test.ts
git commit -m "feat(data): peak hours, source classification and country labels"
```

---

### Task 6: The Audience API route

**Files:**
- Create: `src/app/api/analytics/[displayId]/audience/aggregate.ts`
- Create: `src/app/api/analytics/[displayId]/audience/route.ts`
- Test: `src/app/api/analytics/[displayId]/audience/aggregate.test.ts`

**Interfaces:**
- Consumes: `sessionStats`, `visitorSplit`, `identityKey`, `classifySource`, `AudienceEvent` (Tasks 4–5).
- Produces: `buildAudience(input: AudienceInput): AudienceResult` from `aggregate.ts`, and `GET /api/analytics/[displayId]/audience?days=N`.

**The route file must export ONLY `GET`.** All logic lives in `aggregate.ts`. Exporting a helper from `route.ts` fails `next build` in a way `tsc` cannot detect.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/analytics/[displayId]/audience/aggregate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildAudience, type AudienceInput } from './aggregate'

const base = (): AudienceInput => ({
  ownHost: 'mygalli.com',
  events: [
    { sessionId: 's1', visitorId: 'v1', country: 'US', referrer: 'https://google.com/', utmSource: null, deviceType: 'desktop', browser: 'chrome', createdAt: new Date('2026-07-20T14:00:00Z') },
    { sessionId: 's1', visitorId: 'v1', country: 'US', referrer: 'https://google.com/', utmSource: null, deviceType: 'desktop', browser: 'chrome', createdAt: new Date('2026-07-20T14:01:00Z') },
    { sessionId: 's2', visitorId: 'v2', country: 'DE', referrer: null, utmSource: null, deviceType: 'mobile', browser: 'safari', createdAt: new Date('2026-07-20T09:00:00Z') },
  ],
  priorKeys: new Set(['v:v1']),
})

describe('buildAudience', () => {
  it('summarises visitors, sessions and returning split', () => {
    const out = buildAudience(base())
    expect(out.summary.visitors).toBe(2)
    expect(out.summary.sessions).toBe(2)
    expect(out.summary.returningVisitors).toBe(1)
    expect(out.summary.newVisitors).toBe(1)
  })

  it('reports average session length and bounce rate', () => {
    const out = buildAudience(base())
    expect(out.summary.avgSessionSeconds).toBe(60)
    expect(out.summary.bounceRate).toBeCloseTo(50)
  })

  it('flags the identity fallback only when an event lacks a visitorId', () => {
    expect(buildAudience(base()).identityFallback).toBe(false)

    const legacy = base()
    legacy.events[0].visitorId = null
    expect(buildAudience(legacy).identityFallback).toBe(true)
  })

  it('buckets events into 24 UTC hours', () => {
    const out = buildAudience(base())
    expect(out.hourCountsUtc).toHaveLength(24)
    expect(out.hourCountsUtc[14]).toBe(2)
    expect(out.hourCountsUtc[9]).toBe(1)
  })

  it('ranks geography and reports how many events had no country', () => {
    const input = base()
    input.events.push({ ...input.events[2], country: null, sessionId: 's3', visitorId: 'v3' })
    const out = buildAudience(input)
    expect(out.geography[0]).toEqual({ country: 'US', count: 2 })
    expect(out.unknownCountryEvents).toBe(1)
  })

  it('classifies sources', () => {
    const out = buildAudience(base())
    const search = out.sources.find((s) => s.source === 'search')
    const direct = out.sources.find((s) => s.source === 'direct')
    expect(search?.count).toBe(2)
    expect(direct?.count).toBe(1)
  })

  it('counts devices and browsers', () => {
    const out = buildAudience(base())
    expect(out.devices).toEqual({ desktop: 2, mobile: 1 })
    expect(out.browsers).toEqual({ chrome: 2, safari: 1 })
  })

  it('handles an empty window without dividing by zero', () => {
    const out = buildAudience({ ownHost: 'mygalli.com', events: [], priorKeys: new Set() })
    expect(out.summary.visitors).toBe(0)
    expect(out.summary.avgSessionSeconds).toBeNull()
    expect(out.geography).toEqual([])
    expect(out.hourCountsUtc).toHaveLength(24)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "src/app/api/analytics/[displayId]/audience/aggregate.test.ts"`
Expected: FAIL — cannot resolve `./aggregate`.

- [ ] **Step 3: Write the aggregator**

Create `src/app/api/analytics/[displayId]/audience/aggregate.ts`:

```ts
import {
  classifySource,
  identityKey,
  sessionStats,
  visitorSplit,
  type AudienceEvent,
  type SourceCategory,
} from '@/lib/data-audience'

export interface AudienceRow {
  sessionId: string | null
  visitorId: string | null
  country: string | null
  referrer: string | null
  utmSource: string | null
  deviceType: string | null
  browser: string | null
  createdAt: Date
}

export interface AudienceInput {
  events: AudienceRow[]
  priorKeys: Set<string>
  ownHost: string
}

export interface AudienceResult {
  summary: {
    visitors: number
    sessions: number
    newVisitors: number
    returningVisitors: number
    avgSessionSeconds: number | null
    bounceRate: number
    measuredSessions: number
  }
  identityFallback: boolean
  hourCountsUtc: number[]
  geography: { country: string; count: number }[]
  unknownCountryEvents: number
  sources: { source: SourceCategory; count: number }[]
  devices: Record<string, number>
  browsers: Record<string, number>
}

function tally(map: Map<string, number>, key: string | null) {
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + 1)
}

export function buildAudience(input: AudienceInput): AudienceResult {
  const audienceEvents: AudienceEvent[] = input.events.map((e) => ({
    sessionId: e.sessionId,
    visitorId: e.visitorId,
    at: e.createdAt.toISOString(),
  }))

  const stats = sessionStats(audienceEvents)
  const split = visitorSplit(audienceEvents, input.priorKeys)

  const hourCountsUtc = new Array<number>(24).fill(0)
  const countries = new Map<string, number>()
  const sources = new Map<string, number>()
  const devices = new Map<string, number>()
  const browsers = new Map<string, number>()
  const sessions = new Set<string>()
  let unknownCountryEvents = 0
  let identityFallback = false

  for (const event of input.events) {
    hourCountsUtc[event.createdAt.getUTCHours()] += 1

    if (event.country) tally(countries, event.country)
    else unknownCountryEvents += 1

    tally(sources, classifySource(event.referrer, event.utmSource, input.ownHost))
    tally(devices, event.deviceType)
    tally(browsers, event.browser)

    if (event.sessionId) sessions.add(event.sessionId)
    if (!event.visitorId) identityFallback = true
  }

  return {
    summary: {
      visitors: split.visitors,
      sessions: sessions.size,
      newVisitors: split.newVisitors,
      returningVisitors: split.returningVisitors,
      avgSessionSeconds: stats.avgSessionSeconds,
      bounceRate: stats.bounceRate,
      measuredSessions: stats.measuredSessions,
    },
    identityFallback,
    hourCountsUtc,
    geography: Array.from(countries.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count),
    unknownCountryEvents,
    sources: Array.from(sources.entries())
      .map(([source, count]) => ({ source: source as SourceCategory, count }))
      .sort((a, b) => b.count - a.count),
    devices: Object.fromEntries(devices),
    browsers: Object.fromEntries(browsers),
  }
}

// Exported for the route: identity keys of everyone seen before the window.
export function priorKeysFrom(rows: { sessionId: string | null; visitorId: string | null }[]): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    const key = identityKey({ sessionId: row.sessionId, visitorId: row.visitorId, at: '' })
    if (key) keys.add(key)
  }
  return keys
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run "src/app/api/analytics/[displayId]/audience/aggregate.test.ts"`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the route**

Create `src/app/api/analytics/[displayId]/audience/route.ts`. It exports `GET` and nothing else:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { buildAudience, priorKeysFrom } from './aggregate'

interface Props {
  params: Promise<{ displayId: string }>
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { displayId } = await params

    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const display = await db.display.findUnique({
      where: { id: displayId },
      select: { id: true, userId: true },
    })

    if (!display) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }
    if (display.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const parsedDays = parseInt(url.searchParams.get('days') || '30', 10)
    const days = Number.isFinite(parsedDays) && parsedDays > 0 && parsedDays <= 365 ? parsedDays : 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const [events, priorRows] = await Promise.all([
      db.analyticsEvent.findMany({
        where: { displayId, createdAt: { gte: startDate } },
        select: {
          sessionId: true, visitorId: true, country: true, referrer: true,
          utmSource: true, deviceType: true, browser: true, createdAt: true,
        },
      }),
      // Identities seen before the window define who counts as "returning".
      db.analyticsEvent.findMany({
        where: { displayId, createdAt: { lt: startDate } },
        select: { sessionId: true, visitorId: true },
        distinct: ['visitorId', 'sessionId'],
        take: 10000,
      }),
    ])

    const ownHost = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://mygalli.com').hostname

    return NextResponse.json(
      buildAudience({ events, priorKeys: priorKeysFrom(priorRows), ownHost })
    )
  } catch (error) {
    console.error('Audience fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch audience' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Verify the build accepts the route**

Run: `pnpm exec tsc --noEmit && pnpm exec next build`
Expected: tsc silent; build reports `✓ Compiled successfully` and completes with exit code 0. If the build fails with `not assignable to type 'never'`, something other than `GET` is exported from `route.ts` — move it to `aggregate.ts`.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/analytics/[displayId]/audience/"
git commit -m "feat(api): audience analytics route"
```

---

### Task 7: Headline row and peak hours chart

**Files:**
- Create: `src/components/analytics/audience/AudienceHeadline.tsx`
- Create: `src/components/analytics/audience/PeakHoursChart.tsx`
- Test: `src/components/analytics/audience/AudienceHeadline.test.tsx`

**Interfaces:**
- Consumes: `peakHours` from `@/lib/data-audience`; `AudienceResult['summary']` shape from Task 6.
- Produces:
  - `AudienceHeadline({ summary, identityFallback })`
  - `PeakHoursChart({ hourCountsUtc })`

Both are client components (`'use client'`).

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/audience/AudienceHeadline.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AudienceHeadline } from './AudienceHeadline'
import { PeakHoursChart } from './PeakHoursChart'

const summary = {
  visitors: 412, sessions: 587, newVisitors: 255, returningVisitors: 157,
  avgSessionSeconds: 154, bounceRate: 43.2, measuredSessions: 300,
}

describe('AudienceHeadline', () => {
  it('shows visitors and sessions as distinct numbers', () => {
    render(<AudienceHeadline summary={summary} identityFallback={false} />)
    expect(screen.getByText('412')).toBeTruthy()
    expect(screen.getByText('587')).toBeTruthy()
  })

  it('formats the average session as minutes and seconds with its sample size', () => {
    render(<AudienceHeadline summary={summary} identityFallback={false} />)
    expect(screen.getByText('2m 34s')).toBeTruthy()
    expect(screen.getByText(/over 300 sessions/i)).toBeTruthy()
  })

  it('shows a dash rather than 0s when no session was measurable', () => {
    render(
      <AudienceHeadline
        summary={{ ...summary, avgSessionSeconds: null, measuredSessions: 0 }}
        identityFallback={false}
      />
    )
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.queryByText('0s')).toBeNull()
  })

  it('shows the returning share', () => {
    render(<AudienceHeadline summary={summary} identityFallback={false} />)
    expect(screen.getByText('38.1%')).toBeTruthy()
  })

  it('discloses the identity fallback only when it applies', () => {
    const { rerender } = render(<AudienceHeadline summary={summary} identityFallback={false} />)
    expect(screen.queryByText(/overcount/i)).toBeNull()

    rerender(<AudienceHeadline summary={summary} identityFallback />)
    expect(screen.getByText(/overcount/i)).toBeTruthy()
  })
})

describe('PeakHoursChart', () => {
  it('renders 24 bars and labels the busiest hour', () => {
    const counts = Array.from({ length: 24 }, (_, h) => (h === 18 ? 40 : 1))
    const { container } = render(<PeakHoursChart hourCountsUtc={counts} />)
    expect(container.querySelectorAll('[data-hour]')).toHaveLength(24)
    expect(screen.getByText(/peak/i)).toBeTruthy()
  })

  it('shows an empty state when there is no traffic', () => {
    render(<PeakHoursChart hourCountsUtc={new Array(24).fill(0)} />)
    expect(screen.getByText(/No traffic yet/i)).toBeTruthy()
  })

  it('states which timezone the chart is drawn in', () => {
    const counts = Array.from({ length: 24 }, () => 1)
    render(<PeakHoursChart hourCountsUtc={counts} />)
    expect(screen.getByText(/your time/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/analytics/audience/AudienceHeadline.test.tsx`
Expected: FAIL — cannot resolve `./AudienceHeadline`.

- [ ] **Step 3: Write the components**

Create `src/components/analytics/audience/AudienceHeadline.tsx`:

```tsx
'use client'

import { Users, MousePointerClick, UserPlus, Repeat, Timer, LogOut } from 'lucide-react'

export interface AudienceSummary {
  visitors: number
  sessions: number
  newVisitors: number
  returningVisitors: number
  avgSessionSeconds: number | null
  bounceRate: number
  measuredSessions: number
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  const rest = rounded % 60
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`
}

export function AudienceHeadline({
  summary,
  identityFallback,
}: {
  summary: AudienceSummary
  identityFallback: boolean
}) {
  const returningShare =
    summary.visitors > 0 ? (summary.returningVisitors / summary.visitors) * 100 : 0

  const cards = [
    { key: 'visitors', label: 'Visitors', icon: Users, value: summary.visitors.toLocaleString(), sub: 'people' },
    { key: 'sessions', label: 'Sessions', icon: MousePointerClick, value: summary.sessions.toLocaleString(), sub: 'visits' },
    { key: 'new', label: 'New', icon: UserPlus, value: summary.newVisitors.toLocaleString(), sub: 'first time here' },
    { key: 'returning', label: 'Returning', icon: Repeat, value: `${returningShare.toFixed(1)}%`, sub: `${summary.returningVisitors.toLocaleString()} came back` },
    { key: 'avg', label: 'Avg session', icon: Timer, value: formatDuration(summary.avgSessionSeconds), sub: summary.measuredSessions > 0 ? `over ${summary.measuredSessions.toLocaleString()} sessions` : 'not enough data' },
    { key: 'bounce', label: 'Bounce rate', icon: LogOut, value: `${summary.bounceRate.toFixed(0)}%`, sub: 'left after one action' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ key, label, icon: Icon, value, sub }) => (
          <div key={key} className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-galli/10 text-galli">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {identityFallback && (
        <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Some visits in this range were recorded before we could tell repeat visitors apart. Those
          count each visit separately, so the visitor numbers above overcount slightly.
        </p>
      )}
    </div>
  )
}
```

Create `src/components/analytics/audience/PeakHoursChart.tsx`:

```tsx
'use client'

import { Clock } from 'lucide-react'
import { peakHours } from '@/lib/data-audience'
import { DataIllustration } from '@/components/analytics/DataIllustration'

function formatHour(hour: number): string {
  if (hour === 0) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

export function PeakHoursChart({ hourCountsUtc }: { hourCountsUtc: number[] }) {
  // Drawn in the viewer's own timezone: "most active at 6pm" is only actionable
  // if 6pm means 6pm where the owner is.
  const local = peakHours(hourCountsUtc, new Date().getTimezoneOffset())
  const total = local.reduce((sum, n) => sum + n, 0)
  const max = Math.max(...local, 1)
  const peak = local.indexOf(Math.max(...local))

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Peak Hours</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Shown in your time</p>

      {total === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="activity" />
          <p className="mt-3 text-sm font-medium">No traffic yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once visits come in, the hours your audience is most active appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex h-32 items-end gap-1">
            {local.map((count, hour) => (
              <div
                key={hour}
                data-hour={hour}
                title={`${formatHour(hour)} — ${count}`}
                className={`flex-1 rounded-t ${hour === peak ? 'bg-galli' : 'bg-galli/30'}`}
                style={{ height: `${Math.max((count / max) * 100, 2)}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
          </div>
          <p className="mt-3 text-sm">
            <span className="font-semibold text-galli">Peak</span>{' '}
            <span className="text-muted-foreground">around {formatHour(peak)}</span>
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/analytics/audience/AudienceHeadline.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/audience/
git commit -m "feat(data): audience headline row and peak hours chart"
```

---

### Task 8: Geography and Sources panels

**Files:**
- Create: `src/components/analytics/audience/GeographyList.tsx`
- Create: `src/components/analytics/audience/SourcesBreakdown.tsx`
- Test: `src/components/analytics/audience/panels.test.tsx`

**Interfaces:**
- Consumes: `countryLabel`, `SOURCE_LABELS`, `SourceCategory` from `@/lib/data-audience`.
- Produces:
  - `GeographyList({ geography, unknownCountryEvents })`
  - `SourcesBreakdown({ sources })`

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/audience/panels.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GeographyList } from './GeographyList'
import { SourcesBreakdown } from './SourcesBreakdown'

describe('GeographyList', () => {
  const geography = [
    { country: 'US', count: 62 },
    { country: 'CA', count: 18 },
  ]

  it('names countries and shows their share of located visits', () => {
    render(<GeographyList geography={geography} unknownCountryEvents={0} />)
    expect(screen.getByText('United States')).toBeTruthy()
    expect(screen.getByText('78%')).toBeTruthy()
  })

  it('discloses how many events had no country', () => {
    render(<GeographyList geography={geography} unknownCountryEvents={5} />)
    expect(screen.getByText(/5 visits/i)).toBeTruthy()
  })

  it('says nothing about unknowns when there are none', () => {
    render(<GeographyList geography={geography} unknownCountryEvents={0} />)
    expect(screen.queryByText(/couldn't be located/i)).toBeNull()
  })

  it('shows an empty state with no located visits', () => {
    render(<GeographyList geography={[]} unknownCountryEvents={0} />)
    expect(screen.getByText(/No location data yet/i)).toBeTruthy()
  })

  it('never renders NaN when counts are all zero', () => {
    const { container } = render(
      <GeographyList geography={[{ country: 'US', count: 0 }]} unknownCountryEvents={0} />
    )
    expect(container.textContent).not.toMatch(/NaN/)
  })
})

describe('SourcesBreakdown', () => {
  it('labels each source category with its share', () => {
    render(
      <SourcesBreakdown
        sources={[
          { source: 'search', count: 30 },
          { source: 'direct', count: 10 },
        ]}
      />
    )
    expect(screen.getByText('Search')).toBeTruthy()
    expect(screen.getByText('75%')).toBeTruthy()
  })

  it('shows an empty state with no sources', () => {
    render(<SourcesBreakdown sources={[]} />)
    expect(screen.getByText(/No traffic sources yet/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/analytics/audience/panels.test.tsx`
Expected: FAIL — cannot resolve `./GeographyList`.

- [ ] **Step 3: Write the components**

Create `src/components/analytics/audience/GeographyList.tsx`:

```tsx
'use client'

import { Globe2 } from 'lucide-react'
import { countryLabel } from '@/lib/data-audience'
import { DataIllustration } from '@/components/analytics/DataIllustration'

export function GeographyList({
  geography,
  unknownCountryEvents,
}: {
  geography: { country: string; count: number }[]
  unknownCountryEvents: number
}) {
  const total = geography.reduce((sum, row) => sum + row.count, 0)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Globe2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Geography</h3>
      </div>

      {geography.length === 0 || total === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="referrer" />
          <p className="mt-3 text-sm font-medium">No location data yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Visitor countries appear here as traffic comes in.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {geography.slice(0, 10).map((row) => {
              const { flag, name } = countryLabel(row.country)
              const share = (row.count / total) * 100
              return (
                <li key={row.country} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-base leading-none">{flag}</span>
                  <span className="w-32 shrink-0 truncate text-sm">{name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-galli" style={{ width: `${share}%` }} />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                    {Math.round(share)}%
                  </span>
                </li>
              )
            })}
          </ul>

          {unknownCountryEvents > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              {unknownCountryEvents.toLocaleString()} visits couldn&apos;t be located and are not
              counted above.
            </p>
          )}
        </>
      )}
    </div>
  )
}
```

Create `src/components/analytics/audience/SourcesBreakdown.tsx`:

```tsx
'use client'

import { Share2 } from 'lucide-react'
import { SOURCE_LABELS, type SourceCategory } from '@/lib/data-audience'
import { DataIllustration } from '@/components/analytics/DataIllustration'

const TONE: Record<SourceCategory, string> = {
  search: 'bg-galli-aqua',
  social: 'bg-galli-violet',
  direct: 'bg-galli',
  community: 'bg-amber-500',
  referral: 'bg-rose-500',
}

export function SourcesBreakdown({
  sources,
}: {
  sources: { source: SourceCategory; count: number }[]
}) {
  const total = sources.reduce((sum, row) => sum + row.count, 0)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Share2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Traffic Sources</h3>
      </div>

      {sources.length === 0 || total === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="referrer" />
          <p className="mt-3 text-sm font-medium">No traffic sources yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your page to see where visitors arrive from.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sources.map((row) => {
            const share = (row.count / total) * 100
            return (
              <li key={row.source} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">{SOURCE_LABELS[row.source]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className={`block h-full rounded-full ${TONE[row.source]}`} style={{ width: `${share}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                  {Math.round(share)}%
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/analytics/audience/panels.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/audience/
git commit -m "feat(data): geography and traffic sources panels"
```

---

### Task 9: Wire the Audience tab into the Data page

**Files:**
- Modify: `src/app/(dashboard)/data/page.tsx`
- Move: `src/components/analytics/overview/AudienceBreakdowns.tsx` → `src/components/analytics/audience/AudienceBreakdowns.tsx` (and its test alongside)
- Test: `src/app/(dashboard)/data/audience.test.tsx`

**Interfaces:**
- Consumes: every component from Tasks 7–8 and the API from Task 6.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Create `src/app/(dashboard)/data/audience.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AnalyticsPage from './page'

// Mutable so a single test can start the page on a different tab — the mock is
// module-level and cannot otherwise vary per test.
let searchParamsValue = 'tab=audience'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

const audience = {
  summary: {
    visitors: 412, sessions: 587, newVisitors: 255, returningVisitors: 157,
    avgSessionSeconds: 154, bounceRate: 43.2, measuredSessions: 300,
  },
  identityFallback: false,
  hourCountsUtc: Array.from({ length: 24 }, (_, h) => (h === 18 ? 40 : 1)),
  geography: [{ country: 'US', count: 62 }],
  unknownCountryEvents: 0,
  sources: [{ source: 'search', count: 30 }],
  devices: { desktop: 2 },
  browsers: { chrome: 2 },
}

describe('Data page Audience tab', () => {
  beforeEach(() => {
    searchParamsValue = 'tab=audience'
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.startsWith('/api/displays')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'd1', title: 'My Page', slug: 'my-page', views: 1 }]) })
      }
      if (url.includes('/audience')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(audience) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the audience panels when the tab is active', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('412')).toBeTruthy())
    expect(screen.getByText('Peak Hours')).toBeTruthy()
    expect(screen.getByText('Geography')).toBeTruthy()
    expect(screen.getByText('Traffic Sources')).toBeTruthy()
  })

  it('offers exactly the built tabs and no placeholders for future phases', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Overview')).toBeTruthy())
    expect(screen.getByText('Audience')).toBeTruthy()
    for (const notYet of ['Interactions', 'Insights', 'Automation']) {
      expect(screen.queryByRole('button', { name: notYet })).toBeNull()
    }
  })

  it('does not request audience data while another tab is active', async () => {
    // Start on Overview, not Audience, so the lazy fetch must not have fired.
    searchParamsValue = ''
    vi.unstubAllGlobals()
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith('/api/displays')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'd1', title: 'My Page', slug: 'my-page', views: 1 }]) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Audience')).toBeTruthy())
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/audience'))).toBe(false)

    // Opening the tab does trigger it — proving the assertion above was not
    // passing merely because the fetch never happens at all.
    fireEvent.click(screen.getByText('Audience'))
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/audience'))).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "src/app/(dashboard)/data/audience.test.tsx"`
Expected: FAIL — no Audience tab exists.

- [ ] **Step 3: Move the breakdowns component**

```bash
git mv src/components/analytics/overview/AudienceBreakdowns.tsx src/components/analytics/audience/AudienceBreakdowns.tsx
git mv src/components/analytics/overview/AudienceBreakdowns.test.tsx src/components/analytics/audience/AudienceBreakdowns.test.tsx
```

Update the import path inside the moved test file from `'./AudienceBreakdowns'` — it stays the same, since both files moved together. Verify no other file imports it:

```bash
grep -rn "AudienceBreakdowns" src/
```

Only the moved component, its test, and `data/page.tsx` should appear.

- [ ] **Step 4: Update the Data page**

In `src/app/(dashboard)/data/page.tsx`:

a) Change the `AudienceBreakdowns` import to the new path and add the new components:

```ts
import { AudienceBreakdowns } from '@/components/analytics/audience/AudienceBreakdowns'
import { AudienceHeadline, type AudienceSummary } from '@/components/analytics/audience/AudienceHeadline'
import { PeakHoursChart } from '@/components/analytics/audience/PeakHoursChart'
import { GeographyList } from '@/components/analytics/audience/GeographyList'
import { SourcesBreakdown } from '@/components/analytics/audience/SourcesBreakdown'
import type { SourceCategory } from '@/lib/data-audience'
```

b) Add the audience data type near the other interfaces:

```ts
interface AudienceData {
  summary: AudienceSummary
  identityFallback: boolean
  hourCountsUtc: number[]
  geography: { country: string; count: number }[]
  unknownCountryEvents: number
  sources: { source: SourceCategory; count: number }[]
  devices: Record<string, number>
  browsers: Record<string, number>
}
```

c) Widen the tab union and its initialiser:

```ts
  const [activeTab, setActiveTab] = useState<'overview' | 'audience' | 'elements' | 'bulletin'>(
    (() => {
      const t = searchParams.get('tab')
      return t === 'audience' || t === 'elements' || t === 'bulletin' ? t : 'overview'
    })()
  )
```

d) Add state and a lazy fetch — audience data is only requested when the tab is opened:

```ts
  const [audience, setAudience] = useState<AudienceData | null>(null)
  const [audienceLoading, setAudienceLoading] = useState(false)

  useEffect(() => {
    if (activeTab !== 'audience' || !selectedDisplayId) return
    let cancelled = false
    setAudienceLoading(true)
    fetch(`/api/analytics/${selectedDisplayId}/audience?days=${days}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setAudience(data) })
      .catch(() => { if (!cancelled) setAudience(null) })
      .finally(() => { if (!cancelled) setAudienceLoading(false) })
    return () => { cancelled = true }
  }, [activeTab, selectedDisplayId, days])
```

e) Add the tab button immediately after the Overview button, matching the existing button markup exactly:

```tsx
            <button
              onClick={() => setActiveTab('audience')}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'audience'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4" />
              Audience
            </button>
```

Add `Users` to the existing `lucide-react` import if it is not already there.

f) Add the render branch. Put it immediately before the `activeTab === 'elements'` branch in `<main>`:

```tsx
        ) : activeTab === 'audience' ? (
          audienceLoading && !audience ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Loading audience…</p>
            </div>
          ) : !audience ? (
            <div className="py-20 text-center">
              <p className="text-muted-foreground">Couldn&apos;t load audience data.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <AudienceHeadline summary={audience.summary} identityFallback={audience.identityFallback} />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PeakHoursChart hourCountsUtc={audience.hourCountsUtc} />
                <GeographyList
                  geography={audience.geography}
                  unknownCountryEvents={audience.unknownCountryEvents}
                />
                <SourcesBreakdown sources={audience.sources} />
                <div className="lg:col-span-1">
                  <AudienceBreakdowns devices={audience.devices} browsers={audience.browsers} />
                </div>
              </div>
            </div>
          )
```

g) Remove the `<AudienceBreakdowns ... />` block from the Overview branch — it now lives only in Audience.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run "src/app/(dashboard)/data/" src/components/analytics/`
Expected: PASS — the new audience tests plus the existing overview tests, with no reference to the old component path.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/data/" src/components/analytics/
git commit -m "feat(data): Audience tab wired into the Data page"
```

---

### Task 10: Full verification

**Files:** none created.

- [ ] **Step 1: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no output.

- [ ] **Step 2: Authoritative lint**

`next lint` is masked in this worktree by a nested config, so run ESLint directly:

```powershell
$env:ESLINT_USE_FLAT_CONFIG='false'
pnpm exec eslint --no-eslintrc -c .eslintrc.json "src/**/*.ts" "src/**/*.tsx"
```

Expected: **0 errors.** Warnings are acceptable; errors fail the Vercel build.

- [ ] **Step 3: Production build**

Run: `pnpm exec next build`
Expected: completes with exit code 0. This is the only gate that catches an illegal export from a `route.ts`.

- [ ] **Step 4: Full test suite**

```powershell
$env:JWT_SECRET='test-secret-for-local-verification'
pnpm exec vitest run
```

Expected: all suites pass. Report — do not silently fix — any failure unrelated to this work.

- [ ] **Step 5: Confirm no schema drift**

Run:

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma migrate status
```

Expected: database up to date, no pending migrations.

- [ ] **Step 6: Manual browser verification**

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
pnpm dev
```

Visit `/data`, open the Audience tab and confirm:
- Six headline cards render; Avg session shows `—` rather than `0s` on a page with no multi-event sessions.
- Peak Hours draws 24 bars, labels a peak, and says "Shown in your time".
- Geography lists countries with flags; Sources lists categories.
- Devices/Browsers appear here and **no longer** on Overview.
- The panels stack to one column below the `lg` breakpoint.

- [ ] **Step 7: Push the branch**

```bash
git branch --show-current   # MUST print feat/data-audience-d2
git push -u origin feat/data-audience-d2
```

Do not push to `main` — merging is the operator's decision.

---

## Deferred, recorded so it is not silently dropped

- **Consent for persistent storage.** A `localStorage` identifier surviving across visits is a different privacy posture from a per-tab session id and commonly requires notice under GDPR/ePrivacy. No consent gate is added here. Recommended before ship: a short disclosure on published pages or in a privacy note. **This is the owner's decision and remains open.**
- Interactions, Insights and Automation tabs (D3–D5).
- Per-visitor timezone capture; the chart uses the owner's timezone.
- Choropleth map rendering.
- Backfilling `visitorId` onto historical events — impossible by construction.
- Tag/interest analytics — needs a tagging feature that does not exist.

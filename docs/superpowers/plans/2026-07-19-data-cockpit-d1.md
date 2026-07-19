# Data Intelligence Center D1 — Event Layer + Overview Cockpit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Data page's Overview tab into a real cockpit — five growth-scored stat cards, a Page Health gauge, a live activity feed, section-engagement bars, widget performance and a referrer donut — backed by genuine interaction events rather than placeholder data.

**Architecture:** All derivation logic lives in three pure, dependency-free modules (`analytics-events.ts`, `data-health.ts`, `data-overview.ts`) that are unit-tested in isolation. The existing `GET /api/analytics/[displayId]` route composes those pure functions and returns additive JSON fields. React components are thin renderers over that JSON. Event capture reuses the already-working `POST /api/analytics/track` endpoint, hardened with an event-type allowlist and Vercel geo.

**Tech Stack:** Next.js 15.5.19 App Router, React 19, TypeScript, Prisma/PostgreSQL, Tailwind, Vitest + @testing-library/react, lucide-react icons.

## Global Constraints

- Work in worktree `C:\Users\whirl\pages-mvp\.claude\worktrees\data-cockpit` on branch `feat/data-cockpit-d1`. Verify with `git branch --show-current` before every commit — this repo has concurrent sessions sharing checkouts.
- Existing response fields of `GET /api/analytics/[displayId]` MUST NOT change shape. The Home dashboard's `AnalyticsPanel` consumes the same route.
- Never store raw IPs or `city`. Country granularity only. Live Activity never identifies a visitor.
- No fabricated/sample data in any panel. Empty means an illustrated empty-state via `DataIllustration`.
- Analytics failures must never block or break a visitor-facing interaction — every tracking call is fire-and-forget inside try/catch.
- Brand colors are Tailwind tokens: `galli` (#39D98A), `galli-aqua` (#1FB6FF), `galli-violet` (#6C63FF), `galli-anchor` (#0F3D2E).
- Run tests with `pnpm exec vitest run <path>`. Type check with `pnpm exec tsc --noEmit`.
- ESLint in this worktree: `next lint` fails with a plugin conflict. Use `$env:ESLINT_USE_FLAT_CONFIG='false'; pnpm exec eslint --no-eslintrc -c .eslintrc.json --ext .ts,.tsx <paths>`.
- Do NOT run `prisma migrate dev`. No migration is needed anywhere in this plan.

---

### Task 1: Analytics event contract

Establishes the allowlist and metadata shape every later task depends on. Pure module, no I/O.

**Files:**
- Create: `src/lib/analytics-events.ts`
- Test: `src/lib/analytics-events.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ANALYTICS_EVENT_TYPES`, `AnalyticsEventType`, `isAnalyticsEventType(v): v is AnalyticsEventType`, `InteractMetadata { elementId, elementType, action }`, `parseInteractMetadata(raw): InteractMetadata | null`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/analytics-events.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  ANALYTICS_EVENT_TYPES,
  isAnalyticsEventType,
  parseInteractMetadata,
} from './analytics-events'

describe('isAnalyticsEventType', () => {
  it('accepts the three supported types', () => {
    expect(ANALYTICS_EVENT_TYPES).toEqual(['view', 'interact', 'share'])
    for (const t of ANALYTICS_EVENT_TYPES) expect(isAnalyticsEventType(t)).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isAnalyticsEventType('scroll')).toBe(false)
    expect(isAnalyticsEventType('')).toBe(false)
    expect(isAnalyticsEventType(null)).toBe(false)
    expect(isAnalyticsEventType(42)).toBe(false)
  })
})

describe('parseInteractMetadata', () => {
  it('returns the three fields when all are non-empty strings', () => {
    expect(parseInteractMetadata({ elementId: 'el_1', elementType: 'poll', action: 'vote' }))
      .toEqual({ elementId: 'el_1', elementType: 'poll', action: 'vote' })
  })

  it('drops unknown extra keys rather than persisting them', () => {
    const out = parseInteractMetadata({
      elementId: 'el_1', elementType: 'poll', action: 'vote', evil: 'x',
    })
    expect(out).toEqual({ elementId: 'el_1', elementType: 'poll', action: 'vote' })
  })

  it('returns null when any field is missing, empty or not a string', () => {
    expect(parseInteractMetadata({ elementType: 'poll', action: 'vote' })).toBeNull()
    expect(parseInteractMetadata({ elementId: '', elementType: 'poll', action: 'vote' })).toBeNull()
    expect(parseInteractMetadata({ elementId: 'el_1', elementType: 7, action: 'vote' })).toBeNull()
    expect(parseInteractMetadata(null)).toBeNull()
    expect(parseInteractMetadata('nope')).toBeNull()
  })

  it('trims surrounding whitespace', () => {
    expect(parseInteractMetadata({ elementId: ' el_1 ', elementType: ' poll ', action: ' vote ' }))
      .toEqual({ elementId: 'el_1', elementType: 'poll', action: 'vote' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/analytics-events.test.ts`
Expected: FAIL — `Failed to resolve import "./analytics-events"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/analytics-events.ts`:

```ts
// The complete set of analytics event types Galli records. The track route
// rejects anything outside this list so the events table cannot be polluted
// by arbitrary client-supplied strings.
export const ANALYTICS_EVENT_TYPES = ['view', 'interact', 'share'] as const

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number]

export function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === 'string' && (ANALYTICS_EVENT_TYPES as readonly string[]).includes(value)
}

// Metadata carried by every 'interact' event. Kept generic on purpose: new
// element types need no schema or query changes.
export interface InteractMetadata {
  elementId: string
  elementType: string
  action: string
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function parseInteractMetadata(raw: unknown): InteractMetadata | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const elementId = trimmedString(source.elementId)
  const elementType = trimmedString(source.elementType)
  const action = trimmedString(source.action)
  if (!elementId || !elementType || !action) return null
  return { elementId, elementType, action }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/analytics-events.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics-events.ts src/lib/analytics-events.test.ts
git commit -m "feat(analytics): event type allowlist + interact metadata contract"
```

---

### Task 2: Client tracking helpers

Thin wrappers over the existing `trackEvent`. Keeps call sites from hand-building metadata objects.

**Files:**
- Modify: `src/lib/analytics.ts` (append; leave `getSessionId`, `trackPageView`, `trackEvent` untouched)
- Test: `src/lib/analytics.test.ts`

**Interfaces:**
- Consumes: `InteractMetadata` from Task 1.
- Produces: `trackInteraction(displayId, elementId, elementType, action): Promise<void>`, `trackShare(displayId, channel): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/analytics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackInteraction, trackShare } from './analytics'

function lastBody(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls.at(-1)
  return JSON.parse(call![1].body as string)
}

describe('trackInteraction / trackShare', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('posts an interact event with typed metadata', async () => {
    await trackInteraction('disp_1', 'el_1', 'poll', 'vote')
    expect(fetchMock).toHaveBeenCalledWith('/api/analytics/track', expect.anything())
    expect(lastBody(fetchMock)).toMatchObject({
      displayId: 'disp_1',
      eventType: 'interact',
      metadata: { elementId: 'el_1', elementType: 'poll', action: 'vote' },
    })
  })

  it('posts a share event carrying the channel', async () => {
    await trackShare('disp_1', 'twitter')
    expect(lastBody(fetchMock)).toMatchObject({
      displayId: 'disp_1',
      eventType: 'share',
      metadata: { channel: 'twitter' },
    })
  })

  it('never throws when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(trackInteraction('disp_1', 'el_1', 'poll', 'vote')).resolves.toBeUndefined()
    await expect(trackShare('disp_1', 'copy')).resolves.toBeUndefined()
  })

  it('does nothing when displayId is empty', async () => {
    await trackInteraction('', 'el_1', 'poll', 'vote')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/analytics.test.ts`
Expected: FAIL — `trackInteraction is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/analytics.ts`:

```ts
// Record an interaction with a specific element (poll vote, form submit, ...).
// Fire-and-forget: never let analytics break a visitor's action.
export async function trackInteraction(
  displayId: string,
  elementId: string,
  elementType: string,
  action: string
): Promise<void> {
  if (!displayId || !elementId) return
  await trackEvent(displayId, 'interact', { elementId, elementType, action })
}

// Record that a visitor shared the page. `channel` is the share destination
// (e.g. 'twitter', 'facebook', 'copy').
export async function trackShare(displayId: string, channel: string): Promise<void> {
  if (!displayId) return
  await trackEvent(displayId, 'share', { channel })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/analytics.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics.ts src/lib/analytics.test.ts
git commit -m "feat(analytics): trackInteraction + trackShare client helpers"
```

---

### Task 3: Harden the track route (allowlist + geo)

The route currently persists ANY client-supplied `eventType` string and never populates `country`.

**Files:**
- Modify: `src/app/api/analytics/track/route.ts`
- Test: `src/app/api/analytics/track/validation.test.ts`

**Interfaces:**
- Consumes: `isAnalyticsEventType`, `parseInteractMetadata` from Task 1.
- Produces: track route persisting `country`; rejecting unknown event types with HTTP 400.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/analytics/track/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isAnalyticsEventType, parseInteractMetadata } from '@/lib/analytics-events'
import { countryFromHeaders } from './route'

describe('track route validation helpers', () => {
  it('only allows the three known event types', () => {
    expect(isAnalyticsEventType('interact')).toBe(true)
    expect(isAnalyticsEventType('drop table')).toBe(false)
  })

  it('requires well-formed metadata for interact events', () => {
    expect(parseInteractMetadata({ elementId: 'a', elementType: 'poll', action: 'vote' })).not.toBeNull()
    expect(parseInteractMetadata({ elementId: 'a' })).toBeNull()
  })
})

describe('countryFromHeaders', () => {
  it('reads the Vercel geo header', () => {
    const headers = new Headers({ 'x-vercel-ip-country': 'DE' })
    expect(countryFromHeaders(headers)).toBe('DE')
  })

  it('uppercases and trims', () => {
    expect(countryFromHeaders(new Headers({ 'x-vercel-ip-country': ' de ' }))).toBe('DE')
  })

  it('returns null when absent (local dev)', () => {
    expect(countryFromHeaders(new Headers())).toBeNull()
  })

  it('ignores values that are not two-letter codes', () => {
    expect(countryFromHeaders(new Headers({ 'x-vercel-ip-country': 'Germany' }))).toBeNull()
    expect(countryFromHeaders(new Headers({ 'x-vercel-ip-country': '1' }))).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/api/analytics/track/validation.test.ts`
Expected: FAIL — `countryFromHeaders` is not exported from `./route`.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/analytics/track/route.ts`, add the import at the top:

```ts
import { isAnalyticsEventType, parseInteractMetadata } from '@/lib/analytics-events'
```

Add this exported helper above `export async function POST`:

```ts
// Vercel populates this header at the edge for every request. Country-level
// only — we deliberately never read or store city or IP.
export function countryFromHeaders(headers: Headers): string | null {
  const raw = headers.get('x-vercel-ip-country')
  if (!raw) return null
  const code = raw.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}
```

Inside `POST`, replace the block from `const { displayId, eventType = 'view', sessionId, metadata } = body` down to the end of the `db.analyticsEvent.create` call with:

```ts
    const { displayId, eventType = 'view', sessionId, metadata } = body

    if (!displayId) {
      return NextResponse.json({ error: 'displayId is required' }, { status: 400 })
    }

    if (!isAnalyticsEventType(eventType)) {
      return NextResponse.json({ error: 'Unsupported eventType' }, { status: 400 })
    }

    // Interact events must carry well-formed metadata; anything else is dropped
    // rather than persisted as junk.
    let storedMetadata: object | undefined
    if (eventType === 'interact') {
      const parsed = parseInteractMetadata(metadata)
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid interact metadata' }, { status: 400 })
      }
      storedMetadata = parsed
    } else if (eventType === 'share') {
      const channel = typeof metadata?.channel === 'string' ? metadata.channel.trim() : ''
      storedMetadata = channel ? { channel } : undefined
    }

    // Verify display exists
    const display = await db.display.findUnique({
      where: { id: displayId },
      select: { id: true, published: true },
    })

    if (!display) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    // Only track published displays
    if (!display.published) {
      return NextResponse.json({ error: 'Display not published' }, { status: 403 })
    }

    // Get request info
    const userAgent = request.headers.get('user-agent')
    const referrer = request.headers.get('referer')
    const { deviceType, browser, os } = parseUserAgent(userAgent)
    const utmParams = parseUtmParams(referrer)
    const country = countryFromHeaders(request.headers)

    // Create analytics event
    const event = await db.analyticsEvent.create({
      data: {
        displayId,
        eventType,
        sessionId,
        referrer,
        userAgent,
        deviceType,
        browser,
        os,
        country,
        ...utmParams,
        metadata: storedMetadata,
      },
    })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/api/analytics/track/`
Expected: PASS — the new file plus the pre-existing `view-does-not-stamp.test.ts` still green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analytics/track/route.ts src/app/api/analytics/track/validation.test.ts
git commit -m "feat(analytics): allowlist event types and record country from Vercel geo header"
```

---

### Task 4: Health scoring and delta math

The single number a creator will stare at. Pure module, exhaustively tested.

**Files:**
- Create: `src/lib/data-health.ts`
- Test: `src/lib/data-health.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MetricPair { current, previous }`, `HealthBand`, `HealthDriver { key, label, delta }`, `HealthResult { score, band, drivers, insufficientData }`, `HEALTH_MIN_VIEWS`, `HEALTH_METRIC_KEYS`, `metricScore(pair): number`, `computeDelta(pair): number | null`, `computeHealth(metrics): HealthResult`.

`computeDelta` returns `null` to mean "New" — a zero baseline with positive current. Callers render "New" rather than a percentage.

- [ ] **Step 1: Write the failing test**

Create `src/lib/data-health.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  HEALTH_MIN_VIEWS,
  computeDelta,
  computeHealth,
  metricScore,
  type MetricPair,
} from './data-health'

const pair = (current: number, previous: number): MetricPair => ({ current, previous })

describe('metricScore', () => {
  it('scores a flat metric at half marks', () => {
    expect(metricScore(pair(100, 100))).toBe(10)
  })

  it('scores 50%+ growth at full marks', () => {
    expect(metricScore(pair(150, 100))).toBe(20)
    expect(metricScore(pair(1000, 100))).toBe(20)
  })

  it('scores a 50%+ decline at zero', () => {
    expect(metricScore(pair(50, 100))).toBe(0)
    expect(metricScore(pair(0, 100))).toBe(0)
  })

  it('interpolates linearly between the bounds', () => {
    expect(metricScore(pair(125, 100))).toBe(15)
    expect(metricScore(pair(75, 100))).toBe(5)
  })

  it('gives full marks to growth from a zero baseline', () => {
    expect(metricScore(pair(7, 0))).toBe(20)
  })

  it('treats zero-to-zero as flat, not as a decline', () => {
    expect(metricScore(pair(0, 0))).toBe(10)
  })
})

describe('computeDelta', () => {
  it('returns percentage change against a non-zero baseline', () => {
    expect(computeDelta(pair(118, 100))).toBeCloseTo(18)
    expect(computeDelta(pair(82, 100))).toBeCloseTo(-18)
  })

  it('returns null ("New") for growth from a zero baseline', () => {
    expect(computeDelta(pair(12, 0))).toBeNull()
  })

  it('returns 0 when both periods are empty', () => {
    expect(computeDelta(pair(0, 0))).toBe(0)
  })
})

describe('computeHealth', () => {
  const strong = {
    views: pair(1284, 1000),
    visitors: pair(812, 700),
    followers: pair(356, 300),
    shares: pair(74, 60),
    interactions: pair(1102, 800),
  }

  it('sums five equally weighted metrics into a 0-100 score', () => {
    const result = computeHealth(strong)
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(Number.isInteger(result.score)).toBe(true)
  })

  it('awards a perfect score when every metric grows 50%+', () => {
    const result = computeHealth({
      views: pair(200, 100), visitors: pair(200, 100), followers: pair(200, 100),
      shares: pair(200, 100), interactions: pair(200, 100),
    })
    expect(result.score).toBe(100)
    expect(result.band).toBe('excellent')
  })

  it('scores a totally flat page at 50 (fair)', () => {
    const result = computeHealth({
      views: pair(100, 100), visitors: pair(100, 100), followers: pair(100, 100),
      shares: pair(100, 100), interactions: pair(100, 100),
    })
    expect(result.score).toBe(50)
    expect(result.band).toBe('fair')
  })

  it('bands the score at the documented thresholds', () => {
    const bandFor = (score: number) => {
      // craft metrics that produce an exact score: each metric contributes 20
      // at +50% growth and 10 when flat, so mix full-growth and flat metrics.
      const full = Math.floor(score / 20)
      const metrics: Record<string, MetricPair> = {}
      const keys = ['views', 'visitors', 'followers', 'shares', 'interactions']
      keys.forEach((k, i) => { metrics[k] = i < full ? pair(200, 100) : pair(0, 100) })
      return computeHealth(metrics).band
    }
    expect(bandFor(100)).toBe('excellent')
    expect(bandFor(80)).toBe('good')
    expect(bandFor(60)).toBe('fair')
    expect(bandFor(20)).toBe('needs-attention')
  })

  it('flags insufficient data below the view floor and reports no score', () => {
    const result = computeHealth({
      ...strong,
      views: pair(HEALTH_MIN_VIEWS - 1, 0),
    })
    expect(result.insufficientData).toBe(true)
    expect(result.score).toBe(0)
  })

  it('does not flag insufficient data at exactly the floor', () => {
    const result = computeHealth({ ...strong, views: pair(HEALTH_MIN_VIEWS, 10) })
    expect(result.insufficientData).toBe(false)
  })

  it('lists drivers ordered by absolute movement, largest first', () => {
    const result = computeHealth({
      views: pair(101, 100), visitors: pair(700, 100), followers: pair(120, 100),
      shares: pair(60, 100), interactions: pair(100, 100),
    })
    expect(result.drivers[0].key).toBe('visitors')
    expect(result.drivers.map((d) => d.key)).not.toContain('interactions')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/data-health.test.ts`
Expected: FAIL — `Failed to resolve import "./data-health"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/data-health.ts`:

```ts
// Page Health is a pure growth score: how is this page moving compared with the
// immediately preceding window of equal length? Five metrics each contribute an
// equally weighted 20 points.

export interface MetricPair {
  current: number
  previous: number
}

export type HealthBand = 'excellent' | 'good' | 'fair' | 'needs-attention'

export interface HealthDriver {
  key: string
  label: string
  delta: number
}

export interface HealthResult {
  score: number
  band: HealthBand
  drivers: HealthDriver[]
  insufficientData: boolean
}

// Below this many views in the period, growth percentages are statistical noise
// and a score would be actively misleading, so we show a prompt instead.
export const HEALTH_MIN_VIEWS = 20

export const HEALTH_METRIC_KEYS = ['views', 'visitors', 'followers', 'shares', 'interactions'] as const

const METRIC_LABELS: Record<string, string> = {
  views: 'Views',
  visitors: 'Visitors',
  followers: 'Followers',
  shares: 'Shares',
  interactions: 'Interactions',
}

const POINTS_PER_METRIC = 20
const GROWTH_CAP = 0.5 // ±50% growth saturates the metric's score

// 0..20. Flat = 10. +50% or better = 20. -50% or worse = 0. Linear between.
export function metricScore({ current, previous }: MetricPair): number {
  if (previous === 0) return current > 0 ? POINTS_PER_METRIC : POINTS_PER_METRIC / 2
  const growth = (current - previous) / previous
  const clamped = Math.max(-GROWTH_CAP, Math.min(GROWTH_CAP, growth))
  return (POINTS_PER_METRIC / 2) * (1 + clamped / GROWTH_CAP)
}

// Percentage change, or null meaning "New" (grew from a zero baseline).
export function computeDelta({ current, previous }: MetricPair): number | null {
  if (previous === 0) return current > 0 ? null : 0
  return ((current - previous) / previous) * 100
}

function bandFor(score: number): HealthBand {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'fair'
  return 'needs-attention'
}

export function computeHealth(metrics: Record<string, MetricPair>): HealthResult {
  const views = metrics.views ?? { current: 0, previous: 0 }
  if (views.current < HEALTH_MIN_VIEWS) {
    return { score: 0, band: 'needs-attention', drivers: [], insufficientData: true }
  }

  const total = HEALTH_METRIC_KEYS.reduce(
    (sum, key) => sum + metricScore(metrics[key] ?? { current: 0, previous: 0 }),
    0
  )
  const score = Math.round(total)

  const drivers = HEALTH_METRIC_KEYS
    .map((key) => {
      const pair = metrics[key] ?? { current: 0, previous: 0 }
      return { key, label: METRIC_LABELS[key], delta: pair.current - pair.previous }
    })
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)

  return { score, band: bandFor(score), drivers, insufficientData: false }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/data-health.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-health.ts src/lib/data-health.test.ts
git commit -m "feat(data): page health scoring and delta math"
```

---

### Task 5: Overview aggregation helpers

Derives section labels, widget performance rows and live-activity items. Pure module.

**Files:**
- Create: `src/lib/data-overview.ts`
- Test: `src/lib/data-overview.test.ts`

**Interfaces:**
- Consumes: `Section` from `@/lib/types/canvas`.
- Produces:
  - `deriveSectionLabel(section: Section, index: number): string`
  - `sectionEngagement(sections: Section[], interactions: InteractionRecord[]): SectionEngagementRow[]`
  - `widgetPerformance(interactions: InteractionRecord[], viewCount: number): WidgetPerformanceRow[]`
  - `liveActivityItems(raw: RawActivity[]): LiveActivityItem[]`
  - types `InteractionRecord { elementId, elementType, at }`, `SectionEngagementRow { id, label, count }`, `WidgetPerformanceRow { elementType, label, stat, count, trend }`, `RawActivity { kind, elementType?, action?, country?, at }`, `LiveActivityItem { id, label, detail, country, at }`.

`Section` is `{ id, layout, columns }` — it has NO name field, so labels are derived.

- [ ] **Step 1: Write the failing test**

Create `src/lib/data-overview.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Section } from '@/lib/types/canvas'
import {
  deriveSectionLabel,
  liveActivityItems,
  sectionEngagement,
  widgetPerformance,
  type InteractionRecord,
  type RawActivity,
} from './data-overview'

// LayoutMode is 'full-width' | 'two-column' | 'three-column' — no other values exist.
function section(id: string, elements: { id: string; type: string; content?: string }[]): Section {
  return { id, layout: 'full-width', columns: [{ id: `${id}_c`, elements: elements as never }] } as Section
}

describe('deriveSectionLabel', () => {
  it('prefers the text of the first heading element', () => {
    const s = section('s1', [
      { id: 'e1', type: 'heading', content: 'Landing Hero' },
      { id: 'e2', type: 'gallery' },
    ])
    expect(deriveSectionLabel(s, 0)).toBe('Landing Hero')
  })

  it('truncates a very long heading', () => {
    const s = section('s1', [{ id: 'e1', type: 'heading', content: 'x'.repeat(80) }])
    expect(deriveSectionLabel(s, 0).length).toBeLessThanOrEqual(40)
  })

  it('falls back to a humanised dominant element type', () => {
    const s = section('s1', [
      { id: 'e1', type: 'gallery' },
      { id: 'e2', type: 'gallery' },
      { id: 'e3', type: 'text' },
    ])
    expect(deriveSectionLabel(s, 0)).toBe('Gallery')
  })

  it('humanises hyphenated element types', () => {
    const s = section('s1', [{ id: 'e1', type: 'link-hub' }])
    expect(deriveSectionLabel(s, 0)).toBe('Link Hub')
  })

  it('falls back to a positional name for an empty section', () => {
    expect(deriveSectionLabel(section('s1', []), 3)).toBe('Section 4')
  })

  it('ignores a heading whose content is blank', () => {
    const s = section('s1', [
      { id: 'e1', type: 'heading', content: '   ' },
      { id: 'e2', type: 'timeline' },
    ])
    expect(deriveSectionLabel(s, 0)).toBe('Timeline')
  })
})

describe('sectionEngagement', () => {
  it('attributes interactions to the section containing the element, ranked desc', () => {
    const sections = [
      section('s1', [{ id: 'a', type: 'heading', content: 'Hero' }, { id: 'b', type: 'poll' }]),
      section('s2', [{ id: 'c', type: 'heading', content: 'Contact' }]),
    ]
    const interactions: InteractionRecord[] = [
      { elementId: 'b', elementType: 'poll', at: '2026-07-19T10:00:00Z' },
      { elementId: 'b', elementType: 'poll', at: '2026-07-19T11:00:00Z' },
      { elementId: 'c', elementType: 'form', at: '2026-07-19T12:00:00Z' },
    ]
    expect(sectionEngagement(sections, interactions)).toEqual([
      { id: 's1', label: 'Hero', count: 2 },
      { id: 's2', label: 'Contact', count: 1 },
    ])
  })

  it('includes sections with zero interactions', () => {
    const sections = [section('s1', [{ id: 'a', type: 'poll' }])]
    expect(sectionEngagement(sections, [])).toEqual([{ id: 's1', label: 'Poll', count: 0 }])
  })

  it('ignores interactions whose element no longer exists', () => {
    const sections = [section('s1', [{ id: 'a', type: 'poll' }])]
    const rows = sectionEngagement(sections, [{ elementId: 'gone', elementType: 'poll', at: '2026-07-19T10:00:00Z' }])
    expect(rows).toEqual([{ id: 's1', label: 'Poll', count: 0 }])
  })
})

describe('widgetPerformance', () => {
  const interactions: InteractionRecord[] = [
    { elementId: 'p', elementType: 'poll', at: '2026-07-18T10:00:00Z' },
    { elementId: 'p', elementType: 'poll', at: '2026-07-19T10:00:00Z' },
    { elementId: 'f', elementType: 'form', at: '2026-07-19T10:00:00Z' },
  ]

  it('groups by element type, ranked by count desc', () => {
    const rows = widgetPerformance(interactions, 100)
    expect(rows.map((r) => r.elementType)).toEqual(['poll', 'form'])
    expect(rows[0].count).toBe(2)
  })

  it('uses the per-type primary stat wording', () => {
    const rows = widgetPerformance(interactions, 100)
    expect(rows.find((r) => r.elementType === 'poll')!.stat).toBe('2% of viewers voted')
    expect(rows.find((r) => r.elementType === 'form')!.stat).toBe('1 submission')
  })

  it('singularises and pluralises the stat correctly', () => {
    const rows = widgetPerformance(
      [
        { elementId: 'f', elementType: 'form', at: '2026-07-19T10:00:00Z' },
        { elementId: 'f', elementType: 'form', at: '2026-07-19T11:00:00Z' },
      ],
      10
    )
    expect(rows[0].stat).toBe('2 submissions')
  })

  it('falls back to a generic interaction stat for unmapped types', () => {
    const rows = widgetPerformance([{ elementId: 'x', elementType: 'mystery', at: '2026-07-19T10:00:00Z' }], 10)
    expect(rows[0].stat).toBe('1 interaction')
    expect(rows[0].label).toBe('Mystery')
  })

  it('avoids dividing by zero when there are no views', () => {
    const rows = widgetPerformance([{ elementId: 'p', elementType: 'poll', at: '2026-07-19T10:00:00Z' }], 0)
    expect(rows[0].stat).toBe('0% of viewers voted')
  })

  it('produces a per-day trend series', () => {
    const rows = widgetPerformance(interactions, 100)
    expect(rows.find((r) => r.elementType === 'poll')!.trend).toEqual([1, 1])
  })
})

describe('liveActivityItems', () => {
  it('shapes each event kind into human copy', () => {
    const raw: RawActivity[] = [
      { kind: 'view', country: 'DE', at: '2026-07-19T12:00:00Z' },
      { kind: 'interact', elementType: 'poll', action: 'vote', country: 'US', at: '2026-07-19T11:59:00Z' },
      { kind: 'share', country: null, at: '2026-07-19T11:58:00Z' },
      { kind: 'follow', country: null, at: '2026-07-19T11:57:00Z' },
    ]
    const items = liveActivityItems(raw)
    expect(items.map((i) => i.label)).toEqual([
      'Someone from Germany opened your page',
      'Someone from the United States voted in your poll',
      'Someone shared your page',
      'Someone followed you',
    ])
  })

  it('omits the country clause when geo is unknown', () => {
    const items = liveActivityItems([{ kind: 'view', country: null, at: '2026-07-19T12:00:00Z' }])
    expect(items[0].label).toBe('Someone opened your page')
  })

  it('falls back to the raw code for unrecognised countries', () => {
    const items = liveActivityItems([{ kind: 'view', country: 'ZZ', at: '2026-07-19T12:00:00Z' }])
    expect(items[0].label).toBe('Someone from ZZ opened your page')
  })

  it('assigns stable unique ids', () => {
    const items = liveActivityItems([
      { kind: 'view', country: 'DE', at: '2026-07-19T12:00:00Z' },
      { kind: 'view', country: 'DE', at: '2026-07-19T12:00:00Z' },
    ])
    expect(items[0].id).not.toBe(items[1].id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/data-overview.test.ts`
Expected: FAIL — `Failed to resolve import "./data-overview"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/data-overview.ts`:

```ts
import type { Section, CanvasElement } from '@/lib/types/canvas'

export interface InteractionRecord {
  elementId: string
  elementType: string
  at: string
}

export interface SectionEngagementRow {
  id: string
  label: string
  count: number
}

export interface WidgetPerformanceRow {
  elementType: string
  label: string
  stat: string
  count: number
  trend: number[]
}

export interface RawActivity {
  kind: 'view' | 'interact' | 'share' | 'follow'
  elementType?: string
  action?: string
  country?: string | null
  at: string
}

export interface LiveActivityItem {
  id: string
  label: string
  country: string | null
  at: string
}

const MAX_LABEL_LENGTH = 40

function humanise(elementType: string): string {
  return elementType
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function elementsOf(section: Section): CanvasElement[] {
  return section.columns.flatMap((column) => column.elements)
}

// `Section` has no name field, so a label is derived: first heading's text,
// else the dominant element type, else a positional fallback.
export function deriveSectionLabel(section: Section, index: number): string {
  const elements = elementsOf(section)

  const heading = elements.find(
    (el) => el.type === 'heading' && typeof el.content === 'string' && el.content.trim().length > 0
  )
  if (heading) {
    const text = heading.content!.trim()
    return text.length > MAX_LABEL_LENGTH ? `${text.slice(0, MAX_LABEL_LENGTH - 1)}…` : text
  }

  if (elements.length > 0) {
    const counts = new Map<string, number>()
    for (const el of elements) counts.set(el.type, (counts.get(el.type) || 0) + 1)
    let dominant = elements[0].type
    let best = 0
    for (const [type, count] of counts) {
      if (count > best) {
        best = count
        dominant = type
      }
    }
    return humanise(dominant)
  }

  return `Section ${index + 1}`
}

export function sectionEngagement(
  sections: Section[],
  interactions: InteractionRecord[]
): SectionEngagementRow[] {
  const sectionByElement = new Map<string, string>()
  for (const section of sections) {
    for (const el of elementsOf(section)) sectionByElement.set(el.id, section.id)
  }

  const counts = new Map<string, number>()
  for (const section of sections) counts.set(section.id, 0)
  for (const interaction of interactions) {
    const sectionId = sectionByElement.get(interaction.elementId)
    if (!sectionId) continue
    counts.set(sectionId, (counts.get(sectionId) || 0) + 1)
  }

  return sections
    .map((section, index) => ({
      id: section.id,
      label: deriveSectionLabel(section, index),
      count: counts.get(section.id) || 0,
    }))
    .sort((a, b) => b.count - a.count)
}

// Explicit per-type primary stat. Unmapped types fall back to interactions.
type StatFormatter = (count: number, viewCount: number) => string

const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`

const WIDGET_PRIMARY_STAT: Record<string, StatFormatter> = {
  poll: (count, views) => `${views > 0 ? Math.round((count / views) * 100) : 0}% of viewers voted`,
  rating: (count) => plural(count, 'interaction', 'interactions'),
  form: (count) => plural(count, 'submission', 'submissions'),
  video: (count) => plural(count, 'play', 'plays'),
  'audio-player': (count) => plural(count, 'play', 'plays'),
  calendar: (count) => plural(count, 'save', 'saves'),
  'link-hub': (count) => plural(count, 'click', 'clicks'),
  'tip-jar': (count) => plural(count, 'tip', 'tips'),
}

export function widgetPerformance(
  interactions: InteractionRecord[],
  viewCount: number
): WidgetPerformanceRow[] {
  const byType = new Map<string, InteractionRecord[]>()
  for (const interaction of interactions) {
    const bucket = byType.get(interaction.elementType) || []
    bucket.push(interaction)
    byType.set(interaction.elementType, bucket)
  }

  return Array.from(byType.entries())
    .map(([elementType, records]) => {
      const perDay = new Map<string, number>()
      for (const record of records) {
        const day = record.at.slice(0, 10)
        perDay.set(day, (perDay.get(day) || 0) + 1)
      }
      const trend = Array.from(perDay.keys())
        .sort()
        .map((day) => perDay.get(day)!)

      const format = WIDGET_PRIMARY_STAT[elementType] ?? ((count: number) => plural(count, 'interaction', 'interactions'))

      return {
        elementType,
        label: humanise(elementType),
        stat: format(records.length, viewCount),
        count: records.length,
        trend,
      }
    })
    .sort((a, b) => b.count - a.count)
}

// Country codes we bother naming. Anything else renders as the raw code rather
// than pretending we know it.
const COUNTRY_NAMES: Record<string, string> = {
  US: 'the United States', GB: 'the United Kingdom', DE: 'Germany', FR: 'France',
  CA: 'Canada', AU: 'Australia', JP: 'Japan', BR: 'Brazil', IN: 'India',
  NL: 'the Netherlands', ES: 'Spain', IT: 'Italy', SE: 'Sweden', MX: 'Mexico',
  KR: 'South Korea', IE: 'Ireland', NZ: 'New Zealand', ZA: 'South Africa',
}

function countryPhrase(country: string | null | undefined): string {
  if (!country) return 'Someone'
  return `Someone from ${COUNTRY_NAMES[country] ?? country}`
}

export function liveActivityItems(raw: RawActivity[]): LiveActivityItem[] {
  return raw.map((event, index) => {
    const who = countryPhrase(event.country)
    let label: string

    switch (event.kind) {
      case 'view':
        label = `${who} opened your page`
        break
      case 'share':
        label = `${who} shared your page`
        break
      case 'follow':
        label = `${who} followed you`
        break
      default: {
        const type = event.elementType ? humanise(event.elementType).toLowerCase() : 'element'
        const verb = event.action === 'vote' ? 'voted in' : 'interacted with'
        label = `${who} ${verb} your ${type}`
      }
    }

    return { id: `${event.at}_${event.kind}_${index}`, label, country: event.country ?? null, at: event.at }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/data-overview.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-overview.ts src/lib/data-overview.test.ts
git commit -m "feat(data): overview aggregation helpers (sections, widgets, live activity)"
```

---

### Task 6: Extend the analytics API

Composes Tasks 4 and 5 into the route. Purely additive to the JSON response.

**Files:**
- Modify: `src/app/api/analytics/[displayId]/route.ts`
- Test: `src/app/api/analytics/[displayId]/overview-shape.test.ts`

**Interfaces:**
- Consumes: `computeHealth`, `computeDelta` (Task 4); `sectionEngagement`, `widgetPerformance`, `liveActivityItems` (Task 5).
- Produces: response fields `summary.{interactions,shares,followers}`, `previous`, `health`, `liveActivity`, `widgetPerformance`, `sectionEngagement`. All pre-existing fields keep their exact shape.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/analytics/[displayId]/overview-shape.test.ts`. This tests the pure composition seam rather than booting the route with a database:

```ts
import { describe, it, expect } from 'vitest'
import { buildOverview, type OverviewInput } from './overview'

const baseInput = (): OverviewInput => ({
  currentEvents: [
    { eventType: 'view', sessionId: 's1', country: 'DE', metadata: null, createdAt: new Date('2026-07-18T10:00:00Z') },
    { eventType: 'view', sessionId: 's2', country: 'US', metadata: null, createdAt: new Date('2026-07-19T10:00:00Z') },
    { eventType: 'share', sessionId: 's1', country: 'DE', metadata: { channel: 'copy' }, createdAt: new Date('2026-07-19T10:05:00Z') },
    {
      eventType: 'interact', sessionId: 's2', country: 'US',
      metadata: { elementId: 'b', elementType: 'poll', action: 'vote' },
      createdAt: new Date('2026-07-19T10:06:00Z'),
    },
  ],
  previousEvents: [
    { eventType: 'view', sessionId: 'p1', country: null, metadata: null, createdAt: new Date('2026-06-19T10:00:00Z') },
  ],
  currentFollowers: 3,
  previousFollowers: 2,
  recentFollows: [{ createdAt: new Date('2026-07-19T09:00:00Z') }],
  sections: [
    { id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [{ id: 'b', type: 'poll' }] }] } as never,
  ],
})

describe('buildOverview', () => {
  it('counts each metric for the current window', () => {
    const out = buildOverview(baseInput())
    expect(out.summary).toEqual({ views: 2, uniqueVisitors: 2, interactions: 1, shares: 1, followers: 3 })
  })

  it('reports the previous window for delta math', () => {
    const out = buildOverview(baseInput())
    expect(out.previous).toEqual({ views: 1, uniqueVisitors: 1, interactions: 0, shares: 0, followers: 2 })
  })

  it('returns a health block flagged insufficient for a low-traffic page', () => {
    const out = buildOverview(baseInput())
    expect(out.health.insufficientData).toBe(true)
  })

  it('shapes live activity newest-first and merges follows in', () => {
    const out = buildOverview(baseInput())
    expect(out.liveActivity.length).toBe(5)
    expect(out.liveActivity[0].at >= out.liveActivity[1].at).toBe(true)
    expect(out.liveActivity.some((i) => i.label === 'Someone followed you')).toBe(true)
  })

  it('groups widget performance from interact metadata only', () => {
    const out = buildOverview(baseInput())
    expect(out.widgetPerformance).toHaveLength(1)
    expect(out.widgetPerformance[0].elementType).toBe('poll')
  })

  it('ranks section engagement using derived labels', () => {
    const out = buildOverview(baseInput())
    expect(out.sectionEngagement).toEqual([{ id: 's1', label: 'Poll', count: 1 }])
  })

  it('ignores interact events whose metadata is malformed', () => {
    const input = baseInput()
    input.currentEvents.push({
      eventType: 'interact', sessionId: 's3', country: null,
      metadata: { nonsense: true }, createdAt: new Date('2026-07-19T10:07:00Z'),
    })
    const out = buildOverview(input)
    expect(out.widgetPerformance).toHaveLength(1)
  })

  it('caps live activity at 20 items', () => {
    const input = baseInput()
    for (let i = 0; i < 40; i++) {
      input.currentEvents.push({
        eventType: 'view', sessionId: `x${i}`, country: null, metadata: null,
        createdAt: new Date('2026-07-19T09:00:00Z'),
      })
    }
    expect(buildOverview(input).liveActivity).toHaveLength(20)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/api/analytics/[displayId]/overview-shape.test.ts`
Expected: FAIL — `Failed to resolve import "./overview"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/api/analytics/[displayId]/overview.ts`:

```ts
import type { Section } from '@/lib/types/canvas'
import { parseInteractMetadata } from '@/lib/analytics-events'
import { computeHealth, type HealthResult, type MetricPair } from '@/lib/data-health'
import {
  liveActivityItems,
  sectionEngagement,
  widgetPerformance,
  type InteractionRecord,
  type LiveActivityItem,
  type RawActivity,
  type SectionEngagementRow,
  type WidgetPerformanceRow,
} from '@/lib/data-overview'

export const LIVE_ACTIVITY_LIMIT = 20

export interface OverviewEvent {
  eventType: string
  sessionId: string | null
  country: string | null
  metadata: unknown
  createdAt: Date
}

export interface OverviewInput {
  currentEvents: OverviewEvent[]
  previousEvents: OverviewEvent[]
  currentFollowers: number
  previousFollowers: number
  recentFollows: { createdAt: Date }[]
  sections: Section[]
}

export interface OverviewMetrics {
  views: number
  uniqueVisitors: number
  interactions: number
  shares: number
  followers: number
}

export interface OverviewResult {
  summary: OverviewMetrics
  previous: OverviewMetrics
  health: HealthResult
  liveActivity: LiveActivityItem[]
  widgetPerformance: WidgetPerformanceRow[]
  sectionEngagement: SectionEngagementRow[]
}

function countMetrics(events: OverviewEvent[], followers: number): OverviewMetrics {
  return {
    views: events.filter((e) => e.eventType === 'view').length,
    uniqueVisitors: new Set(
      events.filter((e) => e.eventType === 'view').map((e) => e.sessionId).filter(Boolean)
    ).size,
    interactions: events.filter((e) => e.eventType === 'interact').length,
    shares: events.filter((e) => e.eventType === 'share').length,
    followers,
  }
}

function interactionRecords(events: OverviewEvent[]): InteractionRecord[] {
  const records: InteractionRecord[] = []
  for (const event of events) {
    if (event.eventType !== 'interact') continue
    const parsed = parseInteractMetadata(event.metadata)
    if (!parsed) continue
    records.push({
      elementId: parsed.elementId,
      elementType: parsed.elementType,
      at: event.createdAt.toISOString(),
    })
  }
  return records
}

export function buildOverview(input: OverviewInput): OverviewResult {
  const summary = countMetrics(input.currentEvents, input.currentFollowers)
  const previous = countMetrics(input.previousEvents, input.previousFollowers)

  const pair = (key: keyof OverviewMetrics): MetricPair => ({
    current: summary[key],
    previous: previous[key],
  })

  const health = computeHealth({
    views: pair('views'),
    visitors: pair('uniqueVisitors'),
    followers: pair('followers'),
    shares: pair('shares'),
    interactions: pair('interactions'),
  })

  const interactions = interactionRecords(input.currentEvents)

  const raw: RawActivity[] = [
    ...input.currentEvents.map((event): RawActivity => {
      const parsed = event.eventType === 'interact' ? parseInteractMetadata(event.metadata) : null
      return {
        kind: event.eventType as RawActivity['kind'],
        elementType: parsed?.elementType,
        action: parsed?.action,
        country: event.country,
        at: event.createdAt.toISOString(),
      }
    }),
    ...input.recentFollows.map((follow): RawActivity => ({
      kind: 'follow',
      country: null,
      at: follow.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, LIVE_ACTIVITY_LIMIT)

  return {
    summary,
    previous,
    health,
    liveActivity: liveActivityItems(raw),
    widgetPerformance: widgetPerformance(interactions, summary.views),
    sectionEngagement: sectionEngagement(input.sections, interactions),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/api/analytics/[displayId]/overview-shape.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Wire it into the route**

In `src/app/api/analytics/[displayId]/route.ts`:

Add imports at the top:

```ts
import { buildOverview } from './overview'
import type { Section } from '@/lib/types/canvas'
```

Change the display lookup `select` (line ~22) to also fetch sections and the owner:

```ts
      select: { id: true, userId: true, title: true, views: true, sections: true },
```

After the existing `events` query, add the previous-window and follower queries:

```ts
    // Previous window of equal length, for period-over-period deltas
    const previousStart = new Date(startDate)
    previousStart.setDate(previousStart.getDate() - days)

    const previousEvents = await db.analyticsEvent.findMany({
      where: { displayId, createdAt: { gte: previousStart, lt: startDate } },
      select: { eventType: true, sessionId: true, country: true, metadata: true, createdAt: true },
    })

    const [currentFollowers, previousFollowers, recentFollows] = await Promise.all([
      db.follow.count({ where: { followingId: display.userId, createdAt: { lt: new Date() } } }),
      db.follow.count({ where: { followingId: display.userId, createdAt: { lt: startDate } } }),
      db.follow.findMany({
        where: { followingId: display.userId, createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    const sections = Array.isArray(display.sections) ? (display.sections as unknown as Section[]) : []

    const overview = buildOverview({
      currentEvents: events.map((e) => ({
        eventType: e.eventType,
        sessionId: e.sessionId,
        country: e.country,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
      previousEvents,
      currentFollowers,
      previousFollowers,
      recentFollows,
      sections,
    })
```

Finally, in the `return NextResponse.json({...})`, replace the `summary` key and append the new keys, leaving every other key untouched:

```ts
      summary: {
        views: totalViews,
        uniqueVisitors: uniqueSessions,
        interactions: overview.summary.interactions,
        shares: overview.summary.shares,
        followers: overview.summary.followers,
      },
      previous: overview.previous,
      health: overview.health,
      liveActivity: overview.liveActivity,
      widgetPerformance: overview.widgetPerformance,
      sectionEngagement: overview.sectionEngagement,
```

- [ ] **Step 6: Verify nothing regressed**

Run: `pnpm exec vitest run src/app/api/analytics/ && pnpm exec tsc --noEmit`
Expected: all analytics tests PASS, tsc silent.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/analytics/[displayId]/
git commit -m "feat(api): overview cockpit fields on the analytics route"
```

---

### Task 7: Stat card row + health gauge

**Files:**
- Create: `src/components/analytics/overview/StatCardRow.tsx`
- Create: `src/components/analytics/overview/HealthGauge.tsx`
- Test: `src/components/analytics/overview/StatCardRow.test.tsx`

**Interfaces:**
- Consumes: `computeDelta` (Task 4); `Sparkline` from `@/components/analytics/Sparkline`.
- Produces:
  - `StatCardRow({ metrics, previous, series })` where `metrics`/`previous` are `OverviewMetrics` and `series` is `Record<string, number[]>` keyed by metric key.
  - `HealthGauge({ health })` taking `HealthResult`.

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/overview/StatCardRow.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCardRow } from './StatCardRow'
import { HealthGauge } from './HealthGauge'

const metrics = { views: 1284, uniqueVisitors: 812, followers: 356, shares: 74, interactions: 1102 }
const previous = { views: 1086, uniqueVisitors: 707, followers: 326, shares: 66, interactions: 910 }

describe('StatCardRow', () => {
  it('renders all five metrics with formatted values', () => {
    render(<StatCardRow metrics={metrics} previous={previous} series={{}} />)
    for (const label of ['Views', 'Visitors', 'Followers', 'Shares', 'Interactions']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByText('1,284')).toBeTruthy()
  })

  it('shows a positive delta badge', () => {
    render(<StatCardRow metrics={metrics} previous={previous} series={{}} />)
    expect(screen.getByText('18.2%')).toBeTruthy()
  })

  it('shows "New" instead of a percentage when the baseline was zero', () => {
    render(
      <StatCardRow
        metrics={{ ...metrics, shares: 5 }}
        previous={{ ...previous, shares: 0 }}
        series={{}}
      />
    )
    expect(screen.getByText('New')).toBeTruthy()
  })
})

describe('HealthGauge', () => {
  it('renders the score and band', () => {
    render(
      <HealthGauge
        health={{ score: 92, band: 'excellent', insufficientData: false, drivers: [{ key: 'followers', label: 'Followers', delta: 18 }] }}
      />
    )
    expect(screen.getByText('92')).toBeTruthy()
    expect(screen.getByText('Excellent')).toBeTruthy()
    expect(screen.getByText('Followers')).toBeTruthy()
  })

  it('renders the prompt instead of a score when data is insufficient', () => {
    render(<HealthGauge health={{ score: 0, band: 'needs-attention', insufficientData: true, drivers: [] }} />)
    expect(screen.getByText(/Not enough data yet/i)).toBeTruthy()
    expect(screen.queryByText('0')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/analytics/overview/StatCardRow.test.tsx`
Expected: FAIL — cannot resolve `./StatCardRow`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/analytics/overview/StatCardRow.tsx`:

```tsx
'use client'

import { Eye, Users, UserPlus, Share2, MousePointerClick, TrendingUp, TrendingDown } from 'lucide-react'
import { Sparkline } from '@/components/analytics/Sparkline'
import { computeDelta } from '@/lib/data-health'

export interface StatMetrics {
  views: number
  uniqueVisitors: number
  followers: number
  shares: number
  interactions: number
}

const CARDS = [
  { key: 'views', label: 'Views', icon: Eye, tone: 'text-galli-aqua', chip: 'bg-galli-aqua/10' },
  { key: 'uniqueVisitors', label: 'Visitors', icon: Users, tone: 'text-galli', chip: 'bg-galli/10' },
  { key: 'followers', label: 'Followers', icon: UserPlus, tone: 'text-galli-violet', chip: 'bg-galli-violet/10' },
  { key: 'shares', label: 'Shares', icon: Share2, tone: 'text-rose-500', chip: 'bg-rose-500/10' },
  { key: 'interactions', label: 'Interactions', icon: MousePointerClick, tone: 'text-amber-500', chip: 'bg-amber-500/10' },
] as const

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = computeDelta({ current, previous })

  if (delta === null) {
    return <span className="text-xs font-semibold text-galli">New</span>
  }

  const up = delta >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-galli' : 'text-rose-500'}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

export function StatCardRow({
  metrics,
  previous,
  series,
}: {
  metrics: StatMetrics
  previous: StatMetrics
  series: Record<string, number[]>
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {CARDS.map(({ key, label, icon: Icon, tone, chip }) => (
        <div key={key} className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${chip} ${tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{metrics[key].toLocaleString()}</span>
            <DeltaBadge current={metrics[key]} previous={previous[key]} />
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">vs. previous period</p>
          <div className={`mt-2 ${tone}`}>
            <Sparkline values={series[key] ?? []} />
          </div>
        </div>
      ))}
    </div>
  )
}
```

Create `src/components/analytics/overview/HealthGauge.tsx`:

```tsx
'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import type { HealthResult } from '@/lib/data-health'

const BAND_COPY: Record<HealthResult['band'], { title: string; blurb: string }> = {
  excellent: { title: 'Excellent', blurb: 'Your page is performing great and growing!' },
  good: { title: 'Good', blurb: 'Steady growth — keep the momentum going.' },
  fair: { title: 'Fair', blurb: 'Holding steady. Try sharing to lift your numbers.' },
  'needs-attention': { title: 'Needs attention', blurb: 'Engagement is slipping this period.' },
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function HealthGauge({ health }: { health: HealthResult }) {
  if (health.insufficientData) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <h3 className="text-sm font-bold">Page Health</h3>
        <p className="mt-3 text-sm font-semibold">Not enough data yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep sharing your page — we&apos;ll score its health once there&apos;s enough traffic to be meaningful.
        </p>
      </div>
    )
  }

  const copy = BAND_COPY[health.band]
  const offset = CIRCUMFERENCE * (1 - health.score / 100)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h3 className="text-sm font-bold">Page Health</h3>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" className="stroke-muted" />
            <circle
              cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="10" strokeLinecap="round"
              className="stroke-galli"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{health.score}</span>
            <span className="text-[11px] text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-galli">{copy.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{copy.blurb}</p>
        </div>
      </div>
      {health.drivers.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {health.drivers.map((driver) => {
            const up = driver.delta >= 0
            const Icon = up ? TrendingUp : TrendingDown
            return (
              <li key={driver.key} className="flex items-center gap-2 text-sm">
                <Icon className={`h-3.5 w-3.5 ${up ? 'text-galli' : 'text-rose-500'}`} />
                <span className={up ? 'text-galli' : 'text-rose-500'}>
                  {up ? '+' : ''}{driver.delta.toLocaleString()}
                </span>
                <span className="text-muted-foreground">{driver.label}</span>
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

Run: `pnpm exec vitest run src/components/analytics/overview/StatCardRow.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/overview/
git commit -m "feat(data): stat card row and page health gauge"
```

---

### Task 8: Live activity feed

Visibility-gated polling. The polling behaviour is the part worth testing.

**Files:**
- Create: `src/components/analytics/overview/LiveActivityFeed.tsx`
- Test: `src/components/analytics/overview/LiveActivityFeed.test.tsx`

**Interfaces:**
- Consumes: `LiveActivityItem` (Task 5).
- Produces: `LiveActivityFeed({ items, onRefresh })` — `onRefresh` is called every `LIVE_POLL_MS` only while the document is visible. Exports `LIVE_POLL_MS = 20_000`.

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/overview/LiveActivityFeed.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { LiveActivityFeed, LIVE_POLL_MS } from './LiveActivityFeed'

const items = [
  { id: '1', label: 'Someone from Germany opened your page', country: 'DE', at: new Date().toISOString() },
  { id: '2', label: 'Someone followed you', country: null, at: new Date(Date.now() - 60_000).toISOString() },
]

describe('LiveActivityFeed', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders each activity label', () => {
    render(<LiveActivityFeed items={items} onRefresh={vi.fn()} />)
    expect(screen.getByText('Someone from Germany opened your page')).toBeTruthy()
    expect(screen.getByText('Someone followed you')).toBeTruthy()
  })

  it('shows an illustrated empty state when there is no activity', () => {
    render(<LiveActivityFeed items={[]} onRefresh={vi.fn()} />)
    expect(screen.getByText(/No activity yet/i)).toBeTruthy()
  })

  it('polls on an interval while the tab is visible', () => {
    const onRefresh = vi.fn()
    render(<LiveActivityFeed items={items} onRefresh={onRefresh} />)
    act(() => { vi.advanceTimersByTime(LIVE_POLL_MS * 2) })
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  it('does not poll while the tab is hidden', () => {
    const onRefresh = vi.fn()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    render(<LiveActivityFeed items={items} onRefresh={onRefresh} />)
    act(() => { vi.advanceTimersByTime(LIVE_POLL_MS * 3) })
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('stops polling after unmount', () => {
    const onRefresh = vi.fn()
    const { unmount } = render(<LiveActivityFeed items={items} onRefresh={onRefresh} />)
    unmount()
    act(() => { vi.advanceTimersByTime(LIVE_POLL_MS * 3) })
    expect(onRefresh).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/analytics/overview/LiveActivityFeed.test.tsx`
Expected: FAIL — cannot resolve `./LiveActivityFeed`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/analytics/overview/LiveActivityFeed.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { Activity } from 'lucide-react'
import { DataIllustration } from '@/components/analytics/DataIllustration'
import type { LiveActivityItem } from '@/lib/data-overview'

export const LIVE_POLL_MS = 20_000

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function LiveActivityFeed({
  items,
  onRefresh,
}: {
  items: LiveActivityItem[]
  onRefresh: () => void
}) {
  useEffect(() => {
    const id = setInterval(() => {
      // Only poll while the tab is actually being looked at.
      if (document.visibilityState === 'visible') onRefresh()
    }, LIVE_POLL_MS)
    return () => clearInterval(id)
  }, [onRefresh])

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Live Activity</h3>
        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-galli/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-galli">
          <span className="h-1.5 w-1.5 rounded-full bg-galli" /> Live
        </span>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="activity" />
          <p className="mt-3 text-sm font-medium">No activity yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Visits and interactions will appear here as they happen.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm">{item.label}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(item.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/analytics/overview/LiveActivityFeed.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/overview/LiveActivityFeed.tsx src/components/analytics/overview/LiveActivityFeed.test.tsx
git commit -m "feat(data): live activity feed with visibility-gated polling"
```

---

### Task 9: Section bars, widget table, referrer donut, quick actions

Four presentational panels grouped into one task — each is small and they share a test file.

**Files:**
- Create: `src/components/analytics/overview/SectionEngagementBars.tsx`
- Create: `src/components/analytics/overview/WidgetPerformanceTable.tsx`
- Create: `src/components/analytics/overview/ReferrerDonut.tsx`
- Create: `src/components/analytics/overview/QuickActions.tsx`
- Test: `src/components/analytics/overview/panels.test.tsx`

**Interfaces:**
- Consumes: `SectionEngagementRow`, `WidgetPerformanceRow` (Task 5); `Sparkline`; `DataIllustration`.
- Produces:
  - `SectionEngagementBars({ rows })`
  - `WidgetPerformanceTable({ rows })`
  - `ReferrerDonut({ referrers, totalViews })` where `referrers` is `{ domain, count }[]`
  - `QuickActions({ username, slug, displayId })`

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/overview/panels.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionEngagementBars } from './SectionEngagementBars'
import { WidgetPerformanceTable } from './WidgetPerformanceTable'
import { ReferrerDonut } from './ReferrerDonut'
import { QuickActions } from './QuickActions'

describe('SectionEngagementBars', () => {
  it('renders each section with its percentage of the busiest section', () => {
    render(<SectionEngagementBars rows={[
      { id: 's1', label: 'Landing Hero', count: 68 },
      { id: 's2', label: 'Gallery', count: 34 },
    ]} />)
    expect(screen.getByText('Landing Hero')).toBeTruthy()
    expect(screen.getByText('68')).toBeTruthy()
  })

  it('shows an empty state when nothing has been interacted with', () => {
    render(<SectionEngagementBars rows={[]} />)
    expect(screen.getByText(/No section activity yet/i)).toBeTruthy()
  })
})

describe('WidgetPerformanceTable', () => {
  it('renders a row per widget with its primary stat', () => {
    render(<WidgetPerformanceTable rows={[
      { elementType: 'poll', label: 'Poll', stat: '53% of viewers voted', count: 53, trend: [1, 3, 2] },
    ]} />)
    expect(screen.getByText('Poll')).toBeTruthy()
    expect(screen.getByText('53% of viewers voted')).toBeTruthy()
  })

  it('shows an empty state with no widgets', () => {
    render(<WidgetPerformanceTable rows={[]} />)
    expect(screen.getByText(/No widget activity yet/i)).toBeTruthy()
  })
})

describe('ReferrerDonut', () => {
  it('renders each referrer with a share percentage', () => {
    render(<ReferrerDonut referrers={[{ domain: 'instagram.com', count: 32 }, { domain: 'google.com', count: 18 }]} totalViews={100} />)
    expect(screen.getByText('instagram.com')).toBeTruthy()
    expect(screen.getByText('32%')).toBeTruthy()
  })

  it('shows an empty state with no referrers', () => {
    render(<ReferrerDonut referrers={[]} totalViews={0} />)
    expect(screen.getByText(/No referrers yet/i)).toBeTruthy()
  })
})

describe('QuickActions', () => {
  it('links to the editor, public page and settings', () => {
    render(<QuickActions username="josh" slug="my-page" displayId="d1" />)
    expect(screen.getByText('Create New Page')).toBeTruthy()
    expect(screen.getByText('View as Visitor').closest('a')?.getAttribute('href')).toBe('/josh/my-page')
  })

  it('omits the visitor link when the page has no public URL yet', () => {
    render(<QuickActions username={null} slug={null} displayId="d1" />)
    expect(screen.queryByText('View as Visitor')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/analytics/overview/panels.test.tsx`
Expected: FAIL — cannot resolve `./SectionEngagementBars`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/analytics/overview/SectionEngagementBars.tsx`:

```tsx
'use client'

import { LayoutGrid } from 'lucide-react'
import { DataIllustration } from '@/components/analytics/DataIllustration'
import type { SectionEngagementRow } from '@/lib/data-overview'

export function SectionEngagementBars({ rows }: { rows: SectionEngagementRow[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Top Content by Engagement</h3>
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="activity" />
          <p className="mt-3 text-sm font-medium">No section activity yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once visitors interact with your sections, the busiest ones rank here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm">{row.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-galli"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Create `src/components/analytics/overview/WidgetPerformanceTable.tsx`:

```tsx
'use client'

import { Blocks } from 'lucide-react'
import { Sparkline } from '@/components/analytics/Sparkline'
import { DataIllustration } from '@/components/analytics/DataIllustration'
import type { WidgetPerformanceRow } from '@/lib/data-overview'

export function WidgetPerformanceTable({ rows }: { rows: WidgetPerformanceRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Blocks className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Widget Performance</h3>
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="device" />
          <p className="mt-3 text-sm font-medium">No widget activity yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add an interactive element — a poll, form or rating — to start collecting signal.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.elementType} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.label}</p>
                <p className="truncate text-xs text-muted-foreground">{row.stat}</p>
              </div>
              <div className="w-24 shrink-0 text-galli">
                <Sparkline values={row.trend} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Create `src/components/analytics/overview/ReferrerDonut.tsx`:

```tsx
'use client'

import { Link2 } from 'lucide-react'
import { DataIllustration } from '@/components/analytics/DataIllustration'

const SEGMENT_COLORS = ['#39D98A', '#1FB6FF', '#6C63FF', '#F59E0B', '#F43F5E']
const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ReferrerDonut({
  referrers,
  totalViews,
}: {
  referrers: { domain: string; count: number }[]
  totalViews: number
}) {
  const top = referrers.slice(0, 5)
  const total = top.reduce((sum, r) => sum + r.count, 0) || 1

  let offset = 0

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Top Referrers</h3>
      </div>

      {top.length === 0 ? (
        <div className="py-6 text-center">
          <DataIllustration variant="referrer" />
          <p className="mt-3 text-sm font-medium">No referrers yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Share your page to see where visitors come from.</p>
        </div>
      ) : (
        <>
          <div className="relative mx-auto h-32 w-32">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              {top.map((referrer, index) => {
                const fraction = referrer.count / total
                const dash = CIRCUMFERENCE * fraction
                const circle = (
                  <circle
                    key={referrer.domain}
                    cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="14"
                    stroke={SEGMENT_COLORS[index % SEGMENT_COLORS.length]}
                    strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                    strokeDashoffset={-offset}
                  />
                )
                offset += dash
                return circle
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold">{totalViews.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground">Total Views</span>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {top.map((referrer, index) => (
              <li key={referrer.domain} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{referrer.domain}</span>
                <span className="shrink-0 font-medium">{Math.round((referrer.count / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
```

Create `src/components/analytics/overview/QuickActions.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { ChevronRight, FilePlus2, Eye, Settings, Share2 } from 'lucide-react'

export function QuickActions({
  username,
  slug,
  displayId,
}: {
  username: string | null
  slug: string | null
  displayId: string | null
}) {
  const publicHref = username && slug ? `/${username}/${slug}` : null

  const actions = [
    { label: 'Create New Page', href: '/editor', icon: FilePlus2 },
    ...(publicHref ? [{ label: 'View as Visitor', href: publicHref, icon: Eye }] : []),
    ...(displayId ? [{ label: 'Share Page', href: `/editor?id=${displayId}&share=1`, icon: Share2 }] : []),
    ...(displayId ? [{ label: 'Page Settings', href: `/editor?id=${displayId}`, icon: Settings }] : []),
  ]

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h3 className="mb-3 text-sm font-bold">Quick Actions</h3>
      <ul className="space-y-1">
        {actions.map(({ label, href, icon: Icon }) => (
          <li key={label}>
            <Link
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/analytics/overview/panels.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/overview/
git commit -m "feat(data): section bars, widget table, referrer donut, quick actions"
```

---

### Task 10: Compose the cockpit into the Data page

Replaces the Overview branch, widens the layout, adds the right rail, moves Messages out.

**Files:**
- Modify: `src/app/(dashboard)/data/page.tsx`
- Modify: `src/components/dashboard/SidebarContent.tsx`
- Test: `src/app/(dashboard)/data/overview.test.tsx`

**Interfaces:**
- Consumes: every component from Tasks 7–9, plus the API fields from Task 6.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Create `src/app/(dashboard)/data/overview.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AnalyticsPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))

const analytics = {
  display: { id: 'd1', title: 'My Page', totalViews: 1284 },
  period: { days: 30, start: '2026-06-19T00:00:00Z', end: '2026-07-19T00:00:00Z' },
  summary: { views: 1284, uniqueVisitors: 812, followers: 356, shares: 74, interactions: 1102 },
  previous: { views: 1086, uniqueVisitors: 707, followers: 326, shares: 66, interactions: 910 },
  health: { score: 92, band: 'excellent', drivers: [{ key: 'followers', label: 'Followers', delta: 30 }], insufficientData: false },
  liveActivity: [{ id: '1', label: 'Someone from Germany opened your page', country: 'DE', at: new Date().toISOString() }],
  widgetPerformance: [{ elementType: 'poll', label: 'Poll', stat: '53% of viewers voted', count: 53, trend: [1, 2, 3] }],
  sectionEngagement: [{ id: 's1', label: 'Landing Hero', count: 68 }],
  breakdown: { devices: {}, browsers: {}, referrers: [{ domain: 'instagram.com', count: 32 }] },
  viewsByDay: { '2026-07-18': 40, '2026-07-19': 60 },
  uniqueVisitorsByDay: { '2026-07-18': 20, '2026-07-19': 30 },
  topReferrerByDay: {},
  recentEvents: [],
}

describe('Data page Overview cockpit', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.startsWith('/api/displays')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'd1', title: 'My Page', slug: 'my-page', views: 1284 }]) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(analytics) })
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the five stat cards, health gauge and panels', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('1,284')).toBeTruthy())
    expect(screen.getByText('Interactions')).toBeTruthy()
    expect(screen.getByText('Page Health')).toBeTruthy()
    expect(screen.getByText('92')).toBeTruthy()
    expect(screen.getByText('Live Activity')).toBeTruthy()
    expect(screen.getByText('Landing Hero')).toBeTruthy()
    expect(screen.getByText('Quick Actions')).toBeTruthy()
  })

  it('no longer offers a Messages tab', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Overview')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Messages' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "src/app/(dashboard)/data/overview.test.tsx"`
Expected: FAIL — "Page Health" not found; a Messages tab still exists.

- [ ] **Step 3: Update the Data page**

In `src/app/(dashboard)/data/page.tsx`:

a) Extend the imports:

```ts
import { StatCardRow } from '@/components/analytics/overview/StatCardRow'
import { HealthGauge } from '@/components/analytics/overview/HealthGauge'
import { LiveActivityFeed } from '@/components/analytics/overview/LiveActivityFeed'
import { SectionEngagementBars } from '@/components/analytics/overview/SectionEngagementBars'
import { WidgetPerformanceTable } from '@/components/analytics/overview/WidgetPerformanceTable'
import { ReferrerDonut } from '@/components/analytics/overview/ReferrerDonut'
import { QuickActions } from '@/components/analytics/overview/QuickActions'
import type { HealthResult } from '@/lib/data-health'
import type { LiveActivityItem, SectionEngagementRow, WidgetPerformanceRow } from '@/lib/data-overview'
```

b) Extend `AnalyticsData` — replace the `summary` field and add the new ones:

```ts
  summary: {
    views: number
    uniqueVisitors: number
    followers: number
    shares: number
    interactions: number
  }
  previous: {
    views: number
    uniqueVisitors: number
    followers: number
    shares: number
    interactions: number
  }
  health: HealthResult
  liveActivity: LiveActivityItem[]
  widgetPerformance: WidgetPerformanceRow[]
  sectionEngagement: SectionEngagementRow[]
```

c) Add `slug` to `DisplayOption`:

```ts
interface DisplayOption {
  id: string
  title: string
  slug: string
  views: number
}
```

d) Change the tab state union and initialiser — Messages is gone:

```ts
  const [activeTab, setActiveTab] = useState<'overview' | 'elements' | 'bulletin'>(
    (() => {
      const t = searchParams.get('tab')
      return t === 'elements' || t === 'bulletin' ? t : 'overview'
    })()
  )
```

e) Delete the entire Messages `<button>` from the `tabs` prop, and delete the `MessagesInbox` import and its `activeTab === 'messages' ?` branch in `<main>`.

f) Add a refetch callback above the return, so the live feed can poll:

```ts
  const refreshAnalytics = useCallback(async () => {
    if (!selectedDisplayId) return
    try {
      const res = await fetch(`/api/analytics/${selectedDisplayId}?days=${days}`)
      if (res.ok) setAnalytics(await res.json())
    } catch (error) {
      console.error('Failed to refresh analytics:', error)
    }
  }, [selectedDisplayId, days])
```

Add `useCallback` to the React import on line 3.

g) Widen the main container:

```tsx
      <main className="max-w-7xl mx-auto px-6 py-8">
```

h) Replace the whole `analytics ? (...)` Overview branch body with the cockpit. Keep the period selector row exactly as it is, then:

```tsx
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                <StatCardRow
                  metrics={analytics.summary}
                  previous={analytics.previous}
                  series={{
                    views: Object.keys(analytics.viewsByDay).sort().map((d) => analytics.viewsByDay[d]),
                    uniqueVisitors: Object.keys(analytics.uniqueVisitorsByDay ?? {}).sort().map((d) => (analytics.uniqueVisitorsByDay ?? {})[d]),
                  }}
                />

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <LiveActivityFeed items={analytics.liveActivity} onRefresh={refreshAnalytics} />
                  <SectionEngagementBars rows={analytics.sectionEngagement} />
                </div>

                <WidgetPerformanceTable rows={analytics.widgetPerformance} />
              </div>

              <aside className="space-y-6">
                <HealthGauge health={analytics.health} />
                <QuickActions
                  username={username}
                  slug={displays.find((d) => d.id === selectedDisplayId)?.slug ?? null}
                  displayId={selectedDisplayId}
                />
                <ReferrerDonut
                  referrers={analytics.breakdown.referrers}
                  totalViews={analytics.summary.views}
                />
              </aside>
            </div>
```

i) `QuickActions` needs the viewer's username. Add state and fetch it alongside displays:

```ts
  const [username, setUsername] = useState<string | null>(null)
```

and inside the existing `fetchDisplays` effect, after `setDisplays(data)`:

```ts
          const me = await fetch('/api/profile').then((r) => (r.ok ? r.json() : null))
          setUsername(me?.username ?? null)
```

- [ ] **Step 4: Move Messages to its own sidebar item**

In `src/components/dashboard/SidebarContent.tsx`, add a Messages entry to the nav array immediately after the Data entry (line ~27). Import `Mail` from `lucide-react`:

```ts
  { label: 'Messages', icon: Mail, href: '/messages', match: (p) => p.startsWith('/messages') },
```

Move the badge from Data to Messages — change the line at ~124 from `item.href === '/data'` to:

```tsx
              {item.href === '/messages' && !collapsed && <MessagesNavBadge />}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run "src/app/(dashboard)/data/" src/components/dashboard/`
Expected: PASS — the new overview tests plus existing sidebar tests.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/data/" src/components/dashboard/SidebarContent.tsx
git commit -m "feat(data): compose Overview cockpit, widen layout, move Messages to sidebar"
```

---

### Task 11: Instrument the interaction call sites

Without this the new panels stay empty forever. Interactive public elements already receive `displayId` as a prop, so no threading is required.

**Files:**
- Modify: `src/components/elements/PublicPollElement.tsx`
- Modify: `src/components/elements/PublicRatingElement.tsx`
- Modify: `src/components/elements/PublicShortAnswerElement.tsx`
- Modify: `src/components/elements/PublicMCQElement.tsx`
- Modify: `src/components/elements/PublicWaitlistElement.tsx`
- Modify: `src/components/elements/PublicRSVPElement.tsx`
- Modify: `src/components/elements/PublicLinkHubElement.tsx` (needs `displayId` prop added)
- Modify: `src/components/elements/PublicAudioPlayerElement.tsx` (needs `displayId` prop added)
- Modify: `src/components/elements/PublicCalendarElement.tsx` (needs `displayId` prop added)
- Modify: `src/components/elements/PublicTipJarElement.tsx` (needs `displayId` prop added)
- Modify: `src/lib/render-elements.tsx` (pass `displayId` to the four above)
- Modify: `src/components/share/SocialShareButtons.tsx` (owner-initiated share tracking)
- Test: `src/components/elements/interaction-tracking.test.tsx`

**Interfaces:**
- Consumes: `trackInteraction` (Task 2).
- Produces: nothing exported.

- [ ] **Step 1: Write the failing test**

Create `src/components/elements/interaction-tracking.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PublicPollElement } from './PublicPollElement'
import * as analytics from '@/lib/analytics'

describe('poll interaction tracking', () => {
  beforeEach(() => {
    vi.spyOn(analytics, 'trackInteraction').mockResolvedValue()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ options: [], totalVotes: 0 }),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('records an interact event when a vote succeeds', async () => {
    const element = {
      id: 'el_1',
      type: 'poll',
      pollQuestion: 'Best frog?',
      pollOptions: [{ id: 'o1', label: 'Green' }],
    }
    render(<PublicPollElement element={element as never} displayId="disp_1" />)

    fireEvent.click(await screen.findByText('Green'))

    await waitFor(() =>
      expect(analytics.trackInteraction).toHaveBeenCalledWith('disp_1', 'el_1', 'poll', 'vote')
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/elements/interaction-tracking.test.tsx`
Expected: FAIL — `trackInteraction` never called.

- [ ] **Step 3: Add the tracking calls**

In each listed file, import the helper:

```ts
import { trackInteraction } from '@/lib/analytics'
```

Then add exactly one call in the **success path** of the submit/vote handler, immediately after the server confirms the action. Use these arguments per file:

| File | Call |
|---|---|
| `PublicPollElement.tsx` | `trackInteraction(displayId, element.id, 'poll', 'vote')` |
| `PublicRatingElement.tsx` | `trackInteraction(displayId, element.id, 'rating', 'submit')` |
| `PublicShortAnswerElement.tsx` | `trackInteraction(displayId, element.id, 'form', 'submit')` |
| `PublicMCQElement.tsx` | `trackInteraction(displayId, element.id, 'form', 'submit')` |
| `PublicWaitlistElement.tsx` | `trackInteraction(displayId, element.id, 'waitlist', 'join')` |
| `PublicRSVPElement.tsx` | `trackInteraction(displayId, element.id, 'rsvp', 'respond')` |

The call is deliberately not awaited before updating UI state — analytics must never delay or block the visitor's feedback. Example, in `PublicPollElement`'s vote handler after `if (res.ok)`:

```ts
        void trackInteraction(displayId, element.id, 'poll', 'vote')
```

- [ ] **Step 4: Thread `displayId` into the four elements that lack it**

`PublicLinkHubElement`, `PublicAudioPlayerElement`, `PublicCalendarElement` and `PublicTipJarElement` currently receive only `{ element }`. Without this step their `WIDGET_PRIMARY_STAT` formatters in `data-overview.ts` are dead code.

For each of the four, widen the props and use it:

```tsx
export function PublicLinkHubElement({ element, displayId }: { element: CanvasElement; displayId?: string }) {
```

In `src/lib/render-elements.tsx`, pass the prop at each of the four call sites, matching the existing convention used by the other elements:

```tsx
      return <PublicLinkHubElement element={element} displayId={displayId || ''} />
```

Then add the tracking call in each, guarded so it is a no-op when `displayId` is absent (the editor preview renders these without one):

| File | Call | Fires when |
|---|---|---|
| `PublicLinkHubElement.tsx` | `trackInteraction(displayId, element.id, 'link-hub', 'click')` | a link is clicked |
| `PublicAudioPlayerElement.tsx` | `trackInteraction(displayId, element.id, 'audio-player', 'play')` | playback starts |
| `PublicCalendarElement.tsx` | `trackInteraction(displayId, element.id, 'calendar', 'save')` | an event is saved/added |
| `PublicTipJarElement.tsx` | `trackInteraction(displayId, element.id, 'tip-jar', 'tip')` | a tip is confirmed |

`trackInteraction` already returns early when `displayId` is empty, so no extra guard is needed at the call site.

- [ ] **Step 5: Track shares**

`SocialShareButtons({ url, title })` has no `displayId` and is currently rendered only from the editor's `PublishDialog` and `ShareDialog` — see the note in the handoff below about what this metric does and does not mean.

Widen its props and record the share:

```tsx
export function SocialShareButtons({
  url,
  title,
  displayId,
}: {
  url: string
  title: string
  displayId?: string
}) {
```

In each share handler, after the share action is triggered, add:

```ts
    void trackShare(displayId ?? '', channel)
```

where `channel` is that button's destination (`'twitter'`, `'facebook'`, `'linkedin'`, `'copy'`, …). Import `trackShare` from `@/lib/analytics`.

Then pass `displayId` from both dialogs:

```tsx
              <SocialShareButtons url={pageUrl} title={pageTitle} displayId={displayId} />
```

If a dialog does not already have the display id in scope, add it as a prop on that dialog rather than reaching for global state.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run src/components/elements/ src/components/share/`
Expected: PASS — the new test plus all existing element tests (`PublicLinkHubElement.test.tsx`, `PublicAudioPlayerElement.test.tsx`, `PublicTipJarElement.test.tsx` must stay green after the prop change).

- [ ] **Step 7: Commit**

```bash
git add src/components/elements/ src/components/share/ src/lib/render-elements.tsx
git commit -m "feat(analytics): record interact and share events from call sites"
```

---

### Task 12: Full verification

**Files:** none created.

- [ ] **Step 1: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no output.

- [ ] **Step 2: Lint the changed files**

Run:

```powershell
$env:ESLINT_USE_FLAT_CONFIG='false'
pnpm exec eslint --no-eslintrc -c .eslintrc.json --ext .ts,.tsx src/lib/analytics-events.ts src/lib/data-health.ts src/lib/data-overview.ts src/components/analytics/overview "src/app/(dashboard)/data" src/app/api/analytics
```

Expected: no output.

- [ ] **Step 3: Full test suite**

Run: `pnpm exec vitest run`
Expected: all suites PASS. If anything unrelated to this work fails, report it rather than fixing it silently.

- [ ] **Step 4: Manual browser verification**

Start the dev server with the correct database:

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
pnpm dev
```

Visit `/data` and confirm:
- Five stat cards render with deltas and sparklines; the row wraps to 2-up on a narrow window.
- Page Health shows a gauge, or the "Not enough data yet" prompt on a low-traffic page.
- Live Activity lists events and the panel does not error.
- The right rail stacks below the main column below the `lg` breakpoint.
- Messages appears in the sidebar with its unread badge and no longer appears as a Data tab.

- [ ] **Step 5: Commit any fixes and push**

```bash
git branch --show-current   # MUST print feat/data-cockpit-d1
git push -u origin feat/data-cockpit-d1
```

---

## Deferred to later phases

These are explicit non-goals of D1, recorded so they are not silently dropped:

- Audience, Interactions, Insights, Automation tabs (D2–D5).
- Page-level bookmarking and its stat card.
- Session duration, bounce rate and peak hours (need leave-event tracking — D2).
- Extending the cockpit to Hubs / Boards / Workspaces / Events (D6).
- Real-time transport (SSE/WebSocket) for Live Activity.
- Backfilling historical interaction data — panels accumulate from deploy forward.

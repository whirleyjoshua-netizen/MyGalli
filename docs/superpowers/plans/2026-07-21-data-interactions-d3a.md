# D3a Interactions Tab (Element Operating System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the page-scoped Elements tab and the separate Bulletin tab with one account-wide **Interactions** tab that renders every data-collecting element the user owns as a live status card, grouped by type, with a filter rail and a detail drawer.

**Architecture:** All logic lives in a pure, DB-free module (`src/lib/element-os.ts`) so it is unit-testable without a database. Three new API routes assemble the inventory on demand from existing tables (no schema change): a full inventory route, a ~1KB pulse route polled every 30s, and a per-element detail route for the drawer. The UI is a two-column client cockpit under `src/components/analytics/interactions/`, matching the Overview tab's layout so the tabs read as one product.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma/PostgreSQL, Tailwind, Vitest + Testing Library, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-21-data-interactions-d3a-design.md`

## Global Constraints

- **No schema changes.** No migration, no new Prisma model, no new column. Every status and metric is derived from existing tables.
- **`route.ts` may export ONLY route handlers** (`GET`/`POST`/…) and known config keys (`dynamic`, `revalidate`, `runtime`). Exporting a helper fails `next build` with `not assignable to type 'never'` — invisible to `tsc`. This broke a prod deploy already. All helpers go in `src/lib/element-os.ts`.
- **Every query is scoped to the authenticated user.** This feature reads seven tables; a cross-tenant leak is the top risk.
- **Counts only, never row loads,** in the inventory route. Use `groupBy`/`count`. The drawer route is what pays for detail.
- **Composite keys everywhere.** `makeBlock()` element ids are deterministic, so an element id is unique only *within* a page. Page elements key as `` `${displayId}:${elementId}` ``; bulletin instruments key as `` `bulletin:${postId}:${elementId}` ``.
- **`Comment` has NO `elementId`** — it is keyed by `displayId` only. Grouping comments by `elementId` throws a Prisma unknown-field error. The comment store is page-scoped, so a page's comment count is attributed to the *first* comment element on that page; any further comment elements on the same page show 0 rather than double-counting the same rows.
- **`BulletinPost`'s owner column is `authorId`, not `userId`.** Every bulletin query scopes on `authorId`.
- **All new components need `'use client'`.** A missing directive 500s pages; the D1 review caught exactly this twice.
- **Engagement viewer floor is 20.** Below that, engagement is `null` and renders as `—`.
- **Live window is 24h; idle window is 30 days.**
- **No fabricated data.** Replies, reply times, tip-jar payments, element creation dates, and section names do not exist. Do not invent them.
- Run tests with `pnpm vitest run <path>`. Type check with `pnpm exec tsc --noEmit`.

---

## File Structure

**Created:**
- `src/lib/element-os.ts` — pure inventory/status/engagement/grouping/filtering logic
- `src/lib/element-os.test.ts` — its unit tests
- `src/app/api/data/elements/route.ts` — account-wide inventory
- `src/app/api/data/elements/route.test.ts`
- `src/app/api/data/elements/pulse/route.ts` — 30s pulse
- `src/app/api/data/elements/pulse/route.test.ts`
- `src/app/api/data/elements/[displayId]/[elementId]/route.ts` — drawer detail
- `src/app/api/data/elements/[displayId]/[elementId]/route.test.ts`
- `src/app/api/bulletin/analytics/route.test.ts` — first tests for a route the drawer now depends on
- `src/components/analytics/interactions/InteractionsTab.tsx` — owns fetch, pulse, filter state
- `src/components/analytics/interactions/InsightsStrip.tsx`
- `src/components/analytics/interactions/FilterRail.tsx`
- `src/components/analytics/interactions/TypeGroup.tsx`
- `src/components/analytics/interactions/ElementCard.tsx`
- `src/components/analytics/interactions/ElementDrawer.tsx`
- `src/components/analytics/interactions/card-bodies/index.tsx`
- `src/components/analytics/interactions/useElementSeen.ts` — localStorage last-seen stamps
- Component tests alongside each

**Modified:**
- `src/app/(dashboard)/data/page.tsx` — tab set, selector visibility, `?tab=` redirects

**Deleted:**
- `src/components/analytics/ElementsTab.tsx`
- `src/components/analytics/BulletinAnalyticsTab.tsx`

**Untouched (still used):** `src/components/analytics/element-cards/*` are reused by the drawer; `src/app/api/analytics/[displayId]/elements/route.ts` stays as the drawer's page-element data source.

---

### Task 1: Element inventory types and collection

**Files:**
- Create: `src/lib/element-os.ts`
- Test: `src/lib/element-os.test.ts`

**Interfaces:**
- Consumes: `Section`, `Column`, `CanvasElement` from `@/lib/types/canvas`; `TabsConfig` from `@/lib/types/tabs`
- Produces: `DATA_ELEMENT_TYPES`, `DataElementType`, `CollectedElement`, `collectDataElements(sections, tabs, pageId, pageTitle)`, `elementTitle(el)`, `pageElementKey(displayId, elementId)`, `bulletinElementKey(postId, elementId)`

- [ ] **Step 1: Write the failing test**

Create `src/lib/element-os.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { collectDataElements, elementTitle, pageElementKey, bulletinElementKey } from './element-os'
import type { Section } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

const section = (id: string, elements: any[]): Section =>
  ({ id, layout: 'single', columns: [{ id: `${id}-c1`, elements }] }) as unknown as Section

describe('collectDataElements', () => {
  it('collects data-collecting elements with a 1-based section index', () => {
    const sections = [
      section('s1', [{ id: 'e1', type: 'poll', pollQuestion: 'Best player?' }]),
      section('s2', [{ id: 'e2', type: 'waitlist', waitlistTitle: 'Beta list' }]),
    ]
    const out = collectDataElements(sections, null, 'd1', 'Homepage')
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({
      key: 'd1:e1',
      elementId: 'e1',
      type: 'poll',
      title: 'Best player?',
      pageId: 'd1',
      pageTitle: 'Homepage',
      sectionIndex: 1,
    })
    expect(out[1].sectionIndex).toBe(2)
  })

  it('excludes elements with no response store', () => {
    const sections = [
      section('s1', [
        { id: 'e1', type: 'text' },
        { id: 'e2', type: 'gallery' },
        { id: 'e3', type: 'tip-jar' },
        { id: 'e4', type: 'tracker' },
        { id: 'e5', type: 'poll', pollQuestion: 'Kept' },
      ]),
    ]
    const out = collectDataElements(sections, null, 'd1', 'Homepage')
    expect(out.map((e) => e.elementId)).toEqual(['e5'])
  })

  it('walks tabbed pages and records the tab label', () => {
    const tabs = {
      tabs: [{ id: 't1', label: 'Reviews', sections: [section('s9', [{ id: 'e9', type: 'rating', ratingQuestion: 'How was it?' }])] }],
    } as unknown as TabsConfig
    const out = collectDataElements([], tabs, 'd1', 'Homepage')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ elementId: 'e9', tabLabel: 'Reviews', sectionIndex: 1 })
  })

  it('keeps elements from different pages distinct despite identical element ids', () => {
    const a = collectDataElements([section('s1', [{ id: 'block-1', type: 'poll' }])], null, 'd1', 'A')
    const b = collectDataElements([section('s1', [{ id: 'block-1', type: 'poll' }])], null, 'd2', 'B')
    expect(a[0].key).not.toBe(b[0].key)
  })

  it('tolerates malformed sections without throwing', () => {
    const out = collectDataElements(
      [{ id: 's1' } as unknown as Section, section('s2', [{ id: 'e1', type: 'poll' }])],
      null,
      'd1',
      'Homepage'
    )
    expect(out).toHaveLength(1)
  })
})

describe('elementTitle', () => {
  it.each([
    [{ id: 'e', type: 'poll', pollQuestion: 'P' }, 'P'],
    [{ id: 'e', type: 'mcq', mcqQuestion: 'M' }, 'M'],
    [{ id: 'e', type: 'rating', ratingQuestion: 'R' }, 'R'],
    [{ id: 'e', type: 'shortanswer', shortAnswerQuestion: 'S' }, 'S'],
    [{ id: 'e', type: 'comment', commentTitle: 'C' }, 'C'],
    [{ id: 'e', type: 'waitlist', waitlistTitle: 'W' }, 'W'],
    [{ id: 'e', type: 'mailbox', mailboxTitle: 'MB' }, 'MB'],
    [{ id: 'e', type: 'appointments', apptTitle: 'A' }, 'A'],
    [{ id: 'e', type: 'rsvp', rsvpSubject: 'RS' }, 'RS'],
    [{ id: 'e', type: 'wedding-rsvp', weddingRsvpTitle: 'WR' }, 'WR'],
    [{ id: 'e', type: 'business-review', bizReviewTitle: 'BR' }, 'BR'],
  ])('reads the per-type title field', (el, expected) => {
    expect(elementTitle(el as any)).toBe(expected)
  })

  it('falls back to a type label when the title is empty', () => {
    expect(elementTitle({ id: 'e', type: 'poll' } as any)).toBe('Untitled poll')
  })
})

describe('keys', () => {
  it('builds page and bulletin keys', () => {
    expect(pageElementKey('d1', 'e1')).toBe('d1:e1')
    expect(bulletinElementKey('p1', 'e1')).toBe('bulletin:p1:e1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/element-os.test.ts`
Expected: FAIL — `Failed to resolve import "./element-os"`

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/element-os.ts`:

```ts
// Pure, DB-free logic for the Interactions tab (Element Operating System).
// No IO here: the routes do the querying, this module does the thinking, so
// every rule below is unit-testable without a database.
import type { Section, CanvasElement } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

// Element types that have a real response store. Anything not listed here has
// nothing to report and stays out of the grid. Deliberately excluded:
//   tip-jar  — no model exists; it can only ever report clicks
//   tracker  — TrackerEntry is owner-entered data, not visitor responses
//   static elements (text, gallery, countdown, map, ...) — nothing collected
export const DATA_ELEMENT_TYPES = [
  'poll',
  'mcq',
  'rating',
  'shortanswer',
  'comment',
  'rsvp',
  'wedding-rsvp',
  'business-review',
  'waitlist',
  'appointments',
  'mailbox',
  'jersey',
] as const

export type DataElementType = (typeof DATA_ELEMENT_TYPES)[number]

const TYPE_LABELS: Record<DataElementType, string> = {
  poll: 'poll',
  mcq: 'multiple choice',
  rating: 'rating',
  shortanswer: 'question',
  comment: 'comment wall',
  rsvp: 'RSVP',
  'wedding-rsvp': 'wedding RSVP',
  'business-review': 'reviews',
  waitlist: 'wait list',
  appointments: 'appointments',
  mailbox: 'mailbox',
  jersey: 'jersey',
}

// Which config field holds the human-facing title, per type.
const TITLE_FIELDS: Record<DataElementType, string> = {
  poll: 'pollQuestion',
  mcq: 'mcqQuestion',
  rating: 'ratingQuestion',
  shortanswer: 'shortAnswerQuestion',
  comment: 'commentTitle',
  rsvp: 'rsvpSubject',
  'wedding-rsvp': 'weddingRsvpTitle',
  'business-review': 'bizReviewTitle',
  waitlist: 'waitlistTitle',
  appointments: 'apptTitle',
  mailbox: 'mailboxTitle',
  jersey: 'jerseyName',
}

export interface CollectedElement {
  key: string
  elementId: string
  type: DataElementType
  title: string
  pageId: string
  pageTitle: string
  sectionIndex: number
  tabLabel?: string
}

export function pageElementKey(displayId: string, elementId: string): string {
  return `${displayId}:${elementId}`
}

export function bulletinElementKey(postId: string, elementId: string): string {
  return `bulletin:${postId}:${elementId}`
}

export function isDataElementType(type: unknown): type is DataElementType {
  return (DATA_ELEMENT_TYPES as readonly string[]).includes(type as string)
}

export function elementTitle(el: CanvasElement): string {
  const type = el.type as DataElementType
  const field = TITLE_FIELDS[type]
  const raw = field ? (el as unknown as Record<string, unknown>)[field] : null
  const title = typeof raw === 'string' ? raw.trim() : ''
  return title || `Untitled ${TYPE_LABELS[type] ?? 'element'}`
}

function walk(
  sections: Section[] | null | undefined,
  pageId: string,
  pageTitle: string,
  tabLabel: string | undefined,
  out: CollectedElement[]
): void {
  ;(sections || []).forEach((section, i) => {
    for (const column of section?.columns || []) {
      for (const el of column?.elements || []) {
        if (!el || !isDataElementType(el.type)) continue
        out.push({
          key: pageElementKey(pageId, el.id),
          elementId: el.id,
          type: el.type as DataElementType,
          title: elementTitle(el),
          pageId,
          pageTitle,
          sectionIndex: i + 1,
          ...(tabLabel ? { tabLabel } : {}),
        })
      }
    }
  })
}

// Walks the main canvas AND every tab's canvas. Tabbed pages were silently
// dropped by an earlier analytics feature; that must not repeat here.
export function collectDataElements(
  sections: Section[] | null | undefined,
  tabs: TabsConfig | null | undefined,
  pageId: string,
  pageTitle: string
): CollectedElement[] {
  const out: CollectedElement[] = []
  walk(sections, pageId, pageTitle, undefined, out)
  for (const tab of tabs?.tabs || []) {
    walk(tab?.sections, pageId, pageTitle, tab?.label, out)
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/element-os.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/element-os.ts src/lib/element-os.test.ts
git commit -m "feat(data): element inventory collection for the Interactions tab"
```

---

### Task 2: Status derivation and engagement

**Files:**
- Modify: `src/lib/element-os.ts` (append)
- Test: `src/lib/element-os.test.ts` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: `ElementStatus`, `MIN_VIEWERS_FOR_ENGAGEMENT`, `LIVE_WINDOW_MS`, `IDLE_WINDOW_MS`, `deriveStatus(input)`, `computeEngagement({responders, pageViewers})`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/element-os.test.ts`:

```ts
import { deriveStatus, computeEngagement, MIN_VIEWERS_FOR_ENGAGEMENT } from './element-os'

const NOW = new Date('2026-07-21T12:00:00.000Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString()
const daysAgo = (d: number) => hoursAgo(d * 24)

const base = {
  published: true,
  lastResponseAt: null as string | null,
  unreadCount: 0,
  pendingCount: 0,
  lastSeenAt: null as string | null,
  now: NOW,
}

describe('deriveStatus', () => {
  it('flags unread mailbox messages as needs-attention', () => {
    expect(deriveStatus({ ...base, unreadCount: 3, lastResponseAt: hoursAgo(1) })).toBe('needs-attention')
  })

  it('flags pending RSVP/waitlist entries as needs-attention', () => {
    expect(deriveStatus({ ...base, pendingCount: 2 })).toBe('needs-attention')
  })

  it('flags responses newer than the last-seen stamp as needs-attention', () => {
    expect(deriveStatus({ ...base, lastResponseAt: hoursAgo(1), lastSeenAt: hoursAgo(5) })).toBe('needs-attention')
  })

  it('does not flag responses older than the last-seen stamp', () => {
    expect(deriveStatus({ ...base, lastResponseAt: hoursAgo(5), lastSeenAt: hoursAgo(1) })).toBe('live')
  })

  it('needs-attention outranks live', () => {
    expect(deriveStatus({ ...base, unreadCount: 1, lastResponseAt: hoursAgo(1) })).toBe('needs-attention')
  })

  it('is live when published with a response inside 24h', () => {
    expect(deriveStatus({ ...base, lastResponseAt: hoursAgo(23) })).toBe('live')
  })

  it('is not live at exactly the 24h boundary', () => {
    expect(deriveStatus({ ...base, lastResponseAt: hoursAgo(24) })).not.toBe('live')
  })

  it('is draft when the page is unpublished, even with recent responses', () => {
    expect(deriveStatus({ ...base, published: false, lastResponseAt: hoursAgo(1) })).toBe('draft')
  })

  it('is idle when published with no response in 30 days', () => {
    expect(deriveStatus({ ...base, lastResponseAt: daysAgo(31) })).toBe('idle')
  })

  it('is idle when published and never responded to', () => {
    expect(deriveStatus({ ...base, lastResponseAt: null })).toBe('idle')
  })
})

describe('computeEngagement', () => {
  it('returns a rounded percentage', () => {
    expect(computeEngagement({ responders: 42, pageViewers: 50 })).toBe(84)
  })

  it('returns null below the viewer floor so small samples cannot read 100%', () => {
    expect(computeEngagement({ responders: 3, pageViewers: MIN_VIEWERS_FOR_ENGAGEMENT - 1 })).toBeNull()
  })

  it('returns null when there are no viewers', () => {
    expect(computeEngagement({ responders: 0, pageViewers: 0 })).toBeNull()
  })

  it('clamps to 100 when responders exceed viewers', () => {
    expect(computeEngagement({ responders: 80, pageViewers: 40 })).toBe(100)
  })

  it('never returns a negative value', () => {
    expect(computeEngagement({ responders: -5, pageViewers: 40 })).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/element-os.test.ts`
Expected: FAIL — `deriveStatus is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/element-os.ts`:

```ts
export type ElementStatus = 'needs-attention' | 'live' | 'draft' | 'idle'

export const MIN_VIEWERS_FOR_ENGAGEMENT = 20
export const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000
export const IDLE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export interface StatusInput {
  published: boolean
  lastResponseAt: string | null
  unreadCount: number
  pendingCount: number
  /** From localStorage — the server cannot see this, so status finalises client-side. */
  lastSeenAt: string | null
  now: Date
}

// Order matters: first match wins. needs-attention outranks everything —
// including draft — because it is the only status that asks the owner to do
// something, and an unread message stays unread whether or not the page that
// collected it is currently published.
export function deriveStatus(input: StatusInput): ElementStatus {
  const { published, lastResponseAt, unreadCount, pendingCount, lastSeenAt, now } = input
  const last = lastResponseAt ? Date.parse(lastResponseAt) : NaN
  const hasLast = Number.isFinite(last)

  const unseen = hasLast && (!lastSeenAt || last > Date.parse(lastSeenAt))
  if (unreadCount > 0 || pendingCount > 0 || unseen) return 'needs-attention'
  if (!published) return 'draft'
  if (hasLast && now.getTime() - last < LIVE_WINDOW_MS) return 'live'
  return 'idle'
}

// Share of the page's unique visitors who responded to this element.
// Returns null below the viewer floor: a page with three views must not be
// allowed to display "100% engagement".
export function computeEngagement({
  responders,
  pageViewers,
}: {
  responders: number
  pageViewers: number
}): number | null {
  if (pageViewers < MIN_VIEWERS_FOR_ENGAGEMENT) return null
  const pct = Math.round((responders / pageViewers) * 100)
  return Math.max(0, Math.min(100, pct))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/element-os.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/element-os.ts src/lib/element-os.test.ts
git commit -m "feat(data): derive element status and engagement"
```

---

### Task 3: Grouping, sorting, filtering

**Files:**
- Modify: `src/lib/element-os.ts` (append)
- Test: `src/lib/element-os.test.ts` (append)

**Interfaces:**
- Consumes: `CollectedElement`, `ElementStatus`, `DataElementType`
- Produces: `ElementSummary`, `SortMode`, `ElementFilter`, `TYPE_GROUPS`, `groupByType(elements)`, `sortElements(elements, mode)`, `filterElements(elements, filter)`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/element-os.test.ts`:

```ts
import { groupByType, sortElements, filterElements, type ElementSummary } from './element-os'

const el = (over: Partial<ElementSummary>): ElementSummary => ({
  key: over.key ?? 'd1:e1',
  elementId: 'e1',
  type: 'poll',
  title: 'A poll',
  pageId: 'd1',
  pageTitle: 'Homepage',
  sectionIndex: 1,
  source: 'page',
  published: true,
  responseCount: 0,
  todayCount: 0,
  lastResponseAt: null,
  unreadCount: 0,
  pendingCount: 0,
  engagement: null,
  status: 'idle',
  ...over,
})

describe('groupByType', () => {
  it('groups into ordered, labelled buckets and drops empty ones', () => {
    const groups = groupByType([
      el({ key: 'a', type: 'poll' }),
      el({ key: 'b', type: 'mcq' }),
      el({ key: 'c', type: 'shortanswer' }),
    ])
    expect(groups.map((g) => g.label)).toEqual(['Polls', 'Questions'])
    expect(groups[0].elements).toHaveLength(2) // poll + mcq
    expect(groups[1].elements).toHaveLength(1)
  })
})

describe('sortElements', () => {
  const quiet = el({ key: 'quiet', responseCount: 2, lastResponseAt: '2026-07-01T00:00:00.000Z' })
  const busy = el({ key: 'busy', responseCount: 90, lastResponseAt: '2026-07-20T00:00:00.000Z' })
  const never = el({ key: 'never', responseCount: 0, lastResponseAt: null })

  it('sorts most active first', () => {
    expect(sortElements([quiet, busy, never], 'most-active').map((e) => e.key)).toEqual(['busy', 'quiet', 'never'])
  })

  it('sorts least active first', () => {
    expect(sortElements([quiet, busy, never], 'least-active').map((e) => e.key)).toEqual(['never', 'quiet', 'busy'])
  })

  it('sorts by most recent activity, never-answered last', () => {
    expect(sortElements([quiet, busy, never], 'recent').map((e) => e.key)).toEqual(['busy', 'quiet', 'never'])
  })

  it('sorts longest idle first, never-answered first of all', () => {
    expect(sortElements([quiet, busy, never], 'stale').map((e) => e.key)).toEqual(['never', 'quiet', 'busy'])
  })

  it('does not mutate the input array', () => {
    const input = [quiet, busy]
    sortElements(input, 'most-active')
    expect(input.map((e) => e.key)).toEqual(['quiet', 'busy'])
  })
})

describe('filterElements', () => {
  const items = [
    el({ key: 'a', type: 'poll', title: 'Favorite NBA player', status: 'live', source: 'page' }),
    el({ key: 'b', type: 'waitlist', title: 'Beta waitlist', status: 'idle', source: 'page' }),
    el({ key: 'c', type: 'poll', title: 'Bulletin poll', status: 'needs-attention', source: 'bulletin' }),
  ]
  const all = { search: '', types: [], statuses: [], source: 'all' as const }

  it('returns everything by default', () => {
    expect(filterElements(items, all)).toHaveLength(3)
  })

  it('matches search case-insensitively against title and page', () => {
    expect(filterElements(items, { ...all, search: 'nba' }).map((e) => e.key)).toEqual(['a'])
    expect(filterElements(items, { ...all, search: 'HOMEPAGE' })).toHaveLength(3)
  })

  it('filters by type', () => {
    expect(filterElements(items, { ...all, types: ['waitlist'] }).map((e) => e.key)).toEqual(['b'])
  })

  it('filters by status', () => {
    expect(filterElements(items, { ...all, statuses: ['live'] }).map((e) => e.key)).toEqual(['a'])
  })

  it('filters by source', () => {
    expect(filterElements(items, { ...all, source: 'bulletin' }).map((e) => e.key)).toEqual(['c'])
  })

  it('ands the criteria together', () => {
    expect(filterElements(items, { ...all, types: ['poll'], source: 'page' }).map((e) => e.key)).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/element-os.test.ts`
Expected: FAIL — `groupByType is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/element-os.ts`:

```ts
export interface ElementSummary extends CollectedElement {
  source: 'page' | 'bulletin'
  published: boolean
  responseCount: number
  todayCount: number
  lastResponseAt: string | null
  unreadCount: number
  pendingCount: number
  engagement: number | null
  /** Finalised on the client by deriveStatus(); the route leaves this 'idle'. */
  status: ElementStatus
}

// Display groups. Several element types share a group because the owner thinks
// of them the same way (a poll and an MCQ are both "a poll" to a human).
export const TYPE_GROUPS: { label: string; types: DataElementType[] }[] = [
  { label: 'Polls', types: ['poll', 'mcq'] },
  { label: 'Questions', types: ['shortanswer', 'comment'] },
  { label: 'Ratings', types: ['rating', 'business-review'] },
  { label: 'RSVPs', types: ['rsvp', 'wedding-rsvp'] },
  { label: 'Wait lists', types: ['waitlist'] },
  { label: 'Appointments', types: ['appointments'] },
  { label: 'Mailboxes', types: ['mailbox'] },
  { label: 'Signatures', types: ['jersey'] },
]

export function groupByType(
  elements: ElementSummary[]
): { label: string; elements: ElementSummary[] }[] {
  return TYPE_GROUPS.map((g) => ({
    label: g.label,
    elements: elements.filter((e) => g.types.includes(e.type)),
  })).filter((g) => g.elements.length > 0)
}

export type SortMode = 'most-active' | 'least-active' | 'recent' | 'stale'

// Elements carry no creation date anywhere in the schema, so every sort is
// activity-based. "newest/oldest" would have to be invented; it isn't offered.
export function sortElements(elements: ElementSummary[], mode: SortMode): ElementSummary[] {
  const at = (e: ElementSummary) => (e.lastResponseAt ? Date.parse(e.lastResponseAt) : null)
  return [...elements].sort((a, b) => {
    switch (mode) {
      case 'most-active':
        return b.responseCount - a.responseCount
      case 'least-active':
        return a.responseCount - b.responseCount
      case 'recent': {
        const av = at(a) ?? -Infinity
        const bv = at(b) ?? -Infinity
        return bv - av
      }
      case 'stale': {
        const av = at(a) ?? -Infinity
        const bv = at(b) ?? -Infinity
        return av - bv
      }
    }
  })
}

export interface ElementFilter {
  search: string
  /** Empty means "all". */
  types: DataElementType[]
  /** Empty means "all". */
  statuses: ElementStatus[]
  source: 'all' | 'page' | 'bulletin'
}

export function filterElements(elements: ElementSummary[], filter: ElementFilter): ElementSummary[] {
  const q = filter.search.trim().toLowerCase()
  return elements.filter((e) => {
    if (filter.source !== 'all' && e.source !== filter.source) return false
    if (filter.types.length > 0 && !filter.types.includes(e.type)) return false
    if (filter.statuses.length > 0 && !filter.statuses.includes(e.status)) return false
    if (q && !`${e.title} ${e.pageTitle}`.toLowerCase().includes(q)) return false
    return true
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/element-os.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/element-os.ts src/lib/element-os.test.ts
git commit -m "feat(data): group, sort and filter helpers for the element grid"
```

---

### Task 4: Inventory route — page elements

**Files:**
- Create: `src/app/api/data/elements/route.ts`
- Create: `src/app/api/data/elements/route.test.ts`

**Interfaces:**
- Consumes: `collectDataElements`, `computeEngagement`, `pageElementKey`, `ElementSummary` from `@/lib/element-os`; `getUser` from `@/lib/auth`; `db` from `@/lib/db`
- Produces: `GET /api/data/elements` → `{ elements: ElementSummary[], totals: { elements, responses, avgEngagement, liveNow }, truncated: boolean }`

**Note:** This route must export ONLY `GET`. Any helper belongs in `element-os.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/data/elements/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findMany: vi.fn().mockResolvedValue([]) },
    formResponse: { findMany: vi.fn().mockResolvedValue([]) },
    comment: { groupBy: vi.fn().mockResolvedValue([]) },
    message: { groupBy: vi.fn().mockResolvedValue([]) },
    waitlistSignup: { groupBy: vi.fn().mockResolvedValue([]) },
    booking: { groupBy: vi.fn().mockResolvedValue([]) },
    jerseySignature: { groupBy: vi.fn().mockResolvedValue([]) },
    bulletinPost: { findMany: vi.fn().mockResolvedValue([]) },
    analyticsEvent: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { GET } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const req = () => new NextRequest('http://localhost/api/data/elements')

const display = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  title: 'Homepage',
  slug: 'homepage',
  published: true,
  sections: [{ id: 's1', layout: 'single', columns: [{ id: 'c1', elements: [{ id: 'e1', type: 'poll', pollQuestion: 'Best player?' }] }] }],
  tabs: null,
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('GET /api/data/elements', () => {
  it('401s when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
  })

  it('only ever reads displays owned by the caller', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(req())
    expect(db.display.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'me' }) })
    )
  })

  it('returns one summary per data-collecting element', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    const body = await (await GET(req())).json()
    expect(body.elements).toHaveLength(1)
    expect(body.elements[0]).toMatchObject({
      key: 'd1:e1',
      type: 'poll',
      title: 'Best player?',
      pageTitle: 'Homepage',
      source: 'page',
      published: true,
    })
  })

  it('counts responses per element from FormResponse payloads', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    ;(db.formResponse.findMany as any).mockResolvedValue([
      { displayId: 'd1', responses: { e1: { type: 'poll', answer: 'A' } }, submittedAt: new Date('2026-07-20T10:00:00Z') },
      { displayId: 'd1', responses: { e1: { type: 'poll', answer: 'B' } }, submittedAt: new Date('2026-07-19T10:00:00Z') },
      { displayId: 'd1', responses: { other: { type: 'poll', answer: 'B' } }, submittedAt: new Date('2026-07-19T10:00:00Z') },
    ])
    const body = await (await GET(req())).json()
    expect(body.elements[0].responseCount).toBe(2)
    expect(body.elements[0].lastResponseAt).toBe('2026-07-20T10:00:00.000Z')
  })

  it('reports totals across all elements', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    ;(db.formResponse.findMany as any).mockResolvedValue([
      { displayId: 'd1', responses: { e1: { type: 'poll', answer: 'A' } }, submittedAt: new Date() },
    ])
    const body = await (await GET(req())).json()
    expect(body.totals).toMatchObject({ elements: 1, responses: 1 })
    expect(body.totals).not.toHaveProperty('needsAttention')
  })

  it('leaves engagement null when the page is below the viewer floor', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    const body = await (await GET(req())).json()
    expect(body.elements[0].engagement).toBeNull()
  })

  it('caps the number of displays it will parse and flags truncation', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue(
      Array.from({ length: 201 }, (_, i) => display({ id: `d${i}` }))
    )
    const body = await (await GET(req())).json()
    expect(body.truncated).toBe(true)
    expect(body.elements).toHaveLength(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/api/data/elements/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 3: Write minimal implementation**

Create `src/app/api/data/elements/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import {
  collectDataElements,
  computeEngagement,
  type ElementSummary,
} from '@/lib/element-os'
import type { Section } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

// Guard against an account with an unreasonable number of pages. We surface
// truncation in the payload rather than silently showing a partial inventory.
const MAX_DISPLAYS = 200

export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allDisplays = await db.display.findMany({
    where: { userId: user.id },
    select: { id: true, title: true, slug: true, published: true, sections: true, tabs: true },
    orderBy: { createdAt: 'desc' },
  })

  const truncated = allDisplays.length > MAX_DISPLAYS
  const displays = allDisplays.slice(0, MAX_DISPLAYS)
  if (truncated) {
    console.warn(`[data/elements] user ${user.id} has ${allDisplays.length} displays; capped at ${MAX_DISPLAYS}`)
  }

  const parse = <T,>(v: unknown): T | null =>
    typeof v === 'string' ? (JSON.parse(v) as T) : ((v as T) ?? null)

  const collected = displays.flatMap((d) =>
    collectDataElements(
      parse<Section[]>(d.sections) ?? [],
      parse<TabsConfig>(d.tabs),
      d.id,
      d.title
    ).map((el) => ({ el, published: d.published }))
  )

  const displayIds = displays.map((d) => d.id)

  // FormResponse stores answers as { [elementId]: {...} }, so per-element
  // counts cannot be done with groupBy — we read the rows for these displays
  // and fold them once, in memory.
  const formRows = displayIds.length
    ? await db.formResponse.findMany({
        where: { displayId: { in: displayIds } },
        select: { displayId: true, responses: true, submittedAt: true },
        orderBy: { submittedAt: 'desc' },
      })
    : []

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const counts = new Map<string, { total: number; today: number; last: string | null }>()
  const bump = (key: string, at: Date) => {
    const cur = counts.get(key) ?? { total: 0, today: 0, last: null }
    cur.total += 1
    if (at >= startOfToday) cur.today += 1
    const iso = at.toISOString()
    if (!cur.last || iso > cur.last) cur.last = iso
    counts.set(key, cur)
  }

  for (const row of formRows) {
    const answers = (row.responses ?? {}) as Record<string, unknown>
    for (const elementId of Object.keys(answers)) {
      bump(`${row.displayId}:${elementId}`, row.submittedAt)
    }
  }

  const elements: ElementSummary[] = collected.map(({ el, published }) => {
    const c = counts.get(el.key) ?? { total: 0, today: 0, last: null }
    return {
      ...el,
      source: 'page',
      published,
      responseCount: c.total,
      todayCount: c.today,
      lastResponseAt: c.last,
      unreadCount: 0,
      pendingCount: 0,
      engagement: computeEngagement({ responders: 0, pageViewers: 0 }),
      status: 'idle',
    }
  })

  const engaged = elements.map((e) => e.engagement).filter((v): v is number => v !== null)

  return NextResponse.json({
    elements,
    totals: {
      elements: elements.length,
      responses: elements.reduce((sum, e) => sum + e.responseCount, 0),
      avgEngagement: engaged.length ? Math.round(engaged.reduce((a, b) => a + b, 0) / engaged.length) : null,
      liveNow: 0,
    },
    truncated,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/api/data/elements/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/data/elements/route.ts src/app/api/data/elements/route.test.ts
git commit -m "feat(data): account-wide element inventory route"
```

---

### Task 5: Inventory route — remaining stores, engagement, bulletin

**Files:**
- Modify: `src/app/api/data/elements/route.ts`
- Modify: `src/app/api/data/elements/route.test.ts` (append)

**Interfaces:**
- Consumes: `bulletinElementKey`, `aggregateBlock` is NOT used here (counts only)
- Produces: same route contract, now populated from all seven stores plus engagement

- [ ] **Step 1: Write the failing test**

Append to `src/app/api/data/elements/route.test.ts`:

```ts
describe('GET /api/data/elements — all stores', () => {
  const waitlistDisplay = () =>
    display({
      sections: [{ id: 's1', layout: 'single', columns: [{ id: 'c1', elements: [
        { id: 'w1', type: 'waitlist', waitlistTitle: 'Beta list' },
        { id: 'm1', type: 'mailbox', mailboxTitle: 'Say hi' },
      ] }] }],
    })

  it('counts waitlist signups per element', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([waitlistDisplay()])
    ;(db.waitlistSignup.groupBy as any).mockResolvedValue([
      { displayId: 'd1', elementId: 'w1', _count: { _all: 12 }, _max: { createdAt: new Date('2026-07-20T09:00:00Z') } },
    ])
    const body = await (await GET(req())).json()
    const w = body.elements.find((e: any) => e.key === 'd1:w1')
    expect(w.responseCount).toBe(12)
    expect(w.lastResponseAt).toBe('2026-07-20T09:00:00.000Z')
  })

  it('reports unread mailbox messages so the client can flag attention', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([waitlistDisplay()])
    ;(db.message.groupBy as any).mockImplementation(({ where }: any) =>
      Promise.resolve(
        where?.read === false
          ? [{ displayId: 'd1', elementId: 'm1', _count: { _all: 4 }, _max: { createdAt: new Date('2026-07-20T08:00:00Z') } }]
          : [{ displayId: 'd1', elementId: 'm1', _count: { _all: 9 }, _max: { createdAt: new Date('2026-07-20T08:00:00Z') } }]
      )
    )
    const body = await (await GET(req())).json()
    const m = body.elements.find((e: any) => e.key === 'd1:m1')
    expect(m.responseCount).toBe(9)
    expect(m.unreadCount).toBe(4)
  })

  it('scopes mailbox reads to the owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([waitlistDisplay()])
    await GET(req())
    expect(db.message.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerId: 'me' }) })
    )
  })

  it('computes engagement from unique visitors, not event counts', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    // 25 distinct viewers of d1; one of them fires 40 interact events on e1.
    const views = Array.from({ length: 25 }, (_, i) => ({
      displayId: 'd1', eventType: 'view', visitorId: `v${i}`, sessionId: null, metadata: null,
    }))
    const interacts = Array.from({ length: 40 }, () => ({
      displayId: 'd1', eventType: 'interact', visitorId: 'v0', sessionId: null, metadata: { elementId: 'e1' },
    }))
    ;(db.analyticsEvent.findMany as any).mockResolvedValue([...views, ...interacts])
    const body = await (await GET(req())).json()
    // 1 responder / 25 viewers = 4%, NOT 160%
    expect(body.elements[0].engagement).toBe(4)
  })

  it('falls back to sessionId when visitorId is null on legacy events', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    ;(db.analyticsEvent.findMany as any).mockResolvedValue([
      ...Array.from({ length: 20 }, (_, i) => ({ displayId: 'd1', eventType: 'view', visitorId: null, sessionId: `s${i}`, metadata: null })),
      { displayId: 'd1', eventType: 'interact', visitorId: null, sessionId: 's0', metadata: { elementId: 'e1' } },
    ])
    const body = await (await GET(req())).json()
    expect(body.elements[0].engagement).toBe(5)
  })

  it('attributes page-scoped comment rows to the first comment element on that page', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([
      display({
        sections: [{ id: 's1', layout: 'single', columns: [{ id: 'c1', elements: [
          { id: 'cm1', type: 'comment', commentTitle: 'Wall one' },
          { id: 'cm2', type: 'comment', commentTitle: 'Wall two' },
        ] }] }],
      }),
    ])
    // Comment has no elementId column — the count is per display.
    ;(db.comment.groupBy as any).mockResolvedValue([
      { displayId: 'd1', _count: { _all: 7 }, _max: { createdAt: new Date('2026-07-20T07:00:00Z') } },
    ])
    const body = await (await GET(req())).json()
    expect(body.elements.find((e: any) => e.key === 'd1:cm1').responseCount).toBe(7)
    // Not double counted onto the second wall — they share one store.
    expect(body.elements.find((e: any) => e.key === 'd1:cm2').responseCount).toBe(0)
    expect(body.totals.responses).toBe(7)
  })

  it('groups comments by displayId only, never by elementId', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    await GET(req())
    expect(db.comment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['displayId'] })
    )
  })

  it('includes bulletin instruments keyed by post, tagged as bulletin source', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.bulletinPost.findMany as any).mockResolvedValue([
      {
        id: 'p1',
        createdAt: new Date('2026-07-12T00:00:00Z'),
        blocks: [{ id: 'b1', type: 'poll', pollQuestion: 'Best practice time?' }],
        responses: [{ createdAt: new Date('2026-07-20T12:00:00Z'), responses: { b1: { type: 'poll', answer: 'AM' } } }],
      },
    ])
    const body = await (await GET(req())).json()
    const b = body.elements.find((e: any) => e.key === 'bulletin:p1:b1')
    expect(b).toMatchObject({ source: 'bulletin', type: 'poll', title: 'Best practice time?', published: true, responseCount: 1 })
    expect(b.engagement).toBeNull()
  })

  it('only reads bulletin posts authored by the caller', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(req())
    // BulletinPost's owner column is authorId, NOT userId.
    expect(db.bulletinPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorId: 'me' }) })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/api/data/elements/route.test.ts`
Expected: FAIL — waitlist count is 0, `unreadCount` is 0, engagement is `null`, no bulletin element

- [ ] **Step 3: Write minimal implementation**

Replace the body of `GET` in `src/app/api/data/elements/route.ts` after the `formRows` fold with the full assembly:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import {
  collectDataElements,
  computeEngagement,
  elementTitle,
  isDataElementType,
  bulletinElementKey,
  type ElementSummary,
} from '@/lib/element-os'
import type { Section, CanvasElement } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

const MAX_DISPLAYS = 200
const ENGAGEMENT_WINDOW_DAYS = 30
const MAX_EVENTS = 50_000

export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allDisplays = await db.display.findMany({
    where: { userId: user.id },
    select: { id: true, title: true, slug: true, published: true, sections: true, tabs: true },
    orderBy: { createdAt: 'desc' },
  })

  const truncated = allDisplays.length > MAX_DISPLAYS
  const displays = allDisplays.slice(0, MAX_DISPLAYS)
  if (truncated) {
    console.warn(`[data/elements] user ${user.id} has ${allDisplays.length} displays; capped at ${MAX_DISPLAYS}`)
  }

  const parse = <T,>(v: unknown): T | null =>
    typeof v === 'string' ? (JSON.parse(v) as T) : ((v as T) ?? null)

  const collected = displays.flatMap((d) =>
    collectDataElements(parse<Section[]>(d.sections) ?? [], parse<TabsConfig>(d.tabs), d.id, d.title).map(
      (el) => ({ el, published: d.published })
    )
  )
  const displayIds = displays.map((d) => d.id)
  const since = new Date(Date.now() - ENGAGEMENT_WINDOW_DAYS * 24 * 3600 * 1000)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  // ---- counts -------------------------------------------------------------
  const counts = new Map<string, { total: number; today: number; last: string | null }>()
  const bump = (key: string, at: Date, n = 1) => {
    const cur = counts.get(key) ?? { total: 0, today: 0, last: null }
    cur.total += n
    if (at >= startOfToday) cur.today += n
    const iso = at.toISOString()
    if (!cur.last || iso > cur.last) cur.last = iso
    counts.set(key, cur)
  }

  const empty: any[] = []
  const [formRows, commentRows, messageRows, unreadRows, waitlistRows, bookingRows, jerseyRows, bulletinPosts, events] =
    displayIds.length
      ? await Promise.all([
          db.formResponse.findMany({
            where: { displayId: { in: displayIds } },
            select: { displayId: true, responses: true, submittedAt: true },
            orderBy: { submittedAt: 'desc' },
          }),
          // Comment has NO elementId column — it is page-scoped.
          db.comment.groupBy({
            by: ['displayId'],
            where: { displayId: { in: displayIds } },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
          db.message.groupBy({
            by: ['displayId', 'elementId'],
            where: { ownerId: user.id, displayId: { in: displayIds } },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
          db.message.groupBy({
            by: ['displayId', 'elementId'],
            where: { ownerId: user.id, displayId: { in: displayIds }, read: false },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
          db.waitlistSignup.groupBy({
            by: ['displayId', 'elementId'],
            where: { displayId: { in: displayIds } },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
          db.booking.groupBy({
            by: ['displayId', 'elementId'],
            where: { displayId: { in: displayIds } },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
          db.jerseySignature.groupBy({
            by: ['displayId', 'elementId'],
            where: { displayId: { in: displayIds } },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
          db.bulletinPost.findMany({
            where: { authorId: user.id },
            select: {
              id: true,
              createdAt: true,
              blocks: true,
              responses: { select: { createdAt: true, responses: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
          db.analyticsEvent.findMany({
            where: { displayId: { in: displayIds }, createdAt: { gte: since } },
            select: { displayId: true, eventType: true, visitorId: true, sessionId: true, metadata: true },
            take: MAX_EVENTS,
          }),
        ])
      : [empty, empty, empty, empty, empty, empty, empty, await db.bulletinPost.findMany({
          where: { authorId: user.id },
          select: { id: true, createdAt: true, blocks: true, responses: { select: { createdAt: true, responses: true } } },
          orderBy: { createdAt: 'desc' },
        }), empty]

  // FormResponse keys answers by elementId inside a JSON blob, so it cannot be
  // grouped in SQL — fold it once here.
  for (const row of formRows) {
    const answers = (row.responses ?? {}) as Record<string, unknown>
    for (const elementId of Object.keys(answers)) bump(`${row.displayId}:${elementId}`, row.submittedAt)
  }

  for (const g of [...messageRows, ...waitlistRows, ...bookingRows, ...jerseyRows]) {
    const at = g._max?.createdAt ?? new Date(0)
    bump(`${g.displayId}:${g.elementId}`, at, g._count?._all ?? 0)
  }

  // Comments are stored per display, not per element, so the page's total is
  // attributed to the first comment element on that page. A second comment
  // wall on the same page reads the same rows; showing the count twice would
  // inflate totals.responses, so it stays at zero.
  const firstCommentKeyByPage = new Map<string, string>()
  for (const { el } of collected) {
    if (el.type === 'comment' && !firstCommentKeyByPage.has(el.pageId)) {
      firstCommentKeyByPage.set(el.pageId, el.key)
    }
  }
  for (const g of commentRows) {
    const key = firstCommentKeyByPage.get(g.displayId)
    if (!key) continue
    bump(key, g._max?.createdAt ?? new Date(0), g._count?._all ?? 0)
  }

  const unread = new Map<string, number>()
  for (const g of unreadRows) unread.set(`${g.displayId}:${g.elementId}`, g._count?._all ?? 0)

  // ---- engagement ---------------------------------------------------------
  // Keyed by visitor, never by event count: one visitor clicking 40 times is
  // one responder. visitorId is null on events recorded before 2026-07-20, so
  // fall back to sessionId for those.
  const viewersByPage = new Map<string, Set<string>>()
  const respondersByKey = new Map<string, Set<string>>()
  for (const e of events) {
    const who = e.visitorId || e.sessionId
    if (!who) continue
    if (e.eventType === 'view') {
      const set = viewersByPage.get(e.displayId) ?? new Set()
      set.add(who)
      viewersByPage.set(e.displayId, set)
    } else if (e.eventType === 'interact') {
      const elementId = (e.metadata as { elementId?: string } | null)?.elementId
      if (!elementId) continue
      const key = `${e.displayId}:${elementId}`
      const set = respondersByKey.get(key) ?? new Set()
      set.add(who)
      respondersByKey.set(key, set)
    }
  }

  const pageElements: ElementSummary[] = collected.map(({ el, published }) => {
    const c = counts.get(el.key) ?? { total: 0, today: 0, last: null }
    return {
      ...el,
      source: 'page' as const,
      published,
      responseCount: c.total,
      todayCount: c.today,
      lastResponseAt: c.last,
      unreadCount: unread.get(el.key) ?? 0,
      pendingCount: 0,
      engagement: computeEngagement({
        responders: respondersByKey.get(el.key)?.size ?? 0,
        pageViewers: viewersByPage.get(el.pageId)?.size ?? 0,
      }),
      status: 'idle' as const,
    }
  })

  // ---- bulletin -----------------------------------------------------------
  // Bulletin instruments live on a post, not a page. They are always "published"
  // (a post is either published or it isn't a post), and they have no page views
  // to divide by, so engagement stays null.
  const bulletinElements: ElementSummary[] = []
  for (const post of bulletinPosts) {
    const blocks = (parse<CanvasElement[]>(post.blocks) ?? []).filter((b) => b && isDataElementType(b.type))
    for (const block of blocks) {
      const key = bulletinElementKey(post.id, block.id)
      let total = 0
      let today = 0
      let last: string | null = null
      for (const r of post.responses) {
        const answers = (r.responses ?? {}) as Record<string, unknown>
        if (!(block.id in answers)) continue
        total += 1
        if (r.createdAt >= startOfToday) today += 1
        const iso = r.createdAt.toISOString()
        if (!last || iso > last) last = iso
      }
      bulletinElements.push({
        key,
        elementId: block.id,
        type: block.type as ElementSummary['type'],
        title: elementTitle(block),
        pageId: post.id,
        pageTitle: 'Bulletin',
        sectionIndex: 1,
        source: 'bulletin',
        published: true,
        responseCount: total,
        todayCount: today,
        lastResponseAt: last,
        unreadCount: 0,
        pendingCount: 0,
        engagement: null,
        status: 'idle',
      })
    }
  }

  const elements = [...pageElements, ...bulletinElements]
  const engaged = elements.map((e) => e.engagement).filter((v): v is number => v !== null)
  const liveCutoff = Date.now() - 24 * 3600 * 1000

  return NextResponse.json({
    elements,
    totals: {
      elements: elements.length,
      responses: elements.reduce((sum, e) => sum + e.responseCount, 0),
      avgEngagement: engaged.length ? Math.round(engaged.reduce((a, b) => a + b, 0) / engaged.length) : null,
      liveNow: elements.filter(
        (e) => e.published && e.lastResponseAt && Date.parse(e.lastResponseAt) >= liveCutoff
      ).length,
    },
    truncated,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/api/data/elements/route.test.ts`
Expected: PASS — all tests including the earlier Task 4 ones

- [ ] **Step 5: Verify the route exports only a handler**

Run: `grep -n "^export " src/app/api/data/elements/route.ts`
Expected: exactly one line — `export async function GET(request: NextRequest) {`
If anything else is exported, move it to `src/lib/element-os.ts`. This is the `next build` failure `tsc` cannot see.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/data/elements/route.ts src/app/api/data/elements/route.test.ts
git commit -m "feat(data): fold all response stores, engagement and bulletin into the inventory"
```

---

### Task 6: Pulse route

**Files:**
- Create: `src/app/api/data/elements/pulse/route.ts`
- Create: `src/app/api/data/elements/pulse/route.test.ts`

**Interfaces:**
- Produces: `GET /api/data/elements/pulse` → `{ pulse: { key, lastResponseAt, todayCount, live }[] }`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/data/elements/pulse/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findMany: vi.fn().mockResolvedValue([]) },
    formResponse: { findMany: vi.fn().mockResolvedValue([]) },
    comment: { groupBy: vi.fn().mockResolvedValue([]) },
    message: { groupBy: vi.fn().mockResolvedValue([]) },
    waitlistSignup: { groupBy: vi.fn().mockResolvedValue([]) },
    booking: { groupBy: vi.fn().mockResolvedValue([]) },
    jerseySignature: { groupBy: vi.fn().mockResolvedValue([]) },
    bulletinPost: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { GET } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const req = () => new NextRequest('http://localhost/api/data/elements/pulse')
beforeEach(() => vi.clearAllMocks())

describe('GET /api/data/elements/pulse', () => {
  it('401s when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
  })

  it('returns only key, lastResponseAt, todayCount and live', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([{ id: 'd1', published: true }])
    ;(db.waitlistSignup.groupBy as any).mockResolvedValue([
      { displayId: 'd1', elementId: 'w1', _count: { _all: 3 }, _max: { createdAt: new Date() } },
    ])
    const body = await (await GET(req())).json()
    expect(Object.keys(body)).toEqual(['pulse'])
    expect(Object.keys(body.pulse[0]).sort()).toEqual(['key', 'lastResponseAt', 'live', 'todayCount'])
  })

  it('does not read page sections — it never needs element metadata', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(req())
    const select = (db.display.findMany as any).mock.calls[0][0].select
    expect(select).not.toHaveProperty('sections')
    expect(select).not.toHaveProperty('tabs')
  })

  it('marks an element live when its latest response is inside 24h on a published page', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([{ id: 'd1', published: true }])
    ;(db.waitlistSignup.groupBy as any).mockResolvedValue([
      { displayId: 'd1', elementId: 'w1', _count: { _all: 1 }, _max: { createdAt: new Date() } },
    ])
    const body = await (await GET(req())).json()
    expect(body.pulse[0].live).toBe(true)
  })

  it('is not live when the page is unpublished', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([{ id: 'd1', published: false }])
    ;(db.waitlistSignup.groupBy as any).mockResolvedValue([
      { displayId: 'd1', elementId: 'w1', _count: { _all: 1 }, _max: { createdAt: new Date() } },
    ])
    const body = await (await GET(req())).json()
    expect(body.pulse[0].live).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/api/data/elements/pulse/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 3: Write minimal implementation**

Create `src/app/api/data/elements/pulse/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { bulletinElementKey, LIVE_WINDOW_MS } from '@/lib/element-os'

// Deliberately tiny: this is polled every 30s. It returns activity only — no
// element metadata, no section parsing, no engagement. The full inventory is
// fetched once; this patches it in place.
//
// Comments are deliberately absent: Comment rows carry no elementId, so
// attributing them needs the "first comment element on the page" rule, which
// needs section parsing — exactly the cost this endpoint exists to avoid.
// Comment counts therefore refresh on a full tab load rather than on pulse.
export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const displays = await db.display.findMany({
    where: { userId: user.id },
    select: { id: true, published: true },
  })
  const displayIds = displays.map((d) => d.id)
  const publishedById = new Map(displays.map((d) => [d.id, d.published]))

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const activity = new Map<string, { last: string | null; today: number; published: boolean }>()
  const bump = (key: string, published: boolean, at: Date, n: number) => {
    const cur = activity.get(key) ?? { last: null, today: 0, published }
    const iso = at.toISOString()
    if (!cur.last || iso > cur.last) cur.last = iso
    if (at >= startOfToday) cur.today += n
    activity.set(key, cur)
  }

  if (displayIds.length) {
    const grouped = { by: ['displayId', 'elementId'] as const, _count: { _all: true }, _max: { createdAt: true } }
    const where = { displayId: { in: displayIds } }
    const [forms, messages, waitlist, bookings, jerseys] = await Promise.all([
      db.formResponse.findMany({
        where: { ...where, submittedAt: { gte: startOfToday } },
        select: { displayId: true, responses: true, submittedAt: true },
      }),
      db.message.groupBy({ ...grouped, where: { ...where, ownerId: user.id } }),
      db.waitlistSignup.groupBy({ ...grouped, where }),
      db.booking.groupBy({ ...grouped, where }),
      db.jerseySignature.groupBy({ ...grouped, where }),
    ])

    for (const row of forms) {
      const answers = (row.responses ?? {}) as Record<string, unknown>
      for (const elementId of Object.keys(answers)) {
        bump(`${row.displayId}:${elementId}`, publishedById.get(row.displayId) ?? false, row.submittedAt, 1)
      }
    }
    for (const g of [...messages, ...waitlist, ...bookings, ...jerseys]) {
      const at = g._max?.createdAt
      if (!at) continue
      bump(`${g.displayId}:${g.elementId}`, publishedById.get(g.displayId) ?? false, at, at >= startOfToday ? (g._count?._all ?? 0) : 0)
    }
  }

  const bulletinPosts = await db.bulletinPost.findMany({
    where: { authorId: user.id },
    select: { id: true, responses: { select: { createdAt: true, responses: true } } },
  })
  for (const post of bulletinPosts) {
    for (const r of post.responses) {
      const answers = (r.responses ?? {}) as Record<string, unknown>
      for (const elementId of Object.keys(answers)) {
        bump(bulletinElementKey(post.id, elementId), true, r.createdAt, r.createdAt >= startOfToday ? 1 : 0)
      }
    }
  }

  const now = Date.now()
  return NextResponse.json({
    pulse: [...activity.entries()].map(([key, v]) => ({
      key,
      lastResponseAt: v.last,
      todayCount: v.today,
      live: Boolean(v.published && v.last && now - Date.parse(v.last) < LIVE_WINDOW_MS),
    })),
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/api/data/elements/pulse/route.test.ts`
Expected: PASS

- [ ] **Step 5: Verify exports**

Run: `grep -n "^export " src/app/api/data/elements/pulse/route.ts`
Expected: exactly one `export async function GET`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/data/elements/pulse
git commit -m "feat(data): lightweight pulse endpoint for the element grid"
```

---

### Task 7: localStorage last-seen hook

**Files:**
- Create: `src/components/analytics/interactions/useElementSeen.ts`
- Create: `src/components/analytics/interactions/useElementSeen.test.ts`

**Interfaces:**
- Produces: `SEEN_STORAGE_KEY`, `readSeen()`, `markSeen(key, at?)`, `useElementSeen()` → `{ seen, markSeen }`

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/interactions/useElementSeen.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { readSeen, markSeen, SEEN_STORAGE_KEY } from './useElementSeen'

beforeEach(() => localStorage.clear())

describe('element last-seen stamps', () => {
  it('returns an empty map when nothing is stored', () => {
    expect(readSeen()).toEqual({})
  })

  it('stores a stamp per composite key', () => {
    markSeen('d1:e1', new Date('2026-07-21T00:00:00.000Z'))
    expect(readSeen()['d1:e1']).toBe('2026-07-21T00:00:00.000Z')
  })

  it('keeps stamps for other elements when marking one', () => {
    markSeen('d1:e1', new Date('2026-07-20T00:00:00.000Z'))
    markSeen('d2:e1', new Date('2026-07-21T00:00:00.000Z'))
    expect(Object.keys(readSeen()).sort()).toEqual(['d1:e1', 'd2:e1'])
  })

  it('survives corrupt storage without throwing', () => {
    localStorage.setItem(SEEN_STORAGE_KEY, 'not json')
    expect(readSeen()).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/analytics/interactions/useElementSeen.test.ts`
Expected: FAIL — cannot resolve `./useElementSeen`

- [ ] **Step 3: Write minimal implementation**

Create `src/components/analytics/interactions/useElementSeen.ts`:

```ts
'use client'

import { useCallback, useState } from 'react'

// Per-device, per-browser record of when the owner last opened each element.
// Deliberately localStorage rather than a table: it needs no migration, and
// "what have I already looked at" is a device-local question.
export const SEEN_STORAGE_KEY = 'galli_element_seen'

export type SeenMap = Record<string, string>

export function readSeen(): SeenMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as SeenMap) : {}
  } catch {
    return {}
  }
}

export function markSeen(key: string, at: Date = new Date()): SeenMap {
  const next = { ...readSeen(), [key]: at.toISOString() }
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private mode or quota — the grid still works, statuses just won't persist.
  }
  return next
}

export function useElementSeen() {
  const [seen, setSeen] = useState<SeenMap>(() => readSeen())
  const mark = useCallback((key: string) => setSeen(markSeen(key)), [])
  return { seen, markSeen: mark }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/analytics/interactions/useElementSeen.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/interactions/useElementSeen.ts src/components/analytics/interactions/useElementSeen.test.ts
git commit -m "feat(data): per-device last-seen stamps for elements"
```

---

### Task 8: InsightsStrip

**Files:**
- Create: `src/components/analytics/interactions/InsightsStrip.tsx`
- Create: `src/components/analytics/interactions/InsightsStrip.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks beyond types
- Produces: `<InsightsStrip totals={{elements, responses, avgEngagement, needsAttention, liveNow}} onFilterStatus={(s: ElementStatus) => void} />`

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/interactions/InsightsStrip.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InsightsStrip } from './InsightsStrip'

const totals = { elements: 18, responses: 1483, avgEngagement: 73, needsAttention: 12, liveNow: 4 }

describe('InsightsStrip', () => {
  it('renders all five stats with formatted values', () => {
    render(<InsightsStrip totals={totals} onFilterStatus={() => {}} />)
    expect(screen.getByText('1,483')).toBeTruthy()
    expect(screen.getByText('73%')).toBeTruthy()
    for (const label of ['Elements', 'Responses', 'Avg. Engagement', 'Need Attention', 'Live Now']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('shows a dash when engagement has too little data to report', () => {
    render(<InsightsStrip totals={{ ...totals, avgEngagement: null }} onFilterStatus={() => {}} />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('filters to needs-attention when that stat is clicked', () => {
    const onFilterStatus = vi.fn()
    render(<InsightsStrip totals={totals} onFilterStatus={onFilterStatus} />)
    fireEvent.click(screen.getByRole('button', { name: /need attention/i }))
    expect(onFilterStatus).toHaveBeenCalledWith('needs-attention')
  })

  it('filters to live when that stat is clicked', () => {
    const onFilterStatus = vi.fn()
    render(<InsightsStrip totals={totals} onFilterStatus={onFilterStatus} />)
    fireEvent.click(screen.getByRole('button', { name: /live now/i }))
    expect(onFilterStatus).toHaveBeenCalledWith('live')
  })

  it('does not make the non-actionable stats clickable', () => {
    render(<InsightsStrip totals={totals} onFilterStatus={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/analytics/interactions/InsightsStrip.test.tsx`
Expected: FAIL — cannot resolve `./InsightsStrip`

- [ ] **Step 3: Write minimal implementation**

Create `src/components/analytics/interactions/InsightsStrip.tsx`:

```tsx
'use client'

import { Boxes, MessageSquare, Activity, BellDot, Radio } from 'lucide-react'
import type { ElementStatus } from '@/lib/element-os'

export interface StripTotals {
  elements: number
  responses: number
  avgEngagement: number | null
  needsAttention: number
  liveNow: number
}

const fmt = (n: number) => n.toLocaleString('en-US')

function Stat({
  icon,
  value,
  label,
  tint,
  onClick,
}: {
  icon: React.ReactNode
  value: string
  label: string
  tint: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold leading-tight">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </>
  )
  if (!onClick) return <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-muted/60"
    >
      {inner}
    </button>
  )
}

export function InsightsStrip({
  totals,
  onFilterStatus,
}: {
  totals: StripTotals
  onFilterStatus: (status: ElementStatus) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-2 shadow-soft">
      <Stat icon={<Boxes className="h-5 w-5 text-galli-dark" />} tint="bg-galli/15" value={fmt(totals.elements)} label="Elements" />
      <Stat icon={<MessageSquare className="h-5 w-5 text-galli-violet" />} tint="bg-galli-violet/15" value={fmt(totals.responses)} label="Responses" />
      <Stat
        icon={<Activity className="h-5 w-5 text-galli-aqua" />}
        tint="bg-galli-aqua/15"
        value={totals.avgEngagement === null ? '—' : `${totals.avgEngagement}%`}
        label="Avg. Engagement"
      />
      <Stat
        icon={<BellDot className="h-5 w-5 text-amber-600" />}
        tint="bg-amber-500/15"
        value={fmt(totals.needsAttention)}
        label="Need Attention"
        onClick={() => onFilterStatus('needs-attention')}
      />
      <Stat
        icon={<Radio className="h-5 w-5 text-galli-dark" />}
        tint="bg-galli/15"
        value={fmt(totals.liveNow)}
        label="Live Now"
        onClick={() => onFilterStatus('live')}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/analytics/interactions/InsightsStrip.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/interactions/InsightsStrip.tsx src/components/analytics/interactions/InsightsStrip.test.tsx
git commit -m "feat(data): insights strip for the Interactions tab"
```

---

### Task 9: FilterRail

**Files:**
- Create: `src/components/analytics/interactions/FilterRail.tsx`
- Create: `src/components/analytics/interactions/FilterRail.test.tsx`

**Interfaces:**
- Consumes: `ElementFilter`, `SortMode`, `DataElementType`, `ElementStatus`, `TYPE_GROUPS` from `@/lib/element-os`
- Produces: `<FilterRail filter sort statusCounts onChange onSortChange onReset />` where `statusCounts: Record<ElementStatus, number>`

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/interactions/FilterRail.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterRail } from './FilterRail'
import type { ElementFilter } from '@/lib/element-os'

const filter: ElementFilter = { search: '', types: [], statuses: [], source: 'all' }
const counts = { 'needs-attention': 12, live: 4, draft: 2, idle: 1 }

const setup = (over: Partial<React.ComponentProps<typeof FilterRail>> = {}) => {
  const onChange = vi.fn()
  const onSortChange = vi.fn()
  const onReset = vi.fn()
  render(
    <FilterRail
      filter={filter}
      sort="most-active"
      statusCounts={counts}
      onChange={onChange}
      onSortChange={onSortChange}
      onReset={onReset}
      {...over}
    />
  )
  return { onChange, onSortChange, onReset }
}

describe('FilterRail', () => {
  it('emits search text', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByPlaceholderText(/search elements/i), { target: { value: 'nba' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'nba' }))
  })

  it('toggles a type chip on', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Polls' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ types: ['poll', 'mcq'] }))
  })

  it('toggles a selected type chip back off', () => {
    const { onChange } = setup({ filter: { ...filter, types: ['poll', 'mcq'] } })
    fireEvent.click(screen.getByRole('button', { name: 'Polls' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ types: [] }))
  })

  it('shows a count beside each status', () => {
    setup()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('Need Attention')).toBeTruthy()
  })

  it('toggles a status checkbox', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByLabelText(/live now/i))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ statuses: ['live'] }))
  })

  it('switches source', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Bulletin' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ source: 'bulletin' }))
  })

  it('emits a sort change', () => {
    const { onSortChange } = setup()
    fireEvent.change(screen.getByLabelText(/sort by/i), { target: { value: 'stale' } })
    expect(onSortChange).toHaveBeenCalledWith('stale')
  })

  it('resets', () => {
    const { onReset } = setup()
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(onReset).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/analytics/interactions/FilterRail.test.tsx`
Expected: FAIL — cannot resolve `./FilterRail`

- [ ] **Step 3: Write minimal implementation**

Create `src/components/analytics/interactions/FilterRail.tsx`:

```tsx
'use client'

import { Search } from 'lucide-react'
import { TYPE_GROUPS, type ElementFilter, type ElementStatus, type SortMode } from '@/lib/element-os'

const STATUSES: { id: ElementStatus; label: string; dot: string }[] = [
  { id: 'needs-attention', label: 'Need Attention', dot: 'bg-amber-500' },
  { id: 'live', label: 'Live Now', dot: 'bg-galli' },
  { id: 'draft', label: 'Draft', dot: 'bg-muted-foreground' },
  { id: 'idle', label: 'Idle', dot: 'bg-border' },
]

const SORTS: { id: SortMode; label: string }[] = [
  { id: 'most-active', label: 'Most active' },
  { id: 'least-active', label: 'Least active' },
  { id: 'recent', label: 'Recent activity' },
  { id: 'stale', label: 'Longest idle' },
]

const SOURCES: { id: ElementFilter['source']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'page', label: 'Pages' },
  { id: 'bulletin', label: 'Bulletin' },
]

export function FilterRail({
  filter,
  sort,
  statusCounts,
  onChange,
  onSortChange,
  onReset,
}: {
  filter: ElementFilter
  sort: SortMode
  statusCounts: Record<ElementStatus, number>
  onChange: (next: ElementFilter) => void
  onSortChange: (next: SortMode) => void
  onReset: () => void
}) {
  // A chip represents a display group, which can cover more than one element
  // type (a "Polls" chip selects poll + mcq).
  const groupActive = (types: string[]) => types.every((t) => filter.types.includes(t as never))
  const toggleGroup = (types: string[]) => {
    const next = groupActive(types)
      ? filter.types.filter((t) => !types.includes(t))
      : [...filter.types, ...types.filter((t) => !filter.types.includes(t as never))]
    onChange({ ...filter, types: next as ElementFilter['types'] })
  }

  const toggleStatus = (id: ElementStatus) => {
    const next = filter.statuses.includes(id)
      ? filter.statuses.filter((s) => s !== id)
      : [...filter.statuses, id]
    onChange({ ...filter, statuses: next })
  }

  return (
    <aside className="space-y-5 rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Filter Elements</h2>
        <button onClick={onReset} className="text-xs font-medium text-galli-dark hover:underline">
          Reset
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filter.search}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
          placeholder="Search elements..."
          className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm"
        />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
        <div className="flex flex-wrap gap-2">
          {TYPE_GROUPS.map((g) => (
            <button
              key={g.label}
              onClick={() => toggleGroup(g.types)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                groupActive(g.types)
                  ? 'border-galli bg-galli/10 text-galli-dark'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
        <div className="space-y-1.5">
          {STATUSES.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filter.statuses.includes(s.id)}
                onChange={() => toggleStatus(s.id)}
                className="rounded border-border"
              />
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              <span className="flex-1">{s.label}</span>
              <span className="text-xs text-muted-foreground">{statusCounts[s.id] ?? 0}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source</p>
        <div className="flex gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange({ ...filter, source: s.id })}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                filter.source === s.id
                  ? 'border-galli bg-galli/10 text-galli-dark'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="element-sort" className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sort by
        </label>
        <select
          id="element-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/analytics/interactions/FilterRail.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/interactions/FilterRail.tsx src/components/analytics/interactions/FilterRail.test.tsx
git commit -m "feat(data): filter rail for the element grid"
```

---

### Task 10: ElementCard and card bodies

**Files:**
- Create: `src/components/analytics/interactions/card-bodies/index.tsx`
- Create: `src/components/analytics/interactions/ElementCard.tsx`
- Create: `src/components/analytics/interactions/ElementCard.test.tsx`

**Interfaces:**
- Consumes: `ElementSummary`, `ElementStatus`
- Produces: `<CardBody element={ElementSummary} />`, `<ElementCard element onOpen={(el, tab: 'responses' | 'analytics') => void} editHref={string} />`

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/interactions/ElementCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ElementCard } from './ElementCard'
import type { ElementSummary } from '@/lib/element-os'

const el = (over: Partial<ElementSummary> = {}): ElementSummary => ({
  key: 'd1:e1',
  elementId: 'e1',
  type: 'poll',
  title: 'Favorite NBA Player',
  pageId: 'd1',
  pageTitle: 'Homepage',
  sectionIndex: 2,
  source: 'page',
  published: true,
  responseCount: 143,
  todayCount: 18,
  lastResponseAt: new Date().toISOString(),
  unreadCount: 0,
  pendingCount: 0,
  engagement: 84,
  status: 'live',
  ...over,
})

describe('ElementCard', () => {
  it('renders the title, counts and engagement', () => {
    render(<ElementCard element={el()} onOpen={() => {}} editHref="/editor/d1" />)
    expect(screen.getByText('Favorite NBA Player')).toBeTruthy()
    expect(screen.getByText('143')).toBeTruthy()
    expect(screen.getByText('84%')).toBeTruthy()
  })

  it('renders the location as page and 1-based section, since sections have no names', () => {
    render(<ElementCard element={el()} onOpen={() => {}} editHref="/editor/d1" />)
    expect(screen.getByText('Homepage · Section 2')).toBeTruthy()
  })

  it('includes the tab label in the location for tabbed pages', () => {
    render(<ElementCard element={el({ tabLabel: 'Reviews' })} onOpen={() => {}} editHref="/editor/d1" />)
    expect(screen.getByText('Homepage · Reviews · Section 2')).toBeTruthy()
  })

  it('shows a Bulletin chip instead of a page location for bulletin instruments', () => {
    render(<ElementCard element={el({ source: 'bulletin', pageTitle: 'Bulletin' })} onOpen={() => {}} editHref="/bulletin" />)
    expect(screen.getByText('Bulletin')).toBeTruthy()
  })

  it('shows a LIVE pill only when live', () => {
    const { rerender } = render(<ElementCard element={el()} onOpen={() => {}} editHref="/e" />)
    expect(screen.getByText('LIVE')).toBeTruthy()
    rerender(<ElementCard element={el({ status: 'idle' })} onOpen={() => {}} editHref="/e" />)
    expect(screen.queryByText('LIVE')).toBeNull()
  })

  it('shows a dash for engagement when there is too little data', () => {
    render(<ElementCard element={el({ engagement: null })} onOpen={() => {}} editHref="/e" />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('opens the drawer on Responses and on Analytics', () => {
    const onOpen = vi.fn()
    render(<ElementCard element={el()} onOpen={onOpen} editHref="/e" />)
    fireEvent.click(screen.getByRole('button', { name: /responses/i }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'd1:e1' }), 'responses')
    fireEvent.click(screen.getByRole('button', { name: /analytics/i }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'd1:e1' }), 'analytics')
  })

  it('links Edit to the owning page', () => {
    render(<ElementCard element={el()} onOpen={() => {}} editHref="/editor/d1" />)
    expect(screen.getByRole('link', { name: /edit/i }).getAttribute('href')).toBe('/editor/d1')
  })

  it('renders an unread badge for mailboxes', () => {
    render(<ElementCard element={el({ type: 'mailbox', unreadCount: 4, status: 'needs-attention' })} onOpen={() => {}} editHref="/e" />)
    expect(screen.getByText('4 unread')).toBeTruthy()
  })

  it('renders a waitlist capacity line', () => {
    render(<ElementCard element={el({ type: 'waitlist', responseCount: 623 })} onOpen={() => {}} editHref="/e" />)
    expect(screen.getByText('623 joined')).toBeTruthy()
  })

  it('says so when nothing has been collected yet', () => {
    render(<ElementCard element={el({ responseCount: 0, lastResponseAt: null, status: 'idle' })} onOpen={() => {}} editHref="/e" />)
    expect(screen.getByText(/no responses yet/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/analytics/interactions/ElementCard.test.tsx`
Expected: FAIL — cannot resolve `./ElementCard`

- [ ] **Step 3: Write the card bodies**

Create `src/components/analytics/interactions/card-bodies/index.tsx`:

```tsx
'use client'

import type { ElementSummary } from '@/lib/element-os'

// The distinctive middle of a card, per element family. Kept deliberately thin:
// the full roster and distribution live in the drawer, this is the glance.
export function CardBody({ element }: { element: ElementSummary }) {
  if (element.responseCount === 0) {
    return <p className="text-sm text-muted-foreground">No responses yet</p>
  }

  switch (element.type) {
    case 'mailbox':
      return (
        <p className="text-sm">
          {element.unreadCount > 0 ? (
            <span className="font-semibold text-amber-600">{element.unreadCount} unread</span>
          ) : (
            <span className="text-muted-foreground">All caught up</span>
          )}
        </p>
      )
    case 'waitlist':
      return <p className="text-sm font-medium">{element.responseCount.toLocaleString('en-US')} joined</p>
    case 'appointments':
      return <p className="text-sm font-medium">{element.responseCount.toLocaleString('en-US')} booked</p>
    case 'rsvp':
    case 'wedding-rsvp':
      return <p className="text-sm font-medium">{element.responseCount.toLocaleString('en-US')} RSVPs</p>
    case 'jersey':
      return <p className="text-sm font-medium">{element.responseCount.toLocaleString('en-US')} signatures</p>
    default:
      return (
        <p className="text-sm text-muted-foreground">
          {element.responseCount.toLocaleString('en-US')} response
          {element.responseCount === 1 ? '' : 's'} collected
        </p>
      )
  }
}
```

- [ ] **Step 4: Write the card**

Create `src/components/analytics/interactions/ElementCard.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { BarChart3, MessageSquare, Pencil } from 'lucide-react'
import type { ElementSummary, ElementStatus } from '@/lib/element-os'
import { CardBody } from './card-bodies'

const STATUS_PILL: Record<ElementStatus, { label: string; className: string } | null> = {
  live: { label: 'LIVE', className: 'bg-galli/15 text-galli-dark' },
  'needs-attention': { label: 'NEEDS YOU', className: 'bg-amber-500/15 text-amber-700' },
  draft: { label: 'DRAFT', className: 'bg-muted text-muted-foreground' },
  idle: null,
}

function relativeTime(iso: string | null): string | null {
  if (!iso) return null
  const diff = Date.now() - Date.parse(iso)
  if (!Number.isFinite(diff)) return null
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function ElementCard({
  element,
  onOpen,
  editHref,
}: {
  element: ElementSummary
  onOpen: (element: ElementSummary, tab: 'responses' | 'analytics') => void
  editHref: string
}) {
  const pill = STATUS_PILL[element.status]
  // Sections carry no name in the schema, so location is positional.
  const location =
    element.source === 'bulletin'
      ? null
      : [element.pageTitle, element.tabLabel, `Section ${element.sectionIndex}`].filter(Boolean).join(' · ')
  const last = relativeTime(element.lastResponseAt)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft transition hover:border-galli/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{element.title}</p>
          {location ? (
            <p className="truncate text-xs text-muted-foreground">{location}</p>
          ) : (
            <span className="mt-0.5 inline-block rounded-full bg-galli-violet/15 px-2 py-0.5 text-[10px] font-semibold text-galli-violet">
              Bulletin
            </span>
          )}
        </div>
        {pill && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${pill.className}`}>
            {pill.label}
          </span>
        )}
      </div>

      <div className="flex items-end gap-4">
        <span>
          <span className="block text-xl font-bold leading-none">{element.responseCount.toLocaleString('en-US')}</span>
          <span className="text-[11px] text-muted-foreground">Responses</span>
        </span>
        <span>
          <span className="block text-xl font-bold leading-none">
            {element.todayCount > 0 ? `+${element.todayCount}` : '0'}
          </span>
          <span className="text-[11px] text-muted-foreground">Today</span>
        </span>
        <span className="ml-auto text-right">
          <span className="block text-xl font-bold leading-none">
            {element.engagement === null ? '—' : `${element.engagement}%`}
          </span>
          <span className="text-[11px] text-muted-foreground">Engagement</span>
        </span>
      </div>

      <CardBody element={element} />

      {last && <p className="text-xs text-muted-foreground">Last response {last}</p>}

      <div className="flex items-center gap-1 border-t border-border pt-2 text-xs">
        <button
          onClick={() => onOpen(element, 'analytics')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <BarChart3 className="h-3.5 w-3.5" /> Analytics
        </button>
        <button
          onClick={() => onOpen(element, 'responses')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <MessageSquare className="h-3.5 w-3.5" /> Responses
        </button>
        <Link
          href={editHref}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/components/analytics/interactions/ElementCard.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/analytics/interactions/ElementCard.tsx src/components/analytics/interactions/ElementCard.test.tsx src/components/analytics/interactions/card-bodies
git commit -m "feat(data): element status card with per-type bodies"
```

---

### Task 11: TypeGroup

**Files:**
- Create: `src/components/analytics/interactions/TypeGroup.tsx`
- Create: `src/components/analytics/interactions/TypeGroup.test.tsx`

**Interfaces:**
- Produces: `<TypeGroup label={string} count={number} defaultOpen={boolean}>{children}</TypeGroup>`

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/interactions/TypeGroup.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TypeGroup } from './TypeGroup'

describe('TypeGroup', () => {
  it('renders the label, count and children', () => {
    render(
      <TypeGroup label="Polls" count={3}>
        <p>card</p>
      </TypeGroup>
    )
    expect(screen.getByText('Polls')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('card')).toBeTruthy()
  })

  it('collapses and expands on click', () => {
    render(
      <TypeGroup label="Polls" count={1}>
        <p>card</p>
      </TypeGroup>
    )
    fireEvent.click(screen.getByRole('button', { name: /polls/i }))
    expect(screen.queryByText('card')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /polls/i }))
    expect(screen.getByText('card')).toBeTruthy()
  })

  it('can start collapsed', () => {
    render(
      <TypeGroup label="Polls" count={1} defaultOpen={false}>
        <p>card</p>
      </TypeGroup>
    )
    expect(screen.queryByText('card')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/analytics/interactions/TypeGroup.test.tsx`
Expected: FAIL — cannot resolve `./TypeGroup`

- [ ] **Step 3: Write minimal implementation**

Create `src/components/analytics/interactions/TypeGroup.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function TypeGroup({
  label,
  count,
  defaultOpen = true,
  children,
}: {
  label: string
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-3 flex w-full items-center gap-2 text-left"
      >
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? '' : '-rotate-90'}`} />
        <h2 className="text-base font-bold">{label}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{count}</span>
      </button>
      {open && <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/analytics/interactions/TypeGroup.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/interactions/TypeGroup.tsx src/components/analytics/interactions/TypeGroup.test.tsx
git commit -m "feat(data): collapsible type groups for the element grid"
```

---

### Task 12: Detail route for the drawer

**Files:**
- Create: `src/app/api/data/elements/[displayId]/[elementId]/route.ts`
- Create: `src/app/api/data/elements/[displayId]/[elementId]/route.test.ts`

**Interfaces:**
- Produces: `GET /api/data/elements/[displayId]/[elementId]` → `{ element: {elementId, type, title}, responses: {answer, submittedAt}[], series: {date, count}[] }`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/data/elements/[displayId]/[elementId]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    formResponse: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { GET } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const req = () => new NextRequest('http://localhost/api/data/elements/d1/e1')
const ctx = { params: Promise.resolve({ displayId: 'd1', elementId: 'e1' }) }

const display = {
  id: 'd1',
  userId: 'me',
  title: 'Homepage',
  sections: [{ id: 's1', layout: 'single', columns: [{ id: 'c1', elements: [{ id: 'e1', type: 'poll', pollQuestion: 'Best?' }] }] }],
  tabs: null,
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/data/elements/[displayId]/[elementId]', () => {
  it('401s when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(req(), ctx)).status).toBe(401)
  })

  it('404s for a display that does not exist', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(null)
    expect((await GET(req(), ctx)).status).toBe(404)
  })

  it('403s when the display belongs to someone else', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue({ ...display, userId: 'someone-else' })
    expect((await GET(req(), ctx)).status).toBe(403)
  })

  it('404s when the element is not on that page', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(display)
    const res = await GET(req(), { params: Promise.resolve({ displayId: 'd1', elementId: 'nope' }) })
    expect(res.status).toBe(404)
  })

  it('returns the element, its responses and a daily series', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(display)
    ;(db.formResponse.findMany as any).mockResolvedValue([
      { responses: { e1: { type: 'poll', answer: 'A' } }, submittedAt: new Date('2026-07-20T10:00:00Z') },
      { responses: { e1: { type: 'poll', answer: 'B' } }, submittedAt: new Date('2026-07-20T11:00:00Z') },
      { responses: { other: { type: 'poll', answer: 'C' } }, submittedAt: new Date('2026-07-20T12:00:00Z') },
    ])
    const body = await (await GET(req(), ctx)).json()
    expect(body.element).toMatchObject({ elementId: 'e1', type: 'poll', title: 'Best?' })
    expect(body.responses).toHaveLength(2)
    expect(body.series.find((d: any) => d.date === '2026-07-20').count).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run "src/app/api/data/elements/[displayId]/[elementId]/route.test.ts"`
Expected: FAIL — cannot resolve `./route`

- [ ] **Step 3: Write minimal implementation**

Create `src/app/api/data/elements/[displayId]/[elementId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { collectDataElements } from '@/lib/element-os'
import type { Section } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

const SERIES_DAYS = 30

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ displayId: string; elementId: string }> }
) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { displayId, elementId } = await params
  const display = await db.display.findUnique({
    where: { id: displayId },
    select: { id: true, userId: true, title: true, sections: true, tabs: true },
  })
  if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (display.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parse = <T,>(v: unknown): T | null =>
    typeof v === 'string' ? (JSON.parse(v) as T) : ((v as T) ?? null)

  const element = collectDataElements(
    parse<Section[]>(display.sections) ?? [],
    parse<TabsConfig>(display.tabs),
    display.id,
    display.title
  ).find((e) => e.elementId === elementId)

  if (!element) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const since = new Date(Date.now() - SERIES_DAYS * 24 * 3600 * 1000)
  const rows = await db.formResponse.findMany({
    where: { displayId, submittedAt: { gte: since } },
    select: { responses: true, submittedAt: true },
    orderBy: { submittedAt: 'desc' },
  })

  const mine = rows.filter((r) => {
    const answers = (r.responses ?? {}) as Record<string, unknown>
    return elementId in answers
  })

  const byDay = new Map<string, number>()
  for (const r of mine) {
    const day = r.submittedAt.toISOString().slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }

  return NextResponse.json({
    element: { elementId: element.elementId, type: element.type, title: element.title },
    responses: mine.slice(0, 200).map((r) => ({
      answer: ((r.responses ?? {}) as Record<string, { answer?: unknown }>)[elementId]?.answer ?? null,
      submittedAt: r.submittedAt.toISOString(),
    })),
    series: [...byDay.entries()].sort().map(([date, count]) => ({ date, count })),
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run "src/app/api/data/elements/[displayId]/[elementId]/route.test.ts"`
Expected: PASS

- [ ] **Step 5: Verify exports**

Run: `grep -n "^export " "src/app/api/data/elements/[displayId]/[elementId]/route.ts"`
Expected: exactly one `export async function GET`

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/data/elements/[displayId]"
git commit -m "feat(data): per-element detail route for the drawer"
```

---

### Task 13: ElementDrawer

**Files:**
- Create: `src/components/analytics/interactions/ElementDrawer.tsx`
- Create: `src/components/analytics/interactions/ElementDrawer.test.tsx`

**Interfaces:**
- Consumes: `GET /api/data/elements/[displayId]/[elementId]`, `ElementSummary`
- Produces: `<ElementDrawer element={ElementSummary | null} tab onTabChange onClose />`

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/interactions/ElementDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ElementDrawer } from './ElementDrawer'
import type { ElementSummary } from '@/lib/element-os'

const el: ElementSummary = {
  key: 'd1:e1', elementId: 'e1', type: 'poll', title: 'Favorite NBA Player',
  pageId: 'd1', pageTitle: 'Homepage', sectionIndex: 1, source: 'page', published: true,
  responseCount: 2, todayCount: 1, lastResponseAt: new Date().toISOString(),
  unreadCount: 0, pendingCount: 0, engagement: 84, status: 'live',
}

const payload = {
  element: { elementId: 'e1', type: 'poll', title: 'Favorite NBA Player' },
  responses: [
    { answer: 'LeBron', submittedAt: '2026-07-20T10:00:00.000Z' },
    { answer: 'MJ', submittedAt: '2026-07-19T10:00:00.000Z' },
  ],
  series: [{ date: '2026-07-20', count: 1 }],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))
})
afterEach(() => vi.unstubAllGlobals())

describe('ElementDrawer', () => {
  it('renders nothing when no element is selected', () => {
    const { container } = render(<ElementDrawer element={null} tab="responses" onTabChange={() => {}} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the element header and fetched responses', async () => {
    render(<ElementDrawer element={el} tab="responses" onTabChange={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Favorite NBA Player')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('LeBron')).toBeTruthy())
  })

  it('fetches the composite path for a page element', async () => {
    render(<ElementDrawer element={el} tab="responses" onTabChange={() => {}} onClose={() => {}} />)
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/data/elements/d1/e1')
    )
  })

  it('switches to the analytics tab', () => {
    const onTabChange = vi.fn()
    render(<ElementDrawer element={el} tab="responses" onTabChange={onTabChange} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /analytics/i }))
    expect(onTabChange).toHaveBeenCalledWith('analytics')
  })

  it('closes on the close button and on Escape', () => {
    const onClose = vi.fn()
    render(<ElementDrawer element={el} tab="responses" onTabChange={() => {}} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('uses the bulletin analytics source for bulletin instruments', async () => {
    render(
      <ElementDrawer
        element={{ ...el, key: 'bulletin:p1:e1', source: 'bulletin', pageId: 'p1' }}
        tab="responses"
        onTabChange={() => {}}
        onClose={() => {}}
      />
    )
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/bulletin/analytics'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/analytics/interactions/ElementDrawer.test.tsx`
Expected: FAIL — cannot resolve `./ElementDrawer`

- [ ] **Step 3: Write minimal implementation**

Create `src/components/analytics/interactions/ElementDrawer.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ElementSummary } from '@/lib/element-os'

export type DrawerTab = 'responses' | 'analytics'

interface DetailPayload {
  element: { elementId: string; type: string; title: string }
  responses: { answer: unknown; submittedAt: string }[]
  series: { date: string; count: number }[]
}

export function ElementDrawer({
  element,
  tab,
  onTabChange,
  onClose,
}: {
  element: ElementSummary | null
  tab: DrawerTab
  onTabChange: (tab: DrawerTab) => void
  onClose: () => void
}) {
  const [data, setData] = useState<DetailPayload | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!element) return
    let cancelled = false
    setLoading(true)
    setData(null)
    // Bulletin instruments live on posts, not pages, and are served by the
    // existing bulletin analytics endpoint.
    const url =
      element.source === 'bulletin'
        ? '/api/bulletin/analytics'
        : `/api/data/elements/${element.pageId}/${element.elementId}`
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [element])

  if (!element) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">{element.title}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {element.responseCount.toLocaleString('en-US')} responses
              {element.engagement !== null && ` · ${element.engagement}% engagement`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-4">
          {(['responses', 'analytics'] as DrawerTab[]).map((t) => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className={`border-b-2 px-3 py-2 text-sm font-medium capitalize transition ${
                tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : tab === 'responses' ? (
            !data?.responses?.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No responses yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.responses.map((r, i) => (
                  <li key={i} className="rounded-lg border border-border p-3">
                    <p className="text-sm">{Array.isArray(r.answer) ? r.answer.join(', ') : String(r.answer ?? '')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.submittedAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : !data?.series?.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No activity in the last 30 days.</p>
          ) : (
            <ul className="space-y-1">
              {data.series.map((d) => (
                <li key={d.date} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-muted-foreground">{d.date}</span>
                  <span className="h-2 rounded-full bg-galli" style={{ width: `${Math.min(100, d.count * 8)}px` }} />
                  <span className="text-muted-foreground">{d.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/analytics/interactions/ElementDrawer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/interactions/ElementDrawer.tsx src/components/analytics/interactions/ElementDrawer.test.tsx
git commit -m "feat(data): element detail drawer"
```

---

### Task 14: InteractionsTab container

**Files:**
- Create: `src/components/analytics/interactions/InteractionsTab.tsx`
- Create: `src/components/analytics/interactions/InteractionsTab.test.tsx`

**Interfaces:**
- Consumes: everything above
- Produces: `<InteractionsTab />` — no props; it is account-wide

- [ ] **Step 1: Write the failing test**

Create `src/components/analytics/interactions/InteractionsTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InteractionsTab } from './InteractionsTab'

const inventory = {
  elements: [
    {
      key: 'd1:e1', elementId: 'e1', type: 'poll', title: 'Favorite NBA Player',
      pageId: 'd1', pageTitle: 'Homepage', sectionIndex: 1, source: 'page', published: true,
      responseCount: 143, todayCount: 18, lastResponseAt: new Date().toISOString(),
      unreadCount: 0, pendingCount: 0, engagement: 84, status: 'idle',
    },
    {
      key: 'd2:w1', elementId: 'w1', type: 'waitlist', title: 'Beta waitlist',
      pageId: 'd2', pageTitle: 'Product Hub', sectionIndex: 1, source: 'page', published: true,
      responseCount: 623, todayCount: 0, lastResponseAt: '2026-01-01T00:00:00.000Z',
      unreadCount: 0, pendingCount: 0, engagement: null, status: 'idle',
    },
  ],
  totals: { elements: 2, responses: 766, avgEngagement: 84, liveNow: 1 },
  truncated: false,
}

const mockFetch = (body: unknown = inventory) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => body })

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', mockFetch())
})
afterEach(() => vi.unstubAllGlobals())

describe('InteractionsTab', () => {
  it('shows skeletons before data arrives', () => {
    render(<InteractionsTab />)
    expect(screen.getByTestId('element-grid-skeleton')).toBeTruthy()
  })

  it('renders grouped cards once loaded', async () => {
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByText('Favorite NBA Player')).toBeTruthy())
    expect(screen.getByText('Polls')).toBeTruthy()
    expect(screen.getByText('Wait lists')).toBeTruthy()
  })

  it('finalises status on the client so a fresh response reads as needing attention', async () => {
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByText('NEEDS YOU')).toBeTruthy())
  })

  it('derives the Need Attention total on the client', async () => {
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByText('Need Attention')).toBeTruthy())
    const strip = screen.getByRole('button', { name: /need attention/i })
    expect(strip.textContent).toContain('1')
  })

  it('filters by search', async () => {
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByText('Favorite NBA Player')).toBeTruthy())
    fireEvent.change(screen.getByPlaceholderText(/search elements/i), { target: { value: 'beta' } })
    expect(screen.queryByText('Favorite NBA Player')).toBeNull()
    expect(screen.getByText('Beta waitlist')).toBeTruthy()
  })

  it('shows an empty state when the account has no data elements', async () => {
    vi.stubGlobal('fetch', mockFetch({ elements: [], totals: { elements: 0, responses: 0, avgEngagement: null, liveNow: 0 }, truncated: false }))
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByText(/no interactive elements yet/i)).toBeTruthy())
  })

  it('shows an error state with a retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy())
  })

  it('warns when the inventory was truncated instead of hiding it', async () => {
    vi.stubGlobal('fetch', mockFetch({ ...inventory, truncated: true }))
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByText(/showing the first 200 pages/i)).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/analytics/interactions/InteractionsTab.test.tsx`
Expected: FAIL — cannot resolve `./InteractionsTab`

- [ ] **Step 3: Write minimal implementation**

Create `src/components/analytics/interactions/InteractionsTab.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Inbox } from 'lucide-react'
import {
  deriveStatus,
  filterElements,
  groupByType,
  sortElements,
  type ElementFilter,
  type ElementStatus,
  type ElementSummary,
  type SortMode,
} from '@/lib/element-os'
import { DataIllustration } from '@/components/analytics/DataIllustration'
import { InsightsStrip } from './InsightsStrip'
import { FilterRail } from './FilterRail'
import { TypeGroup } from './TypeGroup'
import { ElementCard } from './ElementCard'
import { ElementDrawer, type DrawerTab } from './ElementDrawer'
import { useElementSeen } from './useElementSeen'

const PULSE_MS = 30_000

const EMPTY_FILTER: ElementFilter = { search: '', types: [], statuses: [], source: 'all' }

interface Inventory {
  elements: ElementSummary[]
  totals: { elements: number; responses: number; avgEngagement: number | null; liveNow: number }
  truncated: boolean
}

export function InteractionsTab() {
  const [data, setData] = useState<Inventory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloads, setReloads] = useState(0)
  const [filter, setFilter] = useState<ElementFilter>(EMPTY_FILTER)
  const [sort, setSort] = useState<SortMode>('most-active')
  const [open, setOpen] = useState<{ element: ElementSummary; tab: DrawerTab } | null>(null)
  const { seen, markSeen } = useElementSeen()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    fetch('/api/data/elements')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloads])

  // Patch counts in place rather than refetching the whole inventory.
  useEffect(() => {
    if (!data) return
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        const res = await fetch('/api/data/elements/pulse')
        if (!res.ok) return
        const { pulse } = await res.json()
        const byKey = new Map<string, { lastResponseAt: string | null; todayCount: number }>(
          (pulse ?? []).map((p: { key: string; lastResponseAt: string | null; todayCount: number }) => [
            p.key,
            { lastResponseAt: p.lastResponseAt, todayCount: p.todayCount },
          ])
        )
        setData((prev) =>
          prev
            ? {
                ...prev,
                elements: prev.elements.map((e) => {
                  const p = byKey.get(e.key)
                  return p ? { ...e, lastResponseAt: p.lastResponseAt, todayCount: p.todayCount } : e
                }),
              }
            : prev
        )
      } catch {
        // A failed pulse is not worth surfacing; the next tick retries.
      }
    }
    const id = setInterval(tick, PULSE_MS)
    return () => clearInterval(id)
  }, [data])

  // Status is finalised here, not on the server: part of the needs-attention
  // rule depends on a localStorage stamp the server cannot see.
  const withStatus = useMemo(() => {
    const now = new Date()
    return (data?.elements ?? []).map((e) => ({
      ...e,
      status: deriveStatus({
        published: e.published,
        lastResponseAt: e.lastResponseAt,
        unreadCount: e.unreadCount,
        pendingCount: e.pendingCount,
        lastSeenAt: seen[e.key] ?? null,
        now,
      }),
    }))
  }, [data, seen])

  const statusCounts = useMemo(() => {
    const counts: Record<ElementStatus, number> = { 'needs-attention': 0, live: 0, draft: 0, idle: 0 }
    for (const e of withStatus) counts[e.status] += 1
    return counts
  }, [withStatus])

  const visible = useMemo(
    () => sortElements(filterElements(withStatus, filter), sort),
    [withStatus, filter, sort]
  )

  const openDrawer = useCallback(
    (element: ElementSummary, tab: DrawerTab) => {
      setOpen({ element, tab })
      markSeen(element.key)
    },
    [markSeen]
  )

  if (loading && !data) {
    return (
      <div data-testid="element-grid-skeleton" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-muted/40" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <h2 className="mb-2 text-lg font-medium">Couldn&apos;t load your elements</h2>
        <button
          onClick={() => setReloads((c) => c + 1)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data || data.elements.length === 0) {
    return (
      <div className="py-20 text-center">
        <DataIllustration className="mx-auto mb-4 h-32" />
        <h2 className="mb-2 text-lg font-medium">No interactive elements yet</h2>
        <p className="text-muted-foreground">Add a poll, form, or wait list to a page to start collecting.</p>
      </div>
    )
  }

  const groups = groupByType(visible)

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <InsightsStrip
            totals={{ ...data.totals, needsAttention: statusCounts['needs-attention'] }}
            onFilterStatus={(status) => setFilter({ ...EMPTY_FILTER, statuses: [status] })}
          />

          {data.truncated && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
              You have a lot of pages — showing the first 200 pages&apos; elements.
            </p>
          )}

          {groups.length === 0 ? (
            <p className="py-20 text-center text-muted-foreground">No elements match these filters.</p>
          ) : (
            <div className="space-y-8">
              {groups.map((g) => (
                <TypeGroup key={g.label} label={g.label} count={g.elements.length}>
                  {g.elements.map((e) => (
                    <ElementCard
                      key={e.key}
                      element={e}
                      onOpen={openDrawer}
                      editHref={e.source === 'bulletin' ? '/bulletin' : `/editor/${e.pageId}`}
                    />
                  ))}
                </TypeGroup>
              ))}
            </div>
          )}
        </div>

        <FilterRail
          filter={filter}
          sort={sort}
          statusCounts={statusCounts}
          onChange={setFilter}
          onSortChange={setSort}
          onReset={() => setFilter(EMPTY_FILTER)}
        />
      </div>

      <ElementDrawer
        element={open?.element ?? null}
        tab={open?.tab ?? 'responses'}
        onTabChange={(tab) => setOpen((o) => (o ? { ...o, tab } : o))}
        onClose={() => setOpen(null)}
      />
    </>
  )
}
```

- [ ] **Step 4: Confirm the editor route used by `editHref`**

Run: `ls src/app/\(dashboard\)/editor 2>/dev/null || grep -rn "href={\`/editor" src/components --include=*.tsx | head -3`
Expected: confirms `/editor/<displayId>` is the real editor path. If the project uses a different path, update `editHref` in `InteractionsTab.tsx` and the assertion in `ElementCard.test.tsx` to match.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/components/analytics/interactions/InteractionsTab.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/analytics/interactions/InteractionsTab.tsx src/components/analytics/interactions/InteractionsTab.test.tsx
git commit -m "feat(data): Interactions tab container with pulse polling"
```

---

### Task 15: Wire into the Data page, retire the old tabs

**Files:**
- Modify: `src/app/(dashboard)/data/page.tsx`
- Delete: `src/components/analytics/ElementsTab.tsx`
- Delete: `src/components/analytics/BulletinAnalyticsTab.tsx`
- Create: `src/app/(dashboard)/data/tab-param.test.ts`

**Interfaces:**
- Consumes: `<InteractionsTab />`
- Produces: `resolveTab(param)` exported from `src/lib/element-os.ts` (a page component cannot export helpers either — keep it in the lib)

- [ ] **Step 1: Write the failing test**

Create `src/app/(dashboard)/data/tab-param.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveTab } from '@/lib/element-os'

describe('resolveTab', () => {
  it('defaults to overview', () => {
    expect(resolveTab(null)).toBe('overview')
    expect(resolveTab('nonsense')).toBe('overview')
  })

  it('passes through the real tabs', () => {
    expect(resolveTab('overview')).toBe('overview')
    expect(resolveTab('audience')).toBe('audience')
    expect(resolveTab('interactions')).toBe('interactions')
  })

  it('redirects the retired tabs to interactions so old links keep working', () => {
    expect(resolveTab('elements')).toBe('interactions')
    expect(resolveTab('bulletin')).toBe('interactions')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run "src/app/(dashboard)/data/tab-param.test.ts"`
Expected: FAIL — `resolveTab is not a function`

- [ ] **Step 3: Add `resolveTab` to the lib**

Append to `src/lib/element-os.ts`:

```ts
export type DataTab = 'overview' | 'audience' | 'interactions'

// 'elements' and 'bulletin' were retired into 'interactions'; keep old links,
// bookmarks and in-app hrefs working rather than dumping people on Overview.
export function resolveTab(param: string | null | undefined): DataTab {
  if (param === 'audience') return 'audience'
  if (param === 'interactions' || param === 'elements' || param === 'bulletin') return 'interactions'
  return 'overview'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run "src/app/(dashboard)/data/tab-param.test.ts"`
Expected: PASS

- [ ] **Step 5: Rewire the Data page**

In `src/app/(dashboard)/data/page.tsx`:

Replace the two old imports:

```tsx
import { ElementsTab } from '@/components/analytics/ElementsTab'
import { BulletinAnalyticsTab } from '@/components/analytics/BulletinAnalyticsTab'
```

with:

```tsx
import { InteractionsTab } from '@/components/analytics/interactions/InteractionsTab'
import { resolveTab, type DataTab } from '@/lib/element-os'
```

Replace the `activeTab` state initialiser:

```tsx
  const [activeTab, setActiveTab] = useState<DataTab>(resolveTab(searchParams.get('tab')))
```

Replace the `Elements` and `Bulletin` tab buttons with a single one (keep the Overview and Audience buttons exactly as they are):

```tsx
            <button
              onClick={() => setActiveTab('interactions')}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'interactions'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Inbox className="w-4 h-4" />
              Interactions
            </button>
```

The tab is account-wide, so hide the page selector while it is active — change the `controls` prop on `PageHero` to:

```tsx
        controls={
          activeTab === 'interactions' ? null : (
            <select
              value={selectedDisplayId || ''}
              onChange={(e) => setSelectedDisplayId(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background text-sm max-w-[200px] truncate"
            >
              <option value="" disabled>
                Select a page
              </option>
              {displays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          )
        }
```

In the `<main>` body, replace the two branches:

```tsx
        {activeTab === 'bulletin' ? (
          <BulletinAnalyticsTab />
        ) : activeTab === 'audience' ? (
```

with:

```tsx
        {activeTab === 'interactions' ? (
          <InteractionsTab />
        ) : activeTab === 'audience' ? (
```

and delete the now-unreachable branch:

```tsx
        ) : activeTab === 'elements' ? (
          <ElementsTab displayId={selectedDisplayId} />
```

Finally remove `Megaphone` from the `lucide-react` import if it is no longer used.

- [ ] **Step 6: Delete the retired components**

```bash
git rm src/components/analytics/ElementsTab.tsx src/components/analytics/BulletinAnalyticsTab.tsx
```

- [ ] **Step 7: Verify nothing still references them**

Run: `grep -rn "ElementsTab\|BulletinAnalyticsTab" src/ --include=*.tsx --include=*.ts | grep -v "editor/panel" | grep -v interactions`
Expected: no output. (`src/components/editor/panel/ElementsTab.tsx` is an unrelated editor panel — leave it alone.)

- [ ] **Step 8: Type check and test**

Run: `pnpm exec tsc --noEmit && pnpm vitest run src/lib/element-os.test.ts "src/app/(dashboard)/data/tab-param.test.ts"`
Expected: no type errors, all tests PASS

- [ ] **Step 9: Commit**

```bash
git add -A src/app/\(dashboard\)/data src/lib/element-os.ts src/components/analytics
git commit -m "feat(data): replace Elements and Bulletin tabs with Interactions"
```

---

### Task 16: Tests for the bulletin analytics route the drawer now depends on

**Files:**
- Create: `src/app/api/bulletin/analytics/route.test.ts`

**Interfaces:**
- Consumes: the existing `GET /api/bulletin/analytics`

**Context:** `src/app/api/bulletin/` has no tests at all. The drawer now depends on this route, so it gets coverage before we rely on it.

- [ ] **Step 1: Read the route to match its actual contract**

Run: `cat src/app/api/bulletin/analytics/route.ts`
Note the exact auth helper it uses (`getUser` vs `verifyAuth`), the Prisma models it reads, and the response shape. Write the mocks below to match what you find — if it uses `verifyAuth`, mock that instead, and remember `verifyAuth` returns the FULL user object, not `{ userId }`.

- [ ] **Step 2: Write the test**

Create `src/app/api/bulletin/analytics/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn(), verifyAuth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { bulletinPost: { findMany: vi.fn().mockResolvedValue([]) } },
}))

import { GET } from './route'
import { db } from '@/lib/db'
import * as auth from '@/lib/auth'

const req = () => new NextRequest('http://localhost/api/bulletin/analytics')

const authed = (user: unknown) => {
  ;(auth.getUser as any).mockResolvedValue(user)
  ;(auth.verifyAuth as any).mockResolvedValue(user)
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/bulletin/analytics', () => {
  it('401s when unauthenticated', async () => {
    authed(null)
    expect((await GET(req())).status).toBe(401)
  })

  it('only reads the caller\'s own bulletin posts', async () => {
    authed({ id: 'me' })
    await GET(req())
    expect(db.bulletinPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorId: 'me' }) })
    )
  })

  it('returns a posts array', async () => {
    authed({ id: 'me' })
    const body = await (await GET(req())).json()
    expect(Array.isArray(body.posts)).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test**

Run: `pnpm vitest run src/app/api/bulletin/analytics/route.test.ts`
Expected: PASS. If the route uses a different auth helper or where-clause shape, adjust the assertions to the real contract — do not change the route to fit the test unless it is genuinely leaking another user's posts, in which case fix the route and say so.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bulletin/analytics/route.test.ts
git commit -m "test(bulletin): cover the analytics route the element drawer depends on"
```

---

### Task 17: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full type check**

Run: `pnpm exec tsc --noEmit`
Expected: no output. If you see `Property 'x' does not exist on type PrismaClient`, the generated client is stale — run `pnpm exec prisma generate` and retry.

- [ ] **Step 2: Authoritative lint**

Run: `ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint --no-eslintrc -c .eslintrc.json "src/**/*.ts" "src/**/*.tsx"`
Expected: 0 errors. `tsc` does not run ESLint, and Vercel lints for real — a lint error here is a red deploy.

- [ ] **Step 3: Confirm no route exports a helper**

Run: `for f in $(git diff --name-only main...HEAD | grep 'route.ts$'); do echo "== $f"; grep '^export ' "$f"; done`
Expected: every listed export is `GET`/`POST`/`PUT`/`PATCH`/`DELETE`/`HEAD`/`OPTIONS` or a known config key. Anything else fails `next build` in a way `tsc` cannot see.

- [ ] **Step 4: Confirm every new component is a client component**

Run: `for f in src/components/analytics/interactions/*.tsx src/components/analytics/interactions/card-bodies/*.tsx; do head -1 "$f" | grep -q "'use client'" || echo "MISSING use client: $f"; done`
Expected: no output.

- [ ] **Step 5: Full test suite**

Run: `pnpm vitest run`
Expected: all tests pass. Note: full-suite runs on a loaded machine can report phantom "errors" that are worker-spawn timeouts — if `passed + errors == total files`, re-run just the skipped files rather than chasing a non-existent failure.

- [ ] **Step 6: Production build**

Run: `pnpm build`
Expected: build succeeds. Stop any running `pnpm dev` first — on Windows they race on `.next` and produce phantom errors.

- [ ] **Step 7: Manual smoke**

Start the dev server with the correct database:

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
pnpm dev
```

Then check, at `/data`:
1. Three tabs only: Overview · Audience · Interactions.
2. `/data?tab=elements` and `/data?tab=bulletin` both land on Interactions.
3. The page selector disappears on Interactions and returns on Overview.
4. Cards are grouped, show a location line, and open the drawer on Responses and Analytics.
5. Search, a type chip, a status checkbox, the source toggle, and sort all narrow the grid.
6. Clicking the Need Attention and Live Now stats filters the grid.
7. A bulletin instrument appears inside its type group with a Bulletin chip.

- [ ] **Step 8: Commit any fixes and push**

```bash
git add -A
git commit -m "fix(data): address verification findings"
git push -u origin feat/data-interactions-d3a
```

---

## Self-Review Notes

Checked against the spec:

- **Tab structure, redirects, selector hiding** → Task 15
- **Account-wide inventory, seven stores, caps** → Tasks 4, 5
- **Engagement definition + viewer floor** → Tasks 2, 5 (with an explicit test that 40 clicks from one visitor is one responder)
- **Status derivation on the client + `lastSeenAt`** → Tasks 2, 7, 14
- **`totals.needsAttention` client-derived** → Tasks 5 (absent from route), 14 (derived)
- **Bulletin mixed into type groups + source filter** → Tasks 5, 9, 10
- **Card actions → drawer** → Tasks 10, 13
- **Pulse polling, hidden-tab pause** → Tasks 6, 14
- **Composite keys** → Tasks 1, 5, with a collision test
- **Tabbed pages walked** → Task 1
- **Positional section, no element creation date** → Tasks 1, 3, 10
- **Excluded types (tip-jar, tracker, static)** → Task 1
- **Skeleton / empty / error states** → Task 14
- **Ownership scoping tests** → Tasks 4, 5, 12, 16
- **`/api/bulletin/analytics` coverage** → Task 16
- **Route export constraint, `'use client'`, lint, build** → Tasks 5, 6, 12, 17

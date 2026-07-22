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
  'lead-gen',
] as const

export type DataElementType = (typeof DATA_ELEMENT_TYPES)[number]

// Types whose PUBLIC component actually calls trackInteraction() — i.e. the only
// types that can produce an AnalyticsEvent with eventType 'interact'.
// Engagement is `unique interacting visitors / unique page viewers`. A type that
// never emits an 'interact' event has no numerator at all, so the ratio would
// always be 0/N — a confident, fabricated "0% engagement" for an element that may
// in fact be converting every visitor. Those types report `engagement: null` (the
// UI renders "—") and are excluded from the average, because "we don't measure
// this" is true and "0%" is not.
// Verified by grepping trackInteraction call sites under src/components/elements/.
export const INSTRUMENTED_TYPES = new Set<DataElementType>([
  'poll',
  'mcq',
  'rating',
  'shortanswer',
  'rsvp',
  'waitlist',
  'lead-gen',
])

export function isInstrumentedType(type: string): boolean {
  return INSTRUMENTED_TYPES.has(type as DataElementType)
}

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
  'lead-gen': 'lead gen',
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
  'lead-gen': 'leadGenHeadline',
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

// Order matters: first match wins. needs-attention outranks everything—including draft—
// because it is the only status that asks the owner to do something.
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
export const TYPE_GROUPS = [
  { label: 'Polls', types: ['poll', 'mcq'] },
  { label: 'Questions', types: ['shortanswer', 'comment'] },
  { label: 'Ratings', types: ['rating', 'business-review'] },
  { label: 'RSVPs', types: ['rsvp', 'wedding-rsvp'] },
  { label: 'Wait lists', types: ['waitlist'] },
  { label: 'Lead Gen', types: ['lead-gen'] },
  { label: 'Appointments', types: ['appointments'] },
  { label: 'Mailboxes', types: ['mailbox'] },
  { label: 'Signatures', types: ['jersey'] },
] as const satisfies readonly { label: string; types: readonly DataElementType[] }[]

type GroupedElementType = (typeof TYPE_GROUPS)[number]['types'][number]

// Compile-time exhaustiveness guard. TYPE_GROUPS drives BOTH the grid and the
// filter rail, so a type missing from it is invisible in the product while still
// collecting data. Adding a 13th DataElementType without putting it in a group
// makes this assignment fail `tsc` (the type resolves to `never`).
const _EVERY_TYPE_IS_GROUPED: Exclude<DataElementType, GroupedElementType> extends never
  ? true
  : never = true
void _EVERY_TYPE_IS_GROUPED

export function groupByType(
  elements: ElementSummary[]
): { label: string; elements: ElementSummary[] }[] {
  return TYPE_GROUPS.map((g) => ({
    label: g.label,
    elements: elements.filter((e) => (g.types as readonly DataElementType[]).includes(e.type)),
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

export type DataTab = 'overview' | 'audience' | 'interactions'

// 'elements' and 'bulletin' were retired into 'interactions'; keep old links,
// bookmarks and in-app hrefs working rather than dumping people on Overview.
export function resolveTab(param: string | null | undefined): DataTab {
  if (param === 'audience') return 'audience'
  if (param === 'interactions' || param === 'elements' || param === 'bulletin') return 'interactions'
  return 'overview'
}

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import {
  collectDataElements,
  computeEngagement,
  elementTitle,
  isDataElementType,
  isInstrumentedType,
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
  const slot = (key: string) => {
    const cur = counts.get(key) ?? { total: 0, today: 0, last: null }
    counts.set(key, cur)
    return cur
  }
  // Total responses, plus the newest response timestamp seen for this element.
  const addTotal = (key: string, n: number, at: Date | null) => {
    const cur = slot(key)
    cur.total += n
    if (at) {
      const iso = at.toISOString()
      if (!cur.last || iso > cur.last) cur.last = iso
    }
  }
  // Today's responses. Never derived from an aggregate's max timestamp — an
  // aggregate carries one timestamp and many rows, so "is the newest one from
  // today" says nothing about how many of them are. Aggregated stores get a
  // separate today-scoped COUNT query below.
  const addToday = (key: string, n: number) => {
    slot(key).today += n
  }

  // FormResponse keys answers by elementId inside a JSON blob — there is no
  // elementId column to group by in Prisma's query builder, and reading every
  // row's JSON payload to fold it in memory (the old approach) means loading
  // every response a user has EVER collected on every tab open. Postgres can
  // aggregate the jsonb keys directly, so this stays a true all-time count
  // without ever materialising the response payloads in Node.
  type FormAgg = { displayId: string; elementId: string; cnt: number; last: Date }
  const formAggAllTime = displayIds.length
    ? db.$queryRaw<FormAgg[]>(Prisma.sql`
        SELECT "displayId", key AS "elementId", COUNT(*)::int AS cnt, MAX("submittedAt") AS last
        FROM "FormResponse", jsonb_object_keys(responses) AS key
        WHERE "displayId" IN (${Prisma.join(displayIds)})
        GROUP BY "displayId", key
      `)
    : Promise.resolve<FormAgg[]>([])
  const formAggToday = displayIds.length
    ? db.$queryRaw<FormAgg[]>(Prisma.sql`
        SELECT "displayId", key AS "elementId", COUNT(*)::int AS cnt, MAX("submittedAt") AS last
        FROM "FormResponse", jsonb_object_keys(responses) AS key
        WHERE "displayId" IN (${Prisma.join(displayIds)}) AND "submittedAt" >= ${startOfToday}
        GROUP BY "displayId", key
      `)
    : Promise.resolve<FormAgg[]>([])

  const empty: any[] = []
  const [
    formRowsAllTime,
    formRowsToday,
    commentRows,
    messageRows,
    unreadRows,
    waitlistRows,
    bookingRows,
    jerseyRows,
    bulletinPosts,
    bulletinRespRows,
    bulletinRespTodayRows,
    events,
    commentTodayRows,
    messageTodayRows,
    waitlistTodayRows,
    bookingTodayRows,
    jerseyTodayRows,
  ] =
    displayIds.length
      ? await Promise.all([
          formAggAllTime,
          formAggToday,
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
            select: { id: true, createdAt: true, blocks: true },
            orderBy: { createdAt: 'desc' },
          }),
          // Bulletin posts carry "zero or one" interactive block (see BulletinPost.blocks
          // comment), so every response to a post is a response to that post's block —
          // a per-post count is a truthful per-element count without reading the JSON
          // response payloads at all (unlike FormResponse, which can back many elements
          // per display and genuinely needs the jsonb aggregation above).
          db.bulletinResponse.groupBy({
            by: ['postId'],
            where: { post: { authorId: user.id } },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
          db.bulletinResponse.groupBy({
            by: ['postId'],
            where: { post: { authorId: user.id }, createdAt: { gte: startOfToday } },
            _count: { _all: true },
          }),
          db.analyticsEvent.findMany({
            where: { displayId: { in: displayIds }, createdAt: { gte: since } },
            select: { displayId: true, eventType: true, visitorId: true, sessionId: true, metadata: true },
            orderBy: { createdAt: 'desc' },
            take: MAX_EVENTS,
          }),
          db.comment.groupBy({
            by: ['displayId'],
            where: { displayId: { in: displayIds }, createdAt: { gte: startOfToday } },
            _count: { _all: true },
          }),
          db.message.groupBy({
            by: ['displayId', 'elementId'],
            where: { ownerId: user.id, displayId: { in: displayIds }, createdAt: { gte: startOfToday } },
            _count: { _all: true },
          }),
          db.waitlistSignup.groupBy({
            by: ['displayId', 'elementId'],
            where: { displayId: { in: displayIds }, createdAt: { gte: startOfToday } },
            _count: { _all: true },
          }),
          db.booking.groupBy({
            by: ['displayId', 'elementId'],
            where: { displayId: { in: displayIds }, createdAt: { gte: startOfToday } },
            _count: { _all: true },
          }),
          db.jerseySignature.groupBy({
            by: ['displayId', 'elementId'],
            where: { displayId: { in: displayIds }, createdAt: { gte: startOfToday } },
            _count: { _all: true },
          }),
        ])
      : [
          empty,
          empty,
          empty,
          empty,
          empty,
          empty,
          empty,
          empty,
          await db.bulletinPost.findMany({
            where: { authorId: user.id },
            select: { id: true, createdAt: true, blocks: true },
            orderBy: { createdAt: 'desc' },
          }),
          await db.bulletinResponse.groupBy({
            by: ['postId'],
            where: { post: { authorId: user.id } },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
          await db.bulletinResponse.groupBy({
            by: ['postId'],
            where: { post: { authorId: user.id }, createdAt: { gte: startOfToday } },
            _count: { _all: true },
          }),
          empty,
          empty,
          empty,
          empty,
          empty,
          empty,
        ]

  for (const row of formRowsAllTime) {
    addTotal(`${row.displayId}:${row.elementId}`, row.cnt, row.last)
  }
  for (const row of formRowsToday) {
    addToday(`${row.displayId}:${row.elementId}`, row.cnt)
  }

  for (const g of [...messageRows, ...waitlistRows, ...bookingRows, ...jerseyRows]) {
    addTotal(`${g.displayId}:${g.elementId}`, g._count?._all ?? 0, g._max?.createdAt ?? null)
  }
  for (const g of [...messageTodayRows, ...waitlistTodayRows, ...bookingTodayRows, ...jerseyTodayRows]) {
    addToday(`${g.displayId}:${g.elementId}`, g._count?._all ?? 0)
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
    addTotal(key, g._count?._all ?? 0, g._max?.createdAt ?? null)
  }
  for (const g of commentTodayRows) {
    const key = firstCommentKeyByPage.get(g.displayId)
    if (!key) continue
    addToday(key, g._count?._all ?? 0)
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

  // The events sample was truncated by MAX_EVENTS: the ratio's denominator
  // (page views) and numerator (interactions) can be dropped unevenly across
  // pages, so any computed percentage would be a confident wrong number, not
  // just an incomplete one. Report "we don't know" instead.
  const eventsTruncated = events.length === MAX_EVENTS
  if (eventsTruncated) {
    console.warn(
      `[data/elements] user ${user.id} hit the ${MAX_EVENTS}-event cap; engagement is unreliable and reported as null`
    )
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
      // Types whose public component never emits an 'interact' event have no
      // numerator at all — 0/N is a fabricated "0% engagement", not a real one.
      engagement:
        !isInstrumentedType(el.type) || eventsTruncated
          ? null
          : computeEngagement({
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
  const bulletinTotals = new Map<string, { total: number; last: string | null }>()
  for (const g of bulletinRespRows) {
    const at = g._max?.createdAt ?? null
    bulletinTotals.set(g.postId, { total: g._count?._all ?? 0, last: at ? at.toISOString() : null })
  }
  const bulletinTodayTotals = new Map<string, number>()
  for (const g of bulletinRespTodayRows) {
    bulletinTodayTotals.set(g.postId, g._count?._all ?? 0)
  }

  const bulletinElements: ElementSummary[] = []
  for (const post of bulletinPosts) {
    const blocks = (parse<CanvasElement[]>(post.blocks) ?? []).filter((b) => b && isDataElementType(b.type))
    for (const block of blocks) {
      const key = bulletinElementKey(post.id, block.id)
      const agg = bulletinTotals.get(post.id) ?? { total: 0, last: null }
      const total = agg.total
      const today = bulletinTodayTotals.get(post.id) ?? 0
      const last = agg.last
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

  return NextResponse.json({
    elements,
    totals: {
      elements: elements.length,
      responses: elements.reduce((sum, e) => sum + e.responseCount, 0),
      avgEngagement:
        eventsTruncated || !engaged.length
          ? null
          : Math.round(engaged.reduce((a, b) => a + b, 0) / engaged.length),
    },
    truncated,
    engagementUnavailable: eventsTruncated,
  })
}

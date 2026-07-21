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

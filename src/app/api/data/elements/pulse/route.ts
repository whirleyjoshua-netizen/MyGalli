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

  // The live window is 24h, not "since midnight" — a response from 11:50pm
  // yesterday still counts as live at 00:30 today. Fetch the whole live
  // window and split today out of it in memory, so form-backed elements
  // cannot drop out of the payload at the day boundary.
  const liveHorizon = new Date(Date.now() - LIVE_WINDOW_MS)

  if (displayIds.length) {
    const where = { displayId: { in: displayIds } }
    const todayWhere = { ...where, createdAt: { gte: startOfToday } }
    const [forms, messages, waitlist, bookings, jerseys, messagesToday, waitlistToday, bookingsToday, jerseysToday] =
      await Promise.all([
        db.formResponse.findMany({
          where: { ...where, submittedAt: { gte: liveHorizon } },
          select: { displayId: true, responses: true, submittedAt: true },
        }),
        db.message.groupBy({
          by: ['displayId', 'elementId'],
          where: { ...where, ownerId: user.id },
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        db.waitlistSignup.groupBy({
          by: ['displayId', 'elementId'],
          where,
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        db.booking.groupBy({
          by: ['displayId', 'elementId'],
          where,
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        db.jerseySignature.groupBy({
          by: ['displayId', 'elementId'],
          where,
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        db.message.groupBy({
          by: ['displayId', 'elementId'],
          where: { ...todayWhere, ownerId: user.id },
          _count: { _all: true },
        }),
        db.waitlistSignup.groupBy({
          by: ['displayId', 'elementId'],
          where: todayWhere,
          _count: { _all: true },
        }),
        db.booking.groupBy({
          by: ['displayId', 'elementId'],
          where: todayWhere,
          _count: { _all: true },
        }),
        db.jerseySignature.groupBy({
          by: ['displayId', 'elementId'],
          where: todayWhere,
          _count: { _all: true },
        }),
      ])

    for (const row of forms) {
      const answers = (row.responses ?? {}) as Record<string, unknown>
      for (const elementId of Object.keys(answers)) {
        bump(
          `${row.displayId}:${elementId}`,
          publishedById.get(row.displayId) ?? false,
          row.submittedAt,
          row.submittedAt >= startOfToday ? 1 : 0
        )
      }
    }
    // An aggregate carries ONE timestamp and MANY rows, so "is the newest one
    // from today" says nothing about how many of them are — inferring today's
    // count from _max would report all 623 wait-list signups as today's.
    // The all-time query supplies lastResponseAt; a today-scoped COUNT
    // supplies todayCount.
    for (const g of [...messages, ...waitlist, ...bookings, ...jerseys]) {
      const at = g._max?.createdAt
      if (!at || !g.elementId || !g.displayId) continue
      bump(`${g.displayId}:${g.elementId}`, publishedById.get(g.displayId) ?? false, at, 0)
    }
    for (const g of [...messagesToday, ...waitlistToday, ...bookingsToday, ...jerseysToday]) {
      const cur = activity.get(`${g.displayId}:${g.elementId}`)
      if (cur) cur.today += g._count?._all ?? 0
    }
  }

  const bulletinPosts = await db.bulletinPost.findMany({
    where: { authorId: user.id },
    select: {
      id: true,
      responses: {
        where: { createdAt: { gte: liveHorizon } },
        select: { createdAt: true, responses: true },
      },
    },
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

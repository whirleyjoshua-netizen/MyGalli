import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { collectDataElements, type CollectedElement } from '@/lib/element-os'
import type { DetailResponse } from '@/lib/interaction-responses'
import type { Section } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

const SERIES_DAYS = 30
const MAX_RESPONSES = 200

// A row plus the timestamp the per-day series buckets on. `at` is the moment the
// response ARRIVED, which is not always the timestamp shown (a booking shows its
// start time but is bucketed by when it was booked).
interface LoadedRow {
  response: DetailResponse
  at: Date | null
}

interface Loaded {
  rows: LoadedRow[]
  /** Honest explanation when the list is structurally empty rather than unused. */
  notice?: string
}

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

  const collected = collectDataElements(
    parse<Section[]>(display.sections) ?? [],
    parse<TabsConfig>(display.tabs),
    display.id,
    display.title
  )
  const element = collected.find((e) => e.elementId === elementId)

  if (!element) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const since = new Date(Date.now() - SERIES_DAYS * 24 * 3600 * 1000)

  // Every store below is reached only after the display ownership check above,
  // and each query is additionally pinned to this displayId (and elementId,
  // where the column exists). Message carries a denormalised ownerId, so it is
  // pinned to the caller directly as well.
  const { rows, notice } = await loadResponses({
    type: element.type,
    displayId,
    elementId,
    userId: user.id,
    since,
    collected,
  })

  // Local calendar day, matching the local-midnight "today" boundary the
  // inventory route and the cards use. toISOString() would bucket by UTC and
  // disagree with the Today count for responses near midnight.
  const dayKey = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const byDay = new Map<string, number>()
  for (const r of rows) {
    if (!r.at) continue
    const day = dayKey(r.at)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }

  const responsesTruncated = rows.length > MAX_RESPONSES
  if (responsesTruncated) {
    console.warn(
      `[data/elements/detail] element ${elementId} on ${displayId} has ${rows.length} responses; returning the most recent ${MAX_RESPONSES}`
    )
  }

  return NextResponse.json({
    element: { elementId: element.elementId, type: element.type, title: element.title },
    responses: rows.slice(0, MAX_RESPONSES).map((r) => r.response),
    responseCount: rows.length,
    responsesTruncated,
    windowDays: SERIES_DAYS,
    series: [...byDay.entries()].sort().map(([date, count]) => ({ date, count })),
    ...(notice ? { notice } : {}),
  })
}

// Not exported: a route.ts may export only route handlers, and exporting a
// helper for testability fails `next build` in a way `tsc` cannot catch.
async function loadResponses({
  type,
  displayId,
  elementId,
  userId,
  since,
  collected,
}: {
  type: string
  displayId: string
  elementId: string
  userId: string
  since: Date
  collected: CollectedElement[]
}): Promise<Loaded> {
  switch (type) {
    case 'waitlist': {
      const signups = await db.waitlistSignup.findMany({
        where: { displayId, elementId, createdAt: { gte: since } },
        select: { email: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
      return {
        rows: signups.map((s) => ({
          at: s.createdAt,
          response: {
            answer: s.email,
            who: s.name ?? undefined,
            submittedAt: s.createdAt.toISOString(),
          },
        })),
      }
    }

    case 'mailbox': {
      // ownerId is the denormalised inbox owner; scoping on it as well as the
      // display means a mailbox can never leak across tenants.
      const messages = await db.message.findMany({
        where: { ownerId: userId, displayId, elementId, createdAt: { gte: since } },
        select: {
          kind: true,
          body: true,
          senderName: true,
          senderEmail: true,
          read: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      return {
        rows: messages.map((m) => ({
          at: m.createdAt,
          response: {
            answer:
              m.body?.trim() || (m.kind === 'audio' ? 'Voice message (audio)' : '(no message)'),
            who: m.senderName?.trim() || m.senderEmail?.trim() || undefined,
            meta: m.read ? undefined : 'Unread',
            submittedAt: m.createdAt.toISOString(),
          },
        })),
      }
    }

    case 'appointments': {
      const bookings = await db.booking.findMany({
        where: { displayId, elementId, createdAt: { gte: since } },
        select: { name: true, email: true, start: true, note: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
      return {
        rows: bookings.map((b) => ({
          at: b.createdAt,
          response: {
            answer: { name: b.name, email: b.email, note: b.note ?? undefined },
            // The booking's own start time, labelled so it is not mistaken for
            // the moment the booking was made.
            submittedAt: b.start.toISOString(),
            dateLabel: 'Booked for',
          },
        })),
      }
    }

    case 'jersey': {
      const signatures = await db.jerseySignature.findMany({
        where: { displayId, elementId, createdAt: { gte: since } },
        select: { name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
      return {
        rows: signatures.map((s) => ({
          at: s.createdAt,
          response: { answer: s.name, submittedAt: s.createdAt.toISOString() },
        })),
      }
    }

    case 'comment': {
      // Comment has NO elementId column — it is page-scoped. The inventory route
      // attributes a page's comments to the FIRST comment element on the page;
      // mirror that here so a second wall's card (which reads 0) and its drawer
      // agree instead of contradicting each other.
      const firstCommentElement = collected.find((e) => e.type === 'comment')
      if (firstCommentElement && firstCommentElement.elementId !== elementId) {
        return {
          rows: [],
          notice:
            'Comments are stored per page, not per element. This page’s comments are shown on its first comment wall.',
        }
      }
      const comments = await db.comment.findMany({
        where: { displayId, createdAt: { gte: since } },
        select: { id: true, authorName: true, content: true, approved: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
      return {
        rows: comments.map((c) => ({
          at: c.createdAt,
          response: {
            id: c.id,
            answer: c.content,
            who: c.authorName,
            approved: c.approved,
            submittedAt: c.createdAt.toISOString(),
          },
        })),
      }
    }

    default: {
      // The seven form-backed types: poll, mcq, rating, shortanswer, rsvp,
      // wedding-rsvp, business-review. Unchanged.
      const responses = await db.formResponse.findMany({
        where: { displayId, submittedAt: { gte: since } },
        select: { responses: true, submittedAt: true },
        orderBy: { submittedAt: 'desc' },
      })
      const mine = responses.filter((r) => {
        const answers = (r.responses ?? {}) as Record<string, unknown>
        return elementId in answers
      })
      return {
        rows: mine.map((r) => ({
          at: r.submittedAt,
          response: {
            answer:
              ((r.responses ?? {}) as Record<string, { answer?: unknown }>)[elementId]?.answer ??
              null,
            submittedAt: r.submittedAt.toISOString(),
          },
        })),
      }
    }
  }
}

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

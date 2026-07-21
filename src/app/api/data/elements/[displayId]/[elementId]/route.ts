import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { collectDataElements } from '@/lib/element-os'
import type { Section } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

const SERIES_DAYS = 30
const MAX_RESPONSES = 200

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
  for (const r of mine) {
    const day = dayKey(r.submittedAt)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }

  const responsesTruncated = mine.length > MAX_RESPONSES
  if (responsesTruncated) {
    console.warn(
      `[data/elements/detail] element ${elementId} on ${displayId} has ${mine.length} responses; returning the most recent ${MAX_RESPONSES}`
    )
  }

  return NextResponse.json({
    element: { elementId: element.elementId, type: element.type, title: element.title },
    responses: mine.slice(0, MAX_RESPONSES).map((r) => ({
      answer: ((r.responses ?? {}) as Record<string, { answer?: unknown }>)[elementId]?.answer ?? null,
      submittedAt: r.submittedAt.toISOString(),
    })),
    responseCount: mine.length,
    responsesTruncated,
    series: [...byDay.entries()].sort().map(([date, count]) => ({ date, count })),
  })
}

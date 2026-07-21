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

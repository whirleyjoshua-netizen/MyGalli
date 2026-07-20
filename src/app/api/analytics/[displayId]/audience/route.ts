import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { buildAudience, priorKeysFrom } from './aggregate'

interface Props {
  params: Promise<{ displayId: string }>
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { displayId } = await params

    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const display = await db.display.findUnique({
      where: { id: displayId },
      select: { id: true, userId: true },
    })

    if (!display) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }
    if (display.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const parsedDays = parseInt(url.searchParams.get('days') || '30', 10)
    const days = Number.isFinite(parsedDays) && parsedDays > 0 && parsedDays <= 365 ? parsedDays : 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const [events, priorRows] = await Promise.all([
      db.analyticsEvent.findMany({
        where: { displayId, createdAt: { gte: startDate } },
        select: {
          sessionId: true, visitorId: true, country: true, referrer: true,
          utmSource: true, deviceType: true, browser: true, createdAt: true,
          eventType: true,
        },
      }),
      // Identities seen before the window define who counts as "returning".
      // Capped at 10000 distinct identities and ordered most-recent-first so
      // a display with more history than the cap still gets its most
      // recently active prior visitors — an arbitrary (unordered) sample
      // would make the returning-visitor count non-deterministic between
      // refreshes.
      db.analyticsEvent.findMany({
        where: { displayId, createdAt: { lt: startDate } },
        select: { sessionId: true, visitorId: true },
        distinct: ['visitorId', 'sessionId'],
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }),
    ])

    const DEFAULT_HOST = 'https://galli.page'
    let ownHost: string
    try {
      ownHost = new URL(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_HOST).hostname
    } catch {
      ownHost = new URL(DEFAULT_HOST).hostname
    }

    return NextResponse.json(
      buildAudience({ events, priorKeys: priorKeysFrom(priorRows), ownHost })
    )
  } catch (error) {
    console.error('Audience fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch audience' }, { status: 500 })
  }
}

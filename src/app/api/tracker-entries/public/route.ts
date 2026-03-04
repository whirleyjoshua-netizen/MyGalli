import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tracker-entries/public?displayId=X&trackerId=Y — no auth needed, but display must be published
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const displayId = searchParams.get('displayId')
    const trackerId = searchParams.get('trackerId')

    if (!displayId || !trackerId) {
      return NextResponse.json({ error: 'displayId and trackerId are required' }, { status: 400 })
    }

    // Verify the display is published
    const display = await db.display.findFirst({
      where: { id: displayId, published: true },
      select: { id: true },
    })
    if (!display) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = { displayId, trackerId }
    if (from || to) {
      where.recordedAt = {}
      if (from) where.recordedAt.gte = new Date(from)
      if (to) where.recordedAt.lte = new Date(to)
    }

    const entries = await db.trackerEntry.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      select: {
        id: true,
        trackerId: true,
        category: true,
        value: true,
        recordedAt: true,
        note: true,
      },
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('GET /api/tracker-entries/public error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

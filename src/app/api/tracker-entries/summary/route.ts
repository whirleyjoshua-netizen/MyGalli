import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { computeTrackerSummary } from '@/lib/kits/tracker-utils'

// GET /api/tracker-entries/summary?displayId=X&trackerId=Y&valueField=Z
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const displayId = searchParams.get('displayId')
    const trackerId = searchParams.get('trackerId')
    const valueField = searchParams.get('valueField') || 'value'

    if (!displayId || !trackerId) {
      return NextResponse.json({ error: 'displayId and trackerId are required' }, { status: 400 })
    }

    // Verify ownership
    const display = await db.display.findFirst({
      where: { id: displayId, userId: user.id },
      select: { id: true },
    })
    if (!display) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const entries = await db.trackerEntry.findMany({
      where: { displayId, trackerId },
      orderBy: { recordedAt: 'asc' },
    })

    const summary = computeTrackerSummary(entries, valueField)

    return NextResponse.json(summary)
  } catch (error) {
    console.error('GET /api/tracker-entries/summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

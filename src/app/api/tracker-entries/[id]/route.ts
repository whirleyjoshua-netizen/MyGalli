import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

// DELETE /api/tracker-entries/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entry = await db.trackerEntry.findUnique({
      where: { id },
      include: { display: { select: { userId: true } } },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (entry.display.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.trackerEntry.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/tracker-entries/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type Params = { params: Promise<{ displayId: string }> }

// GET — owner-only. Upcoming bookings with PII (name/email/note).
export async function GET(request: NextRequest, { params }: Params) {
  const { displayId } = await params
  const elementId = request.nextUrl.searchParams.get('elementId')
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const display = await db.display.findUnique({ where: { id: displayId }, select: { userId: true } })
  if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (display.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const bookings = await db.booking.findMany({
    where: { displayId, ...(elementId ? { elementId } : {}), start: { gte: new Date() } },
    orderBy: { start: 'asc' },
    select: { id: true, start: true, end: true, name: true, email: true, note: true },
  })
  return NextResponse.json({ bookings }, { headers: { 'Cache-Control': 'no-store' } })
}

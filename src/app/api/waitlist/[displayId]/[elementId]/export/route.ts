import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function needsEscape(value: string): boolean {
  return /[",\n]/.test(value)
}

function csvField(value: string): string {
  return needsEscape(value) ? csvEscape(value) : value
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ displayId: string; elementId: string }> },
) {
  const { displayId, elementId } = await params

  const user = await getUser(request)

  const display = await db.display.findUnique({
    where: { id: displayId },
    select: { id: true, userId: true },
  })

  if (!display) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!user || user.id !== display.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const signups = await db.waitlistSignup.findMany({
    where: { displayId, elementId },
    orderBy: { createdAt: 'asc' },
    select: { email: true, name: true, createdAt: true },
  })

  const header = 'email,name,joinedAt'
  const rows = signups.map((s) =>
    [csvField(s.email), csvField(s.name ?? ''), s.createdAt.toISOString()].join(','),
  )
  const csv = [header, ...rows].join('\n') + '\n'

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="waitlist-${elementId}.csv"`,
    },
  })
}

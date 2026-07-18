import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ displayId: string; elementId: string }> },
) {
  const { displayId, elementId } = await params
  const count = await db.waitlistSignup.count({ where: { displayId, elementId } })
  return NextResponse.json({ count })
}

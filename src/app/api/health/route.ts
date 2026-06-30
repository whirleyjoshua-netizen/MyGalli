import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Lightweight health/uptime endpoint. Returns 200 when the app + DB are reachable,
// 503 when the DB ping fails. No auth, no sensitive data.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'up', time: new Date().toISOString() })
  } catch {
    return NextResponse.json(
      { status: 'degraded', db: 'down', time: new Date().toISOString() },
      { status: 503 },
    )
  }
}

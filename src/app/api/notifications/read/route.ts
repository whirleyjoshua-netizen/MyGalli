import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.notification.updateMany({
    where: { userId: me.id, read: false },
    data: { read: true },
  })
  return NextResponse.json({ ok: true })
}

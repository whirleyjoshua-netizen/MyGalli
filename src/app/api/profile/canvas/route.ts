import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const fresh = await db.user.findUnique({ where: { id: me.id }, select: { profileDisplayId: true, username: true } })

    if (fresh?.profileDisplayId) {
      const existing = await db.display.findUnique({ where: { id: fresh.profileDisplayId }, select: { id: true } })
      if (existing) return NextResponse.json({ id: existing.id })
    }

    const display = await db.display.create({
      data: {
        userId: me.id,
        kind: 'profile',
        published: true,
        slug: '__profile',
        title: `${fresh?.username ?? 'My'} profile`,
        sections: [],
      },
      select: { id: true },
    })
    await db.user.update({ where: { id: me.id }, data: { profileDisplayId: display.id } })
    return NextResponse.json({ id: display.id })
  } catch (e) {
    console.error('Profile canvas error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

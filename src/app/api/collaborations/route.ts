import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rows = await db.displayCollaborator.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
      select: {
        display: {
          select: {
            id: true, slug: true, title: true, coverImage: true, published: true, updatedAt: true,
            user: { select: { username: true, name: true, avatar: true } },
          },
        },
      },
    })
    return NextResponse.json({ displays: rows.map((r) => ({ ...r.display, owner: r.display.user })) })
  } catch (e) {
    console.error('Collaborations error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

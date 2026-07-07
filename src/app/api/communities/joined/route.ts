import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const memberships = await db.hubMember.findMany({
    where: { userId: me.id, hub: { community: true } },
    orderBy: { createdAt: 'desc' },
    select: {
      hub: {
        select: {
          id: true, title: true, slug: true, coverImage: true,
          user: { select: { username: true } },
          posts: { orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, createdAt: true } },
        },
      },
    },
  })
  const communities = memberships.map(({ hub }) => ({
    id: hub.id,
    title: hub.title,
    username: hub.user.username,
    slug: hub.slug,
    coverImage: hub.coverImage,
    latestPost: hub.posts[0] ? { text: hub.posts[0].text, createdAt: hub.posts[0].createdAt.toISOString() } : null,
  }))
  return NextResponse.json({ communities })
}

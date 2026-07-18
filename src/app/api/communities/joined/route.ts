import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const hubSelect = {
  id: true, title: true, slug: true, coverImage: true, updatedAt: true,
  user: { select: { username: true } },
  _count: { select: { members: true } },
  posts: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { text: true, createdAt: true } },
}

type HubRow = {
  id: string; title: string; slug: string; coverImage: string | null; updatedAt: Date
  user: { username: string }; _count: { members: number }
  posts: { text: string | null; createdAt: Date }[]
}

function shape(hub: HubRow, role: 'owner' | 'member') {
  return {
    id: hub.id,
    title: hub.title,
    username: hub.user.username,
    slug: hub.slug,
    coverImage: hub.coverImage,
    role,
    memberCount: hub._count.members,
    latestPost: hub.posts[0]
      ? { text: hub.posts[0].text, createdAt: hub.posts[0].createdAt.toISOString() }
      : null,
    updatedAt: hub.updatedAt.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [owned, memberships] = await Promise.all([
    db.hub.findMany({
      where: { userId: me.id, community: true },
      orderBy: { updatedAt: 'desc' },
      select: hubSelect,
    }),
    db.hubMember.findMany({
      where: { userId: me.id, hub: { community: true } },
      orderBy: { createdAt: 'desc' },
      select: { hub: { select: hubSelect } },
    }),
  ])

  const byId = new Map<string, ReturnType<typeof shape>>()
  for (const hub of owned as HubRow[]) byId.set(hub.id, shape(hub, 'owner'))
  for (const { hub } of memberships as { hub: HubRow }[]) {
    if (!byId.has(hub.id)) byId.set(hub.id, shape(hub, 'member'))
  }

  const communities = Array.from(byId.values()).sort((a, b) => {
    const at = new Date(a.latestPost?.createdAt ?? a.updatedAt).getTime()
    const bt = new Date(b.latestPost?.createdAt ?? b.updatedAt).getTime()
    return bt - at
  })

  return NextResponse.json({ communities })
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type CommunityDTO = {
  id: string
  title: string
  username: string
  slug: string
  coverImage: string | null
  isOwner: boolean
  memberCount: number
  latestPost: { text: string | null; createdAt: string } | null
}

const hubSelect = {
  id: true,
  title: true,
  slug: true,
  coverImage: true,
  user: { select: { username: true } },
  _count: { select: { members: true } },
  posts: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { text: true, createdAt: true } },
}

function toDTO(hub: any, isOwner: boolean): CommunityDTO {
  return {
    id: hub.id,
    title: hub.title,
    username: hub.user.username,
    slug: hub.slug,
    coverImage: hub.coverImage,
    isOwner,
    memberCount: hub._count.members,
    latestPost: hub.posts[0]
      ? { text: hub.posts[0].text, createdAt: hub.posts[0].createdAt.toISOString() }
      : null,
  }
}

// Communities the current user owns OR has joined. A "community" is a Hub with
// community=true; owners are excluded from HubMember, so owned communities are
// fetched separately and merged (owned wins on dedupe).
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

  const byId = new Map<string, CommunityDTO>()
  for (const hub of owned) byId.set(hub.id, toDTO(hub, true))
  for (const { hub } of memberships) if (!byId.has(hub.id)) byId.set(hub.id, toDTO(hub, false))

  return NextResponse.json({ communities: Array.from(byId.values()) })
}

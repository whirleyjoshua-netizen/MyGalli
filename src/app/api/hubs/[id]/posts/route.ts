import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate, postNotifyTargets } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
import { notifyHubMembers } from '@/lib/notifications'

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, community: true, displayId: true, userId: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  // Draft (unpublished) community posts stay private — only the owner + collaborators can read them.
  // KEEP IN SYNC with readableCommunityHub() in [postId]/comments/route.ts GET.
  const display = hub.displayId ? await db.display.findUnique({ where: { id: hub.displayId }, select: { published: true } }) : null
  if (!display?.published) {
    const canView = !!me && (me.id === hub.userId || (await collaboratorIds(id)).includes(me.id))
    if (!canView) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const posts = await db.hubPost.findMany({
    where: { hubId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      author: { select: { id: true, name: true, username: true, avatar: true } },
      likes: { select: { userId: true } },
      _count: { select: { comments: true } },
    },
  })
  const feed = posts.map((p) => ({
    id: p.id,
    author: p.author,
    text: p.text,
    imageUrl: p.imageUrl,
    block: null,
    settings: { revealAfterAnswer: false, liveTally: false },
    createdAt: p.createdAt.toISOString(),
    likeCount: p.likes.length,
    likedByMe: me ? p.likes.some((l) => l.userId === me.id) : false,
    myResponse: null,
    results: null,
    commentCount: p._count.comments,
  }))
  return NextResponse.json({ posts: feed })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-post-create' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({
    where: { id },
    select: { id: true, userId: true, community: true, title: true, slug: true, user: { select: { username: true } } },
  })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
  const collabIds = await collaboratorIds(id)
  if (!canParticipate(me.id, hub, collabIds, isMember)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 5000) : ''
  const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl ? body.imageUrl : null
  if (!text && !imageUrl) return NextResponse.json({ error: 'Empty post' }, { status: 400 })
  const post = await db.hubPost.create({ data: { hubId: id, authorId: me.id, text: text || null, imageUrl } })
  const memberIds = (await db.hubMember.findMany({ where: { hubId: id }, select: { userId: true } })).map((m) => m.userId)
  const targets = postNotifyTargets({ authorId: me.id, ownerId: hub.userId, collabIds, memberIds })
  await notifyHubMembers(targets, {
    type: 'hub_post',
    actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
    entityUrl: `/${hub.user.username}/hub/${hub.slug}`,
    contextText: hub.title,
  })
  return NextResponse.json({ id: post.id }, { status: 201 })
}

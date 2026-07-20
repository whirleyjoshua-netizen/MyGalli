import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { canParticipate, canViewCommunityHub, isUserBanned } from '@/lib/community'
import { createNotification } from '@/lib/notifications'

type Params = { params: Promise<{ id: string; postId: string }> }

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

// Mirror of the posts-GET read gate — KEEP IN SYNC with src/app/api/hubs/[id]/posts/route.ts GET.
async function readableCommunityHub(id: string, meId: string | null) {
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, community: true, userId: true, published: true } })
  if (!hub || !hub.community) return null
  const isPrivileged = !!meId && (meId === hub.userId || (await collaboratorIds(id)).includes(meId))
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) return null
  return hub
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id, postId } = await params
  const limited = await rateLimit(request, { limit: 120, windowMs: 60_000, prefix: `hub-comments-read:${postId}` })
  if (limited) return limited
  const me = await getUser(request)
  const hub = await readableCommunityHub(id, me?.id ?? null)
  if (!hub) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { id: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const comments = await db.hubPostComment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: { author: { select: { id: true, name: true, username: true, avatar: true } } },
  })
  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      author: { id: c.author.id, name: c.author.name, username: c.author.username, avatar: c.author.avatar },
      text: c.text,
      createdAt: c.createdAt.toISOString(),
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id, postId } = await params
  const limited = await rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'hub-comment-create' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({
    where: { id },
    select: { id: true, community: true, userId: true, title: true, slug: true, user: { select: { username: true } } },
  })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { id: true, authorId: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
  const isBanned = await isUserBanned(id, me.id)
  if (!canParticipate(me.id, hub, await collaboratorIds(id), isMember, isBanned)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : ''
  if (!text) return NextResponse.json({ error: 'Empty comment' }, { status: 400 })
  const c = await db.hubPostComment.create({
    data: { postId, authorId: me.id, text },
    include: { author: { select: { id: true, name: true, username: true, avatar: true } } },
  })
  if (post.authorId !== me.id) {
    await createNotification({
      userId: post.authorId,
      type: 'hub_comment',
      actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
      entityUrl: `/${hub.user.username}/hub/${hub.slug}`,
      contextText: hub.title,
    })
  }
  return NextResponse.json({
    comment: { id: c.id, author: { id: c.author.id, name: c.author.name, username: c.author.username, avatar: c.author.avatar }, text: c.text, createdAt: c.createdAt.toISOString() },
  }, { status: 201 })
}

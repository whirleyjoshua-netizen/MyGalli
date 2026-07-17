import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate, postNotifyTargets, canViewCommunityHub } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
import { notifyHubMembers } from '@/lib/notifications'
import { normalizeSettings, resultsVisible, firstBlock, isBulletinBlockType, isEmptyPost } from '@/lib/bulletin'
import { aggregateBlock, toRecords } from '@/lib/element-aggregate'
import { summarizeReactions } from '@/lib/hub-reactions'
import type { Prisma } from '@prisma/client'

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, community: true, userId: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  // Draft (unpublished) community posts stay private — only owner + collaborators can read.
  // KEEP IN SYNC with the comments route GET.
  const isPrivileged = !!me && (me.id === hub.userId || (await collaboratorIds(id)).includes(me.id))
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const posts = await db.hubPost.findMany({
    where: { hubId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      author: { select: { id: true, name: true, username: true, avatar: true } },
      _count: { select: { comments: true } },
    },
  })

  // One query for every response on this page of posts, grouped in memory (avoids N+1).
  const postIds = posts.map((p) => p.id)
  const responseRows = postIds.length
    ? await db.hubPostResponse.findMany({
        where: { postId: { in: postIds } },
        select: { postId: true, userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
      })
    : []
  const byPost = new Map<string, typeof responseRows>()
  for (const r of responseRows) {
    const list = byPost.get(r.postId)
    if (list) list.push(r)
    else byPost.set(r.postId, [r])
  }

  const reactionRows = postIds.length
    ? await db.hubPostReaction.findMany({ where: { postId: { in: postIds } }, select: { postId: true, emoji: true, userId: true } })
    : []
  const reactionsByPost = new Map<string, { emoji: string; userId: string }[]>()
  for (const r of reactionRows) {
    const list = reactionsByPost.get(r.postId)
    if (list) list.push(r)
    else reactionsByPost.set(r.postId, [r])
  }

  const feed = posts.map((p) => {
    const block = firstBlock(p.blocks)
    const settings = normalizeSettings(p.settings)
    const rows = byPost.get(p.id) || []
    const mine = me ? rows.find((r) => r.userId === me.id) : undefined
    const canSee = resultsVisible({
      isAuthor: !!me && me.id === p.authorId,
      revealAfterAnswer: settings.revealAfterAnswer,
      hasResponded: !!mine,
    })
    return {
      id: p.id,
      author: p.author,
      text: p.text,
      imageUrl: p.imageUrl,
      block,
      settings,
      createdAt: p.createdAt.toISOString(),
      reactions: summarizeReactions(reactionsByPost.get(p.id) || [], me?.id),
      myResponse: (mine?.responses as Record<string, { type: string; answer: unknown }> | undefined) ?? null,
      results: block && canSee ? aggregateBlock(block, toRecords(rows, false)) : null,
      commentCount: p._count.comments,
    }
  })
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
  const block = body.block && typeof body.block === 'object' ? body.block : null
  if (block) {
    if (!isBulletinBlockType(block.type)) {
      return NextResponse.json({ error: 'Unsupported block type' }, { status: 400 })
    }
    if (typeof block.id !== 'string' || !block.id) {
      block.id = `blk-${me.id.slice(-4)}-${text ? text.length : 0}-${Math.round(1000 * block.type.length)}`
    }
  }
  if (isEmptyPost({ text, imageUrl, block })) {
    return NextResponse.json({ error: 'Empty post' }, { status: 400 })
  }
  const post = await db.hubPost.create({
    data: {
      hubId: id,
      authorId: me.id,
      text: text || null,
      imageUrl,
      blocks: block ? [block] : [],
      settings: normalizeSettings(body.settings) as unknown as Prisma.InputJsonValue,
    },
  })
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

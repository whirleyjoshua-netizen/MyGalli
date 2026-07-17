import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate } from '@/lib/community'
import { firstBlock } from '@/lib/bulletin'
import { rateLimit } from '@/lib/rate-limit'
import { aggregateBlock, toRecords } from '@/lib/element-aggregate'

interface Props {
  params: Promise<{ id: string; postId: string }>
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id, postId } = await params
    const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-post-respond' })
    if (limited) return limited

    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const responses = body.responses
    if (!responses || typeof responses !== 'object') {
      return NextResponse.json({ error: 'Missing responses' }, { status: 400 })
    }

    const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
    if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Scope the post to this hub so a valid id from another hub cannot be answered.
    const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { id: true, blocks: true } })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const collabIds = (await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })).map((r) => r.userId)
    const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
    if (!canParticipate(me.id, hub, collabIds, isMember)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.hubPostResponse.upsert({
      where: { postId_userId: { postId, userId: me.id } },
      create: { postId, userId: me.id, responses },
      update: { responses },
    })

    // Recompute results (the responder has now answered, so they may see them).
    const block = firstBlock(post.blocks)
    let results = null
    if (block) {
      const rows = await db.hubPostResponse.findMany({
        where: { postId },
        select: { userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
      })
      results = aggregateBlock(block, toRecords(rows, false))
    }

    return NextResponse.json({ results, myResponse: responses })
  } catch (error) {
    console.error('Hub post respond error:', error)
    return NextResponse.json({ error: 'Failed to respond' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isInScope, firstBlock } from '@/lib/bulletin'
import { aggregateBlock, toRecords } from '@/lib/element-aggregate'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const responses = body.responses
    if (!responses || typeof responses !== 'object') {
      return NextResponse.json({ error: 'Missing responses' }, { status: 400 })
    }

    const post = await db.bulletinPost.findUnique({
      where: { id },
      select: { authorId: true, blocks: true },
    })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const followingIds = (await db.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } })).map((f) => f.followingId)
    if (!isInScope(post.authorId, followingIds, me.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.bulletinResponse.upsert({
      where: { postId_userId: { postId: id, userId: me.id } },
      create: { postId: id, userId: me.id, responses },
      update: { responses },
    })

    // Recompute results (the responder has now answered, so they may see them).
    const block = firstBlock(post.blocks)
    let results = null
    if (block) {
      const rows = await db.bulletinResponse.findMany({
        where: { postId: id },
        select: { userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
      })
      results = aggregateBlock(block, toRecords(rows, false))
    }

    return NextResponse.json({ results, myResponse: responses })
  } catch (error) {
    console.error('Bulletin respond error:', error)
    return NextResponse.json({ error: 'Failed to respond' }, { status: 500 })
  }
}

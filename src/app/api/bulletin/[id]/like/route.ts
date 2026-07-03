import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isInScope } from '@/lib/bulletin'

interface Props {
  params: Promise<{ id: string }>
}

async function scopeCheck(request: NextRequest, postId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const post = await db.bulletinPost.findUnique({ where: { id: postId }, select: { authorId: true } })
  if (!post) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const followingIds = (await db.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } })).map((f) => f.followingId)
  if (!isInScope(post.authorId, followingIds, me.id)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { me }
}

async function likeState(postId: string, userId: string) {
  const [likeCount, mine] = await Promise.all([
    db.bulletinLike.count({ where: { postId } }),
    db.bulletinLike.findUnique({ where: { postId_userId: { postId, userId } }, select: { id: true } }),
  ])
  return { likeCount, likedByMe: !!mine }
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params
    const check = await scopeCheck(request, id)
    if (check.error) return check.error
    const me = check.me!
    await db.bulletinLike.upsert({
      where: { postId_userId: { postId: id, userId: me.id } },
      create: { postId: id, userId: me.id },
      update: {},
    })
    return NextResponse.json(await likeState(id, me.id))
  } catch (error) {
    console.error('Bulletin like error:', error)
    return NextResponse.json({ error: 'Failed to like' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params
    const check = await scopeCheck(request, id)
    if (check.error) return check.error
    const me = check.me!
    await db.bulletinLike.deleteMany({ where: { postId: id, userId: me.id } })
    return NextResponse.json(await likeState(id, me.id))
  } catch (error) {
    console.error('Bulletin unlike error:', error)
    return NextResponse.json({ error: 'Failed to unlike' }, { status: 500 })
  }
}

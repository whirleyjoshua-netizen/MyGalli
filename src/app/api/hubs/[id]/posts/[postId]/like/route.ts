import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

async function likeState(postId: string, userId: string) {
  const [likeCount, mine] = await Promise.all([
    db.hubPostLike.count({ where: { postId } }),
    db.hubPostLike.findUnique({ where: { postId_userId: { postId, userId } }, select: { id: true } }),
  ])
  return { likeCount, likedByMe: !!mine }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { id: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await db.hubPostLike.upsert({
    where: { postId_userId: { postId, userId: me.id } },
    create: { postId, userId: me.id },
    update: {},
  })
  return NextResponse.json(await likeState(postId, me.id))
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.hubPostLike.deleteMany({ where: { postId, userId: me.id } })
  return NextResponse.json(await likeState(postId, me.id))
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'

type Params = { params: Promise<{ id: string; postId: string; commentId: string }> }

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id, postId, commentId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const comment = await db.hubPostComment.findFirst({
    where: { id: commentId, postId, post: { hubId: id } },
    select: { authorId: true, post: { select: { hub: { select: { userId: true } } } } },
  })
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabs = await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })
  const canMod = canModerate(me.id, { userId: comment.post.hub.userId }, collabs.map((c) => c.userId))
  if (comment.authorId !== me.id && !canMod) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.hubPostComment.delete({ where: { id: commentId } })
  return NextResponse.json({ ok: true })
}

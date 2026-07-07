import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { authorId: true, hub: { select: { userId: true } } } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (post.authorId !== me.id && post.hub.userId !== me.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.hubPost.delete({ where: { id: postId } })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

interface Props {
  params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const post = await db.bulletinPost.findUnique({ where: { id }, select: { authorId: true } })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (post.authorId !== me.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await db.bulletinPost.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Bulletin delete error:', error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}

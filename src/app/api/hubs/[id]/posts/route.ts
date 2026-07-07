import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canPostToHub } from '@/lib/community'

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  const posts = await db.hubPost.findMany({
    where: { hubId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      author: { select: { id: true, name: true, username: true, avatar: true } },
      likes: { select: { userId: true } },
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
  }))
  return NextResponse.json({ posts: feed })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canPostToHub(me.id, hub, await collaboratorIds(id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 5000) : ''
  const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl ? body.imageUrl : null
  if (!text && !imageUrl) return NextResponse.json({ error: 'Empty post' }, { status: 400 })
  const post = await db.hubPost.create({ data: { hubId: id, authorId: me.id, text: text || null, imageUrl } })
  return NextResponse.json({ id: post.id }, { status: 201 })
}

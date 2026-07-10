import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isPro } from '@/lib/plan'
import { computePositions } from '@/lib/collections'

type Ctx = { params: Promise<{ id: string }> }

// Load the board and enforce: exists, is a collection, owned by `me`, `me` is Pro.
// Returns a NextResponse to short-circuit, or null when authorized.
async function guard(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), me: null }
  // if (!isPro(me)) return { res: NextResponse.json({ error: 'Pro required' }, { status: 403 }), me: null }
  const board = await db.display.findUnique({ where: { id }, select: { userId: true, kind: true } })
  if (!board || board.kind !== 'collection') return { res: NextResponse.json({ error: 'Not found' }, { status: 404 }), me: null }
  if (board.userId !== me.id) return { res: NextResponse.json({ error: 'Not your board' }, { status: 403 }), me: null }
  return { res: null, me }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { res } = await guard(request, id)
  if (res) return res
  const rows = await db.collectionMember.findMany({
    where: { collectionId: id },
    orderBy: { position: 'asc' },
    select: {
      memberId: true,
      position: true,
      member: { select: { published: true, slug: true, title: true, coverImage: true, user: { select: { username: true } } } },
    },
  })
  return NextResponse.json({
    isOwner: true,
    members: rows.map((r) => ({
      memberId: r.memberId,
      position: r.position,
      published: r.member.published,
      slug: r.member.slug,
      title: r.member.title,
      coverImage: r.member.coverImage,
      username: r.member.user.username,
    })),
  })
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { res, me } = await guard(request, id)
  if (res) return res
  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  // The member must be one of the owner's own regular pages.
  const member = await db.display.findUnique({ where: { id: memberId }, select: { userId: true, kind: true } })
  if (!member || member.userId !== me!.id || member.kind !== 'page') {
    return NextResponse.json({ error: 'You can only add your own pages' }, { status: 400 })
  }

  const count = await db.collectionMember.count({ where: { collectionId: id } })
  try {
    await db.collectionMember.create({ data: { collectionId: id, memberId, position: count } })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Already added' }, { status: 409 })
    }
    throw err
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { res } = await guard(request, id)
  if (res) return res
  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })
  await db.collectionMember.deleteMany({ where: { collectionId: id, memberId } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { res } = await guard(request, id)
  if (res) return res
  const { order } = await request.json()
  if (!Array.isArray(order)) return NextResponse.json({ error: 'order must be an array' }, { status: 400 })
  const updates = computePositions(order as string[])
  await db.$transaction(
    updates.map((u) =>
      db.collectionMember.updateMany({
        where: { collectionId: id, memberId: u.memberId },
        data: { position: u.position },
      })
    )
  )
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { computePositions } from '@/lib/collections'

type Ctx = { params: Promise<{ id: string }> }

// Load the board and enforce: exists, is a collection, owned by `me`.
// Returns a NextResponse to short-circuit, or null when authorized.
async function guard(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), me: null }
  // Scope the lookup to the caller so someone else's board is indistinguishable
  // from one that does not exist. Answering 403 "Not your board" for a real id
  // and 404 for a fake one told an unauthenticated-to-this-board caller which
  // board ids are real — including unpublished ones. Same rule the CRM routes
  // follow.
  const board = await db.display.findFirst({
    where: { id, userId: me.id, kind: 'collection' },
    select: { userId: true },
  })
  if (!board) return { res: NextResponse.json({ error: 'Not found' }, { status: 404 }), me: null }
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

  // Append after the current last position, not at count().
  //
  // count() is only equal to "next free slot" while positions are a gapless
  // 0..n-1 run, and a removal breaks that: drop the member at 0 and the
  // survivor keeps position 1 while count falls to 1, so the next add collides
  // with it. Two rows then share a position and `orderBy: position` puts them
  // in an arbitrary order — an explicit reorder heals it, but until then the
  // board can shuffle between renders.
  const last = await db.collectionMember.findFirst({
    where: { collectionId: id },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  const position = last ? last.position + 1 : 0
  try {
    await db.collectionMember.create({ data: { collectionId: id, memberId, position } })
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
